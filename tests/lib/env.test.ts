/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withEnv } from '@/tests/helpers/envHelper';
import { validateEnv, getServerGuestTokenSecret } from '@/lib/env';
import { getConvexServerUrl, isLocalServerMode } from '@/lib/localMode';

describe('validateEnv', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('accepts production env when Convex and Sentry public vars are configured', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CONVEX_URL: 'https://convex.example',
        NEXT_PUBLIC_SENTRY_DSN: ['https://public', 'sentry.example/1'].join(
          '@'
        ),
        NEXT_PUBLIC_SENTRY_ENABLED: '1',
      },
      async () => {
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).not.toThrow();
      }
    );
  });

  it('throws when Sentry public vars are missing in production', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CONVEX_URL: 'https://convex.example',
        NEXT_PUBLIC_SENTRY_DSN: undefined,
        NEXT_PUBLIC_SENTRY_ENABLED: undefined,
      },
      async () => {
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).toThrow(
          /NEXT_PUBLIC_SENTRY_DSN[\s\S]*NEXT_PUBLIC_SENTRY_ENABLED/
        );
      }
    );
  });

  it('skips secret-backed env requirements for dependabot builds', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        GITHUB_ACTOR: 'dependabot[bot]',
        GUEST_TOKEN_SECRET: undefined,
        NEXT_PUBLIC_CONVEX_URL: undefined,
        NEXT_PUBLIC_SENTRY_DSN: undefined,
        NEXT_PUBLIC_SENTRY_ENABLED: '1',
      },
      async () => {
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).not.toThrow();
      }
    );
  });

  it('throws when Sentry is not explicitly enabled', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CONVEX_URL: 'https://convex.example',
        NEXT_PUBLIC_SENTRY_DSN: ['https://public', 'sentry.example/1'].join(
          '@'
        ),
        NEXT_PUBLIC_SENTRY_ENABLED: '0',
      },
      async () => {
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).toThrow(
          /Invalid environment variables:[\s\S]*NEXT_PUBLIC_SENTRY_ENABLED/
        );
      }
    );
  });

  it.each([
    'not-a-dsn',
    ['http://public', 'sentry.example/1'].join('@'),
    'https://sentry.example/1',
    ['https://public:secret', 'sentry.example/1'].join('@'),
    ['https://public', 'sentry.example/project'].join('@'),
  ])('rejects malformed Sentry DSN %s', async (dsn) => {
    await withEnv(
      {
        NODE_ENV: 'production',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CONVEX_URL: 'https://convex.example',
        NEXT_PUBLIC_SENTRY_DSN: dsn,
        NEXT_PUBLIC_SENTRY_ENABLED: '1',
      },
      async () => {
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).toThrow(
          /Invalid environment variables:[\s\S]*NEXT_PUBLIC_SENTRY_DSN/
        );
      }
    );
  });

  it('requires deployment skew controls for the real production target', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CONVEX_URL: 'https://convex.example',
        NEXT_PUBLIC_SENTRY_DSN: ['https://public', 'sentry.example/1'].join(
          '@'
        ),
        NEXT_PUBLIC_SENTRY_ENABLED: '1',
        NEXT_DEPLOYMENT_ID: undefined,
        NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: undefined,
      },
      async () => {
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).toThrow(
          /NEXT_DEPLOYMENT_ID[\s\S]*NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/
        );
      }
    );
  });

  it('rejects a production deployment ID that is not the served commit SHA', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CONVEX_URL: 'https://convex.example',
        NEXT_PUBLIC_SENTRY_DSN: ['https://public', 'sentry.example/1'].join(
          '@'
        ),
        NEXT_PUBLIC_SENTRY_ENABLED: '1',
        NEXT_DEPLOYMENT_ID: 'master',
        NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          'base64'
        ),
      },
      async () => {
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).toThrow(
          /Invalid environment variables:[\s\S]*NEXT_DEPLOYMENT_ID/
        );
      }
    );
  });

  it('rejects a production Server Action key that is not 32-byte base64', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CONVEX_URL: 'https://convex.example',
        NEXT_PUBLIC_SENTRY_DSN: ['https://public', 'sentry.example/1'].join(
          '@'
        ),
        NEXT_PUBLIC_SENTRY_ENABLED: '1',
        NEXT_DEPLOYMENT_ID: 'a'.repeat(40),
        NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: 'not-a-valid-key',
      },
      async () => {
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).toThrow(
          /Invalid environment variables:[\s\S]*NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/
        );
      }
    );
  });
});

describe('isolated local mode', () => {
  const localEnv = {
    NODE_ENV: 'production',
    LINEJAM_LOCAL: '1',
    NEXT_PUBLIC_LINEJAM_LOCAL: '1',
    LINEJAM_DEPLOY_ENVIRONMENT: 'development',
    NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3210',
    CONVEX_SERVER_URL: 'http://convex:3210',
    CONVEX_DEPLOYMENT: undefined,
    GUEST_TOKEN_SECRET: 'isolated-test-guest-secret',
    NEXT_PUBLIC_SENTRY_DSN: undefined,
    NEXT_PUBLIC_SENTRY_ENABLED: undefined,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined,
    CLERK_SECRET_KEY: undefined,
  };

  it('uses the private transport and explicit guest secret without account or telemetry keys', async () => {
    await withEnv(localEnv, async () => {
      validateEnv();
      expect(isLocalServerMode()).toBe(true);
      expect(getConvexServerUrl()).toBe('http://convex:3210');
      expect(getServerGuestTokenSecret()).toBe(localEnv.GUEST_TOKEN_SECRET);
    });
  });

  it.each([
    { LINEJAM_LOCAL: undefined },
    { NEXT_PUBLIC_LINEJAM_LOCAL: undefined },
    { LINEJAM_DEPLOY_ENVIRONMENT: undefined },
    { LINEJAM_DEPLOY_ENVIRONMENT: 'production' },
    { LINEJAM_DEPLOY_ENVIRONMENT: 'preview' },
    { CONVEX_DEPLOYMENT: 'prod:shared-deployment' },
    { NEXT_PUBLIC_CONVEX_URL: undefined },
    { NEXT_PUBLIC_CONVEX_URL: 'https://shared.convex.cloud' },
    { NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1.external.test:3210' },
    { NEXT_PUBLIC_CONVEX_URL: 'http://user@127.0.0.1:3210' },
    { CONVEX_SERVER_URL: 'https://shared.convex.cloud' },
  ])('rejects unsafe local configuration %j', async (override) => {
    await withEnv({ ...localEnv, ...override }, async () => {
      expect(() => validateEnv()).toThrow(/Local mode requires/);
    });
  });

  it('never substitutes the insecure development secret for a missing local secret', async () => {
    await withEnv(
      { ...localEnv, NODE_ENV: 'development', GUEST_TOKEN_SECRET: undefined },
      async () => {
        expect(() => validateEnv()).toThrow(/GUEST_TOKEN_SECRET/);
        expect(() => getServerGuestTokenSecret()).toThrow(/GUEST_TOKEN_SECRET/);
      }
    );
  });

  it('does not redirect a deployed server to a local transport override', async () => {
    await withEnv(
      {
        ...localEnv,
        LINEJAM_LOCAL: undefined,
        NEXT_PUBLIC_LINEJAM_LOCAL: undefined,
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        NEXT_PUBLIC_CONVEX_URL: 'https://deployed.convex.cloud',
      },
      async () => {
        expect(getConvexServerUrl()).toBe('https://deployed.convex.cloud');
        expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_SENTRY_DSN/);
      }
    );
  });
});
