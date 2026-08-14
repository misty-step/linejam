const REQUEST_TIMEOUT_MS = 2_000;
const MAX_SEND_ATTEMPTS = 2;
const MAX_REPORT_COUNT = 1_000_000;
const RELEASE_PATTERN = /^[0-9a-f]{40}$/;
const PROJECT_ID_PATTERN = /^\d+$/;
const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9]+$/;

export const AI_FALLBACK_MONITOR_SLUG = 'linejam-ai-fallback-rate';

export const BACKEND_FAILURE_OPERATIONS = [
  'sweepAbandonedGames',
  'finishAbandonedGame',
  'aiGenerationBudgetThreshold',
  'generateLineForRound',
  'generateGhostLine',
] as const;

export const BACKEND_FAILURE_CODES = [
  'unexpected_error',
  'budget_threshold_reached',
] as const;

export const AI_FALLBACK_OPERATIONS = ['aiFallbackRate'] as const;

export const AI_FALLBACK_FAILURE_CODES = [
  'budget_exhaustion',
  'provider_error',
  'invalid_output',
  'missing_configuration',
] as const;

export type BackendFailureOperation =
  (typeof BACKEND_FAILURE_OPERATIONS)[number];
export type BackendFailureCode = (typeof BACKEND_FAILURE_CODES)[number];
export type AiFallbackOperation = (typeof AI_FALLBACK_OPERATIONS)[number];
export type AiFallbackFailureCode = (typeof AI_FALLBACK_FAILURE_CODES)[number];
export type SentryEnvironment = 'preview' | 'production';

export interface BackendFailureReport {
  operation: BackendFailureOperation;
  failureCode: BackendFailureCode;
  scheduled?: number;
  scanned?: number;
  filled?: number;
  observed?: number;
  threshold?: number;
  round?: number;
}

export interface AiFallbackCheckInReport {
  operation: AiFallbackOperation;
  status: 'alive' | 'ok' | 'error';
  failureCode?: AiFallbackFailureCode;
  totalGenerations: number;
  fallbackGenerations: number;
  fallbackRatePercent: number;
  thresholdPercent: number;
}

export interface ParsedSentryDsn {
  envelopeEndpoint: string;
  publicKey: string;
  projectId: string;
}

interface SentryConfig extends ParsedSentryDsn {
  environment: SentryEnvironment;
  release: string;
}

type SentryConfigResult =
  | { enabled: true; config: SentryConfig }
  | {
      enabled: false;
      diagnostic:
        | 'disabled'
        | 'missing_enablement'
        | 'invalid_enablement'
        | 'invalid_configuration';
    };

const emittedDiagnostics = new Set<string>();

function emitDiagnostic(
  result: Extract<SentryConfigResult, { enabled: false }>
) {
  if (result.diagnostic === 'disabled') return;
  const message =
    result.diagnostic === 'missing_enablement'
      ? 'Sentry transport disabled: enablement is not configured'
      : result.diagnostic === 'invalid_enablement'
        ? 'Sentry transport disabled: enablement is invalid'
        : 'Sentry transport disabled: configuration is invalid';
  if (emittedDiagnostics.has(message)) return;
  emittedDiagnostics.add(message);
  console.warn(message);
}

export function parseSentryDsn(
  rawDsn: string | undefined
): ParsedSentryDsn | null {
  const raw = rawDsn?.trim();
  if (!raw) return null;

  try {
    const dsn = new URL(raw);
    if (
      dsn.protocol !== 'https:' ||
      !dsn.hostname ||
      !PUBLIC_KEY_PATTERN.test(dsn.username) ||
      dsn.password ||
      dsn.search ||
      dsn.hash
    ) {
      return null;
    }

    const segments = dsn.pathname.split('/').filter(Boolean);
    const projectId = segments.pop();
    if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) return null;

    const prefix = segments.length === 0 ? '' : `/${segments.join('/')}`;
    return {
      envelopeEndpoint: `${dsn.protocol}//${dsn.host}${prefix}/api/${projectId}/envelope/`,
      publicKey: dsn.username,
      projectId,
    };
  } catch {
    return null;
  }
}

