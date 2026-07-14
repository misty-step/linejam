import { getServerGuestTokenSecret } from './env';

const subtle = globalThis.crypto.subtle;

export const GUEST_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const GUEST_TOKEN_MAX_AGE_SECONDS = GUEST_TOKEN_TTL_MS / 1000;

export interface GuestTokenPayload {
  guestId: string;
  issuedAt: number;
  sessionId?: string;
  rateLimitKey?: string;
}

/**
 * Cached HMAC key to avoid re-importing on every operation
 */
let keyPromise: Promise<CryptoKey> | null = null;

async function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const secret = getServerGuestTokenSecret();
    // Use TextEncoder for explicit cross-platform compatibility with Convex
    const keyData = new TextEncoder().encode(secret);

    keyPromise = subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }
  return keyPromise;
}

/**
 * Base64url encode (Web API compatible)
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64url decode to ArrayBuffer
 */
function base64UrlToArrayBuffer(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const binString = atob(base64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Base64url decode to string
 */
function base64UrlToString(base64Url: string): string {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

/**
 * Sign a guest token payload with HMAC-SHA256
 * Uses Web APIs for cross-platform compatibility with Convex
 */
export async function signGuestToken(
  guestId: string,
  options: { sessionId?: string; rateLimitKey?: string } = {}
): Promise<string> {
  const payload: GuestTokenPayload = {
    guestId,
    issuedAt: Date.now(),
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    ...(options.rateLimitKey ? { rateLimitKey: options.rateLimitKey } : {}),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const payloadB64 = arrayBufferToBase64Url(payloadBytes);

  const key = await getKey();
  const payloadBuffer = new TextEncoder().encode(payloadB64);
  const signature = await subtle.sign('HMAC', key, payloadBuffer);
  const signatureB64 = arrayBufferToBase64Url(signature);

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verify and parse a guest token
 * Returns guestId if valid, throws if invalid/expired/tampered
 * Uses Web APIs for cross-platform compatibility with Convex
 */
export async function verifyGuestToken(token: string): Promise<string> {
  const payload = await verifyGuestTokenPayload(token);
  return payload.guestId;
}

/**
 * Verify and parse a guest token payload.
 *
 * Callers that need launch-abuse metadata use this richer form; legacy callers
 * keep using verifyGuestToken() and receive only the stable guest id.
 */
export async function verifyGuestTokenPayload(
  token: string
): Promise<GuestTokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }

  const [payloadB64, signatureB64] = parts;

  // Verify signature
  const key = await getKey();
  const signatureBuffer = base64UrlToArrayBuffer(signatureB64);
  const payloadBuffer = new TextEncoder().encode(payloadB64);

  const isValid = await subtle.verify(
    'HMAC',
    key,
    signatureBuffer,
    payloadBuffer
  );

  if (!isValid) {
    throw new Error('Token signature verification failed');
  }

  // Parse payload and check expiry
  const payloadJson = base64UrlToString(payloadB64);
  const payload: GuestTokenPayload = JSON.parse(payloadJson);

  // Check expiry (HMAC already guarantees payload integrity)
  const age = Date.now() - payload.issuedAt;
  if (age > GUEST_TOKEN_TTL_MS) {
    throw new Error('Token expired');
  }

  return payload;
}
