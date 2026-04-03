/** @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { withEnv } from '../helpers/envHelper';

const ORIGINAL_ENV = { ...process.env };

describe('Convex env validation', () => {
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws at module load when GUEST_TOKEN_SECRET is missing in production-like Convex env', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        GUEST_TOKEN_SECRET: undefined,
      },
      async () => {
        await expect(import('../../convex/lib/guestToken')).rejects.toThrow(
          'GUEST_TOKEN_SECRET must be set in Convex environment'
        );
      }
    );
  });

  it('does not throw at module load when GUEST_TOKEN_SECRET is missing in development', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: undefined,
        GUEST_TOKEN_SECRET: undefined,
      },
      async () => {
        await expect(
          import('../../convex/lib/guestToken')
        ).resolves.toMatchObject({
          verifyGuestToken: expect.any(Function),
        });
      }
    );
  });

  it('logs a structured error at module load when OPENROUTER_API_KEY is missing in production-like Convex env', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        GUEST_TOKEN_SECRET: 'test-secret',
        OPENROUTER_API_KEY: undefined,
      },
      async () => {
        await import('../../convex/ai');
      }
    );

    const logCall = consoleErrorSpy.mock.calls.find(([entry]) =>
      String(entry).includes('OPENROUTER_API_KEY not configured at module load')
    );

    expect(logCall).toBeDefined();
    expect(JSON.parse(String(logCall?.[0]))).toMatchObject({
      level: 'error',
      message: 'OPENROUTER_API_KEY not configured at module load',
      service: 'convex',
    });
  });

  it('does not log an AI module-load error when OPENROUTER_API_KEY is present', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        GUEST_TOKEN_SECRET: 'test-secret',
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
      async () => {
        await import('../../convex/ai');
      }
    );

    expect(
      consoleErrorSpy.mock.calls.find(([entry]) =>
        String(entry).includes(
          'OPENROUTER_API_KEY not configured at module load'
        )
      )
    ).toBeUndefined();
  });

  it('reports production env as unhealthy when required Convex vars are missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        GUEST_TOKEN_SECRET: undefined,
        OPENROUTER_API_KEY: undefined,
      },
      async () => {
        const { getConvexEnvHealthReport } =
          await import('../../convex/lib/env');

        expect(getConvexEnvHealthReport()).toMatchObject({
          ok: false,
          status: 500,
          environment: 'production',
          missing: ['guestTokenSecret', 'openRouterApiKey'],
          checks: {
            guestTokenSecret: { configured: false, required: true },
            openRouterApiKey: { configured: false, required: true },
          },
        });
      }
    );
  });

  it('reports development env as healthy when only production-only Convex vars are missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: undefined,
        GUEST_TOKEN_SECRET: undefined,
        OPENROUTER_API_KEY: undefined,
      },
      async () => {
        const { getConvexEnvHealthReport } =
          await import('../../convex/lib/env');

        expect(getConvexEnvHealthReport()).toMatchObject({
          ok: true,
          status: 200,
          environment: 'development',
          missing: [],
          checks: {
            guestTokenSecret: { configured: false, required: false },
            openRouterApiKey: { configured: false, required: false },
          },
        });
      }
    );
  });
});
