import { describe, it, expect } from 'vitest';
import { signGuestToken, verifyGuestToken } from '../lib/guestToken';

describe('guestToken', () => {
  describe('signGuestToken', () => {
    it('creates a valid token for a guestId', async () => {
      const guestId = 'test-guest-123';
      const token = await signGuestToken(guestId);

      expect(token).toBeTruthy();
      expect(token).toContain('.');
      expect(token.split('.')).toHaveLength(2);
    });
  });

  describe('verifyGuestToken', () => {
    it('verifies a valid token and returns guestId', async () => {
      const guestId = 'test-guest-456';
      const token = await signGuestToken(guestId);

      const result = await verifyGuestToken(token);
      expect(result).toBe(guestId);
    });

    it('rejects tampered token payload', async () => {
      const guestId = 'test-guest-789';
      const token = await signGuestToken(guestId);

      // Tamper with payload (change first character)
      const [payload, signature] = token.split('.');
      const tamperedPayload = 'X' + payload.slice(1);
      const tamperedToken = `${tamperedPayload}.${signature}`;

      await expect(verifyGuestToken(tamperedToken)).rejects.toThrow(
        'Token signature verification failed'
      );
    });

    it('rejects tampered token signature', async () => {
      const guestId = 'test-guest-abc';
      const token = await signGuestToken(guestId);

      // Tamper with signature (reverse it to ensure it's invalid)
      const [payload, signature] = token.split('.');
      const tamperedSignature = signature.split('').reverse().join('');
      const tamperedToken = `${payload}.${tamperedSignature}`;

      await expect(verifyGuestToken(tamperedToken)).rejects.toThrow(
        'Token signature verification failed'
      );
    });

    it('rejects token with invalid format', async () => {
      await expect(verifyGuestToken('invalid-token')).rejects.toThrow(
        'Invalid token format'
      );

      await expect(verifyGuestToken('too.many.parts.here')).rejects.toThrow(
        'Invalid token format'
      );
    });

    it('rejects expired token', async () => {
      // Create a token with past issuedAt
      const guestId = 'test-guest-expired';
      const expiredPayload = {
        guestId,
        issuedAt: Date.now() - 31 * 24 * 60 * 60 * 1000, // 31 days ago
      };

      // Manually create expired token (bypass signGuestToken)
      const payloadB64 = Buffer.from(JSON.stringify(expiredPayload)).toString(
        'base64url'
      );
      const { subtle } = await import('crypto');
      const secret =
        process.env.GUEST_TOKEN_SECRET ||
        'dev-only-insecure-secret-change-in-production';
      const key = await subtle.importKey(
        'raw',
        Buffer.from(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await subtle.sign('HMAC', key, Buffer.from(payloadB64));
      const signatureB64 = Buffer.from(signature).toString('base64url');
      const expiredToken = `${payloadB64}.${signatureB64}`;

      await expect(verifyGuestToken(expiredToken)).rejects.toThrow(
        'Token expired'
      );
    });
  });
});