export function readSentryConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
): SentryConfigResult {
  const enablement = env.LINEJAM_SENTRY_ENABLED;
  if (enablement === undefined || enablement === '') {
    return { enabled: false, diagnostic: 'missing_enablement' };
  }
  if (enablement === 'false') {
    return { enabled: false, diagnostic: 'disabled' };
  }
  if (enablement !== 'true') {
    return { enabled: false, diagnostic: 'invalid_enablement' };
  }

  const dsn = parseSentryDsn(env.SENTRY_DSN);
  const environment = env.SENTRY_ENVIRONMENT;
  const release = env.SENTRY_RELEASE;
  if (
    !dsn ||
    (environment !== 'preview' && environment !== 'production') ||
    !release ||
    !RELEASE_PATTERN.test(release)
  ) {
    return { enabled: false, diagnostic: 'invalid_configuration' };
  }

  return {
    enabled: true,
    config: { ...dsn, environment, release },
  };
}

export function isBackendSentryEnabled(): boolean {
  const result = readSentryConfig();
  if (!result.enabled) emitDiagnostic(result);
  return result.enabled;
}

function boundedCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_REPORT_COUNT, Math.max(0, Math.trunc(value)));
}

function isBackendFailureReport(report: BackendFailureReport): boolean {
  return (
    BACKEND_FAILURE_OPERATIONS.includes(report.operation) &&
    BACKEND_FAILURE_CODES.includes(report.failureCode)
  );
}

function isAiFallbackCheckIn(checkIn: AiFallbackCheckInReport): boolean {
  return (
    AI_FALLBACK_OPERATIONS.includes(checkIn.operation) &&
    (checkIn.failureCode === undefined ||
      AI_FALLBACK_FAILURE_CODES.includes(checkIn.failureCode)) &&
    (checkIn.status === 'alive' ||
      checkIn.status === 'ok' ||
      checkIn.status === 'error')
  );
}

function isAiFallbackFailureReport(
  checkIn: AiFallbackCheckInReport
): checkIn is AiFallbackCheckInReport & {
  status: 'error';
  failureCode: AiFallbackFailureCode;
} {
  return (
    isAiFallbackCheckIn(checkIn) &&
    checkIn.status === 'error' &&
    checkIn.failureCode !== undefined
  );
}

function numericContext(report: BackendFailureReport) {
  return {
    ...(report.scheduled === undefined
      ? {}
      : { scheduled: boundedCount(report.scheduled) }),
    ...(report.scanned === undefined
      ? {}
      : { scanned: boundedCount(report.scanned) }),
    ...(report.filled === undefined
      ? {}
      : { filled: boundedCount(report.filled) }),
    ...(report.observed === undefined
      ? {}
      : { observed: boundedCount(report.observed) }),
    ...(report.threshold === undefined
      ? {}
      : { threshold: boundedCount(report.threshold) }),
    ...(report.round === undefined
      ? {}
      : { round: boundedCount(report.round) }),
  };
}

function envelope(
  eventId: string,
  itemType: 'event' | 'check_in',
  payload: object
) {
  return `${JSON.stringify({ event_id: eventId })}\n${JSON.stringify({ type: itemType })}\n${JSON.stringify(payload)}`;
}

export function buildBackendSentryEnvelope(
  report: BackendFailureReport,
  config: Pick<SentryConfig, 'environment' | 'release'>,
  eventId: string
): string | null {
  if (!isBackendFailureReport(report)) return null;

  return envelope(eventId, 'event', {
    event_id: eventId,
    platform: 'javascript',
    level: 'error',
    environment: config.environment,
    release: config.release,
    message: 'Convex backend operation failed',
    fingerprint: [
      'linejam-convex-backend-failure',
      report.operation,
      report.failureCode,
    ],
    tags: {
      runtime: 'convex',
      environment: config.environment,
      release: config.release,
      operation: report.operation,
      failure_code: report.failureCode,
      level: 'error',
    },
    contexts: {
      linejam: numericContext(report),
    },
  });
}

