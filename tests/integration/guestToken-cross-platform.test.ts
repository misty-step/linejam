import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID, subtle } from 'crypto';

// Next.js implementation (signs tokens)
import { signGuestToken as nextSignGuestToken } from '@/lib/guestToken';

let convexVerifyGuestToken: (token: string) => Promise<string> = async () => {
  throw new Error('convexVerifyGuestToken not initialized');
};

function arrayBufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createTokenWithCustomTimestamp(
  guestId: string,
  issuedAt: number
): Promise<string> {
  const payload = {
    guestId,
    issuedAt,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const payloadB64 = arrayBufferToBase64Url(payloadBytes);

  const secret =
    process.env.GUEST_TOKEN_SECRET ||
    'test-secret-for-cross-platform-validation';
  const keyData = new TextEncoder().encode(secret);

  const key = await subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payloadBuffer = new TextEncoder().encode(payloadB64);
  const signature = await subtle.sign('HMAC', key, payloadBuffer);
  const signatureB64 = arrayBufferToBase64Url(signature);

  return `${payloadB64}.${signatureB64}`;
}

describe('Cross-platform Guest Token Compatibility', () => {
  beforeAll(async () => {
    // Ensure GUEST_TOKEN_SECRET is set for tests
    if (!process.env.GUEST_TOKEN_SECRET) {
      process.env.GUEST_TOKEN_SECRET =
        'test-secret-for-cross-platform-validation';
    }

    const mod = await import('../../convex/lib/guestToken');
    convexVerifyGuestToken = mod.verifyGuestToken;
  });

  describe('Cross-platform Signing and Verification', () => {
    it('token signed in Next.js verifies in Convex', async () => {
      const guestId = randomUUID();

      // Sign with Next.js implementation
      const token = await nextSignGuestToken(guestId);

      // Verify with Convex implementation
      const verifiedId = await convexVerifyGuestToken(token);

      expect(verifiedId).toBe(guestId);
    });
  });

  describe('Error Handling', () => {
    it('rejects invalid token format', async () => {
      await expect(convexVerifyGuestToken('invalid-token')).rejects.toThrow(
        'Invalid token format'
      );
    });

    it('rejects tampered payload', async () => {
      const token = await nextSignGuestToken(randomUUID());
      const [payload, signature] = token.split('.');

      // Tamper with payload
      const tamperedPayload = payload + 'x';
      const tamperedToken = `${tamperedPayload}.${signature}`;

      await expect(convexVerifyGuestToken(tamperedToken)).rejects.toThrow(
        'Token signature verification failed'
      );
    });

    it('rejects tampered signature', async () => {
      const token = await nextSignGuestToken(randomUUID());
      const [payload] = token.split('.');

      // Completely replace signature with garbage to ensure rejection
      const tamperedSignature = 'INVALID_SIGNATURE_AAAAAAAAAAAAAAAAAAAAAA';
      const tamperedToken = `${payload}.${tamperedSignature}`;

      await expect(convexVerifyGuestToken(tamperedToken)).rejects.toThrow(
        'Token signature verification failed'
      );
    });

    it('rejects expired tokens', async () => {
      const guestId = randomUUID();
      // 31 days ago (expiry is 30 days)
      const expiredToken = await createTokenWithCustomTimestamp(
        guestId,
        Date.now() - 31 * 24 * 60 * 60 * 1000
      );
      await expect(convexVerifyGuestToken(expiredToken)).rejects.toThrow(
        'Token expired'
      );
    });
  });
});
