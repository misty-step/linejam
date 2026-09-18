import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  GUEST_TOKEN_VERSION,
  GuestTokenError,
  MAX_SEGMENT_LENGTH,
  MAX_TOKEN_LENGTH,
  type GuestTokenClaims,
  type GuestTokenIssueInput,
  type GuestTokenVerifyOptions,
} from "../src/index.js";
import { issueGuestToken, verifyGuestToken } from "../src/server.js";

const secret = new Uint8Array(32).fill(0x41);
const rotatedSecret = new Uint8Array(32).fill(0x52);
const baseIssue: GuestTokenIssueInput = {
  keyId: "current",
  secret,
  audience: "playground",
  issuedAt: 1_000,
  lifetimeMs: 60_000,
  now: () => 1_000,
};

const ring = {
  keys: { current: secret, old: rotatedSecret },
  activeKeyId: "current",
} satisfies GuestTokenVerifyOptions["keyRing"];

function runIssue(input: GuestTokenIssueInput = baseIssue) {
  return issueGuestToken(input);
}

function runVerify(
  token: string,
  options: GuestTokenVerifyOptions = {
    keyRing: ring,
    audience: "playground",
    now: () => 1_000,
  },
) {
  return verifyGuestToken(token, options);
}

async function expectFailure(effect: Effect.Effect<unknown, GuestTokenError>) {
  const result = await Effect.runPromise(Effect.either(effect));
  expect(result._tag).toBe("Left");
  if (result._tag === "Left") {
    expect(result.left).toBeInstanceOf(GuestTokenError);
    return result.left;
  }
  throw new Error("expected failure");
}

function encodeBase64Url(value: string): string {
  const encoded = btoa(value);
  return encoded.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function signClaims(
  keyId: string,
  claims: unknown,
  signingSecret: Uint8Array,
): Promise<string> {
  const encodedClaims = encodeBase64Url(JSON.stringify(claims));
  const signingInput = `v${GUEST_TOKEN_VERSION}.${keyId}.${encodedClaims}`;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    signingSecret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "HMAC" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const encodedSignature = encodeBase64Url(String.fromCharCode(...new Uint8Array(signature)));
  return `${signingInput}.${encodedSignature}`;
}

describe("guest tokens", () => {
  it("round-trips claims and supports injected time and IDs", async () => {
    const issued = await Effect.runPromise(
      runIssue({
        ...baseIssue,
        generateId: (kind) => `${kind}-injected`,
      }),
    );
    expect(issued.claims).toMatchObject<Partial<GuestTokenClaims>>({
      guestId: "guest-injected",
      sessionId: "session-injected",
      issuedAt: 1_000,
      expiresAt: 61_000,
    });
    await expect(Effect.runPromise(runVerify(issued.token))).resolves.toEqual(issued.claims);
  });

  it("rejects tampered payloads and signatures", async () => {
    const { token } = await Effect.runPromise(runIssue());
    const segments = token.split(".");
    const payloadTampered = `${segments[0]}.${segments[1]}.${segments[2][0] === "A" ? "B" : "A"}${segments[2].slice(1)}.${segments[3]}`;
    const signatureTampered = `${segments.slice(0, 3).join(".")}.${segments[3][0] === "A" ? "B" : "A"}${segments[3].slice(1)}`;
    expect((await expectFailure(runVerify(payloadTampered))).code).toBe("invalid-signature");
    expect((await expectFailure(runVerify(signatureTampered))).code).toBe("invalid-signature");
  });

  it("rejects malformed and oversized tokens", async () => {
    const malformed = [
      "",
      "v1",
      "v1.current.not-base64.!!!!",
      "v2.current.AA.AA",
      "v1.current.AA.AA.extra",
    ];
    for (const token of malformed) {
      const failure = await expectFailure(runVerify(token));
      expect(["malformed-token", "unsupported-version"]).toContain(failure.code);
    }
    const oversizedSegment = `v1.current.${"A".repeat(MAX_SEGMENT_LENGTH + 1)}.AA`;
    expect((await expectFailure(runVerify(oversizedSegment))).code).toBe("malformed-token");
    const oversizedToken = `v1.current.${"A".repeat(MAX_TOKEN_LENGTH)}.AA`;
    expect((await expectFailure(runVerify(oversizedToken))).code).toBe("malformed-token");
  });

  it("rejects unknown keys and accepts rotated keys", async () => {
    const oldIssued = await Effect.runPromise(
      runIssue({ ...baseIssue, keyId: "old", secret: rotatedSecret }),
    );
    await expect(Effect.runPromise(runVerify(oldIssued.token))).resolves.toEqual(oldIssued.claims);
    const unknownKeyToken = oldIssued.token.replace(".old.", ".retired.");
    expect((await expectFailure(runVerify(unknownKeyToken))).code).toBe("unknown-key");
  });

  it("rejects wrong audience, expiry, and future issue times", async () => {
    const issued = await Effect.runPromise(runIssue());
    expect(
      (await expectFailure(runVerify(issued.token, { ...ringOptions(), audience: "other" }))).code,
    ).toBe("wrong-audience");
    expect(
      (await expectFailure(runVerify(issued.token, { ...ringOptions(), now: () => 61_000 }))).code,
    ).toBe("expired");

    const future = await Effect.runPromise(
      runIssue({
        ...baseIssue,
        issuedAt: 60_000,
        now: () => 60_000,
      }),
    );
    expect(
      (await expectFailure(runVerify(future.token, { ...ringOptions(), now: () => 0 }))).code,
    ).toBe("issued-in-future");
  });

  it("rejects invalid secrets and nonpositive lifetimes", async () => {
    const invalidSecret = new Uint8Array(31);
    expect((await expectFailure(runIssue({ ...baseIssue, secret: invalidSecret }))).code).toBe(
      "invalid-secret",
    );
    expect((await expectFailure(runIssue({ ...baseIssue, lifetimeMs: 0 }))).code).toBe(
      "invalid-lifetime",
    );
  });

  it("rejects hostile claim shapes after signature verification", async () => {
    const hostile = await signClaims(
      "current",
      {
        version: 1,
        audience: "playground",
        guestId: [],
        sessionId: "session-1",
        issuedAt: 1_000,
        expiresAt: 61_000,
      },
      secret,
    );
    expect((await expectFailure(runVerify(hostile))).code).toBe("invalid-claims");

    const extraField = await signClaims(
      "current",
      {
        version: 1,
        audience: "playground",
        guestId: "guest-1",
        sessionId: "session-1",
        issuedAt: 1_000,
        expiresAt: 61_000,
        ["__proto__"]: { polluted: true },
      },
      secret,
    );
    expect((await expectFailure(runVerify(extraField))).code).toBe("invalid-claims");
  });
});

function ringOptions() {
  return { keyRing: ring, audience: "playground", now: () => 1_000 } as const;
}
