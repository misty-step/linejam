/** @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { withEnv } from '../helpers/envHelper';

const ORIGINAL_ENV = { ...process.env };
const COMPLETE_PRODUCTION_ENV = {
  CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
  LINEJAM_DEPLOY_ENVIRONMENT: 'production',
  CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.test',
  GUEST_TOKEN_SECRET: 'test-secret',
  GITHUB_ISSUES_TOKEN: 'test-github-token',
  GITHUB_REPOSITORY_NAME: 'linejam',
  GITHUB_REPOSITORY_OWNER: 'misty-step',
  LINEJAM_SENTRY_ENABLED: 'true',
  SENTRY_DSN: ['https://public', 'sentry.example.test/1'].join('@'),
  SENTRY_ENVIRONMENT: 'production',
  SENTRY_RELEASE: 'a'.repeat(40),
  SENTRY_EVENT_WRITE_TOKEN: 'test-event-token',
  SENTRY_EXPECTED_APP_ID: '160944',
  SENTRY_EXPECTED_INSTALLATION_UUID: '268a6e8e-c341-414e-bee6-20125b9987ef',
  SENTRY_EXPECTED_PROJECT_ID: '4510762050650112',
  SENTRY_GITHUB_INTEGRATION_ID: '338522',
  SENTRY_ORG: 'misty-step',
  SENTRY_WEBHOOK_SECRET: 'test-webhook-secret',
};

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

  it('reports production env as unhealthy when required Convex configuration is missing', async () => {
    await withEnv(
      {
        ...COMPLETE_PRODUCTION_ENV,
        CLERK_JWT_ISSUER_DOMAIN: undefined,
        GUEST_TOKEN_SECRET: undefined,
        GITHUB_ISSUES_TOKEN: undefined,
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
          },
          configuration: {
            missingRequired: [
              'CLERK_JWT_ISSUER_DOMAIN',
              'GITHUB_ISSUES_TOKEN',
              'GUEST_TOKEN_SECRET',
            ],
          },
        });
      }
    );
  });

  it('uses the manifest to fail health when a non-capability production name is missing', async () => {
    await withEnv(
      {
        ...COMPLETE_PRODUCTION_ENV,
        CLERK_JWT_ISSUER_DOMAIN: undefined,
      },
      async () => {
        const { getConvexEnvHealthReport } =
          await import('../../convex/lib/env');

        expect(getConvexEnvHealthReport()).toMatchObject({
          ok: false,
          status: 500,
          capabilities: {
            guestTokenVerification: { status: 'ready' },
          },
          configuration: {
            missingRequired: ['CLERK_JWT_ISSUER_DOMAIN'],
          },
        });
      }
    );
  });

  it('does not require or expose retired machine-authorship configuration', async () => {
    await withEnv(
      {
        ...COMPLETE_PRODUCTION_ENV,
        OPENROUTER_API_KEY: undefined,
        AI_PROVIDER_ENABLED: undefined,
        AI_MODEL: undefined,
      },
      async () => {
        const { getConvexRuntimeConfig, getConvexEnvHealthReport } =
          await import('../../convex/lib/env');
        const config = getConvexRuntimeConfig();
        const health = getConvexEnvHealthReport();

        expect(health).toMatchObject({
          ok: true,
          status: 200,
          capabilities: {
            guestTokenVerification: { status: 'ready' },
          },
          configuration: { missingRequired: [] },
        });
        expect(config).not.toHaveProperty('openRouterApiKey');
        expect(health.capabilities).not.toHaveProperty('aiLineGeneration');
      }
    );
  });

  it('reports development env as healthy with optional guest verification disabled', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: undefined,
        GUEST_TOKEN_SECRET: undefined,
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
        ...COMPLETE_PRODUCTION_ENV,
        GUEST_TOKEN_SECRET: 'first-secret',
      },
      async () => {
        const { getConvexRuntimeConfig, getConvexEnvHealthReport } =
          await import('../../convex/lib/env');

        process.env.GUEST_TOKEN_SECRET = 'second-secret';

        expect(getConvexRuntimeConfig()).toMatchObject({
          environment: 'production',
          guestTokenSecret: 'first-secret',
        });
        expect(getConvexEnvHealthReport()).toMatchObject({
          ok: true,
          status: 200,
          capabilities: {
            guestTokenVerification: {
              status: 'ready',
              available: true,
              required: true,
            },
          },
        });
      }
    );
  });
});
