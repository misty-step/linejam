import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { captureRequestErrorMock } = vi.hoisted(() => ({
  captureRequestErrorMock: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureRequestError: captureRequestErrorMock,
}));

describe('instrumentation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does not initialize an unrelated runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', '');
    const { register } = await import('@/instrumentation');

    await expect(register()).resolves.toBeUndefined();
  });

  it('delegates Next request errors to the supported Sentry hook', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENABLED', '1');
    vi.stubEnv(
      'NEXT_PUBLIC_SENTRY_DSN',
      ['https://public', 'sentry.example.test/1'].join('@')
    );
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

    onRequestError(error, request, context);

    expect(captureRequestErrorMock).toHaveBeenCalledWith(
      error,
      request,
      context
    );
  });
});
