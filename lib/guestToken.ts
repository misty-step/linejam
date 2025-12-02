import { subtle } from 'crypto';

const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface GuestTokenPayload {
  guestId: string;
  issuedAt: number;
}

/**
 * Get HMAC secret from environment
 * Falls back to development-only default if not set (warns in production)
 */
function getSecret(): string {
  const secret = process.env.GUEST_TOKEN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'GUEST_TOKEN_SECRET must be set in production environment'
      );
    }
    return 'dev-only-insecure-secret-change-in-production';
  }
  return secret;
}

/**
 * Cached HMAC key to avoid re-importing on every operation
 */
let keyPromise: Promise<CryptoKey> | null = null;

async function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const secret = getSecret();
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
function base64UrlToArrayBuffer(base64Url: string): Uint8Array {
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
export async function signGuestToken(guestId: string): Promise<string> {
  const payload: GuestTokenPayload = {
    guestId,
    issuedAt: Date.now(),
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
    signatureBuffer as BufferSource,
    payloadBuffer as BufferSource
  );

  if (!isValid) {
    throw new Error('Token signature verification failed');
  }

  // Parse payload and check expiry
  const payloadJson = base64UrlToString(payloadB64);
  const payload: GuestTokenPayload = JSON.parse(payloadJson);

  // Check expiry (HMAC already guarantees payload integrity)
  const age = Date.now() - payload.issuedAt;
  if (age > TOKEN_EXPIRY_MS) {
    throw new Error('Token expired');
  }

  return payload.guestId;
}
