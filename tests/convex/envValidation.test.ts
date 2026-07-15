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
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        CANARY_API_KEY: undefined,
        CANARY_ENDPOINT: undefined,
        CLERK_JWT_ISSUER_DOMAIN: undefined,
        GUEST_TOKEN_SECRET: undefined,
      },
      async () => {
        await expect(import('../../convex/lib/guestToken')).rejects.toThrow(
          'GUEST_TOKEN_SECRET must be set in Convex environment'
        );
      }
    );
  });

  it('does not expose the guest-session throttle with a fallback secret in production', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: undefined,
      },
      async () => {
        await expect(import('../../convex/guestSessions')).rejects.toThrow(
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

  it('never enables the development fallback secret on an unmarked remote deployment', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: undefined,
        GUEST_TOKEN_SECRET: undefined,
      },
      async () => {
        await expect(import('../../convex/lib/guestToken')).rejects.toThrow(
          'GUEST_TOKEN_SECRET must be set in Convex environment'
        );
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
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: 'test-secret',
        OPENROUTER_API_KEY: undefined,
      },
      async () => {
        await import('../../convex/lib/env');
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
      source: 'convex/env',
    });
  });

  it('does not log module-load error when OPENROUTER_API_KEY is present', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: 'test-secret',
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
      async () => {
        await import('../../convex/lib/env');
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

  it('reports production env as unhealthy when required Convex capabilities are missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        CANARY_API_KEY: undefined,
        CANARY_ENDPOINT: undefined,
        CLERK_JWT_ISSUER_DOMAIN: undefined,
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
          configuration: {
            missingRequired: expect.arrayContaining([
              'CANARY_API_KEY',
              'CANARY_ENDPOINT',
              'CLERK_JWT_ISSUER_DOMAIN',
              'GUEST_TOKEN_SECRET',
              'OPENROUTER_API_KEY',
            ]),
          },
        });
      }
    );
  });

  it('reports production env as unhealthy when only guest token secret is missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: undefined,
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
      async () => {
        const { getConvexEnvHealthReport } =
          await import('../../convex/lib/env');

        expect(getConvexEnvHealthReport()).toMatchObject({
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
              status: 'ready',
              available: true,
              required: true,
            },
          },
        });
      }
    );
  });

  it('uses the manifest to fail health when a non-capability production name is missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        CANARY_API_KEY: 'test-canary-key',
        CANARY_ENDPOINT: 'https://canary.test',
        CLERK_JWT_ISSUER_DOMAIN: undefined,
        GUEST_TOKEN_SECRET: 'test-secret',
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
      async () => {
        const { getConvexEnvHealthReport } =
          await import('../../convex/lib/env');

        expect(getConvexEnvHealthReport()).toMatchObject({
          ok: false,
          status: 500,
          capabilities: {
            guestTokenVerification: { status: 'ready' },
            aiLineGeneration: { status: 'ready' },
          },
          configuration: {
            missingRequired: ['CLERK_JWT_ISSUER_DOMAIN'],
          },
        });
      }
    );
  });

  it('reports development env as healthy with optional capabilities disabled', async () => {
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
          capabilities: {
            guestTokenVerification: {
              status: 'disabled',
              available: false,
              required: false,
            },
            aiLineGeneration: {
              status: 'disabled',
              available: false,
              required: false,
            },
          },
        });
      }
    );
  });

  it('fails health for a missing or invalid deployment marker on a remote deployment', async () => {
    for (const marker of [undefined, 'prod']) {
      vi.resetModules();
      await withEnv(
        {
          CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
          LINEJAM_DEPLOY_ENVIRONMENT: marker,
          GUEST_TOKEN_SECRET: 'test-secret',
          OPENROUTER_API_KEY: 'test-openrouter-key',
        },
        async () => {
          const { getConvexEnvHealthReport } =
            await import('../../convex/lib/env');

          expect(getConvexEnvHealthReport()).toMatchObject({
            ok: false,
            status: 500,
            environment: 'development',
            deployment: {
              markerValid: false,
              url: 'https://linejam.convex.cloud',
            },
          });
        }
      );
    }
  });

  it('keeps runtime config and health report stable after module load', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: 'first-secret',
        OPENROUTER_API_KEY: undefined,
      },
      async () => {
        const { getConvexRuntimeConfig, getConvexEnvHealthReport } =
          await import('../../convex/lib/env');

        process.env.GUEST_TOKEN_SECRET = 'second-secret';
        process.env.OPENROUTER_API_KEY = 'late-openrouter-key';

        expect(getConvexRuntimeConfig()).toMatchObject({
          environment: 'production',
          guestTokenSecret: 'first-secret',
          openRouterApiKey: undefined,
        });
        expect(getConvexEnvHealthReport()).toMatchObject({
          ok: false,
          status: 500,
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
