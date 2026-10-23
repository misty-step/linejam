/**
 * Environment variable validation
 *
 * Public configuration is checked at build time. Secrets are checked at the
 * Worker request boundary, never required in the uncredentialed build sandbox.
 */

import { isValidServerActionEncryptionKey } from './serverActionEncryptionKey';
import { isLocalServerMode } from './localMode';

// Required for Next.js runtime (signing guest tokens)
const REQUIRED_SERVER_ENV = ['GUEST_TOKEN_SECRET'] as const;

// Required at build time (public vars)
const REQUIRED_PUBLIC_ENV = [
  'NEXT_PUBLIC_CONVEX_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_ENABLED',
] as const;
const REQUIRED_PRODUCTION_SKEW_ENV = [
  'NEXT_DEPLOYMENT_ID',
  'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
] as const;
const DEV_GUEST_TOKEN_SECRET = 'dev-only-insecure-secret-change-in-production';
const COMMIT_SHA = /^[a-f0-9]{40}$/;

export interface ReleaseEnvironment {
  GUEST_TOKEN_SECRET?: string;
  NEXT_PUBLIC_CONVEX_URL?: string;
  NEXT_PUBLIC_SENTRY_DSN?: string;
  NEXT_PUBLIC_SENTRY_ENABLED?: string;
  NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string;
  NEXT_DEPLOYMENT_ID?: string;
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?: string;
  LINEJAM_DEPLOY_ENVIRONMENT?: string;
  GITHUB_ACTOR?: string;
}

export function isValidSentryDsn(
  value: string | null | undefined
): value is string {
  if (!value || value !== value.trim()) return false;

  try {
    const dsn = new URL(value);
    const segments = dsn.pathname.split('/').filter(Boolean);
    const projectId = segments.at(-1);
    return (
      dsn.protocol === 'https:' &&
      /^[A-Za-z0-9_-]+$/.test(dsn.username) &&
      !dsn.password &&
      Boolean(dsn.hostname) &&
      !dsn.search &&
      !dsn.hash &&
      projectId !== undefined &&
      /^[1-9]\d*$/.test(projectId)
    );
  } catch {
    return false;
  }
}

export function getServerGuestTokenSecret(): string {
  const localMode = isLocalServerMode();
  const secret = process.env.GUEST_TOKEN_SECRET?.trim();
  if (secret) return secret;

  if (localMode) {
    throw new Error('GUEST_TOKEN_SECRET must be set in local mode');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('GUEST_TOKEN_SECRET must be set in production environment');
  }

  return DEV_GUEST_TOKEN_SECRET;
}

/**
 * Runtime remains the default for existing consumers and local development.
 */
export function validateEnv(phase: 'build' | 'runtime' = 'runtime'): void {
  if (isLocalServerMode()) {
    getServerGuestTokenSecret();
    return;
  }
  const environment: ReleaseEnvironment = {
    LINEJAM_DEPLOY_ENVIRONMENT: process.env.LINEJAM_DEPLOY_ENVIRONMENT,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    GITHUB_ACTOR: process.env.GITHUB_ACTOR,
  };
  for (const name of [
    ...REQUIRED_SERVER_ENV,
    ...REQUIRED_PUBLIC_ENV,
    ...REQUIRED_PRODUCTION_SKEW_ENV,
  ])
    environment[name] = process.env[name];
  validateConfiguration(environment, phase);
}

export function validateProductionBindings(
  environment: ReleaseEnvironment
): void {
  if (environment.LINEJAM_DEPLOY_ENVIRONMENT !== 'production') return;
  validateConfiguration(environment, 'runtime');
}

function validateConfiguration(
  environment: ReleaseEnvironment,
  phase: 'build' | 'runtime'
): void {
  const value = (name: keyof ReleaseEnvironment): string | undefined =>
    environment[name];
  const missing: string[] = [];
  const invalid: string[] = [];
  const isDependabot =
    phase === 'build' && environment.GITHUB_ACTOR === 'dependabot[bot]';
  const isDeployed =
    environment.LINEJAM_DEPLOY_ENVIRONMENT === 'production' ||
    environment.LINEJAM_DEPLOY_ENVIRONMENT === 'preview';
  // A declared Sentry "test" build (CI, Playwright) never sends events, so it
  // needs no DSN. Deployed builds can never declare it.
  const declaresSentryTest =
    environment.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'test';
  if (declaresSentryTest && isDeployed) {
    invalid.push('NEXT_PUBLIC_SENTRY_ENVIRONMENT');
  }
  const isSentryTestBuild = declaresSentryTest && !isDeployed;

  for (const key of REQUIRED_SERVER_ENV) {
    if (phase === 'runtime' && !value(key)?.trim()) {
      missing.push(key);
    }
  }

  for (const key of REQUIRED_PUBLIC_ENV) {
    if (isSentryTestBuild && key !== 'NEXT_PUBLIC_CONVEX_URL') continue;
    if (!isDependabot && !value(key)?.trim()) {
      missing.push(key);
    }
  }

  if (environment.LINEJAM_DEPLOY_ENVIRONMENT === 'production') {
    for (const key of REQUIRED_PRODUCTION_SKEW_ENV) {
      if (key === 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY' && phase === 'build')
        continue;
      if (!value(key)?.trim()) missing.push(key);
    }

    const deploymentId = value('NEXT_DEPLOYMENT_ID')?.trim();
    if (deploymentId && !COMMIT_SHA.test(deploymentId)) {
      invalid.push('NEXT_DEPLOYMENT_ID');
    }

    const serverActionKey = value('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY')?.trim();
    if (serverActionKey && !isValidServerActionEncryptionKey(serverActionKey)) {
      invalid.push('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY');
    }
  }

  if (!isSentryTestBuild && environment.NEXT_PUBLIC_SENTRY_ENABLED !== '1') {
    invalid.push('NEXT_PUBLIC_SENTRY_ENABLED');
  }

  if (
    value('NEXT_PUBLIC_SENTRY_DSN') &&
    !isValidSentryDsn(value('NEXT_PUBLIC_SENTRY_DSN'))
  ) {
    invalid.push('NEXT_PUBLIC_SENTRY_DSN');
  }

  if (missing.length > 0 || invalid.length > 0) {
    const sections: string[] = [];

    if (missing.length > 0) {
      sections.push(
        `Missing required environment variables:\n${missing
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
