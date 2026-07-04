#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const DEFAULT_CANARY_ENDPOINT = 'https://canary-obs.fly.dev';
const MONITOR_NAME = 'linejam-production-smoke';
const ESCALATION_THRESHOLD = 2;

/**
 * @param {Record<string, string | undefined>} env
 */
export function resolveCanaryConfig(env = process.env) {
  const apiKey =
    env.CANARY_API_KEY?.trim() || env.NEXT_PUBLIC_CANARY_API_KEY?.trim() || '';
  const endpoint =
    env.CANARY_ENDPOINT?.trim() ||
    env.NEXT_PUBLIC_CANARY_ENDPOINT?.trim() ||
    DEFAULT_CANARY_ENDPOINT;
  return { apiKey, endpoint };
}

/**
 * Decide the check-in to send to the `linejam-production-smoke` TTL
 * monitor. Canary maps check-in status `error` directly to its Down health
 * state (opening/holding an incident); `ok`, `alive`, and `in_progress` all
 * map to Up. So a single failed run is recorded on the monitor (visible in
 * its check-in history and the annotation this same run writes to the GitHub
 * step summary) without tripping Down — only
 * `ESCALATION_THRESHOLD` consecutive failures escalate to an incident.
 * A success always reports `ok`, which resolves any open incident.
 *
 * @param {{ outcome: 'success' | 'failure', consecutiveFailures: number }} params
 */
export function planCheckIn({ outcome, consecutiveFailures }) {
  if (outcome === 'success') {
    return { status: 'ok', summary: 'Production Smoke passed.' };
  }

  if (consecutiveFailures >= ESCALATION_THRESHOLD) {
    return {
      status: 'error',
      summary: `Production Smoke failed ${consecutiveFailures} consecutive runs.`,
    };
  }

  return {
    status: 'alive',
    summary:
      `Production Smoke failed (consecutive failures: ${consecutiveFailures}, ` +
      `below the ${ESCALATION_THRESHOLD}-run escalation threshold).`,
  };
}

/**
 * @param {{
 *   status: string,
 *   summary: string,
 *   context?: Record<string, unknown>,
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: typeof fetch,
 * }} params
 */
export async function sendCheckIn({
  status,
  summary,
  context,
  env = process.env,
  fetchImpl = globalThis.fetch,
}) {
  const { apiKey, endpoint } = resolveCanaryConfig(env);
  if (!apiKey) {
    return { skipped: true, reason: 'Canary ingest key is not configured' };
  }

  const response = await fetchImpl(
    `${endpoint.replace(/\/$/, '')}/api/v1/check-ins`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ monitor: MONITOR_NAME, status, summary, context }),
      signal: AbortSignal.timeout(5_000),
    }
  );

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Canary check-in failed: HTTP ${response.status}: ${truncate(bodyText)}`
    );
  }

  return {
    skipped: false,
    status: response.status,
    body: safeJsonParse(bodyText),
  };
}

function truncate(value, max = 500) {
  if (!value) return '<empty>';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * @param {{
 *   outcome?: string,
 *   consecutiveFailures?: number,
 *   runUrl?: string,
 *   failureDetail?: string,
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: typeof fetch,
 * }} [params]
 */
export async function run({
  outcome = process.env.LINEJAM_SMOKE_OUTCOME,
  consecutiveFailures = Number.parseInt(
    process.env.LINEJAM_SMOKE_CONSECUTIVE_FAILURES || '0',
    10
  ),
  runUrl = process.env.LINEJAM_SMOKE_RUN_URL,
  failureDetail = process.env.LINEJAM_SMOKE_FAILURE_DETAIL,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (outcome !== 'success' && outcome !== 'failure') {
    throw new Error(
      `LINEJAM_SMOKE_OUTCOME must be "success" or "failure", got: ${outcome}`
    );
  }

  const plan = planCheckIn({ outcome, consecutiveFailures });
  const context = {
    consecutiveFailures,
    ...(runUrl ? { runUrl } : {}),
    ...(outcome === 'failure' && failureDetail?.trim()
      ? { failureDetail: truncate(failureDetail.trim(), 1_000) }
      : {}),
  };

  return sendCheckIn({ ...plan, context, env, fetchImpl });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .then((result) => {
      console.log(JSON.stringify(result));
      if (result.skipped) {
        console.error('Canary check-in skipped:', result.reason);
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
