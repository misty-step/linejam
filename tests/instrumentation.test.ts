import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureRequestError = vi.fn();
const fetchMock = vi.fn();

describe('onRequestError', () => {
  beforeEach(() => {
    vi.resetModules();
    captureRequestError.mockReset();
    fetchMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_test_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://canary.test/');
    vi.stubGlobal('fetch', fetchMock);

    vi.doMock('@/lib/sentry', () => ({
      isSentryEnabled: true,
    }));

    vi.doMock('@sentry/nextjs', () => ({
      captureRequestError,
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not wait for Canary before handing off to Sentry', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    captureRequestError.mockResolvedValue(undefined);

    const { onRequestError } = await import('@/instrumentation');
    const error = new Error('boom');
    const request = {
      path: '/room/ABCD',
      method: 'GET',
      headers: {},
    };
    const context = {
      routerKind: 'App Router' as const,
      routePath: '/room/[code]',
      routeType: 'render' as const,
      renderSource: 'react-server-components' as const,
    };

    await expect(
      Promise.race([
        onRequestError(error, request, context),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('instrumentation request error timed out')),
            100
          );
        }),
      ])
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(captureRequestError).toHaveBeenCalledWith(error, request, context);
  });
});
