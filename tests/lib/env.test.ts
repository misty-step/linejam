/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withEnv } from '@/tests/helpers/envHelper';

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
        NEXT_DEPLOYMENT_ID: 'abc123',
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
