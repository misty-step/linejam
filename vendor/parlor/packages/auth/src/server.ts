import { Effect, Schema } from "effect";

import {
  DEFAULT_CLOCK_SKEW_MS,
  DEFAULT_TOKEN_LIFETIME_MS,
  GUEST_TOKEN_VERSION,
  GuestTokenClaimsSchema,
  GuestTokenError,
  MAX_AUDIENCE_LENGTH,
  MAX_IDENTIFIER_LENGTH,
  MAX_KEY_ID_LENGTH,
  MAX_SEGMENT_LENGTH,
  MAX_TOKEN_LENGTH,
  MAX_TOKEN_LIFETIME_MS,
  MIN_SECRET_BYTES,
  type GuestTokenErrorCode,
  type GuestTokenIssueInput,
  type GuestTokenRandomBytes,
  type GuestTokenVerifyOptions,
  type GuestTokenClaims,
  type IssuedGuestToken,
} from "./index.js";

const ID_RANDOM_BYTES = 16;
const SIGNATURE_BYTES = 32;
const CLAIM_KEYS = [
  "version",
  "audience",
  "guestId",
  "sessionId",
  "issuedAt",
  "expiresAt",
] as const;
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveLifetime(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_TOKEN_LIFETIME_MS
  );
}

function invalid(code: GuestTokenErrorCode): GuestTokenError {
  return new GuestTokenError({ code });
}

function defaultRandomBytes(length: number): Uint8Array {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi === undefined || typeof cryptoApi.getRandomValues !== "function") {
    throw invalid("crypto-failure");
  }
  const bytes = new Uint8Array(length);
  try {
    cryptoApi.getRandomValues(bytes);
  } catch {
    throw invalid("crypto-failure");
  }
  return bytes;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const encoded = btoa(binary);
  return encoded.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (
    value.length === 0 ||
    value.length > MAX_SEGMENT_LENGTH ||
    !BASE64URL_PATTERN.test(value) ||
    value.length % 4 === 1
  ) {
    throw invalid("malformed-token");
  }

  const padding = (4 - (value.length % 4)) % 4;
  const padded = `${value}${"=".repeat(padding)}`;
  let binary: string;
  try {
    binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  } catch {
    throw invalid("malformed-token");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  // Reject non-canonical encodings (including non-zero unused pad bits).
  if (encodeBase64Url(bytes) !== value) {
    throw invalid("malformed-token");
  }
  return bytes;
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function getCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;
  if (
    cryptoApi === undefined ||
    typeof cryptoApi.subtle?.importKey !== "function" ||
    typeof cryptoApi.subtle?.sign !== "function" ||
    typeof cryptoApi.subtle?.verify !== "function"
  ) {
    throw invalid("crypto-failure");
  }
  return cryptoApi;
}

async function importHmacKey(secret: Uint8Array, usage: "sign" | "verify"): Promise<CryptoKey> {
  const cryptoApi = getCrypto();
  try {
    return await cryptoApi.subtle.importKey(
      "raw",
      toArrayBuffer(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      [usage],
    );
  } catch {
    throw invalid("crypto-failure");
  }
}

async function generateId(randomBytes: GuestTokenRandomBytes): Promise<string> {
  let bytes: Uint8Array;
  try {
    bytes = await randomBytes(ID_RANDOM_BYTES);
  } catch (cause) {
    if (cause instanceof GuestTokenError) {
      throw cause;
    }
    throw invalid("crypto-failure");
  }
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== ID_RANDOM_BYTES) {
    throw invalid("invalid-config");
  }
  const id = encodeBase64Url(bytes);
  if (!isBoundedText(id, MAX_IDENTIFIER_LENGTH)) {
    throw invalid("invalid-config");
  }
  return id;
}

function validateClaimsShape(value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw invalid("invalid-claims");
  }
  const keys = Object.keys(value);
  if (
    keys.length !== CLAIM_KEYS.length ||
    CLAIM_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    throw invalid("invalid-claims");
  }
}

function decodeClaims(encoded: string): GuestTokenClaims {
  const bytes = decodeBase64Url(encoded);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw invalid("invalid-claims");
  }
  validateClaimsShape(value);
  try {
    return Schema.decodeUnknownSync(GuestTokenClaimsSchema)(value);
  } catch {
    throw invalid("invalid-claims");
  }
}

