const THROTTLE_PROOF_CONTEXT = 'linejam:guest-session-throttle:v1:';
const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export async function signGuestSessionThrottleProof(
  key: string,
  secret: string
) {
  const cryptoKey = await importHmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(`${THROTTLE_PROOF_CONTEXT}${key}`)
  );

  return arrayBufferToBase64Url(signature);
}

export async function verifyGuestSessionThrottleProof(
  key: string,
  proof: string,
  secret: string
) {
  if (!SHA256_BASE64URL_PATTERN.test(proof)) return false;

  try {
    const cryptoKey = await importHmacKey(secret, ['verify']);
    return await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      base64UrlToArrayBuffer(proof),
      new TextEncoder().encode(`${THROTTLE_PROOF_CONTEXT}${key}`)
    );
  } catch {
    return false;
  }
}

async function importHmacKey(secret: string, usages: KeyUsage[]) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlToArrayBuffer(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
