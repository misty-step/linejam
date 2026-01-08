import type { ErrorEvent } from '@sentry/nextjs';

/**
 * Shared Sentry configuration options for every runtime.
 *
 * Deep module responsibilities:
 * - Resolve release + environment metadata
 * - Guard initialization when DSN is absent
 * - Scrub user generated content before it leaves the process
 */

const APP_NAME = process.env.npm_package_name ?? 'linejam';
const APP_VERSION = process.env.npm_package_version;
const RAW_DSN =
  process.env.SENTRY_DSN?.trim() ||
  process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
  '';

const isProduction = process.env.NODE_ENV === 'production';

export const isSentryEnabled = RAW_DSN.length > 0;

export const sentryOptions = {
  dsn: RAW_DSN || undefined,
  enabled: isSentryEnabled,
  environment:
    process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  release: resolveRelease(),
  tracesSampleRate: isProduction ? 0.1 : 1.0,
  profilesSampleRate: isProduction ? 0.1 : 1.0,

  beforeSend(event: ErrorEvent): ErrorEvent | null {
    return scrubSensitiveData(event);
  },
};

// Fields containing user-generated content or PII
const SCRUB_FIELDS = new Set([
  'text',
  'displayName',
  'poemText',
  'lineText',
  'lines',
  'content',
  'previousLine',
  'currentLine',
  'submittedLine',
]);

function scrubObject(target: unknown) {
  if (!target || typeof target !== 'object') return;

  SCRUB_FIELDS.forEach((field) => {
    if (field in (target as Record<string, unknown>)) {
      delete (target as Record<string, unknown>)[field];
    }
  });
}

/**
 * Scrubs sensitive user data from Sentry events
 *
 * Poem text is user-generated creative content (privacy concern).
 * Display names may contain PII.
 */
function scrubSensitiveData(event: ErrorEvent): ErrorEvent {
  scrubObject(event.contexts?.poem);
  scrubObject(event.contexts?.user);
  scrubObject(event.user);
  scrubObject(event.extra);

  if (event.request?.data) {
    scrubObject(event.request.data);
  }

  if (event.request?.headers) {
    scrubObject(event.request.headers);
  }

  event.breadcrumbs?.forEach((breadcrumb) => {
    scrubObject(breadcrumb.data);
  });

  return event;
}

function resolveRelease(): string | undefined {
  const explicitRelease = process.env.SENTRY_RELEASE?.trim();
  if (explicitRelease) return explicitRelease;

  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.CF_PAGES_COMMIT_SHA ??
    process.env.SOURCE_VERSION ??
    process.env.COMMIT_SHA;

  const normalizedCommit = commitSha?.slice(0, 7);

  if (APP_VERSION && normalizedCommit) {
    return `${APP_NAME}@${APP_VERSION}+${normalizedCommit}`;
  }

  if (normalizedCommit) {
    return `${APP_NAME}@${normalizedCommit}`;
  }

  if (APP_VERSION) {
    return `${APP_NAME}@${APP_VERSION}+local`;
  }

  return undefined;
}
