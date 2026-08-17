#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import * as Sentry from '@sentry/node';
import { getSentryRuntimeOptions } from '../../sentry.runtime.mjs';
import {
  signSentryAutomationGroup,
  signSentryAutomationProvenance,
} from '../../sentry.provenance.mjs';

export const SENTRY_MONITOR_SLUGS = Object.freeze({
  previewSmoke: 'linejam-preview-smoke',
  productionSmoke: 'linejam-production-smoke',
});

// GitHub Actions scheduled workflows are best-effort: the `17 * * * *` cron
// fires late by 10-53 minutes in practice (observed Aug 5-17 2026), and the
// check-in only arrives after the smoke finishes. A crontab slot is satisfied
// solely by a check-in landing inside [expected, expected + margin], so the
// margin must cover the scheduler delay; 5 minutes marked every slot missed
// even when the smoke passed (LINEJAM-9). 60 minutes covers the observed
// distribution while still paging after two consecutive genuinely missed
// slots.
const PRODUCTION_SMOKE_MONITOR_CONFIG = Object.freeze({
  schedule: { type: 'crontab', value: '17 * * * *' },
  checkinMargin: 60,
  maxRuntime: 15,
  timezone: 'UTC',
});
const ALLOWED_MONITOR_SLUGS = new Set(Object.values(SENTRY_MONITOR_SLUGS));
const PROD_ESCALATION_THRESHOLD = 2;
const PREVIEW_FAILURE_MESSAGE = 'Linejam preview smoke failed';
const PRODUCTION_FAILURE_MESSAGE = 'Linejam production smoke failed';
const COMMIT_RELEASE = /^[a-f0-9]{40}$/;
const EVENT_ID = /^[a-f0-9]{32}$/i;

/** @typedef {Pick<typeof Sentry, 'init' | 'captureCheckIn' | 'captureException' | 'flush'>} SentryWorkflowSdk */
/**
 * @typedef {Omit<ReturnType<typeof getSentryRuntimeOptions>, 'enabled'> & {
 *   enabled?: boolean
 * }} SentryRuntimeOptions
 */

/**
 * Rebuild workflow events from a closed vocabulary. Node's SDK adds host,
 * module, stack, and runtime context by default; none is needed to route these
 * deterministic failures.
 *
 * @param {import('@sentry/node').Event} event
 * @returns {import('@sentry/node').ErrorEvent | null}
 */
export function sanitizeWorkflowEvent(event) {
  const release =
    Object.prototype.toString.call(event.release) === '[object String]' &&
    COMMIT_RELEASE.test(event.release)
      ? event.release
      : undefined;
  const tags = event.tags;
  const operation = tags?.operation;
  const expectedMessage =
    event.environment === 'preview' && operation === 'previewSmoke'
      ? PREVIEW_FAILURE_MESSAGE
      : event.environment === 'production' && operation === 'productionSmoke'
        ? PRODUCTION_FAILURE_MESSAGE
        : undefined;
  const expectedException =
    expectedMessage &&
    event.exception?.values?.some(
      (value) => value?.type === 'Error' && value.value === expectedMessage
    );
  if (
    !release ||
    event.level !== 'error' ||
    tags?.runtime !== 'github-actions' ||
    tags.failure_code !== 'unexpected_error' ||
    !expectedMessage ||
    !expectedException
  ) {
    return null;
  }

  const eventId =
    Object.prototype.toString.call(event.event_id) === '[object String]' &&
    EVENT_ID.test(event.event_id)
      ? event.event_id
      : undefined;
  const timestamp = Number.isFinite(event.timestamp)
    ? event.timestamp
    : undefined;

  const sanitized = {
    platform: 'node',
    level: 'error',
    environment: event.environment,
    release,
    fingerprint: [
      `linejam-${operation === 'previewSmoke' ? 'preview' : 'production'}-smoke`,
    ],
    tags: {
      runtime: 'github-actions',
      operation,
      failure_code: 'unexpected_error',
    },
    exception: {
      values: [{ type: 'Error', value: expectedMessage }],
    },
  };
  if (eventId) {
    sanitized.event_id = eventId;
  }
  if (timestamp !== undefined) {
    sanitized.timestamp = timestamp;
  }
  return sanitized;
}
export function createWorkflowBeforeSend(secret) {
  const secretBytes =
    Object.prototype.toString.call(secret) === '[object String]'
      ? new TextEncoder().encode(secret).length
      : 0;
  if (secretBytes < 32 || secretBytes > 256) {
    throw new Error(
      'SENTRY_AUTOMATION_PROVENANCE_SECRET must contain 32-256 bytes'
    );
  }
  return async (event) => {
    const sanitized = sanitizeWorkflowEvent(event);
    if (!sanitized?.event_id) return null;
    const routing = {
      runtime: 'github-actions',
      environment: sanitized.environment,
      level: 'error',
      operation: sanitized.tags.operation,
      failureCode: sanitized.tags.failure_code,
    };
    const [provenance, groupKey] = await Promise.all([
      signSentryAutomationProvenance(secret, {
        eventId: sanitized.event_id,
        release: sanitized.release,
        ...routing,
      }),
      signSentryAutomationGroup(secret, routing),
    ]);
    return {
      ...sanitized,
      fingerprint: ['linejam-trusted-automation-v1', groupKey],
      tags: { ...sanitized.tags, provenance },
    };
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
  releaseResolved = true,
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
      outcome: releaseResolved ? outcome : 'failure',
    };
  }

  const transientProductionFailure =
    releaseResolved &&
    outcome === 'failure' &&
    consecutiveFailures < PROD_ESCALATION_THRESHOLD;

  return {
    kind: 'check_in',
    monitorSlug,
    status:
      releaseResolved && (outcome === 'success' || transientProductionFailure)
        ? 'ok'
        : 'error',
  };
}

