/**
 * Environment variable validation
 *
 * Called during build to ensure all required env vars are present.
 * Prevents deploying with missing configuration.
 */

// Required for Next.js runtime (signing guest tokens)
const REQUIRED_SERVER_ENV = ['GUEST_TOKEN_SECRET'] as const;

// Required at build time (public vars)
const REQUIRED_PUBLIC_ENV = ['NEXT_PUBLIC_CONVEX_URL'] as const;

/**
 * Validate that all required environment variables are set.
 * Throws during build if any are missing.
 */
export function validateEnv(): void {
  const missing: string[] = [];
  const isDependabot = process.env.GITHUB_ACTOR === 'dependabot[bot]';

  for (const key of REQUIRED_SERVER_ENV) {
    if (!isDependabot && !process.env[key]) {
      missing.push(key);
    }
  }

  for (const key of REQUIRED_PUBLIC_ENV) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n\n` +
        'See .env.example for documentation.'
    );
  }
}
