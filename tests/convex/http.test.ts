/** @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { withEnv } from '../helpers/envHelper';

const ORIGINAL_ENV = { ...process.env };

const { httpActionMock, httpRouterMock, routeSpy } = vi.hoisted(() => {
  const routeSpy = vi.fn();
  const httpRouterMock = vi.fn(() => ({
    route: routeSpy,
  }));
  const httpActionMock = vi.fn((handler) => handler);

  return {
    httpActionMock,
    httpRouterMock,
    routeSpy,
  };
});

vi.mock('convex/server', () => ({
  httpRouter: httpRouterMock,
}));

vi.mock('../../convex/_generated/server', () => ({
  httpAction: httpActionMock,
}));

describe('convex/http health route', () => {
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(() => {
    vi.resetModules();
    routeSpy.mockClear();
    httpRouterMock.mockClear();
    httpActionMock.mockClear();
    process.env = { ...ORIGINAL_ENV };
  });

  it('registers GET /api/health and returns 500 when required capabilities are missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        GUEST_TOKEN_SECRET: undefined,
        OPENROUTER_API_KEY: undefined,
      },
      async () => {
        await import('../../convex/http');

        expect(httpRouterMock).toHaveBeenCalledTimes(1);
        expect(routeSpy).toHaveBeenCalledTimes(1);

        const route = routeSpy.mock.calls[0][0];
        expect(route.path).toBe('/api/health');
        expect(route.method).toBe('GET');

        const response = await route.handler(
          {} as never,
          new Request('https://example.com/api/health')
        );

        expect(response.status).toBe(500);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          status: 500,
          environment: 'production',
          capabilities: {
            guestTokenVerification: {
              status: 'missing_required',
              available: false,
              required: true,
            },
            aiLineGeneration: {
              status: 'missing_required',
              available: false,
              required: true,
            },
          },
        });
      }
    );
  });

  it('returns 200 when production env is complete', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        GUEST_TOKEN_SECRET: 'test-secret',
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
      async () => {
        await import('../../convex/http');

        const route = routeSpy.mock.calls[0][0];
        const response = await route.handler(
          {} as never,
          new Request('https://example.com/api/health')
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expect(response.json()).resolves.toMatchObject({
          ok: true,
          status: 200,
          environment: 'production',
          capabilities: {
            guestTokenVerification: {
              status: 'ready',
              available: true,
              required: true,
            },
            aiLineGeneration: {
              status: 'ready',
              available: true,
              required: true,
            },
          },
        });
      }
    );
  });

  it('returns 500 when only one required capability is missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        GUEST_TOKEN_SECRET: 'test-secret',
        OPENROUTER_API_KEY: undefined,
      },
      async () => {
        await import('../../convex/http');

        const route = routeSpy.mock.calls[0][0];
        const response = await route.handler(
          {} as never,
          new Request('https://example.com/api/health')
        );

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          status: 500,
          environment: 'production',
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
      }
    );
  });
});