/**
 * @param {{
 *   monitorSlug: string,
 *   outcome: string,
 *   consecutiveFailures?: number,
 *   releaseResolved?: boolean,
 *   sdk?: SentryWorkflowSdk,
 *   provenanceSecret?: string,
 *   runtimeOptions?: SentryRuntimeOptions
 * }} input
 */
export async function reportSentryWorkflow({
  monitorSlug,
  outcome,
  consecutiveFailures = 0,
  releaseResolved = true,
  sdk = Sentry,
  provenanceSecret = process.env.SENTRY_AUTOMATION_PROVENANCE_SECRET,
  runtimeOptions = getSentryRuntimeOptions(),
}) {
  const plan = planSentryReport({
    monitorSlug,
    outcome,
    consecutiveFailures,
    releaseResolved,
  });

  if (plan.kind === 'event' && plan.outcome === 'success') {
    return {
      ...plan,
      skipped: true,
      reason: 'Successful event-driven checks do not emit Sentry issues',
    };
  }
  if (!releaseResolved) {
    return {
      ...plan,
      skipped: true,
      reason:
        'Exact deployed release unavailable; workflow failure is authoritative',
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
  if (
    plan.kind === 'check_in' &&
    runtimeOptions.environment !== 'production'
  ) {
    throw new Error(
      `The ${monitorSlug} monitor only accepts production check-ins; ` +
        `a ${runtimeOptions.environment} check-in would seed a permanent ` +
        'non-production environment track'
    );
  }

  sdk.init({
    ...runtimeOptions,
    tracesSampleRate: 0,
    beforeSend: createWorkflowBeforeSend(provenanceSecret),
  });
  let eventId;
  if (plan.kind === 'event') {
    eventId = sdk.captureException(new Error(PREVIEW_FAILURE_MESSAGE), {
      fingerprint: ['linejam-preview-smoke'],
      tags: {
        runtime: 'github-actions',
        operation: plan.operation,
        failure_code: 'unexpected_error',
      },
    });
  } else {
    eventId = sdk.captureCheckIn(plan, PRODUCTION_SMOKE_MONITOR_CONFIG);
    if (plan.status === 'error') {
      eventId = sdk.captureException(new Error(PRODUCTION_FAILURE_MESSAGE), {
        fingerprint: ['linejam-production-smoke'],
        tags: {
          runtime: 'github-actions',
          operation: 'productionSmoke',
          failure_code: 'unexpected_error',
        },
      });
    }
  }
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
  const releaseResolutionOutcome =
    env.LINEJAM_RELEASE_RESOLUTION_OUTCOME?.trim();
  return reportSentryWorkflow({
    monitorSlug: env.LINEJAM_MONITOR_SLUG,
    outcome: env.LINEJAM_MONITOR_OUTCOME,
    consecutiveFailures,
    releaseResolved:
      !releaseResolutionOutcome || releaseResolutionOutcome === 'success',
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
