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
const sentryMocks = vi.hoisted(() => ({
  captureCheckIn: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(),
}));
const captureCheckInMock = sentryMocks.captureCheckIn;
const captureExceptionMock = sentryMocks.captureException;
const flushSentryMock = sentryMocks.flush;
flushSentryMock.mockResolvedValue(true);
vi.mock('@sentry/nextjs', () => sentryMocks);

const originalEnv = { ...process.env };

const HEALTHY_ENV = {
  GUEST_TOKEN_SECRET: 'test-secret-for-health-checks',
  LINEJAM_DEPLOY_ENVIRONMENT: 'development',
  NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
  NEXT_PUBLIC_SENTRY_DSN: ['https://public', 'sentry.example/1'].join('@'),
  NEXT_PUBLIC_SENTRY_ENABLED: '1',
  NEXT_DEPLOYMENT_ID: 'test-deployment',
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

const HEALTHY_REPORT = {
  ok: true,
  status: 200,
  environment: 'development',
  deployment: {
    markerValid: true,
    url: HEALTHY_ENV.NEXT_PUBLIC_CONVEX_URL,
  },
  capabilities: {
    guestTokenVerification: {
      status: 'ready',
      available: true,
      required: false,
    },
    aiLineGeneration: {
      status: 'ready',
      available: true,
      required: false,
    },
  },
  configuration: { missingRequired: [] },
};

const mockQuery = vi.fn();
const mockMutation = vi.fn();

function parseJsonLogCalls(spy: ReturnType<typeof vi.spyOn>) {
  const calls = spy.mock.calls as Array<[unknown, ...unknown[]]>;
  return calls.map((call) => JSON.parse(String(call[0]))) as Array<
    Record<string, unknown>
  >;
}

class MockConvexHttpClient {
  query = mockQuery;
  mutation = mockMutation;
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
      process.env.GUEST_TOKEN_SECRET = HEALTHY_ENV.GUEST_TOKEN_SECRET;
      process.env.LINEJAM_DEPLOY_ENVIRONMENT =
        HEALTHY_ENV.LINEJAM_DEPLOY_ENVIRONMENT;
      process.env.NEXT_PUBLIC_CONVEX_URL = HEALTHY_ENV.NEXT_PUBLIC_CONVEX_URL;
      process.env.NEXT_PUBLIC_SENTRY_DSN = HEALTHY_ENV.NEXT_PUBLIC_SENTRY_DSN;
      process.env.NEXT_PUBLIC_SENTRY_ENABLED =
        HEALTHY_ENV.NEXT_PUBLIC_SENTRY_ENABLED;
      process.env.NEXT_DEPLOYMENT_ID = HEALTHY_ENV.NEXT_DEPLOYMENT_ID;
      process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY =
        HEALTHY_ENV.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;

      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: MockConvexHttpClient,
      }));
      mockQuery.mockResolvedValue(HEALTHY_REPORT);
      mockMutation.mockResolvedValue({ ok: true });

      const mod = await import('@/app/api/health/route');
      GET = mod.GET;
    });

    afterEach(() => {
      mockQuery.mockReset();
      mockQuery.mockResolvedValue(HEALTHY_REPORT);
      mockMutation.mockReset();
      mockMutation.mockResolvedValue({ ok: true });
      captureCheckInMock.mockReset();
      flushSentryMock.mockReset();
      flushSentryMock.mockResolvedValue(true);
      vi.useRealTimers();
    });

    it('returns healthy data and schedules missed-equivalent Sentry detection', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        deployment: {
          id: HEALTHY_ENV.NEXT_DEPLOYMENT_ID,
          skewProtection: true,
          stableServerActions: true,
        },
        env: {
          nodeEnv: expect.stringMatching(/^(development|test|production)$/),
          guestTokenSecret: true,
          guestTokenParity: true,
          convexDeploymentMatch: true,
          convexUrl: true,
          sentryEnabled: true,
        },
        observability: {
          status: 'ready',
          sentryEnabled: true,
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

      expect(captureCheckInMock).toHaveBeenCalledWith(
        {
          monitorSlug: 'linejam-production-health',
          status: 'ok',
          duration: expect.any(Number),
        },
        {
          schedule: { type: 'crontab', value: '*/5 * * * *' },
          checkinMargin: 2,
          maxRuntime: 1,
          timezone: 'UTC',
        }
      );
    });

    it('includes Cache-Control: no-store header', async () => {
      const response = await GET();
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('fails production readiness for malformed Server Action key material', async () => {
      const previousEnvironment = process.env.LINEJAM_DEPLOY_ENVIRONMENT;
      const previousKey = process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;
      try {
        process.env.LINEJAM_DEPLOY_ENVIRONMENT = 'production';
        process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = 'malformed-key';

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.deployment.stableServerActions).toBe(false);
      } finally {
        process.env.LINEJAM_DEPLOY_ENVIRONMENT = previousEnvironment;
        process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = previousKey;
      }
    });

    it('returns connected when Convex ping succeeds', async () => {
      mockQuery.mockResolvedValue(HEALTHY_REPORT);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.convex).toBe('connected');
      expect(mockQuery).toHaveBeenCalled();
      expect(mockMutation).toHaveBeenCalledWith(expect.anything(), {
        key: 'guestSession:deployment-readiness',
        proof: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        dryRun: true,
      });
    });

    it('returns 503 without exposing values when web and Convex guest secrets differ', async () => {
      mockMutation.mockRejectedValue(
        new Error('Invalid guest session throttle proof')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data).toMatchObject({
        status: 'unhealthy',
        env: { guestTokenSecret: true, guestTokenParity: false },
      });
      expect(JSON.stringify(data)).not.toContain(
        HEALTHY_ENV.GUEST_TOKEN_SECRET
      );
    });

    it('returns 503 when Convex is reachable but a required capability is unconfigured', async () => {
      // Regression: 2026-07-09 incident. Prod Convex was missing
      // OPENROUTER_API_KEY for days while this route stayed green because it
      // only proved connectivity. The capabilities report must gate health.
      mockQuery.mockResolvedValue({
        ok: false,
        status: 500,
        environment: 'production',
        deployment: {
          markerValid: true,
          url: HEALTHY_ENV.NEXT_PUBLIC_CONVEX_URL,
        },
        capabilities: {
          guestTokenVerification: {
            status: 'ready',
            available: true,
            required: true,
          },
          aiLineGeneration: {
            status: 'missing_required',
            available: false,
            required: true,
          },
        },
      });
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const response = await GET();
      const data = await response.json();
      consoleLogSpy.mockRestore();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.convex).toBe('connected');
      expect(data.convexEnv).toMatchObject({
        aiLineGeneration: { status: 'missing_required' },
      });
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
      expect(captureCheckInMock).toHaveBeenCalledWith(
        expect.objectContaining({
          monitorSlug: 'linejam-production-health',
          status: 'error',
        }),
        expect.objectContaining({
          schedule: { type: 'crontab', value: '*/5 * * * *' },
        })
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
      await vi.advanceTimersByTimeAsync(3_000);

      const response = await responsePromise;
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.convex).toBe('unreachable');
    });

    it('reports degraded observability when Sentry is not configured', async () => {
      const previous = process.env.NEXT_PUBLIC_SENTRY_DSN;
      try {
        delete process.env.NEXT_PUBLIC_SENTRY_DSN;

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toMatchObject({
          status: 'ok',
          env: {
            sentryEnabled: false,
          },
          observability: {
            status: 'degraded',
            sentryEnabled: false,
          },
        });
      } finally {
        process.env.NEXT_PUBLIC_SENTRY_DSN = previous;
      }
    });

    it('reports degraded observability for a malformed Sentry DSN', async () => {
      const previous = process.env.NEXT_PUBLIC_SENTRY_DSN;
      try {
        process.env.NEXT_PUBLIC_SENTRY_DSN =
          'https://sentry.example/not-a-project';

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toMatchObject({
          status: 'ok',
          env: {
            sentryEnabled: false,
          },
          observability: {
            status: 'degraded',
            sentryEnabled: false,
          },
        });
        expect(captureCheckInMock).not.toHaveBeenCalled();
      } finally {
        process.env.NEXT_PUBLIC_SENTRY_DSN = previous;
      }
    });

    it('preserves a healthy response when Sentry check-in capture fails', async () => {
      captureCheckInMock.mockImplementationOnce(() => {
        throw new Error('transport unavailable');
      });
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const response = await GET();

      expect(response.status).toBe(200);
      expect(parseJsonLogCalls(consoleErrorSpy)).toContainEqual(
        expect.objectContaining({
          level: 'error',
          message: 'Sentry health check-in failed',
          operation: 'healthCheckIn',
          failureCode: 'reportingFailure',
          errorName: 'Error',
        })
      );
    });

    it.each([undefined, '0', 'false'])(
      'does not send a Sentry check-in when the enable flag is %s',
      async (flag) => {
        const previous = process.env.NEXT_PUBLIC_SENTRY_ENABLED;
        try {
          if (flag === undefined) {
            delete process.env.NEXT_PUBLIC_SENTRY_ENABLED;
          } else {
            process.env.NEXT_PUBLIC_SENTRY_ENABLED = flag;
          }

          const response = await GET();
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.observability.sentryEnabled).toBe(false);
          expect(captureCheckInMock).not.toHaveBeenCalled();
          expect(flushSentryMock).not.toHaveBeenCalled();
        } finally {
          process.env.NEXT_PUBLIC_SENTRY_ENABLED = previous;
        }
      }
    );

    it('fails health when a remote deployment loses its environment marker', async () => {
      const previous = process.env.LINEJAM_DEPLOY_ENVIRONMENT;
      try {
        process.env.LINEJAM_DEPLOY_ENVIRONMENT = 'production';
        mockQuery.mockResolvedValue({
          ...HEALTHY_REPORT,
          environment: 'development',
          deployment: {
            markerValid: false,
            url: HEALTHY_ENV.NEXT_PUBLIC_CONVEX_URL,
          },
        });

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.env.convexDeploymentMatch).toBe(false);
      } finally {
        if (previous === undefined) {
          delete process.env.LINEJAM_DEPLOY_ENVIRONMENT;
        } else {
          process.env.LINEJAM_DEPLOY_ENVIRONMENT = previous;
        }
      }
    });

    it('fails health when the web deployment marker is missing', async () => {
      const previous = process.env.LINEJAM_DEPLOY_ENVIRONMENT;
      try {
        delete process.env.LINEJAM_DEPLOY_ENVIRONMENT;
        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.env.convexDeploymentMatch).toBe(false);
      } finally {
        if (previous !== undefined) {
          process.env.LINEJAM_DEPLOY_ENVIRONMENT = previous;
        }
      }
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
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_ENABLED;

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
          guestTokenParity: false,
          convexUrl: false,
          sentryEnabled: false,
        },
        observability: {
          status: 'degraded',
          sentryEnabled: false,
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
      process.env.NEXT_PUBLIC_SENTRY_DSN = HEALTHY_ENV.NEXT_PUBLIC_SENTRY_DSN;
      process.env.NEXT_PUBLIC_SENTRY_ENABLED =
        HEALTHY_ENV.NEXT_PUBLIC_SENTRY_ENABLED;

      vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
        throw new Error('Date serialization failed');
      });

      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: MockConvexHttpClient,
      }));

      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mod = await import('@/app/api/health/route');
      GET = mod.GET;
    });

    afterAll(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('returns 500 on internal error and reports to Sentry', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ status: 'error' });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Healthcheck failed"')
      );
      expect(captureExceptionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Date serialization failed',
        }),
        {
          contexts: {
            linejam: {
              durationMs: expect.any(Number),
            },
          },
        }
      );
    });
  });
});
