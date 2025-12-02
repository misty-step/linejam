/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Common env vars needed for healthy responses
const HEALTHY_ENV = {
  GUEST_TOKEN_SECRET: 'test-secret-for-health-checks',
  NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
};

describe('/api/health', () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it('returns 200 with status, timestamp, and env checks', async () => {
    // Set required env vars for healthy response
    process.env.GUEST_TOKEN_SECRET = HEALTHY_ENV.GUEST_TOKEN_SECRET;
    process.env.NEXT_PUBLIC_CONVEX_URL = HEALTHY_ENV.NEXT_PUBLIC_CONVEX_URL;

    const { GET } = await import('@/app/api/health/route');

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

  it('returns 503 unhealthy when critical env vars are missing', async () => {
    // Don't set GUEST_TOKEN_SECRET or NEXT_PUBLIC_CONVEX_URL
    delete process.env.GUEST_TOKEN_SECRET;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    const { GET } = await import('@/app/api/health/route');

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

  it('includes Cache-Control: no-store header', async () => {
    // Set required env vars
    process.env.GUEST_TOKEN_SECRET = HEALTHY_ENV.GUEST_TOKEN_SECRET;
    process.env.NEXT_PUBLIC_CONVEX_URL = HEALTHY_ENV.NEXT_PUBLIC_CONVEX_URL;

    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const cacheControl = response.headers.get('Cache-Control');

    expect(cacheControl).toBe('no-store');
  });

  it('returns 500 on internal error and logs to logger and Sentry', async () => {
    // Mock Date.toISOString to throw
    const originalToISOString = Date.prototype.toISOString;
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
      throw new Error('Date serialization failed');
    });

    // Mock logger
    const mockLogger = { error: vi.fn() };
    vi.doMock('@/lib/logger', () => ({ logger: mockLogger }));

    // Mock Sentry
    const mockCaptureException = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({
      captureException: mockCaptureException,
    }));

    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ status: 'error' });

    // Verify Cache-Control still set on error
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    // Verify logger.error was called
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Healthcheck failed'
    );

    // Verify Sentry.captureException was called
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));

    // Restore
    Date.prototype.toISOString = originalToISOString;
  });

  it('handles Sentry import failure gracefully', async () => {
    // Mock Date.toISOString to throw
    const originalToISOString = Date.prototype.toISOString;
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
      throw new Error('Date serialization failed');
    });

    // Mock logger
    const mockLogger = { error: vi.fn() };
    vi.doMock('@/lib/logger', () => ({ logger: mockLogger }));

    // Mock Sentry to fail on import
    vi.doMock('@sentry/nextjs', () => {
      throw new Error('Sentry not available');
    });

    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const data = await response.json();

    // Should still return 500 even if Sentry fails
    expect(response.status).toBe(500);
    expect(data).toEqual({ status: 'error' });

    // Logger should still be called
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Healthcheck failed'
    );

    // Restore
    Date.prototype.toISOString = originalToISOString;
  });

  it('returns connected when Convex ping succeeds', async () => {
    // Set required env vars
    process.env.GUEST_TOKEN_SECRET = HEALTHY_ENV.GUEST_TOKEN_SECRET;
    process.env.NEXT_PUBLIC_CONVEX_URL = HEALTHY_ENV.NEXT_PUBLIC_CONVEX_URL;

    // Mock ConvexHttpClient as a class
    const mockQuery = vi.fn().mockResolvedValue({ ok: true });
    class MockConvexHttpClient {
      query = mockQuery;
    }
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: MockConvexHttpClient,
    }));

    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.convex).toBe('connected');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('returns unreachable when Convex ping fails', async () => {
    // Set required env vars
    process.env.GUEST_TOKEN_SECRET = HEALTHY_ENV.GUEST_TOKEN_SECRET;
    process.env.NEXT_PUBLIC_CONVEX_URL = HEALTHY_ENV.NEXT_PUBLIC_CONVEX_URL;

    // Mock ConvexHttpClient as a class that throws on query
    const mockQuery = vi
      .fn()
      .mockRejectedValue(new Error('Connection refused'));
    class MockConvexHttpClient {
      query = mockQuery;
    }
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: MockConvexHttpClient,
    }));

    // Suppress console.warn
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.convex).toBe('unreachable');
  });

  it('handles logger import failure with console.error fallback', async () => {
    // Mock Date.toISOString to throw
    const originalToISOString = Date.prototype.toISOString;
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
      throw new Error('Date serialization failed');
    });

    // Mock logger to fail on import
    vi.doMock('@/lib/logger', () => {
      throw new Error('Logger not available');
    });

    // Mock Sentry to succeed
    const mockCaptureException = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({
      captureException: mockCaptureException,
    }));

    // Spy on console.error
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ status: 'error' });

    // console.error should be called as fallback
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Healthcheck failed',
      expect.any(Error)
    );

    // Restore
    Date.prototype.toISOString = originalToISOString;
  });
});
