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

// Store original env for restoration
const originalEnv = { ...process.env };

// Common env vars needed for healthy responses
const HEALTHY_ENV = {
  GUEST_TOKEN_SECRET: 'test-secret-for-health-checks',
  NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
};

// Shared mock for ConvexHttpClient - prevents real network calls
const mockQuery = vi.fn();
class MockConvexHttpClient {
  query = mockQuery;
}

/**
 * Tests grouped by env configuration to minimize module reloads.
 * Each describe block reloads the module once in beforeAll.
 * ConvexHttpClient is always mocked to prevent network calls.
 */

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
      process.env.NEXT_PUBLIC_CONVEX_URL = HEALTHY_ENV.NEXT_PUBLIC_CONVEX_URL;

      // Mock Convex to prevent network calls
      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: MockConvexHttpClient,
      }));
      mockQuery.mockResolvedValue({ ok: true });

      const mod = await import('@/app/api/health/route');
      GET = mod.GET;
    });

    afterEach(() => {
      mockQuery.mockReset();
      mockQuery.mockResolvedValue({ ok: true });
    });

    it('returns 200 with status, timestamp, and env checks', async () => {
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
        },
      });

      // Verify timestamp is valid ISO 8601
      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
    });

    it('includes Cache-Control: no-store header', async () => {
      const response = await GET();
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toBe('no-store');
    });

    it('returns connected when Convex ping succeeds', async () => {
      mockQuery.mockResolvedValue({ ok: true });
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.convex).toBe('connected');
      expect(mockQuery).toHaveBeenCalled();
    });

    it('returns unreachable when Convex ping fails', async () => {
      mockQuery.mockRejectedValue(new Error('Connection refused'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.convex).toBe('unreachable');
    });
  });

  describe('with missing env', () => {
    let GET: typeof import('@/app/api/health/route').GET;

    beforeAll(async () => {
      vi.resetModules();
      process.env = { ...originalEnv };
      delete process.env.GUEST_TOKEN_SECRET;
      delete process.env.NEXT_PUBLIC_CONVEX_URL;

      // Mock Convex to prevent network calls
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
        },
      });
    });
  });

  describe('with error injection', () => {
    let GET: typeof import('@/app/api/health/route').GET;
    let mockCaptureException: ReturnType<typeof vi.fn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
      vi.resetModules();
      process.env = { ...originalEnv };

      // Mock Date.toISOString to throw
      vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
        throw new Error('Date serialization failed');
      });

      // Mock Sentry
      mockCaptureException = vi.fn();
      vi.doMock('@sentry/nextjs', () => ({
        captureException: mockCaptureException,
      }));

      // Mock Convex
      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: MockConvexHttpClient,
      }));

      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mod = await import('@/app/api/health/route');
      GET = mod.GET;
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('returns 500 on internal error and logs to console and Sentry', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ status: 'error' });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Healthcheck failed',
        expect.any(Error)
      );
      expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('with Sentry failure', () => {
    let GET: typeof import('@/app/api/health/route').GET;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
      vi.resetModules();
      process.env = { ...originalEnv };

      // Mock Date.toISOString to throw
      vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
        throw new Error('Date serialization failed');
      });

      // Mock Sentry to fail on import
      vi.doMock('@sentry/nextjs', () => {
        throw new Error('Sentry not available');
      });

      // Mock Convex
      vi.doMock('convex/browser', () => ({
        ConvexHttpClient: MockConvexHttpClient,
      }));

      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mod = await import('@/app/api/health/route');
      GET = mod.GET;
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('handles Sentry import failure gracefully', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ status: 'error' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Healthcheck failed',
        expect.any(Error)
      );
    });
  });
});
