import { Data, Schema } from "effect";

/** The only token version currently accepted by Parlor. */
export const GUEST_TOKEN_VERSION = 1 as const;

/** Minimum HMAC secret size. */
export const MIN_SECRET_BYTES = 32;

/** Maximum encoded token size. Token segments are ASCII, so this is also a byte limit. */
export const MAX_TOKEN_LENGTH = 4096;

/** Maximum encoded size for any individual token segment. */
export const MAX_SEGMENT_LENGTH = 2048;

/** Maximum key identifier size. */
export const MAX_KEY_ID_LENGTH = 64;

/** Maximum audience size. */
export const MAX_AUDIENCE_LENGTH = 128;

/** Maximum guest or session identifier size. */
export const MAX_IDENTIFIER_LENGTH = 128;

/** Default amount of clock skew allowed for an issued-at claim. */
export const DEFAULT_CLOCK_SKEW_MS = 30_000;

/** Default token lifetime used by the issuer. */
export const DEFAULT_TOKEN_LIFETIME_MS = 15 * 60_000;

/** Absolute lifetime ceiling accepted by both issuer and verifier. */
export const MAX_TOKEN_LIFETIME_MS = 24 * 60 * 60_000;

const boundedString = (maximum: number) =>
  Schema.String.pipe(Schema.filter((value) => value.length > 0 && value.length <= maximum));

const timestamp = Schema.Number.pipe(
  Schema.filter((value) => Number.isSafeInteger(value) && value >= 0),
);

/** Schema for the signed claims carried in a guest token. */
export const GuestTokenClaimsSchema = Schema.Struct({
  version: Schema.Literal(GUEST_TOKEN_VERSION),
  audience: boundedString(MAX_AUDIENCE_LENGTH),
  guestId: boundedString(MAX_IDENTIFIER_LENGTH),
  sessionId: boundedString(MAX_IDENTIFIER_LENGTH),
  issuedAt: timestamp,
  expiresAt: timestamp,
});

export type GuestTokenClaims = Schema.Schema.Type<typeof GuestTokenClaimsSchema>;

export interface GuestTokenKey {
  readonly keyId: string;
  readonly secret: Uint8Array;
}

/**
 * Verification keys indexed by the key identifier present in a token.
 *
 * `activeKeyId` is metadata for callers that also issue tokens. Verification
 * deliberately accepts every key in `keys`, which permits key rotation.
 */
export interface GuestTokenKeyRing {
  readonly keys: Readonly<Record<string, Uint8Array>>;
  readonly activeKeyId?: string;
}

export type GuestTokenIdKind = "guest" | "session";

export type GuestTokenRandomBytes = (length: number) => Uint8Array | Promise<Uint8Array>;

export type GuestTokenIdGenerator = (kind: GuestTokenIdKind) => string | Promise<string>;

export interface GuestTokenIssueInput {
  readonly keyId: string;
  readonly secret: Uint8Array;
  readonly audience: string;
  readonly lifetimeMs?: number;
  readonly issuedAt?: number;
  readonly expiresAt?: number;
  readonly guestId?: string;
  readonly sessionId?: string;
  readonly now?: () => number;
  readonly randomBytes?: GuestTokenRandomBytes;
  readonly generateId?: GuestTokenIdGenerator;
}

export interface GuestTokenVerifyOptions {
  readonly keyRing: GuestTokenKeyRing;
  readonly audience: string;
  readonly now?: () => number;
  readonly clockSkewMs?: number;
  readonly maxLifetimeMs?: number;
}

export interface IssuedGuestToken {
  readonly token: string;
  readonly claims: GuestTokenClaims;
}

export type GuestTokenErrorCode =
  | "invalid-config"
  | "invalid-secret"
  | "invalid-lifetime"
  | "unsupported-version"
  | "malformed-token"
  | "unknown-key"
  | "invalid-signature"
  | "invalid-claims"
  | "wrong-audience"
  | "expired"
  | "issued-in-future"
  | "crypto-failure";

/**
 * Safe, tagged failure for all guest-token operations.
 *
 * Deliberately contains only a stable code. It never carries a token, secret,
 * crypto-library exception, or claim value.
 */
export class GuestTokenError extends Data.TaggedError("GuestTokenError")<{
  readonly code: GuestTokenErrorCode;
}> {}
