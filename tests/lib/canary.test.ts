/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

describe('canary helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports enabled state from server or public keys', async () => {
    vi.stubEnv('CANARY_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', '');
    let canary = await import('@/lib/canary');
    expect(canary.isCanaryEnabled()).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_public');
    canary = await import('@/lib/canary');
    expect(canary.isCanaryEnabled()).toBe(true);

    vi.stubEnv('CANARY_API_KEY', 'sk_server');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', '');
    canary = await import('@/lib/canary');
    expect(canary.isCanaryEnabled()).toBe(true);
  });

  it('treats placeholder Canary keys as disabled', async () => {
    vi.stubEnv('CANARY_API_KEY', 'example_canary_server_key');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'example_canary_write_key');

    const canary = await import('@/lib/canary');
    expect(canary.isCanaryEnabled()).toBe(false);
  });

  it('scrubs nested context objects and arrays using the allowlist', async () => {
    const { scrubCanaryContext } = await import('@/lib/canary');

    expect(
      scrubCanaryContext({
        source: 'window.error',
        path: ['/room/ABCD', { routePath: '/room/[code]' }, { userId: 'x' }],
        route: { routeType: 'app', userId: 'secret' },
        metadata: { roomCode: 'ABCD' },
      })
    ).toEqual({
      source: 'window.error',
      path: ['/room/ABCD', { routePath: '/room/[code]' }],
      route: { routeType: 'app' },
    });
  });

  it('returns undefined scrubbed context when no allowlisted keys remain', async () => {
    const { scrubCanaryContext } = await import('@/lib/canary');

    expect(
      scrubCanaryContext({
        userId: 'user_123',
        profile: { email: 'ada@example.com' },
      })
    ).toBeUndefined();
  });
});

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

  it('normalizes string errors', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const { captureCanaryException } = await import('@/lib/canary');
    await captureCanaryException('string failure', { source: 'window.error' });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      error_class: string;
      message: string;
    };

    expect(body.error_class).toBe('StringError');
    expect(body.message).toBe('string failure');
  });

  it('normalizes unknown non-error values', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const { captureCanaryException } = await import('@/lib/canary');
    await captureCanaryException(
      { reason: 'badness' },
      { source: 'api.health' }
    );

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      error_class: string;
      message: string;
    };

    expect(body.error_class).toBe('UnknownError');
    expect(body.message).toBe('[object Object]');
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
        originalError: {
          errorClass: 'Error',
          message: 'original boom',
          stackTrace: expect.any(String),
        },
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
      originalError: {
        errorClass: 'Error',
        message: 'boom',
        stackTrace: expect.any(String),
      },
      context: { source: 'api.health' },
    });
  });

  it('prefers server-side Canary credentials when available', async () => {
    vi.stubEnv('CANARY_API_KEY', 'sk_server_canary');
    vi.stubEnv('CANARY_ENDPOINT', 'https://server-canary.test/');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_public_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://public-canary.test/');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const { captureCanaryException } = await import('@/lib/canary');
    await captureCanaryException(new Error('server preferred'));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://server-canary.test/api/v1/errors',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_server_canary',
        }),
      })
    );
  });

  it('uses default endpoint and production environment as fallback', async () => {
    vi.stubEnv('CANARY_ENDPOINT', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', '');
    vi.stubEnv('CANARY_ENVIRONMENT', '');
    vi.stubEnv('NODE_ENV', '');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const { captureCanaryException } = await import('@/lib/canary');
    await captureCanaryException(new Error('fallbacks'));

    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as { environment: string };

    expect(url).toBe('https://canary-obs.fly.dev/api/v1/errors');
    expect(body.environment).toBe('production');
  });

  it('uses CANARY_ENVIRONMENT when provided', async () => {
    vi.stubEnv('CANARY_ENVIRONMENT', 'staging');
    vi.stubEnv('NODE_ENV', 'test');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const { captureCanaryException } = await import('@/lib/canary');
    await captureCanaryException(new Error('environment precedence'));

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as { environment: string };
    expect(body.environment).toBe('staging');
  });

  it('skips reporting when no Canary key is configured', async () => {
    vi.stubEnv('CANARY_API_KEY', '');
    vi.stubEnv('CANARY_ENDPOINT', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', '');

    const { captureCanaryException } = await import('@/lib/canary');
    await captureCanaryException(new Error('disabled'));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
