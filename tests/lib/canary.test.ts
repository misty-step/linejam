/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

describe('captureCanaryException', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_test_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://canary.test/');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('only sends allowlisted context fields', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const { captureCanaryException } = await import('@/lib/canary');
    await captureCanaryException(new Error('boom'), {
      roomCode: 'ABCD',
      operation: 'joinRoom',
      userId: 'user_123',
      guestToken: 'guest-token',
      displayName: 'Ada',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      context?: Record<string, unknown>;
    };

    expect(body.context).toEqual({
      operation: 'joinRoom',
      roomCode: 'ABCD',
    });
  });

  it('logs transport failures with scrubbed context', async () => {
    const reportingError = new Error('network down');
    fetchMock.mockRejectedValue(reportingError);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { captureCanaryException } = await import('@/lib/canary');
    const originalError = new Error('original boom');
    const context = { route: '/room/ABCD', userId: 'user_123' };

    await captureCanaryException(originalError, context);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Canary capture failed:',
      reportingError,
      {
        originalError,
        context: { route: '/room/ABCD' },
      }
    );
  });

  it('treats non-2xx responses as reporting failures', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 401, statusText: 'Unauthorized' })
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { captureCanaryException } = await import('@/lib/canary');
    await captureCanaryException(new Error('boom'), { source: 'api.health' });

    const reportingError = consoleErrorSpy.mock.calls[0]?.[1];

    expect(reportingError).toBeInstanceOf(Error);
    expect((reportingError as Error).message).toBe(
      'Canary capture returned 401 Unauthorized'
    );
    expect(consoleErrorSpy.mock.calls[0]?.[2]).toEqual({
      originalError: expect.any(Error),
      context: { source: 'api.health' },
    });
  });
});