export function buildAiFallbackFailureSentryEnvelope(
  checkIn: AiFallbackCheckInReport,
  config: Pick<SentryConfig, 'environment' | 'release'>,
  eventId: string
): string | null {
  if (!isAiFallbackFailureReport(checkIn)) return null;

  return envelope(eventId, 'event', {
    event_id: eventId,
    platform: 'javascript',
    level: 'error',
    environment: config.environment,
    release: config.release,
    message: 'Convex backend operation failed',
    fingerprint: [
      'linejam-convex-backend-failure',
      checkIn.operation,
      checkIn.failureCode,
    ],
    tags: {
      runtime: 'convex',
      environment: config.environment,
      release: config.release,
      operation: checkIn.operation,
      failure_code: checkIn.failureCode,
      level: 'error',
    },
    contexts: {
      linejam: {
        observed: boundedCount(checkIn.fallbackRatePercent),
        threshold: boundedCount(checkIn.thresholdPercent),
      },
    },
  });
}

export function buildAiFallbackSentryEnvelope(
  checkIn: AiFallbackCheckInReport,
  config: Pick<SentryConfig, 'environment' | 'release'>,
  eventId: string
): string | null {
  if (!isAiFallbackCheckIn(checkIn)) return null;

  return envelope(eventId, 'check_in', {
    check_in_id: eventId,
    monitor_slug: AI_FALLBACK_MONITOR_SLUG,
    status: checkIn.status === 'error' ? 'error' : 'ok',
    environment: config.environment,
    release: config.release,
    monitor_config: {
      schedule: { type: 'interval', value: 1, unit: 'hour' },
      checkin_margin: 5,
      max_runtime: 5,
      timezone: 'UTC',
      failure_issue_threshold: 1,
      recovery_threshold: 1,
    },
  });
}

function eventId(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

async function sendEnvelope(config: SentryConfig, body: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(config.envelopeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          'X-Sentry-Auth':
            `Sentry sentry_version=7, sentry_key=${config.publicKey}, ` +
            'sentry_client=linejam-convex/1.0',
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return;
      if (response.status < 500 || attempt === MAX_SEND_ATTEMPTS) break;
    } catch {
      if (attempt === MAX_SEND_ATTEMPTS) break;
    }
  }
  console.error('Sentry transport failed');
}

/** Send one closed backend event. The same event ID is reused by both attempts. */
export async function sendBackendSentryEvent(
  report: BackendFailureReport
): Promise<void> {
  const result = readSentryConfig();
  if (!result.enabled) {
    emitDiagnostic(result);
    return;
  }
  const id = eventId();
  const body = buildBackendSentryEnvelope(report, result.config, id);
  if (!body) {
    console.error('Sentry transport rejected a report');
    return;
  }
  await sendEnvelope(result.config, body);
}

/**
 * Emit one tagged issue event only when the aggregate fallback monitor enters
 * its error state. The check-in remains the monitor-health signal; this event
 * supplies the closed tags required by the Sentry-to-GitHub bridge.
 */
export async function sendAiFallbackSentryFailureEvent(
  checkIn: AiFallbackCheckInReport
): Promise<void> {
  if (!isAiFallbackFailureReport(checkIn)) return;
  const result = readSentryConfig();
  if (!result.enabled) {
    emitDiagnostic(result);
    return;
  }
  const id = eventId();
  const body = buildAiFallbackFailureSentryEnvelope(checkIn, result.config, id);
  if (!body) return;
  await sendEnvelope(result.config, body);
}

/** Send one aggregate threshold check-in, never one check-in per generated line. */
export async function sendAiFallbackSentryCheckIn(
  checkIn: AiFallbackCheckInReport
): Promise<void> {
  const result = readSentryConfig();
  if (!result.enabled) {
    emitDiagnostic(result);
    return;
  }
  const id = eventId();
  const body = buildAiFallbackSentryEnvelope(checkIn, result.config, id);
  if (!body) {
    console.error('Sentry transport rejected a check-in');
    return;
  }
  await sendEnvelope(result.config, body);
}
