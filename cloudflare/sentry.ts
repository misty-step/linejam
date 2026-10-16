import { getSentryRuntimeOptions } from '../sentry.runtime.mjs';
import { beforeSend, beforeSendTransaction } from '../lib/sentryPrivacy';
import type { CloudflareOptions } from '@sentry/cloudflare';

export interface SentryBindings {
  NEXT_PUBLIC_LINEJAM_LOCAL?: string;
  NEXT_PUBLIC_SENTRY_DSN?: string;
  NEXT_PUBLIC_SENTRY_ENABLED?: string;
  LINEJAM_DEPLOY_ENVIRONMENT?: string;
  NEXT_DEPLOYMENT_ID?: string;
}

// Native Worker entry errors have the same release and closed privacy boundary
// as Next/browser errors. No second DSN, reporter, or arbitrary event content.
export function workerSentryOptions(env: SentryBindings) {
  return {
    ...getSentryRuntimeOptions({
      NEXT_PUBLIC_LINEJAM_LOCAL: env.NEXT_PUBLIC_LINEJAM_LOCAL,
      NEXT_PUBLIC_SENTRY_DSN: env.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_SENTRY_ENABLED: env.NEXT_PUBLIC_SENTRY_ENABLED,
      LINEJAM_DEPLOY_ENVIRONMENT: env.LINEJAM_DEPLOY_ENVIRONMENT,
      NEXT_DEPLOYMENT_ID: env.NEXT_DEPLOYMENT_ID,
    }),
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    // Telemetry must never consume/clone credential-bearing mutation streams.
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== 'HttpServer'),
    transportOptions: {
      bufferSize: 5,
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(2_000) }),
    },
    beforeBreadcrumb: () => null,
    beforeSend,
    beforeSendTransaction,
    initialScope: { tags: { runtime: 'worker' } },
  } satisfies CloudflareOptions;
}
