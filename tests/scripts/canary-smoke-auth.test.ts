import './canary-test-env';
import { describe, expect, it } from 'vitest';

import { getSmokeClerkKeyError } from '@/scripts/canary/smoke-auth.mjs';

describe('getSmokeClerkKeyError', () => {
  const env = (values: Record<string, string>): NodeJS.ProcessEnv => ({
    NODE_ENV: 'test',
    ...values,
  });

  it('returns null when authenticated smoke is disabled', () => {
    expect(
      getSmokeClerkKeyError(
        'https://www.linejam.app',
        env({
          PLAYWRIGHT_REQUIRE_AUTH_SMOKE: '0',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
          CLERK_SECRET_KEY: 'sk_test_example',
        })
      )
    ).toBeNull();
  });

  it('rejects production smoke with a test publishable key', () => {
    expect(
      getSmokeClerkKeyError(
        'https://www.linejam.app',
        env({
          PLAYWRIGHT_REQUIRE_AUTH_SMOKE: '1',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
          CLERK_SECRET_KEY: 'sk_live_example',
        })
      )
    ).toBe(
      'Authenticated production smoke requires a live Clerk publishable key. Use production-aligned Clerk env instead of localhost test keys.'
    );
  });

  it('rejects production smoke with a test secret key', () => {
    expect(
      getSmokeClerkKeyError(
        'https://www.linejam.app',
        env({
          PLAYWRIGHT_REQUIRE_AUTH_SMOKE: '1',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_example',
          CLERK_SECRET_KEY: 'sk_test_example',
        })
      )
    ).toBe(
      'Authenticated production smoke requires a live Clerk secret key. Use production-aligned Clerk env instead of localhost test keys.'
    );
  });

  it('allows preview smoke to use test keys', () => {
    expect(
      getSmokeClerkKeyError(
        'https://preview.linejam.app',
        env({
          PLAYWRIGHT_REQUIRE_AUTH_SMOKE: '1',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
          CLERK_SECRET_KEY: 'sk_test_example',
        })
      )
    ).toBeNull();
  });

  it('requires Clerk credentials when authenticated smoke is enabled', () => {
    expect(
      getSmokeClerkKeyError(
        'https://www.linejam.app',
        env({
          PLAYWRIGHT_REQUIRE_AUTH_SMOKE: '1',
        })
      )
    ).toBe(
      'Authenticated smoke requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.'
    );
  });

  it('rejects a fallback Clerk publishable test key in production smoke', () => {
    expect(
      getSmokeClerkKeyError(
        'https://www.linejam.app',
        env({
          PLAYWRIGHT_REQUIRE_AUTH_SMOKE: '1',
          CLERK_PUBLISHABLE_KEY: 'pk_test_example',
          CLERK_SECRET_KEY: 'sk_live_example',
        })
      )
    ).toBe(
      'Authenticated production smoke requires a live Clerk publishable key. Use production-aligned Clerk env instead of localhost test keys.'
    );
  });
});
