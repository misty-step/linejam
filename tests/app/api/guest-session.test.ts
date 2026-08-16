/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock, MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import { ConvexError } from 'convex/values';
import { createGuestSessionRoute, DELETE } from '@/app/api/guest/session/route';
import type {
  GuestSessionRoute,
  GuestSessionThrottleInput,
} from '@/app/api/guest/session/route';
import * as guestToken from '@/lib/guestToken';
import * as errorServer from '@/lib/errorServer';

interface LogEntry {
  level?: string;
  message?: string;
  method?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  operation?: string;
  reusedExistingToken?: boolean;
  reason?: string;
  errorName?: string;
}

interface UnsyncedThrottleGuardCase {
  name: string;
  configure(): void;
}

describe('GET /api/guest/session', () => {
  let GET: GuestSessionRoute;
  let consoleLogSpy: MockInstance;
  let consoleErrorSpy: MockInstance;
  let mutationSpy: Mock<(input: GuestSessionThrottleInput) => Promise<void>>;
  let captureServerErrorSpy: MockInstance;
  let signGuestTokenSpy: MockInstance;
  let verifyGuestTokenPayloadSpy: MockInstance;
  const originalEnv = { ...process.env };

  function jsonLogs(): LogEntry[] {
    return consoleLogSpy.mock.calls.map((call) => JSON.parse(String(call[0])));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureServerErrorSpy = vi
      .spyOn(errorServer, 'captureServerError')
      .mockImplementation(() => {});
    mutationSpy = vi
      .fn<(input: GuestSessionThrottleInput) => Promise<void>>()
      .mockResolvedValue(undefined);
    GET = createGuestSessionRoute({
      checkThrottle: mutationSpy,
    });
    signGuestTokenSpy = vi.spyOn(guestToken, 'signGuestToken');
    verifyGuestTokenPayloadSpy = vi.spyOn(
      guestToken,
      'verifyGuestTokenPayload'
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    captureServerErrorSpy.mockRestore();
    signGuestTokenSpy.mockRestore();
    verifyGuestTokenPayloadSpy.mockRestore();
  });

  describe('with normal operation', () => {
    it('creates new guest session when no cookie exists', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.guestId).toBeTruthy();
      expect(data.guestId).toEqual(expect.any(String));

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
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';

      const request = new NextRequest(
        'https://www.linejam.app/api/guest/session'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mutationSpy).toHaveBeenCalledOnce();
      expect(mutationSpy.mock.calls[0]?.[0]).toMatchObject({
        key: expect.stringMatching(/^guestSession:/),
        proof: expect.any(String),
      });
    });

    it('fails closed in production when the Convex URL is missing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      process.env.GUEST_TOKEN_SECRET = 'production-test-secret';
      process.env.NEXT_PUBLIC_CONVEX_URL = '';

      const response = await GET(
        new NextRequest('https://www.linejam.app/api/guest/session')
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create guest session');
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
      expect(mutationSpy).not.toHaveBeenCalled();
    });

    it('re-uses existing valid guest session from cookie', async () => {
      const existingToken = await guestToken.signGuestToken(
        'guest_existing_123',
        {
          sessionId: 'session_existing_123',
          rateLimitKey: 'guestSession:existing',
        }
      );

      const request = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );
      request.cookies.set('linejam_guest_token', existingToken);

      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.guestId).toBe('guest_existing_123');
      expect(data.token).toBe(existingToken);
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();

      expect(jsonLogs()).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Request completed',
          method: 'GET',
          route: '/api/guest/session',
          status: 200,
          operation: 'reuseGuestSession',
          reusedExistingToken: true,
        })
      );
    });

    it('rotates a legacy guest cookie that lacks throttle metadata', async () => {
      const existingToken = await guestToken.signGuestToken('guest_legacy_123');
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );
      request.cookies.set('linejam_guest_token', existingToken);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.guestId).toBe('guest_legacy_123');
      expect(data.token).not.toBe(existingToken);
      expect(response.cookies.get('linejam_guest_token')?.value).toBe(
        data.token
      );
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

    it('creates new session when existing cookie is invalid', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );
      request.cookies.set('linejam_guest_token', 'invalid-token');

      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.guestId).toBeTruthy();
      // Should NOT be the invalid token
      expect(data.guestId).not.toBe('invalid-token');

      // New cookie should be set
      const cookies = response.cookies.getAll();
      const guestCookie = cookies.find((c) => c.name === 'linejam_guest_token');
      expect(guestCookie).toBeTruthy();
      expect(guestCookie?.value).not.toBe('invalid-token');
      expect(jsonLogs()).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          message: 'Guest session token rejected',
          method: 'GET',
          route: '/api/guest/session',
          operation: 'verifyGuestToken',
          reason: 'invalid_or_expired',
        })
      );
      expect(JSON.stringify(jsonLogs())).not.toContain('invalid-token');
    });

    it('returns existing session without creating a new one when ?existing=1 is passed', async () => {
      const existingToken = await guestToken.signGuestToken('guest_probe_123', {
        sessionId: 'session_probe_123',
        rateLimitKey: 'guestSession:probe',
      });
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session?existing=1'
      );
      request.cookies.set('linejam_guest_token', existingToken);

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.guestId).toBe('guest_probe_123');
      expect(data.token).toBe(existingToken);
      expect(jsonLogs()).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Request completed',
          method: 'GET',
          route: '/api/guest/session',
          status: 200,
          operation: 'reuseGuestSession',
          reusedExistingToken: true,
        })
      );
    });

    it('returns an empty session from ?existing=1 when no cookie is present', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session?existing=1'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
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

    it('returns an empty session from ?existing=1 and clears an invalid cookie', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session?existing=1'
      );
      request.cookies.set('linejam_guest_token', 'invalid-token');

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ guestId: null, token: null });
      expect(response.cookies.get('linejam_guest_token')?.value).toBe('');
      expect(response.cookies.get('linejam_guest_token')?.maxAge).toBe(0);
      expect(jsonLogs()).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          message: 'Guest session token rejected',
          method: 'GET',
          route: '/api/guest/session',
          operation: 'verifyGuestToken',
          reason: 'invalid_or_expired',
        })
      );
      expect(JSON.stringify(jsonLogs())).not.toContain('invalid-token');
    });

    it('clears the guest cookie on revocation', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/guest/session',
        { method: 'DELETE' }
      );
      request.cookies.set('linejam_guest_token', 'token-to-revoke');

      const response = await DELETE(request);

      expect(response.status).toBe(204);
      expect(response.cookies.get('linejam_guest_token')?.value).toBe('');
      expect(response.cookies.get('linejam_guest_token')?.maxAge).toBe(0);
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
    it('logs an unknown token verification failure without the token value', async () => {
      verifyGuestTokenPayloadSpy.mockRejectedValue('bad token');

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
    it('returns 500 when token signing fails', async () => {
      signGuestTokenSpy.mockRejectedValue(new Error('Signing failed'));

      const request = new NextRequest(
        'http://localhost:3000/api/guest/session'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create guest session');
      expect(captureServerErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ operation: 'createGuestSession' })
      );
    });
  });

  describe('with guest-session throttle', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
      mutationSpy.mockRejectedValue(new Error('Rate limit exceeded'));

      const clientIp = '203.0.113.7';
      const request = new NextRequest(
        'https://www.linejam.app/api/guest/session',
        {
          headers: {
            'x-forwarded-for': `${clientIp}, 10.0.0.1`,
          },
        }
      );
      const response = await GET(request);

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('600');
      const data = await response.json();
      expect(data.error).toBe('Too many guest sessions. Try again later.');
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
      expect(captureServerErrorSpy).not.toHaveBeenCalled();
      expect(mutationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringMatching(/^guestSession:/),
          proof: expect.stringMatching(/^[A-Za-z0-9_-]+$/),
        })
      );
      expect(JSON.stringify(mutationSpy.mock.calls)).not.toContain(clientIp);
    });

    it('returns 429 when Convex redacts a rate-limit message', async () => {
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
      const error = new ConvexError(
        'Rate limit exceeded. Please try again later.'
      );
      error.message = '[Request ID: production-request] Server Error';
      mutationSpy.mockRejectedValue(error);

      const response = await GET(
        new NextRequest('https://www.linejam.app/api/guest/session')
      );

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('600');
      expect(captureServerErrorSpy).not.toHaveBeenCalled();
    });

    it('prefers the App Platform client address over a forwarded chain', async () => {
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
      const requestFor = (platformIp: string) =>
        new NextRequest('https://www.linejam.app/api/guest/session', {
          headers: {
            'do-connecting-ip': platformIp,
            'x-forwarded-for': '203.0.113.99, 10.0.0.1',
          },
        });

      await GET(requestFor('198.51.100.21'));
      const firstKey = mutationSpy.mock.calls.at(-1)?.[0]?.key;
      await GET(requestFor('198.51.100.22'));
      const secondKey = mutationSpy.mock.calls.at(-1)?.[0]?.key;

      expect(firstKey).toMatch(/^guestSession:/);
      expect(secondKey).toMatch(/^guestSession:/);
      expect(secondKey).not.toBe(firstKey);
    });

    it('ignores caller-controlled forwarding headers in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
      process.env.GUEST_TOKEN_SECRET = 'production-test-secret';

      const requestFor = (forwardedIp: string) =>
        new NextRequest('https://www.linejam.app/api/guest/session', {
          headers: { 'x-forwarded-for': forwardedIp },
        });

      await GET(requestFor('198.51.100.31'));
      const firstKey = mutationSpy.mock.calls.at(-1)?.[0]?.key;
      await GET(requestFor('198.51.100.32'));
      const secondKey = mutationSpy.mock.calls.at(-1)?.[0]?.key;

      expect(firstKey).toMatch(/^guestSession:/);
      expect(secondKey).toBe(firstKey);
      vi.unstubAllEnvs();
    });
  });

  describe('with unsynced Convex throttle function', () => {
    it('fails closed when Convex is missing the throttle function', async () => {
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
      mutationSpy.mockRejectedValue(
        new Error(
          "Could not find public function for 'guestSessions:checkSignedGuestSessionThrottle'."
        )
      );

      const response = await GET(
        new NextRequest('https://www.linejam.app/api/guest/session')
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create guest session');
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
    });

    it('allows explicit local verification when the throttle function is unsynced', async () => {
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
      process.env.LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE = '1';
      delete process.env.CI;
      vi.stubEnv('NODE_ENV', 'test');
      mutationSpy.mockRejectedValue(
        new Error(
          "Could not find public function for 'guestSessions:checkSignedGuestSessionThrottle'."
        )
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

    it.each<UnsyncedThrottleGuardCase>([
      {
        name: 'production',
        configure: () => vi.stubEnv('NODE_ENV', 'production'),
      },
      {
        name: 'hosted CI',
        configure: () => vi.stubEnv('CI', 'true'),
      },
    ])(
      'fails closed in $name even when the local bypass flag is set',
      async ({ configure }) => {
        process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
        process.env.GUEST_TOKEN_SECRET = 'production-test-secret';
        process.env.LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE = '1';
        delete process.env.CI;
        vi.stubEnv('NODE_ENV', 'test');
        configure();
        mutationSpy.mockRejectedValue(
          new Error(
            "Could not find public function for 'guestSessions:checkSignedGuestSessionThrottle'."
          )
        );

        const response = await GET(
          new NextRequest('https://www.linejam.app/api/guest/session')
        );

        expect(response.status).toBe(500);
        expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
      }
    );
  });

  describe('with string and object throttle failures', () => {
    it('treats string rate-limit failures as a closed guest-mint bucket', async () => {
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
      mutationSpy.mockRejectedValue('Rate limit exceeded');

      const response = await GET(
        new NextRequest('https://www.linejam.app/api/guest/session')
      );
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('600');
      expect(data.error).toBe('Too many guest sessions. Try again later.');
      expect(response.cookies.get('linejam_guest_token')).toBeUndefined();
      expect(mutationSpy).toHaveBeenCalledOnce();
    });

    it('fails closed on string throttle errors that are not rate limits', async () => {
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
      mutationSpy.mockRejectedValue('temporary Convex transport failure');

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
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
      process.env.LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE = '1';
      delete process.env.CI;
      vi.stubEnv('NODE_ENV', 'test');
      mutationSpy.mockRejectedValue(
        "Could not find public function for 'guestSessions:checkSignedGuestSessionThrottle'."
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
      process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
      mutationSpy.mockRejectedValue({ code: 'upstream_down' });

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
