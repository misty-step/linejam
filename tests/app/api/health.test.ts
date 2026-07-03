/** @vitest-environment node */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('server-only', () => ({}));

const originalEnv = { ...process.env };

const HEALTHY_ENV = {
  GUEST_TOKEN_SECRET: 'test-secret-for-health-checks',
  NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
  NEXT_PUBLIC_CANARY_API_KEY: 'sk_test_canary',
};

const mockQuery = vi.fn();
const fetchMock = vi.fn();

function parseJsonLogCalls(spy: ReturnType<typeof vi.spyOn>) {
  const calls = spy.mock.calls as Array<[unknown, ...unknown[]]>;
  return calls.map((call) => JSON.parse(String(call[0]))) as Array<
    Record<string, unknown>
  >;
}

class MockConvexHttpClient {
  query = mockQuery;
}

describe('/api/health', () => {
  afterAll(() => {
    process.env = originalEnv;
  });

  describe('with healthy env', () => {
    let GET: typeof import('@/app/api/health/route').GET;

    beforeAll(async () => {
      vi.resetModules();
      process.env = { ...originalEnv };
      delete process.env.CANARY_API_KEY;
      delete process.env.CANARY_ENDPOINT;
      process.env.GUEST_TOKEN_SECRET = HEALTHY_ENV.GUEST_TOKEN_SECRET;
      process.env.NEXT_PUBLIC_CONVEX_URL = HEALTHY_ENV.NEXT_PUBLIC_CONVEX_URL;
      process.env.NEXT_PUBLIC_CANARY_API_KEY =
        HEALTHY_ENV.NEXT_PUBLIC_CANARY_API_KEY;

      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: MockConvexHttpClient,
      }));
      mockQuery.mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

      const mod = await import('@/app/api/health/route');
      GET = mod.GET;
    });

    afterEach(() => {
      mockQuery.mockReset();
      mockQuery.mockResolvedValue({ ok: true });
      fetchMock.mockClear();
      fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
      vi.useRealTimers();
    });

    it('returns 200 with status, timestamp, and env checks', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        env: {
          nodeEnv: expect.stringMatching(/^(development|test|production)$/),
          guestTokenSecret: true,
          convexUrl: true,
          canaryIngestKey: true,
        },
        observability: {
          status: 'ready',
          canaryIngestKey: true,
        },
      });

      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
      expect(parseJsonLogCalls(consoleLogSpy)).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Request completed',
          method: 'GET',
          route: '/api/health',
          status: 200,
          durationMs: expect.any(Number),
          convex: 'connected',
          observabilityStatus: 'ready',
        })
      );

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/check-ins$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk_test_canary',
          }),
        })
      );
    });

    it('includes Cache-Control: no-store header', async () => {
      const response = await GET();
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('returns connected when Convex ping succeeds', async () => {
      mockQuery.mockResolvedValue({ ok: true });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.convex).toBe('connected');
      expect(mockQuery).toHaveBeenCalled();
    });

    it('returns unhealthy when Convex ping fails', async () => {
      mockQuery.mockRejectedValue(new Error('Connection refused'));
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.convex).toBe('unreachable');
      expect(parseJsonLogCalls(consoleLogSpy)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'warn',
            message: 'Convex health ping failed; marking unreachable',
            method: 'GET',
            route: '/api/health',
            operation: 'convexHealthPing',
          }),
          expect.objectContaining({
            level: 'info',
            message: 'Request completed',
            method: 'GET',
            route: '/api/health',
            status: 503,
            durationMs: expect.any(Number),
            convex: 'unreachable',
            observabilityStatus: 'ready',
          }),
        ])
      );
    });

    it('logs non-Error Convex ping failures without throwing', async () => {
      mockQuery.mockRejectedValue('connection refused');
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const response = await GET();

      expect(response.status).toBe(503);
      expect(parseJsonLogCalls(consoleLogSpy)).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          message: 'Convex health ping failed; marking unreachable',
          method: 'GET',
          route: '/api/health',
          operation: 'convexHealthPing',
          errorName: 'UnknownError',
          errorMessage: 'connection refused',
        })
      );
    });

    it('returns unhealthy when Convex never answers before the deadline', async () => {
      mockQuery.mockImplementation(() => new Promise(() => undefined));
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.useFakeTimers();

      const responsePromise = GET();
      await vi.advanceTimersByTimeAsync(1_500);

      const response = await responsePromise;
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.convex).toBe('unreachable');
    });

    it('reports degraded observability when Canary ingest is not configured', async () => {
      delete process.env.NEXT_PUBLIC_CANARY_API_KEY;
      delete process.env.CANARY_API_KEY;

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: 'ok',
        env: {
          canaryIngestKey: false,
        },
        observability: {
          status: 'degraded',
          canaryIngestKey: false,
        },
      });
    });

    it('falls back to development when NODE_ENV is unset', async () => {
      Reflect.deleteProperty(process.env, 'NODE_ENV');

      const response = await GET();
      const data = await response.json();

      expect(data.env.nodeEnv).toBe('development');
    });
  });

  describe('with missing env', () => {
    let GET: typeof import('@/app/api/health/route').GET;

    beforeAll(async () => {
      vi.resetModules();
      process.env = { ...originalEnv };
      delete process.env.GUEST_TOKEN_SECRET;
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
      delete process.env.CANARY_API_KEY;
      delete process.env.NEXT_PUBLIC_CANARY_API_KEY;
      delete process.env.NEXT_PUBLIC_CANARY_ENDPOINT;

      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: MockConvexHttpClient,
      }));

      const mod = await import('@/app/api/health/route');
      GET = mod.GET;
    });

    it('returns 503 unhealthy when critical env vars are missing', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data).toMatchObject({
        status: 'unhealthy',
        env: {
          guestTokenSecret: false,
          convexUrl: false,
          canaryIngestKey: false,
        },
        observability: {
          status: 'degraded',
          canaryIngestKey: false,
        },
      });
    });
  });

  describe('with internal failure', () => {
    let GET: typeof import('@/app/api/health/route').GET;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
      vi.resetModules();
      process.env = { ...originalEnv };
      process.env.NEXT_PUBLIC_CANARY_API_KEY = 'sk_test_canary';
      process.env.NEXT_PUBLIC_CANARY_ENDPOINT = 'https://canary.test/';

      vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
        throw new Error('Date serialization failed');
      });

      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: MockConvexHttpClient,
      }));

      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal('fetch', fetchMock);
      fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

      const mod = await import('@/app/api/health/route');
      GET = mod.GET;
    });

    afterAll(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('returns 500 on internal error and reports to Canary', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ status: 'error' });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Healthcheck failed"')
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [, request] = fetchMock.mock.calls[0];
      const body = JSON.parse(String(request?.body)) as {
        context?: Record<string, unknown>;
      };

      expect(body.context).toEqual({
        durationMs: expect.any(Number),
        method: 'GET',
        route: '/api/health',
        source: 'api.health',
        status: 500,
      });
    });
  });

  describe('when Canary reporting stays pending', () => {
    let GET: typeof import('@/app/api/health/route').GET;
    const pendingFetch = vi.fn(() => new Promise<Response>(() => undefined));

    beforeAll(async () => {
      vi.resetModules();
      process.env = { ...originalEnv };
      process.env.NEXT_PUBLIC_CANARY_API_KEY = 'sk_test_canary';
      process.env.NEXT_PUBLIC_CANARY_ENDPOINT = 'https://canary.test/';

      vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
        throw new Error('Date serialization failed');
      });

      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: MockConvexHttpClient,
      }));

      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal('fetch', pendingFetch);

      const mod = await import('@/app/api/health/route');
      GET = mod.GET;
    });

    afterAll(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('returns the error response without waiting for Canary', async () => {
      const response = await Promise.race([
        GET(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('health route timed out')), 100);
        }),
      ]);

      expect(response.status).toBe(500);
      expect(pendingFetch).toHaveBeenCalledTimes(1);
    });
  });
});
