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
import { ConvexError } from 'convex/values';

vi.mock('server-only', () => ({}));

/**
 * Tests grouped by mock configuration to minimize module reloads.
 * Each describe block reloads the module once in beforeAll.
 */

function mockAllowedGuestSessionThrottle() {
  const mutation = vi.fn().mockResolvedValue({ ok: true });

  vi.doMock('convex/browser', () => ({
    ConvexHttpClient: class {
      mutation = mutation;
    },
  }));

  return mutation;
}

describe('GET /api/guest/session', () => {
  describe('with normal operation', () => {
    let GET: typeof import('@/app/api/guest/session/route').GET;
    let DELETE: typeof import('@/app/api/guest/session/route').DELETE;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    function jsonLogs() {
      const calls = consoleLogSpy.mock.calls as Array<[unknown, ...unknown[]]>;
      return calls.map((call) => JSON.parse(String(call[0]))) as Array<
        Record<string, unknown>
      >;
    }

    beforeAll(async () => {
      vi.resetModules();
      mockAllowedGuestSessionThrottle();
      const mod = await import('@/app/api/guest/session/route');
      GET = mod.GET;
      DELETE = mod.DELETE;
    });

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    afterAll(() => {
      vi.doUnmock('convex/browser');
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

    it('creates a new guest session when the Convex throttle allows the bucket', async () => {
      const originalConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';

      try {
        const request = new NextRequest(
          'http://localhost:3000/api/guest/session'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.guestId).toEqual(expect.any(String));
      } finally {
        if (originalConvexUrl === undefined) {
          delete process.env.NEXT_PUBLIC_CONVEX_URL;
        } else {
          process.env.NEXT_PUBLIC_CONVEX_URL = originalConvexUrl;
        }
      }
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

    it('rotates a legacy guest cookie that lacks launch-abuse metadata', async () => {
      const { signGuestToken } = await import('@/lib/guestToken');
      const legacyToken = await signGuestToken('legacy-guest');
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );
      request.cookies.set('linejam_guest_token', legacyToken);

      const response = await GET(request);
      const data = await response.json();
      const guestCookie = response.cookies.get('linejam_guest_token');

      expect(response.status).toBe(200);
      expect(data.guestId).toBe('legacy-guest');
      expect(data.token).not.toBe(legacyToken);
      expect(guestCookie?.value).toBe(data.token);
      expect(jsonLogs()).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Request completed',
          method: 'GET',
          route: '/api/guest/session',
          status: 200,
          operation: 'rotateLegacyGuestSession',
          reusedExistingToken: false,
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

    it('clears an invalid cookie when only an existing session is requested', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session?existing=1'
      );
      request.cookies.set('linejam_guest_token', 'tampered-invalid-token');

      const response = await GET(request);
      const data = await response.json();
      const guestCookie = response.cookies.get('linejam_guest_token');

      expect(response.status).toBe(200);
      expect(data).toEqual({ guestId: null, token: null });
      expect(guestCookie?.value).toBe('');
      expect(guestCookie?.maxAge).toBe(0);
    });

    it('does not mint a new session when only an existing cookie is requested', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session?existing=1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ guestId: null, token: null });
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
      expect(jsonLogs()).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Request completed',
          method: 'GET',
          route: '/api/guest/session',
          status: 200,
          operation: 'readExistingGuestSession',
          reusedExistingToken: false,
        })
      );
    });

    it('allows test/dev session creation when no Convex URL is configured', async () => {
      const originalConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      delete process.env.NEXT_PUBLIC_CONVEX_URL;

      try {
        const request = new NextRequest(
          'http://localhost:3000/api/guest/session'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.guestId).toEqual(expect.any(String));
      } finally {
        if (originalConvexUrl === undefined) {
          delete process.env.NEXT_PUBLIC_CONVEX_URL;
        } else {
          process.env.NEXT_PUBLIC_CONVEX_URL = originalConvexUrl;
        }
      }
    });

    it('fails closed in production when no Convex URL is configured', async () => {
      vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', '');
      vi.stubEnv('NODE_ENV', 'production');

      try {
        const request = new NextRequest(
          'https://www.linejam.app/api/guest/session'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to create guest session');
        expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('clears the guest cookie on revocation', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session',
        { method: 'DELETE' }
      );

      const response = await DELETE(request);
      const guestCookie = response.cookies.get('linejam_guest_token');

      expect(response.status).toBe(204);
      expect(guestCookie?.value).toBe('');
      expect(guestCookie?.maxAge).toBe(0);
      expect(jsonLogs()).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Request completed',
          method: 'DELETE',
          route: '/api/guest/session',
          status: 204,
          operation: 'revokeGuestSession',
        })
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
      mockAllowedGuestSessionThrottle();
      vi.doMock('@/lib/guestToken', () => ({
        GUEST_TOKEN_MAX_AGE_SECONDS: 7 * 24 * 60 * 60,
        signGuestToken: vi.fn().mockResolvedValue('fresh-token'),
        verifyGuestTokenPayload: vi.fn().mockRejectedValue('bad token'),
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
      vi.doUnmock('convex/browser');
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
      mockAllowedGuestSessionThrottle();

      // Mock signGuestToken to throw
      vi.doMock('@/lib/guestToken', () => ({
        GUEST_TOKEN_MAX_AGE_SECONDS: 7 * 24 * 60 * 60,
        signGuestToken: vi.fn().mockRejectedValue(new Error('Signing failed')),
        verifyGuestTokenPayload: vi
          .fn()
          .mockRejectedValue(new Error('Invalid token')),
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
      vi.doUnmock('@/lib/guestToken');
      vi.doUnmock('@/lib/errorServer');
      vi.doUnmock('convex/browser');
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

  describe('with guest-session throttle', () => {
    let GET: typeof import('@/app/api/guest/session/route').GET;
    let mockMutation: ReturnType<typeof vi.fn>;
    let mockCaptureServerError: ReturnType<typeof vi.fn>;
    const originalEnv = { ...process.env };

    beforeAll(async () => {
      vi.resetModules();
      vi.doUnmock('@/lib/guestToken');
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
      };
      mockMutation = vi
        .fn()
        .mockRejectedValue(new Error('Rate limit exceeded'));

      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: class {
          mutation = mockMutation;
        },
      }));
      mockCaptureServerError = vi.fn();
      vi.doMock('@/lib/errorServer', () => ({
        captureServerError: mockCaptureServerError,
      }));

      const mod = await import('@/app/api/guest/session/route');
      GET = mod.GET;
    });

    beforeEach(() => {
      mockMutation.mockClear();
      mockCaptureServerError.mockClear();
    });

    afterAll(() => {
      process.env = originalEnv;
      vi.doUnmock('convex/browser');
      vi.doUnmock('@/lib/errorServer');
      vi.restoreAllMocks();
    });

    it('returns 429 before minting a new guest when the IP bucket is exhausted', async () => {
      const request = new NextRequest(
        'https://www.linejam.app/api/guest/session',
        {
          headers: {
            'x-forwarded-for': '203.0.113.7, 10.0.0.1',
          },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('600');
      expect(data.error).toBe('Too many guest sessions. Try again later.');
      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          key: expect.stringMatching(/^guestSession:/),
        })
      );
      expect(JSON.stringify(mockMutation.mock.calls)).not.toContain(
        '203.0.113.7'
      );
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
    });

    it('returns 429 when production Convex redacts the rate-limit message', async () => {
      const error = new ConvexError(
        'Rate limit exceeded. Please try again later.'
      );
      error.message = '[Request ID: production-request] Server Error';
      mockMutation.mockRejectedValueOnce(error);

      const response = await GET(
        new NextRequest('https://www.linejam.app/api/guest/session', {
          headers: {
            'x-forwarded-for': '203.0.113.8',
          },
        })
      );
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('600');
      expect(data.error).toBe('Too many guest sessions. Try again later.');
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
      expect(mockCaptureServerError).not.toHaveBeenCalled();
    });

    it.each([
      ['x-real-ip', '198.51.100.10'],
      ['do-connecting-ip', '198.51.100.11'],
      ['cf-connecting-ip', '198.51.100.12'],
    ])('derives an opaque throttle key from %s', async (header, ip) => {
      const request = new NextRequest(
        'https://www.linejam.app/api/guest/session',
        {
          headers: {
            [header]: ip,
          },
        }
      );

      const response = await GET(request);

      expect(response.status).toBe(429);
      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          key: expect.stringMatching(/^guestSession:/),
        })
      );
      expect(JSON.stringify(mockMutation.mock.calls)).not.toContain(ip);
    });

    it('prefers the App Platform client address over a forwarded chain', async () => {
      const requestFor = (platformIp: string) =>
        new NextRequest('https://www.linejam.app/api/guest/session', {
          headers: {
            'do-connecting-ip': platformIp,
            'x-forwarded-for': '203.0.113.99, 10.0.0.1',
          },
        });

      await GET(requestFor('198.51.100.21'));
      const firstKey = mockMutation.mock.calls.at(-1)?.[1]?.key;
      await GET(requestFor('198.51.100.22'));
      const secondKey = mockMutation.mock.calls.at(-1)?.[1]?.key;

      expect(firstKey).toMatch(/^guestSession:/);
      expect(secondKey).toMatch(/^guestSession:/);
      expect(secondKey).not.toBe(firstKey);
    });
  });

  describe('with unsynced Convex throttle function', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = originalEnv;
      vi.doUnmock('convex/browser');
      vi.restoreAllMocks();
    });

    async function loadGetWithMissingThrottleFunction(allow: boolean) {
      vi.resetModules();
      vi.doUnmock('@/lib/guestToken');
      vi.doUnmock('@/lib/errorServer');
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
        ...(allow ? { LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE: '1' } : {}),
      };

      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: class {
          mutation = vi
            .fn()
            .mockRejectedValue(
              new Error(
                "Could not find public function for 'guestSessions:checkGuestSessionThrottle'."
              )
            );
        },
      }));

      return (await import('@/app/api/guest/session/route')).GET;
    }

    it('fails closed when Convex is missing the throttle function', async () => {
      const GET = await loadGetWithMissingThrottleFunction(false);

      const response = await GET(
        new NextRequest('https://www.linejam.app/api/guest/session')
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create guest session');
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
    });

    it('allows explicit local verification when the throttle function is unsynced', async () => {
      const GET = await loadGetWithMissingThrottleFunction(true);

      const response = await GET(
        new NextRequest('http://localhost:3333/api/guest/session')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.guestId).toEqual(expect.any(String));
      expect(data.token).toEqual(expect.any(String));
      expect(response.cookies.get('linejam_guest_token')?.value).toBeTruthy();
    });
  });

  describe('with string and object throttle failures', () => {
    const originalEnv = { ...process.env };
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      process.env = originalEnv;
      vi.doUnmock('@/lib/guestToken');
      vi.doUnmock('@/lib/errorServer');
      vi.doUnmock('convex/browser');
      vi.restoreAllMocks();
    });

    async function loadGetWithThrottleFailure(
      error: unknown,
      extraEnv: Partial<NodeJS.ProcessEnv> = {}
    ) {
      vi.resetModules();
      vi.doUnmock('@/lib/guestToken');
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
        ...extraEnv,
      };

      const mutation = vi.fn().mockRejectedValue(error);
      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: class {
          mutation = mutation;
        },
      }));
      vi.doMock('@/lib/errorServer', () => ({
        captureServerError: vi.fn(),
      }));

      return {
        GET: (await import('@/app/api/guest/session/route')).GET,
        mutation,
      };
    }

    it('treats string rate-limit failures as a closed guest-mint bucket', async () => {
      const { GET, mutation } = await loadGetWithThrottleFailure(
        'Rate limit exceeded'
      );

      const response = await GET(
        new NextRequest('https://www.linejam.app/api/guest/session')
      );
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('600');
      expect(data.error).toBe('Too many guest sessions. Try again later.');
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
      expect(mutation).toHaveBeenCalledOnce();
    });

    it('fails closed on string throttle errors that are not rate limits', async () => {
      const { GET } = await loadGetWithThrottleFailure(
        'temporary Convex transport failure'
      );

      const response = await GET(
        new NextRequest('https://www.linejam.app/api/guest/session')
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create guest session');
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('allows string missing-function errors only under the explicit local bypass', async () => {
      const { GET } = await loadGetWithThrottleFailure(
        "Could not find public function for 'guestSessions:checkGuestSessionThrottle'.",
        { LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE: '1' }
      );

      const response = await GET(
        new NextRequest('http://localhost:3333/api/guest/session')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.guestId).toEqual(expect.any(String));
      expect(data.token).toEqual(expect.any(String));
      expect(response.cookies.get('linejam_guest_token')?.value).toBeTruthy();
    });

    it('fails closed on opaque object-shaped throttle failures', async () => {
      const { GET } = await loadGetWithThrottleFailure({
        code: 'upstream_down',
      });

      const response = await GET(
        new NextRequest('https://www.linejam.app/api/guest/session')
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create guest session');
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
    });
  });
});
