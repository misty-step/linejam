const REQUEST_TIMEOUT_MS = 2_000;
const MAX_SEND_ATTEMPTS = 2;
const MAX_REPORT_COUNT = 1_000_000;
const RELEASE_PATTERN = /^[0-9a-f]{40}$/;
const PROJECT_ID_PATTERN = /^\d+$/;
const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9]+$/;

export const BACKEND_FAILURE_OPERATIONS = [
  'sweepAbandonedGames',
  'finishAbandonedGame',
] as const;

export const BACKEND_FAILURE_CODES = ['unexpected_error'] as const;

export type BackendFailureOperation =
  (typeof BACKEND_FAILURE_OPERATIONS)[number];
export type BackendFailureCode = (typeof BACKEND_FAILURE_CODES)[number];
export type SentryEnvironment = 'preview' | 'production';

export interface BackendFailureReport {
  operation: BackendFailureOperation;
  failureCode: BackendFailureCode;
  scheduled?: number;
  scanned?: number;
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

function numericContext(report: BackendFailureReport) {
  return {
    ...(report.scheduled === undefined
      ? {}
      : { scheduled: boundedCount(report.scheduled) }),
    ...(report.scanned === undefined
      ? {}
      : { scanned: boundedCount(report.scanned) }),
  };
}

function envelope(eventId: string, payload: object) {
  return `${JSON.stringify({ event_id: eventId })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(payload)}`;
}

export function buildBackendSentryEnvelope(
  report: BackendFailureReport,
  config: Pick<SentryConfig, 'environment' | 'release'>,
  eventId: string
): string | null {
  if (!isBackendFailureReport(report)) return null;

  return envelope(eventId, {
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
