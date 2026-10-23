/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { withEnv } from '@/tests/helpers/envHelper';
import { validateEnv, validateProductionBindings } from '@/lib/env';

const publicConfiguration = {
  LINEJAM_DEPLOY_ENVIRONMENT: 'production',
  NEXT_DEPLOYMENT_ID: 'a'.repeat(40),
  NEXT_PUBLIC_CONVEX_URL: 'https://linejam.mistystep.io/backend',
  NEXT_PUBLIC_SENTRY_DSN: ['https://public', 'sentry.example/1'].join('@'),
  NEXT_PUBLIC_SENTRY_ENABLED: '1',
};

describe('uncredentialed production builds', () => {
  it('builds without runtime credentials but rejects those missing bindings at runtime', async () => {
    await withEnv(
      {
        ...publicConfiguration,
        NODE_ENV: 'production',
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: undefined,
        GUEST_TOKEN_SECRET: undefined,
        NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: undefined,
      },
      async () => {
        expect(() => validateEnv('build')).not.toThrow();
        expect(() => validateEnv()).toThrow(/GUEST_TOKEN_SECRET/);
      }
    );
    expect(() => validateProductionBindings(publicConfiguration)).toThrow(
      /GUEST_TOKEN_SECRET[\s\S]*NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/
    );
  });

  it('accepts complete production bindings, rejects invalid keys and recovers', () => {
    const bindings = {
      ...publicConfiguration,
      GUEST_TOKEN_SECRET: 'runtime-only-test-secret',
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString(
        'base64'
      ),
    };
    expect(() => validateProductionBindings(bindings)).not.toThrow();
    expect(() =>
      validateProductionBindings({
        ...bindings,
        NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: 'invalid',
      })
    ).toThrow(
      /Invalid environment variables:[\s\S]*NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/
    );
    expect(() => validateProductionBindings(bindings)).not.toThrow();
  });

  it('does not let a Dependabot actor bypass production runtime validation', () => {
    expect(() =>
      validateProductionBindings({
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GITHUB_ACTOR: 'dependabot[bot]',
      })
    ).toThrow(/GUEST_TOKEN_SECRET/);
  });
});
