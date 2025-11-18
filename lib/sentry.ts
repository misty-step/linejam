import type { ErrorEvent } from '@sentry/nextjs';

/**
 * Shared Sentry configuration options
 *
 * Centralizes Sentry config for consistency across client/server/edge.
 * Includes sensitive data scrubbing for poem text and display names.
 */

export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

  beforeSend(event: ErrorEvent): ErrorEvent | null {
    return scrubSensitiveData(event);
  },
};

// Fields containing user-generated content or PII
const SCRUB_FIELDS = ['text', 'displayName', 'poemText', 'lineText', 'lines'];

function scrubObject(obj: Record<string, unknown>) {
  SCRUB_FIELDS.forEach((field) => delete obj[field]);
}

/**
 * Scrubs sensitive user data from Sentry events
 *
 * Poem text is user-generated creative content (privacy concern).
 * Display names may contain PII.
 */
function scrubSensitiveData(event: ErrorEvent): ErrorEvent {
  if (event.contexts?.poem) scrubObject(event.contexts.poem);
  if (event.contexts?.user) scrubObject(event.contexts.user);
  if (event.extra) scrubObject(event.extra);

  event.breadcrumbs?.forEach((breadcrumb) => {
    if (breadcrumb.data) scrubObject(breadcrumb.data);
  });

  return event;
}
