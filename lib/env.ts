/**
 * Environment variable validation
 *
 * Called during build to ensure all required env vars are present.
 * Prevents deploying with missing configuration.
 */

import { isValidServerActionEncryptionKey } from '@/lib/serverActionEncryptionKey';

// Required for Next.js runtime (signing guest tokens)
const REQUIRED_SERVER_ENV = ['GUEST_TOKEN_SECRET'] as const;

// Required at build time (public vars)
const REQUIRED_PUBLIC_ENV = [
  'NEXT_PUBLIC_CONVEX_URL',
  'NEXT_PUBLIC_CANARY_ENDPOINT',
  'NEXT_PUBLIC_CANARY_API_KEY',
] as const;
const REQUIRED_PRODUCTION_SKEW_ENV = [
  'NEXT_DEPLOYMENT_ID',
  'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
] as const;
const PLACEHOLDER_CANARY_KEYS = new Set([
  'example_canary_server_key',
  'example_canary_write_key',
]);
const DEV_GUEST_TOKEN_SECRET = 'dev-only-insecure-secret-change-in-production';

export function getServerGuestTokenSecret(): string {
  const secret = process.env.GUEST_TOKEN_SECRET?.trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('GUEST_TOKEN_SECRET must be set in production environment');
  }

  return DEV_GUEST_TOKEN_SECRET;
}

/**
 * Validate that all required environment variables are set.
 * Throws during build if any are missing.
 */
export function validateEnv(): void {
  const missing: string[] = [];
  const invalidPlaceholders: string[] = [];
  const invalid: string[] = [];
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

  if (process.env.LINEJAM_DEPLOY_ENVIRONMENT === 'production') {
    for (const key of REQUIRED_PRODUCTION_SKEW_ENV) {
      if (!process.env[key]?.trim()) missing.push(key);
    }

    const serverActionKey =
      process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?.trim();
    if (serverActionKey && !isValidServerActionEncryptionKey(serverActionKey)) {
      invalid.push('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY');
    }
  }

  const canaryApiKey = process.env.NEXT_PUBLIC_CANARY_API_KEY?.trim();
  if (canaryApiKey && PLACEHOLDER_CANARY_KEYS.has(canaryApiKey)) {
    invalidPlaceholders.push('NEXT_PUBLIC_CANARY_API_KEY');
  }

  if (
    missing.length > 0 ||
    invalidPlaceholders.length > 0 ||
    invalid.length > 0
  ) {
    const sections: string[] = [];

    if (missing.length > 0) {
      sections.push(
        `Missing required environment variables:\n${missing
          .map((k) => `  - ${k}`)
          .join('\n')}`
      );
    }

    if (invalidPlaceholders.length > 0) {
      sections.push(
        `Invalid placeholder environment variables:\n${invalidPlaceholders
          .map((k) => `  - ${k}`)
          .join('\n')}`
      );
    }

    if (invalid.length > 0) {
      sections.push(
        `Invalid environment variables:\n${invalid
          .map((k) => `  - ${k}`)
          .join('\n')}`
      );
    }

    throw new Error(
      `${sections.join('\n\n')}\n\nSee .env.example for documentation.`
    );
  }
}
