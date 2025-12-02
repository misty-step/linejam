const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface GuestTokenPayload {
  guestId: string;
  issuedAt: number;
}

function getSecret(): string {
  const secret = process.env.GUEST_TOKEN_SECRET;
  if (!secret) {
    // Detect Convex production via CONVEX_CLOUD_URL
    const isProduction = process.env.CONVEX_CLOUD_URL?.includes('convex.cloud');

    if (isProduction) {
      throw new Error(
        'GUEST_TOKEN_SECRET must be set in Convex environment. ' +
          'Run: npx convex env set GUEST_TOKEN_SECRET "your-secret" production'
      );
    }

    console.warn(
      'GUEST_TOKEN_SECRET not set - using development default (INSECURE)'
    );
    return 'dev-only-insecure-secret-change-in-production';
  }
  return secret;
}

let keyPromise: Promise<CryptoKey> | null = null;

async function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const secret = getSecret();
    const keyData = new TextEncoder().encode(secret);

    keyPromise = crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }
  return keyPromise;
}

export async function verifyGuestToken(token: string): Promise<string> {
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }

  const [payloadB64, signatureB64] = parts;

  const key = await getKey();

  // Handle Base64Url to ArrayBuffer conversion
  const signatureBuffer = base64UrlToArrayBuffer(signatureB64);
  const payloadBuffer = new TextEncoder().encode(payloadB64);

  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBuffer as BufferSource,
    payloadBuffer as BufferSource
  );

  if (!isValid) {
    throw new Error('Token signature verification failed');
  }

  const payloadJson = base64UrlToString(payloadB64);
  const payload: GuestTokenPayload = JSON.parse(payloadJson);

  const age = Date.now() - payload.issuedAt;
  if (age > TOKEN_EXPIRY_MS) {
    throw new Error('Token expired');
  }

  return payload.guestId;
}

function base64UrlToArrayBuffer(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binString = atob(base64);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
      bytes[i] = binString.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new Error('Invalid base64url encoding');
  }
}

function base64UrlToString(base64Url: string): string {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}
