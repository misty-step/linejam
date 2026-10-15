import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, it } from "vitest";
import { AuthenticationError, SyncSession, TokenVerifier, type Runtime } from "../src/index.js";
import { newRuntime } from "./helpers.js";

const ISSUER = "https://clerk.example.test";
const AUDIENCE = "convex";

function base64Url(bytes: Uint8Array | string): string {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return Buffer.from(data).toString("base64url");
}

async function issuer() {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", keys.publicKey)),
    kid: "k1",
    alg: "RS256",
    use: "sig",
  };
  const fetcher: typeof fetch = async (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url === `${ISSUER}/.well-known/openid-configuration`)
      return Response.json({ jwks_uri: `${ISSUER}/jwks` });
    if (url === `${ISSUER}/jwks`) return Response.json({ keys: [jwk] });
    return new Response("not found", { status: 404 });
  };
  const sign = async (claims: Record<string, unknown>) => {
    const header = base64Url(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }));
    const payload = base64Url(JSON.stringify(claims));
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keys.privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    );
    return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
  };
  const verifier = new TokenVerifier(
    { providers: [{ domain: ISSUER, applicationID: AUDIENCE }] },
    fetcher,
  );
  return { sign, verifier };
}

const now = () => Math.floor(Date.now() / 1000);

describe("TokenVerifier", () => {
  it("accepts a signed OIDC token and maps Convex identity fields", async () => {
    const { sign, verifier } = await issuer();
    const token = await sign({
      iss: ISSUER,
      sub: "user_1",
      aud: AUDIENCE,
      exp: now() + 60,
      email: "p@example.test",
    });
    const { identity } = await verifier.verify(token);
    expect(identity).toMatchObject({
      tokenIdentifier: `${ISSUER}|user_1`,
      subject: "user_1",
      issuer: ISSUER,
      email: "p@example.test",
    });
  });

  it("rejects wrong audience, expiry and tampering", async () => {
    const { sign, verifier } = await issuer();
    await expect(
      verifier.verify(await sign({ iss: ISSUER, sub: "u", aud: "other", exp: now() + 60 })),
    ).rejects.toBeInstanceOf(AuthenticationError);
    await expect(
      verifier.verify(await sign({ iss: ISSUER, sub: "u", aud: AUDIENCE, exp: now() - 60 })),
    ).rejects.toThrow("expired");
    const token = await sign({ iss: ISSUER, sub: "u", aud: AUDIENCE, exp: now() + 60 });
    const [header, , signature] = token.split(".");
    const forged = `${header}.${base64Url(JSON.stringify({ iss: ISSUER, sub: "admin", aud: AUDIENCE, exp: now() + 60 }))}.${signature}`;
    await expect(verifier.verify(forged)).rejects.toThrow("signature");
  });
});

/** In-process WebSocket that speaks to a SyncSession, as a Worker socket would. */
function socketFactory(runtime: Runtime, verifier: TokenVerifier | null, sockets: FakeSocket[]) {
  return class extends FakeSocket {
    constructor(url: string) {
      super(url, runtime, verifier);
      sockets.push(this);
    }
  };
}

class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly session: SyncSession;
  readonly url: string;

  constructor(url: string, runtime: Runtime, verifier: TokenVerifier | null) {
    this.url = url;
    this.session = new SyncSession(runtime, verifier, {
      send: (message) =>
        setTimeout(() => this.readyState === 1 && this.onmessage?.({ data: message })),
      close: (code, reason) => this.drop(code ?? 1000, reason ?? ""),
    });
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.({});
    });
  }

  send(data: string) {
    this.session.receive(data);
  }

  close(code = 1000, reason = "") {
    this.drop(code, reason);
  }

  /** Simulate a network drop or server close. */
  drop(code = 1006, reason = "") {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.session.close();
    setTimeout(() => this.onclose?.({ code, reason, wasClean: code === 1000 }));
  }
}

function nextValue<T>(
  client: ConvexClient,
  reference: unknown,
  args: Record<string, unknown>,
  accept: (value: T) => boolean,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("timed out waiting for subscription value")),
      5000,
    );
    const unsubscribe = client.onUpdate(reference as never, args as never, (value: unknown) => {
      if (accept(value as T)) {
        clearTimeout(timer);
        unsubscribe();
        resolve(value as T);
      }
    });
  });
}

const clients: ConvexClient[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

function connect(runtime: Runtime, verifier: TokenVerifier | null, sockets: FakeSocket[] = []) {
  const created = new ConvexClient("https://backend.example.test/backend", {
    webSocketConstructor: socketFactory(runtime, verifier, sockets) as unknown as typeof WebSocket,
    unsavedChangesWarning: false,
  });
  clients.push(created);
  return created;
}

describe("Convex client protocol", () => {
  it("delivers live query updates and ConvexError data to the real ConvexClient", async () => {
    const runtime = newRuntime();
    const writer = connect(runtime, null);
    const reader = connect(runtime, null);
    const roomId = await writer.mutation(anyApi["rooms"]!["create"]!, { code: "LIVE" });
    const empty = nextValue<string[]>(
      reader,
      anyApi["messages"]!["list"],
      { roomId },
      (value) => value.length === 0,
    );
    expect(await empty).toEqual([]);
    const updated = nextValue<string[]>(
      reader,
      anyApi["messages"]!["list"],
      { roomId },
      (value) => value.length === 1,
    );
    await writer.mutation(anyApi["messages"]!["send"]!, { roomId, body: "hi" });
    expect(await updated).toEqual(["hi"]);

    const failure = await writer
      .mutation(anyApi["rooms"]!["createThenFail"]!, { code: "X" })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConvexError);
    expect((failure as ConvexError<{ kind: string }>).data).toEqual({ kind: "Nope", code: "X" });
  });

  it("authenticates with a JWT and attributes writes to its subject", async () => {
    const runtime = newRuntime();
    const { sign, verifier } = await issuer();
    const authed = connect(runtime, verifier);
    authed.setAuth(async () =>
      sign({ iss: ISSUER, sub: "user_9", aud: AUDIENCE, exp: now() + 600 }),
    );
    const roomId = await authed.mutation(anyApi["rooms"]!["create"]!, { code: "AUTH" });
    await authed.mutation(anyApi["messages"]!["send"]!, { roomId, body: "signed" });
    const authors = runtime.store.driver
      .exec("SELECT json FROM cvx_documents WHERE table_name = 'messages'")
      .map((row) => (JSON.parse(String(row["json"])) as { author?: string }).author);
    expect(authors).toEqual(["user_9"]);
  });

  it("resubscribes after a dropped connection and sees writes made meanwhile", async () => {
    const runtime = newRuntime();
    const sockets: FakeSocket[] = [];
    const reader = connect(runtime, null, sockets);
    const roomId = await reader.mutation(anyApi["rooms"]!["create"]!, { code: "DROP" });
    await nextValue<string[]>(reader, anyApi["messages"]!["list"], { roomId }, () => true);
    sockets.at(-1)!.drop();
    await runtime.mutation("messages:send", { roomId, body: "while offline" }, null);
    const recovered = await nextValue<string[]>(
      reader,
      anyApi["messages"]!["list"],
      { roomId },
      (value) => value.length === 1,
    );
    expect(recovered).toEqual(["while offline"]);
    expect(sockets.length).toBeGreaterThan(1);
  });
});
