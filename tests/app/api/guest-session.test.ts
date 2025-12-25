/** @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Tests grouped by mock configuration to minimize module reloads.
 * Each describe block reloads the module once in beforeAll.
 */

describe('GET /api/guest/session', () => {
  describe('with normal operation', () => {
    let GET: typeof import('@/app/api/guest/session/route').GET;

    beforeAll(async () => {
      vi.resetModules();
      const mod = await import('@/app/api/guest/session/route');
      GET = mod.GET;
    });

    it('creates new guest session when no cookie exists', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.guestId).toBeTruthy();
      expect(typeof data.guestId).toBe('string');

      // Check cookie was set
      const cookies = response.cookies.getAll();
      const guestCookie = cookies.find((c) => c.name === 'linejam_guest_token');
      expect(guestCookie).toBeTruthy();
      expect(guestCookie?.value).toBeTruthy();
    });

    it('returns existing guestId when valid cookie exists', async () => {
      // First request to create session
      const request1 = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );
      const response1 = await GET(request1);
      const data1 = await response1.json();
      const cookies1 = response1.cookies.getAll();
      const token1 = cookies1.find(
        (c) => c.name === 'linejam_guest_token'
      )?.value;

      // Second request with the cookie
      const request2 = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );
      request2.cookies.set('linejam_guest_token', token1!);
      const response2 = await GET(request2);
      const data2 = await response2.json();

      // Should return same guestId
      expect(data2.guestId).toBe(data1.guestId);
    });

    it('creates new session when cookie is tampered', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );
      request.cookies.set('linejam_guest_token', 'tampered-invalid-token');

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.guestId).toBeTruthy();

      // Should have created new cookie
      const cookies = response.cookies.getAll();
      const guestCookie = cookies.find((c) => c.name === 'linejam_guest_token');
      expect(guestCookie?.value).not.toBe('tampered-invalid-token');
    });
  });

  describe('with error injection', () => {
    let GET: typeof import('@/app/api/guest/session/route').GET;
    let mockCaptureError: ReturnType<typeof vi.fn>;

    beforeAll(async () => {
      vi.resetModules();

      // Mock signGuestToken to throw
      vi.doMock('@/lib/guestToken', () => ({
        signGuestToken: vi.fn().mockRejectedValue(new Error('Signing failed')),
        verifyGuestToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
      }));

      // Mock captureError
      mockCaptureError = vi.fn();
      vi.doMock('@/lib/error', () => ({
        captureError: mockCaptureError,
      }));

      const mod = await import('@/app/api/guest/session/route');
      GET = mod.GET;
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('returns 500 when token signing fails', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create guest session');
      expect(mockCaptureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ operation: 'createGuestSession' })
      );
    });
  });
});
