import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const fetchMock = vi.fn();

describe('instrumentation', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_test_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://canary.test/');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('register is a no-op', async () => {
    const { register } = await import('@/instrumentation');

    await expect(register()).resolves.toBeUndefined();
  });

  it('does not wait for Canary transport when request errors fire', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

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
  });
});
