#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import * as Sentry from '@sentry/node';
import { getSentryRuntimeOptions } from '../../sentry.runtime.mjs';

export const SENTRY_MONITOR_SLUGS = Object.freeze({
  previewSmoke: 'linejam-preview-smoke',
  productionSmoke: 'linejam-production-smoke',
});

const PRODUCTION_SMOKE_MONITOR_CONFIG = Object.freeze({
  schedule: { type: 'crontab', value: '17 * * * *' },
  checkinMargin: 5,
  maxRuntime: 15,
  timezone: 'UTC',
});
const ALLOWED_MONITOR_SLUGS = new Set(Object.values(SENTRY_MONITOR_SLUGS));
const PROD_ESCALATION_THRESHOLD = 2;
const PREVIEW_FAILURE_MESSAGE = 'Linejam preview smoke failed';
const COMMIT_RELEASE = /^[a-f0-9]{7,64}$/i;
const EVENT_ID = /^[a-f0-9]{32}$/i;

/** @typedef {Pick<typeof Sentry, 'init' | 'captureCheckIn' | 'captureException' | 'flush'>} SentryWorkflowSdk */
/**
 * @typedef {Omit<ReturnType<typeof getSentryRuntimeOptions>, 'enabled'> & {
 *   enabled?: boolean
 * }} SentryRuntimeOptions
 */

/**
 * Rebuild the preview workflow event from a closed vocabulary. Node's SDK adds
 * host, module, stack, and runtime context by default; none is needed to route
 * this deterministic workflow failure.
 *
 * @param {import('@sentry/node').Event} event
 * @returns {import('@sentry/node').ErrorEvent | null}
 */
export function sanitizePreviewSmokeEvent(event) {
  const release =
    typeof event.release === 'string' && COMMIT_RELEASE.test(event.release)
      ? event.release
      : undefined;
  const tags = event.tags;
  const expectedException = event.exception?.values?.some(
    (value) =>
      value?.type === 'Error' && value.value === PREVIEW_FAILURE_MESSAGE
  );
  if (
    event.environment !== 'preview' ||
    !release ||
    event.level !== 'error' ||
    tags?.runtime !== 'github-actions' ||
    tags.operation !== 'previewSmoke' ||
    tags.failure_code !== 'unexpected_error' ||
    !expectedException
  ) {
    return null;
  }

  const eventId =
    typeof event.event_id === 'string' && EVENT_ID.test(event.event_id)
      ? event.event_id
      : undefined;
  const timestamp =
    typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)
      ? event.timestamp
      : undefined;
  return {
    ...(eventId ? { event_id: eventId } : {}),
    ...(timestamp !== undefined ? { timestamp } : {}),
    platform: 'node',
    level: 'error',
    environment: 'preview',
    release,
    fingerprint: ['linejam-preview-smoke'],
    tags: {
      runtime: 'github-actions',
      operation: 'previewSmoke',
      failure_code: 'unexpected_error',
    },
    exception: {
      values: [{ type: 'Error', value: PREVIEW_FAILURE_MESSAGE }],
    },
  };
}

/**
 * Convert a workflow result into bounded Sentry reporting intent. Production
 * smoke is scheduled and therefore uses a monitor. Preview smoke is
 * event-driven: successes need no Sentry record, while failures become issues.
 */
export function planSentryReport({
  monitorSlug,
  outcome,
  consecutiveFailures = 0,
}) {
  if (!ALLOWED_MONITOR_SLUGS.has(monitorSlug)) {
    throw new Error(`Unsupported Sentry monitor slug: ${monitorSlug}`);
  }
  if (outcome !== 'success' && outcome !== 'failure') {
    throw new Error(
      `Monitor outcome must be "success" or "failure": ${outcome}`
    );
  }
  if (!Number.isInteger(consecutiveFailures) || consecutiveFailures < 0) {
    throw new Error('Consecutive failures must be a non-negative integer');
  }

  if (monitorSlug === SENTRY_MONITOR_SLUGS.previewSmoke) {
    return {
      kind: 'event',
      operation: 'previewSmoke',
      outcome,
    };
  }

  const transientProductionFailure =
    outcome === 'failure' && consecutiveFailures < PROD_ESCALATION_THRESHOLD;

  return {
    kind: 'check_in',
    monitorSlug,
    status:
      outcome === 'success' || transientProductionFailure ? 'ok' : 'error',
  };
}

/**
 * @param {{
 *   monitorSlug: string,
 *   outcome: string,
 *   consecutiveFailures?: number,
 *   sdk?: SentryWorkflowSdk,
 *   runtimeOptions?: SentryRuntimeOptions
 * }} input
 */
export async function reportSentryWorkflow({
  monitorSlug,
  outcome,
  consecutiveFailures = 0,
  sdk = Sentry,
  runtimeOptions = getSentryRuntimeOptions(),
}) {
  const plan = planSentryReport({
    monitorSlug,
    outcome,
    consecutiveFailures,
  });

  if (plan.kind === 'event' && plan.outcome === 'success') {
    return {
      ...plan,
      skipped: true,
      reason: 'Successful event-driven checks do not emit Sentry issues',
    };
  }
  if (!runtimeOptions.enabled) {
    return {
      ...plan,
      skipped: true,
      reason: 'Sentry workflow reporting is disabled',
    };
  }
  if (!runtimeOptions.dsn) {
    throw new Error('NEXT_PUBLIC_SENTRY_DSN is required for Sentry reporting');
  }
  if (!runtimeOptions.environment) {
    throw new Error(
      'LINEJAM_DEPLOY_ENVIRONMENT is required for Sentry reporting'
    );
  }
  if (!runtimeOptions.release) {
    throw new Error('NEXT_DEPLOYMENT_ID is required for Sentry reporting');
  }

  sdk.init({
    ...runtimeOptions,
    tracesSampleRate: 0,
    beforeSend: sanitizePreviewSmokeEvent,
  });
  const eventId =
    plan.kind === 'event'
      ? sdk.captureException(new Error(PREVIEW_FAILURE_MESSAGE), {
          fingerprint: ['linejam-preview-smoke'],
          tags: {
            runtime: 'github-actions',
            operation: plan.operation,
            failure_code: 'unexpected_error',
          },
        })
      : sdk.captureCheckIn(plan, PRODUCTION_SMOKE_MONITOR_CONFIG);
  const flushed = await sdk.flush(5_000);
  if (!flushed) {
    throw new Error('Sentry workflow report flush did not complete');
  }
  return { ...plan, eventId };
}

export async function runFromEnv(env = process.env) {
  if (
    env.NEXT_PUBLIC_SENTRY_ENABLED === '1' &&
    !env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  ) {
    throw new Error(
      'NEXT_PUBLIC_SENTRY_DSN is required when Sentry reporting is enabled'
    );
  }

  const consecutiveFailures = Number.parseInt(
    env.LINEJAM_MONITOR_CONSECUTIVE_FAILURES || '0',
    10
  );
  return reportSentryWorkflow({
    monitorSlug: env.LINEJAM_MONITOR_SLUG,
    outcome: env.LINEJAM_MONITOR_OUTCOME,
    consecutiveFailures,
    runtimeOptions: getSentryRuntimeOptions(env),
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFromEnv()
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
