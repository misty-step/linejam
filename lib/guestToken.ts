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
    console.warn(
      'GUEST_TOKEN_SECRET not set - using development default (INSECURE)'
    );
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
    keyPromise = subtle.importKey(
      'raw',
      Buffer.from(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }
  return keyPromise;
}

/**
 * Sign a guest token payload with HMAC-SHA256
 */
export async function signGuestToken(guestId: string): Promise<string> {
  const payload: GuestTokenPayload = {
    guestId,
    issuedAt: Date.now(),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson).toString('base64url');

  const key = await getKey();
  const signature = await subtle.sign('HMAC', key, Buffer.from(payloadB64));
  const signatureB64 = Buffer.from(signature).toString('base64url');

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verify and parse a guest token
 * Returns guestId if valid, throws if invalid/expired/tampered
 */
export async function verifyGuestToken(token: string): Promise<string> {
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }

  const [payloadB64, signatureB64] = parts;

  // Verify signature
  const key = await getKey();
  const isValid = await subtle.verify(
    'HMAC',
    key,
    Buffer.from(signatureB64, 'base64url'),
    Buffer.from(payloadB64)
  );

  if (!isValid) {
    throw new Error('Token signature verification failed');
  }

  // Parse payload and check expiry
  const payloadJson = Buffer.from(payloadB64, 'base64url').toString();
  const payload: GuestTokenPayload = JSON.parse(payloadJson);

  // Check expiry (HMAC already guarantees payload integrity)
  const age = Date.now() - payload.issuedAt;
  if (age > TOKEN_EXPIRY_MS) {
    throw new Error('Token expired');
  }

  return payload.guestId;
}