function validateIssueInput(input: GuestTokenIssueInput): void {
  if (!isRecord(input)) {
    throw invalid("invalid-config");
  }
  if (!isBoundedText(input.keyId, MAX_KEY_ID_LENGTH) || !KEY_ID_PATTERN.test(input.keyId)) {
    throw invalid("invalid-config");
  }
  if (!(input.secret instanceof Uint8Array) || input.secret.byteLength < MIN_SECRET_BYTES) {
    throw invalid("invalid-secret");
  }
  if (!isBoundedText(input.audience, MAX_AUDIENCE_LENGTH)) {
    throw invalid("invalid-config");
  }
  if (input.lifetimeMs !== undefined && !isPositiveLifetime(input.lifetimeMs)) {
    throw invalid("invalid-lifetime");
  }
  if (input.issuedAt !== undefined && !isTimestamp(input.issuedAt)) {
    throw invalid("invalid-config");
  }
  if (input.expiresAt !== undefined && !isTimestamp(input.expiresAt)) {
    throw invalid("invalid-lifetime");
  }
  if (input.now !== undefined && typeof input.now !== "function") {
    throw invalid("invalid-config");
  }
  if (input.randomBytes !== undefined && typeof input.randomBytes !== "function") {
    throw invalid("invalid-config");
  }
  if (input.generateId !== undefined && typeof input.generateId !== "function") {
    throw invalid("invalid-config");
  }
  if (input.guestId !== undefined && !isBoundedText(input.guestId, MAX_IDENTIFIER_LENGTH)) {
    throw invalid("invalid-config");
  }
  if (input.sessionId !== undefined && !isBoundedText(input.sessionId, MAX_IDENTIFIER_LENGTH)) {
    throw invalid("invalid-config");
  }
}

