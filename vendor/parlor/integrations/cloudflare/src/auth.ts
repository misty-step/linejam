import type { JSONValue } from "convex/values";
import type { UserIdentity } from "./runtime.js";

/** Convex `auth.config.ts` provider entries supported by this runtime. */
export type AuthProvider =
  | { readonly domain: string; readonly applicationID: string; readonly type?: undefined }
  | {
      readonly type: "customJwt";
      readonly issuer: string;
      readonly jwks: string;
      readonly algorithm: "RS256" | "ES256";
      readonly applicationID?: string;
    };

export interface AuthConfig {
  readonly providers: readonly AuthProvider[];
}

export interface VerifiedToken {
  readonly identity: UserIdentity;
  /** Epoch milliseconds after which the identity must be refreshed. */
  readonly expiresAt: number;
}

export class AuthenticationError extends Error {
  override readonly name = "AuthenticationError";
}

interface Jwk {
  readonly kid?: string;
  readonly kty: string;
  readonly alg?: string;
  readonly [key: string]: unknown;
}

const REGISTERED_CLAIMS = new Set([
  "iss",
  "sub",
  "aud",
  "exp",
  "nbf",
  "iat",
  "jti",
  "azp",
  "sid",
  "nonce",
]);
const CLAIM_NAMES: Readonly<Record<string, string>> = {
  name: "name",
  given_name: "givenName",
  family_name: "familyName",
  nickname: "nickname",
  preferred_username: "preferredUsername",
  profile: "profileUrl",
  picture: "pictureUrl",
  email: "email",
  email_verified: "emailVerified",
  gender: "gender",
  birthdate: "birthday",
  zoneinfo: "timezone",
  locale: "language",
  phone_number: "phoneNumber",
  phone_number_verified: "phoneNumberVerified",
  address: "address",
  updated_at: "updatedAt",
};
const KEY_CACHE_MS = 10 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 5;

function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
  const padded = text
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character: string) => character.charCodeAt(0));
}

function decodeSegment(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlDecode(text)));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AuthenticationError("Malformed token");
  }
  return parsed as Record<string, unknown>;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function audienceIncludes(audience: unknown, expected: string): boolean {
  return Array.isArray(audience) ? audience.includes(expected) : audience === expected;
}

/** Map verified JWT claims to the identity Convex functions observe. */
export function identityFromClaims(claims: Readonly<Record<string, unknown>>): UserIdentity {
  const issuer = claims["iss"];
  const subject = claims["sub"];
  if (typeof issuer !== "string" || typeof subject !== "string") {
    throw new AuthenticationError("Token is missing iss or sub");
  }
  const identity: Record<string, JSONValue> = {
    tokenIdentifier: `${issuer}|${subject}`,
    subject,
    issuer,
  };
  for (const [claim, value] of Object.entries(claims)) {
    if (REGISTERED_CLAIMS.has(claim) || value === undefined) continue;
    const name = CLAIM_NAMES[claim] ?? claim;
    if (Object.hasOwn(identity, name)) continue;
    if (claim === "updated_at" && typeof value === "number") {
      identity[name] = new Date(value * 1000).toISOString();
    } else if (claim === "address" && typeof value === "object") {
      identity[name] = JSON.stringify(value);
    } else {
      identity[name] = value as JSONValue;
    }
  }
  return identity as UserIdentity;
}

/** Verifies OIDC and custom JWTs against `auth.config.ts` providers. */
export class TokenVerifier {
  private readonly keys = new Map<string, { fetchedAt: number; keys: readonly Jwk[] }>();

