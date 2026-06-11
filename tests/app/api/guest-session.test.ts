/** @vitest-environment node */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

/**
 * Tests grouped by mock configuration to minimize module reloads.
 * Each describe block reloads the module once in beforeAll.
 */

describe('GET /api/guest/session', () => {
  describe('with normal operation', () => {
    let GET: typeof import('@/app/api/guest/session/route').GET;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    function jsonLogs() {
      const calls = consoleLogSpy.mock.calls as Array<[unknown, ...unknown[]]>;
      return calls.map((call) => JSON.parse(String(call[0]))) as Array<
        Record<string, unknown>
      >;
    }

    beforeAll(async () => {
      vi.resetModules();
      const mod = await import('@/app/api/guest/session/route');
      GET = mod.GET;
    });

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
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
      expect(jsonLogs()).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Request completed',
          method: 'GET',
          route: '/api/guest/session',
          status: 200,
          durationMs: expect.any(Number),
          operation: 'createGuestSession',
          reusedExistingToken: false,
        })
      );
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
      expect(jsonLogs()).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Request completed',
          method: 'GET',
          route: '/api/guest/session',
          status: 200,
          durationMs: expect.any(Number),
          operation: 'reuseGuestSession',
          reusedExistingToken: true,
        })
      );
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
      expect(jsonLogs()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'warn',
            message: 'Guest session token rejected',
            method: 'GET',
            route: '/api/guest/session',
            operation: 'verifyGuestToken',
            reason: 'invalid_or_expired',
          }),
          expect.objectContaining({
            level: 'info',
            message: 'Request completed',
            method: 'GET',
            route: '/api/guest/session',
            status: 200,
            durationMs: expect.any(Number),
            operation: 'createGuestSession',
            reusedExistingToken: false,
          }),
        ])
      );
      expect(JSON.stringify(jsonLogs())).not.toContain(
        'tampered-invalid-token'
      );
    });
  });

  describe('with non-Error invalid token failure', () => {
    let GET: typeof import('@/app/api/guest/session/route').GET;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    function jsonLogs() {
      const calls = consoleLogSpy.mock.calls as Array<[unknown, ...unknown[]]>;
      return calls.map((call) => JSON.parse(String(call[0]))) as Array<
        Record<string, unknown>
      >;
    }

    beforeAll(async () => {
      vi.resetModules();
      vi.doMock('@/lib/guestToken', () => ({
        signGuestToken: vi.fn().mockResolvedValue('fresh-token'),
        verifyGuestToken: vi.fn().mockRejectedValue('bad token'),
      }));

      const mod = await import('@/app/api/guest/session/route');
      GET = mod.GET;
    });

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    afterAll(() => {
      vi.doUnmock('@/lib/guestToken');
    });

    it('logs an unknown token verification failure without the token value', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );
      request.cookies.set('linejam_guest_token', 'tampered-invalid-token');

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(jsonLogs()).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          message: 'Guest session token rejected',
          method: 'GET',
          route: '/api/guest/session',
          operation: 'verifyGuestToken',
          reason: 'invalid_or_expired',
          errorName: 'UnknownError',
        })
      );
      expect(JSON.stringify(jsonLogs())).not.toContain(
        'tampered-invalid-token'
      );
      expect(JSON.stringify(jsonLogs())).not.toContain('bad token');
    });
  });

  describe('with error injection', () => {
    let GET: typeof import('@/app/api/guest/session/route').GET;
    let mockCaptureServerError: ReturnType<typeof vi.fn>;

    beforeAll(async () => {
      vi.resetModules();

      // Mock signGuestToken to throw
      vi.doMock('@/lib/guestToken', () => ({
        signGuestToken: vi.fn().mockRejectedValue(new Error('Signing failed')),
        verifyGuestToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
      }));

      // Mock captureServerError
      mockCaptureServerError = vi.fn();
      vi.doMock('@/lib/errorServer', () => ({
        captureServerError: mockCaptureServerError,
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
      expect(mockCaptureServerError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ operation: 'createGuestSession' })
      );
    });
  });
});
