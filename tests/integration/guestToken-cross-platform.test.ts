import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'crypto';

// Next.js implementation (signs tokens)
import {
  signGuestToken as nextSignGuestToken,
  verifyGuestToken as nextVerifyGuestToken,
} from '@/lib/guestToken';

// Convex implementation (verifies tokens)
import { verifyGuestToken as convexVerifyGuestToken } from '../../convex/lib/guestToken';

describe('Cross-platform Guest Token Compatibility', () => {
  beforeAll(() => {
    // Ensure GUEST_TOKEN_SECRET is set for tests
    if (!process.env.GUEST_TOKEN_SECRET) {
      process.env.GUEST_TOKEN_SECRET =
        'test-secret-for-cross-platform-validation';
    }
  });

  describe('Encoding Compatibility', () => {
    it('TextEncoder and Buffer.from produce identical UTF-8 bytes for ASCII strings', () => {
      const testString = 'test-secret-123';
      const encoderBytes = new TextEncoder().encode(testString);
      const bufferBytes = Buffer.from(testString);

      expect(Array.from(encoderBytes)).toEqual(Array.from(bufferBytes));
    });

    it('TextEncoder and Buffer.from produce identical UTF-8 bytes for base64 secrets', () => {
      const base64Secret = 'UlOjzXHtVNu6baGB8/7Bot1qLehLaTBRio5rVZ0DvA8=';
      const encoderBytes = new TextEncoder().encode(base64Secret);
      const bufferBytes = Buffer.from(base64Secret);

      expect(Array.from(encoderBytes)).toEqual(Array.from(bufferBytes));
    });

    it('TextEncoder and Buffer.from produce identical UTF-8 bytes for special characters', () => {
      const specialChars = 'test+secret/with=chars_123-ABC';
      const encoderBytes = new TextEncoder().encode(specialChars);
      const bufferBytes = Buffer.from(specialChars);

      expect(Array.from(encoderBytes)).toEqual(Array.from(bufferBytes));
    });
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

    it('token signed in Next.js verifies in Next.js', async () => {
      const guestId = randomUUID();

      // Sign and verify with Next.js implementation
      const token = await nextSignGuestToken(guestId);
      const verifiedId = await nextVerifyGuestToken(token);

      expect(verifiedId).toBe(guestId);
    });

    it('multiple tokens with different guestIds verify correctly', async () => {
      const guestIds = [randomUUID(), randomUUID(), randomUUID()];

      for (const guestId of guestIds) {
        const token = await nextSignGuestToken(guestId);
        const nextVerified = await nextVerifyGuestToken(token);
        const convexVerified = await convexVerifyGuestToken(token);

        expect(nextVerified).toBe(guestId);
        expect(convexVerified).toBe(guestId);
      }
    });

    it('tokens signed at different times verify correctly', async () => {
      const guestId = randomUUID();

      const token1 = await nextSignGuestToken(guestId);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms
      const token2 = await nextSignGuestToken(guestId);

      // Different tokens (different issuedAt timestamps)
      expect(token1).not.toBe(token2);

      // Both verify to same guestId
      expect(await convexVerifyGuestToken(token1)).toBe(guestId);
      expect(await convexVerifyGuestToken(token2)).toBe(guestId);
    });
  });

  describe('Token Format and Structure', () => {
    it('tokens have the expected format (payload.signature)', async () => {
      const token = await nextSignGuestToken(randomUUID());

      const parts = token.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBeTruthy(); // payload
      expect(parts[1]).toBeTruthy(); // signature
    });

    it('payload contains guestId and issuedAt', async () => {
      const guestId = randomUUID();
      const token = await nextSignGuestToken(guestId);

      const [payloadB64] = token.split('.');
      const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = atob(base64);
      const payload = JSON.parse(payloadJson);

      expect(payload.guestId).toBe(guestId);
      expect(payload.issuedAt).toBeTypeOf('number');
      expect(payload.issuedAt).toBeLessThanOrEqual(Date.now());
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
      const [payload, signature] = token.split('.');

      // Tamper with signature
      const tamperedSignature = signature.slice(0, -1) + 'x';
      const tamperedToken = `${payload}.${tamperedSignature}`;

      await expect(convexVerifyGuestToken(tamperedToken)).rejects.toThrow(
        'Token signature verification failed'
      );
    });

    it.skip('rejects expired tokens', async () => {
      // TODO: Implement test helper to create tokens with custom issuedAt timestamp
      // const guestId = randomUUID();
      // const expiredToken = await createTokenWithCustomTimestamp(
      //   guestId,
      //   Date.now() - 31 * 24 * 60 * 60 * 1000
      // );
      // await expect(convexVerifyGuestToken(expiredToken)).rejects.toThrow('Token expired');
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Backward Compatibility', () => {
    it.skip('verifies tokens created with old Buffer-based implementation', async () => {
      // This test ensures we maintain backward compatibility
      // If you have any existing tokens in production, add them here for verification

      // Example: A token created with the old Buffer.from() implementation
      // const oldToken = 'existing-production-token-here';
      // const verifiedId = await convexVerifyGuestToken(oldToken);
      // expect(verifiedId).toBe('expected-guest-id');

      expect(true).toBe(true); // Placeholder - no old tokens to test yet
    });
  });
});