  constructor(
    private readonly config: AuthConfig,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  get enabled(): boolean {
    return this.config.providers.length > 0;
  }

  async verify(token: string, now = Date.now()): Promise<VerifiedToken> {
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
      throw new AuthenticationError("Could not parse JWT payload");
    }
    const [headerText, payloadText, signatureText] = parts as [string, string, string];
    const header = decodeSegment(headerText);
    const claims = decodeSegment(payloadText);
    const issuer = typeof claims["iss"] === "string" ? trimSlash(claims["iss"]) : "";
    const provider = this.config.providers.find((candidate) =>
      candidate.type === "customJwt"
        ? trimSlash(candidate.issuer) === issuer &&
          (candidate.applicationID === undefined ||
            audienceIncludes(claims["aud"], candidate.applicationID))
        : trimSlash(candidate.domain) === issuer &&
          audienceIncludes(claims["aud"], candidate.applicationID),
    );
    if (provider === undefined) {
      throw new AuthenticationError(
        `No auth provider found matching the given token (issuer ${issuer || "missing"}). Check your auth.config.ts.`,
      );
    }
    const algorithm = header["alg"];
    const expectedAlgorithm = provider.type === "customJwt" ? provider.algorithm : "RS256";
    if (algorithm !== expectedAlgorithm)
      throw new AuthenticationError(`Unsupported token algorithm ${String(algorithm)}`);
    const nowSeconds = now / 1000;
    // Every accepted identity expires: `exp` must be a finite number, and
    // the other registered times, when present, must be too.
    const exp = claims["exp"];
    if (typeof exp !== "number" || !Number.isFinite(exp)) {
      throw new AuthenticationError("Token has no valid expiration time (exp)");
    }
    for (const claim of ["nbf", "iat"]) {
      const value = claims[claim];
      if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
        throw new AuthenticationError(`Token has an invalid ${claim} claim`);
      }
    }
    const nbf = claims["nbf"];
    if (exp + CLOCK_SKEW_SECONDS < nowSeconds) {
      throw new AuthenticationError("Token expired");
    }
    if (typeof nbf === "number" && nbf - CLOCK_SKEW_SECONDS > nowSeconds) {
      throw new AuthenticationError("Token is not yet valid");
    }
    const kid = typeof header["kid"] === "string" ? header["kid"] : undefined;
    const jwk = await this.findKey(provider, kid, now);
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk as JsonWebKey,
      expectedAlgorithm === "RS256"
        ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
        : { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      expectedAlgorithm === "RS256"
        ? { name: "RSASSA-PKCS1-v1_5" }
        : { name: "ECDSA", hash: "SHA-256" },
      key,
      base64UrlDecode(signatureText),
      new TextEncoder().encode(`${headerText}.${payloadText}`),
    );
    if (!valid) throw new AuthenticationError("Token signature is invalid");
    return { identity: identityFromClaims(claims), expiresAt: exp * 1000 };
  }

  private async jwksUrl(provider: AuthProvider): Promise<string> {
    if (provider.type === "customJwt") return provider.jwks;
    const response = await this.fetcher(
      `${trimSlash(provider.domain)}/.well-known/openid-configuration`,
    );
    if (!response.ok) throw new AuthenticationError(`OIDC discovery failed (${response.status})`);
    const configuration = (await response.json()) as { jwks_uri?: unknown };
    if (typeof configuration.jwks_uri !== "string")
      throw new AuthenticationError("OIDC discovery has no jwks_uri");
    return configuration.jwks_uri;
  }

  private async findKey(
    provider: AuthProvider,
    kid: string | undefined,
    now: number,
  ): Promise<Jwk> {
    const cacheKey = provider.type === "customJwt" ? provider.jwks : provider.domain;
    const pick = (keys: readonly Jwk[]) =>
      keys.find((candidate) => (kid === undefined ? true : candidate.kid === kid));
    const cached = this.keys.get(cacheKey);
    if (cached !== undefined && now - cached.fetchedAt < KEY_CACHE_MS) {
      const found = pick(cached.keys);
      if (found !== undefined) return found;
      // Unknown key ID: allow one refresh per minute for key rotation.
      if (now - cached.fetchedAt < 60_000)
        throw new AuthenticationError("Token signing key not found");
    }
    const response = await this.fetcher(await this.jwksUrl(provider));
    if (!response.ok) throw new AuthenticationError(`JWKS fetch failed (${response.status})`);
    const body = (await response.json()) as { keys?: unknown };
    const keys = Array.isArray(body.keys) ? (body.keys as Jwk[]) : [];
    this.keys.set(cacheKey, { fetchedAt: now, keys });
    const found = pick(keys);
    if (found === undefined) throw new AuthenticationError("Token signing key not found");
    return found;
  }
}
