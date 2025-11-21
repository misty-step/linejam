import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('/api/health', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with status, timestamp, and env', async () => {
    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'ok',
      timestamp: expect.any(String),
      env: expect.stringMatching(/^(development|test|production)$/),
    });

    // Verify timestamp is valid ISO 8601
    const timestamp = new Date(data.timestamp);
    expect(timestamp.toISOString()).toBe(data.timestamp);
  });

  it('includes Cache-Control: no-store header', async () => {
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
});