async function issueGuestTokenInternal(input: GuestTokenIssueInput): Promise<IssuedGuestToken> {
  validateIssueInput(input);

  let now: number;
  try {
    now = input.now === undefined ? Date.now() : input.now();
  } catch {
    throw invalid("invalid-config");
  }
  if (!isTimestamp(now)) {
    throw invalid("invalid-config");
  }

  const issuedAt = input.issuedAt ?? now;
  if (issuedAt - now > DEFAULT_CLOCK_SKEW_MS) {
    throw invalid("issued-in-future");
  }

  const lifetimeMs = input.lifetimeMs ?? DEFAULT_TOKEN_LIFETIME_MS;
  let expiresAt: number;
  if (input.expiresAt !== undefined) {
    expiresAt = input.expiresAt;
    if (input.lifetimeMs !== undefined && expiresAt - issuedAt !== input.lifetimeMs) {
      throw invalid("invalid-lifetime");
    }
  } else {
    expiresAt = issuedAt + lifetimeMs;
  }

  const lifetime = expiresAt - issuedAt;
  if (!isTimestamp(expiresAt) || !isPositiveLifetime(lifetime) || expiresAt <= now) {
    throw invalid("invalid-lifetime");
  }

  const randomBytes = input.randomBytes ?? defaultRandomBytes;
  let guestId = input.guestId;
  let sessionId = input.sessionId;
  if (input.generateId !== undefined) {
    if (guestId === undefined) {
      guestId = await input.generateId("guest");
    }
    if (sessionId === undefined) {
      sessionId = await input.generateId("session");
    }
  } else {
    if (guestId === undefined) {
      guestId = await generateId(randomBytes);
    }
    if (sessionId === undefined) {
      sessionId = await generateId(randomBytes);
    }
  }

  if (
    !isBoundedText(guestId, MAX_IDENTIFIER_LENGTH) ||
    !isBoundedText(sessionId, MAX_IDENTIFIER_LENGTH)
  ) {
    throw invalid("invalid-config");
  }

  const claimsCandidate = {
    version: GUEST_TOKEN_VERSION,
    audience: input.audience,
    guestId,
    sessionId,
    issuedAt,
    expiresAt,
  };
  let claims: GuestTokenClaims;
  try {
    claims = Schema.decodeUnknownSync(GuestTokenClaimsSchema)(claimsCandidate);
  } catch {
    throw invalid("invalid-config");
  }

  const encodedClaims = encodeBase64Url(textBytes(JSON.stringify(claims)));
  if (encodedClaims.length > MAX_SEGMENT_LENGTH) {
    throw invalid("invalid-config");
  }

  const signingInput = `v${GUEST_TOKEN_VERSION}.${input.keyId}.${encodedClaims}`;
  const key = await importHmacKey(input.secret, "sign");
  let signature: ArrayBuffer;
  try {
    signature = await getCrypto().subtle.sign(
      { name: "HMAC" },
      key,
      toArrayBuffer(textBytes(signingInput)),
    );
  } catch {
    throw invalid("crypto-failure");
  }
  const token = `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
  if (token.length > MAX_TOKEN_LENGTH) {
    throw invalid("invalid-config");
  }
  return { token, claims };
}

function validateVerifyOptions(options: GuestTokenVerifyOptions): void {
  if (!isRecord(options) || !isRecord(options.keyRing)) {
    throw invalid("invalid-config");
  }
  if (!isBoundedText(options.audience, MAX_AUDIENCE_LENGTH)) {
    throw invalid("invalid-config");
  }
  if (options.now !== undefined && typeof options.now !== "function") {
    throw invalid("invalid-config");
  }
  if (
    options.clockSkewMs !== undefined &&
    (!Number.isSafeInteger(options.clockSkewMs) ||
      options.clockSkewMs < 0 ||
      options.clockSkewMs > MAX_TOKEN_LIFETIME_MS)
  ) {
    throw invalid("invalid-config");
  }
  if (options.maxLifetimeMs !== undefined && !isPositiveLifetime(options.maxLifetimeMs)) {
    throw invalid("invalid-lifetime");
  }
  const keys = options.keyRing.keys;
  if (!isRecord(keys)) {
    throw invalid("invalid-config");
  }
  if (
    options.keyRing.activeKeyId !== undefined &&
    (!isBoundedText(options.keyRing.activeKeyId, MAX_KEY_ID_LENGTH) ||
      !KEY_ID_PATTERN.test(options.keyRing.activeKeyId))
  ) {
    throw invalid("invalid-config");
  }
}

async function verifyGuestTokenInternal(
  token: string,
  options: GuestTokenVerifyOptions,
): Promise<GuestTokenClaims> {
  validateVerifyOptions(options);
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    throw invalid("malformed-token");
  }

  const segments = token.split(".");
  if (segments.length !== 4) {
    throw invalid("malformed-token");
  }
  const version = segments[0];
  const keyId = segments[1];
  const encodedClaims = segments[2];
  const encodedSignature = segments[3];
  if (
    version === undefined ||
    keyId === undefined ||
    encodedClaims === undefined ||
    encodedSignature === undefined
  ) {
    throw invalid("malformed-token");
  }
  if (
    version !== `v${GUEST_TOKEN_VERSION}` ||
    !isBoundedText(keyId, MAX_KEY_ID_LENGTH) ||
    !KEY_ID_PATTERN.test(keyId) ||
    encodedClaims.length === 0 ||
    encodedClaims.length > MAX_SEGMENT_LENGTH ||
    encodedClaims.length % 4 === 1 ||
    encodedSignature.length === 0 ||
    encodedSignature.length > MAX_SEGMENT_LENGTH ||
    encodedSignature.length % 4 === 1 ||
    !BASE64URL_PATTERN.test(encodedClaims) ||
    !BASE64URL_PATTERN.test(encodedSignature)
  ) {
    if (version !== `v${GUEST_TOKEN_VERSION}`) {
      throw invalid("unsupported-version");
    }
    throw invalid("malformed-token");
  }

  const keys = options.keyRing.keys;
  if (!Object.prototype.hasOwnProperty.call(keys, keyId)) {
    throw invalid("unknown-key");
  }
  const secret = keys[keyId];
  if (!(secret instanceof Uint8Array) || secret.byteLength < MIN_SECRET_BYTES) {
    throw invalid("invalid-secret");
  }

  const signature = decodeBase64Url(encodedSignature);
  if (signature.byteLength !== SIGNATURE_BYTES) {
    throw invalid("malformed-token");
  }

  const key = await importHmacKey(secret, "verify");
  let verified: boolean;
  try {
    verified = await getCrypto().subtle.verify(
      { name: "HMAC" },
      key,
      toArrayBuffer(signature),
      toArrayBuffer(textBytes(`${version}.${keyId}.${encodedClaims}`)),
    );
  } catch {
    throw invalid("crypto-failure");
  }
  if (!verified) {
    throw invalid("invalid-signature");
  }

  // Do not decode or parse claims until after the signature has been checked.
  const claims = decodeClaims(encodedClaims);
  if (claims.audience !== options.audience) {
    throw invalid("wrong-audience");
  }

  let now: number;
  try {
    now = options.now === undefined ? Date.now() : options.now();
  } catch {
    throw invalid("invalid-config");
  }
  if (!isTimestamp(now)) {
    throw invalid("invalid-config");
  }
  const clockSkewMs = options.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  const maxLifetimeMs = options.maxLifetimeMs ?? MAX_TOKEN_LIFETIME_MS;
  if (claims.issuedAt - now > clockSkewMs) {
    throw invalid("issued-in-future");
  }
  if (claims.expiresAt <= now) {
    throw invalid("expired");
  }
  const lifetime = claims.expiresAt - claims.issuedAt;
  if (!isPositiveLifetime(lifetime) || lifetime > maxLifetimeMs) {
    throw invalid("invalid-lifetime");
  }
  return claims;
}

/**
 * Issue a signed guest token in a trusted runtime only.
 *
 * The implementation lives behind the explicit `@parlor/auth/server` export;
 * the package root intentionally has no signing or Web Crypto exports.
 */
export function issueGuestToken(
  input: GuestTokenIssueInput,
): Effect.Effect<IssuedGuestToken, GuestTokenError> {
  return Effect.tryPromise<IssuedGuestToken, GuestTokenError>({
    try: () => issueGuestTokenInternal(input),
    catch: (cause) =>
      cause instanceof GuestTokenError ? cause : new GuestTokenError({ code: "crypto-failure" }),
  });
}

/** Verify a guest token against every key currently retained for rotation. */
export function verifyGuestToken(
  token: string,
  options: GuestTokenVerifyOptions,
): Effect.Effect<GuestTokenClaims, GuestTokenError> {
  return Effect.tryPromise<GuestTokenClaims, GuestTokenError>({
    try: () => verifyGuestTokenInternal(token, options),
    catch: (cause) =>
      cause instanceof GuestTokenError ? cause : new GuestTokenError({ code: "crypto-failure" }),
  });
}
