const PRODUCTION_SMOKE_ORIGIN = 'https://www.linejam.app';

/**
 * Returns an error when production auth smoke is configured with test Clerk keys.
 *
 * @param {string} baseUrl
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null}
 */
export function getSmokeClerkKeyError(baseUrl, env = process.env) {
  if (env.PLAYWRIGHT_REQUIRE_AUTH_SMOKE !== '1') {
    return null;
  }

  const publishableKey =
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
    env.CLERK_PUBLISHABLE_KEY?.trim() ||
    '';
  const secretKey = env.CLERK_SECRET_KEY?.trim() || '';

  if (!publishableKey || !secretKey) {
    const missing = [];
    if (!publishableKey) {
      missing.push(
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY'
      );
    }
    if (!secretKey) {
      missing.push('CLERK_SECRET_KEY');
    }

    return `Authenticated smoke requires ${missing.join(' and ')}.`;
  }

  let origin = '';
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return null;
  }

  if (
    origin === PRODUCTION_SMOKE_ORIGIN &&
    publishableKey.startsWith('pk_test_')
  ) {
    return (
      'Authenticated production smoke requires a live Clerk publishable key. ' +
      'Use production-aligned Clerk env instead of localhost test keys.'
    );
  }

  if (origin === PRODUCTION_SMOKE_ORIGIN && secretKey.startsWith('sk_test_')) {
    return (
      'Authenticated production smoke requires a live Clerk secret key. ' +
      'Use production-aligned Clerk env instead of localhost test keys.'
    );
  }

  return null;
}
