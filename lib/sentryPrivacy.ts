import type { ErrorEvent, Event, EventHint } from '@sentry/nextjs';
import { isUnrecognizedServerActionError } from '@/lib/deploymentSkew';

type TransactionEvent = Event & { type: 'transaction' };

const SAFE_TAG_VALUES: Record<string, Readonly<Record<string, true>>> = {
  runtime: { browser: true, node: true, edge: true },
  environment: {
    development: true,
    preview: true,
    production: true,
    test: true,
  },
  operation: {
    aiFallbackRate: true,
    clearGuestSession: true,
    clerkLoadTimeout: true,
    convexAuthUnavailable: true,
    createGuestSession: true,
    fetchGuestSession: true,
    finishAbandonedGame: true,
    healthCheckIn: true,
    migrateGuestToUser: true,
    renderRoomPage: true,
    renderRoomPanel: true,
    sentryPreviewDrill: true,
    summonGhostwriter: true,
    sweepAbandonedGames: true,
    toggleFavorite: true,
  },
  failureCode: {
    budget_exhaustion: true,
    invalid_output: true,
    missing_configuration: true,
    provider_error: true,
    reportingFailure: true,
    unexpected_error: true,
  },
};

const SAFE_NUMERIC_CONTEXT: Readonly<Record<string, true>> = {
  attempt: true,
  durationMs: true,
  fallbackGenerations: true,
  fallbackRatePercent: true,
  filled: true,
  maxAttempts: true,
  scanned: true,
  scheduled: true,
  statusCode: true,
  thresholdPercent: true,
  totalGenerations: true,
};
const SAFE_CORRELATION_CONTEXT: Readonly<Record<string, true>> = {
  correlationId: true,
  requestId: true,
};
const SAFE_EXCEPTION_MESSAGES: Readonly<Record<string, true>> = {
  'Linejam preview privacy drill': true,
};
const SAFE_LEVELS: Readonly<Record<string, true>> = {
  debug: true,
  info: true,
  warning: true,
  error: true,
  fatal: true,
};
const SAFE_PLATFORMS: Readonly<Record<string, true>> = {
  javascript: true,
  node: true,
};
const SAFE_TRACE_STATUS: Readonly<Record<string, true>> = {
  aborted: true,
  already_exists: true,
  cancelled: true,
  data_loss: true,
  deadline_exceeded: true,
  failed_precondition: true,
  internal_error: true,
  invalid_argument: true,
  not_found: true,
  ok: true,
  out_of_range: true,
  permission_denied: true,
  resource_exhausted: true,
  unauthenticated: true,
  unavailable: true,
  unimplemented: true,
  unknown_error: true,
};
const SAFE_ROUTES: Readonly<Record<string, true>> = {
  '/': true,
  '/auth/callback': true,
  '/host': true,
  '/join': true,
  '/api/guest/session': true,
  '/api/health': true,
  '/api/internal/sentry-preview-drill': true,
  '/room/[code]': true,
};
const SAFE_TRACE_OPERATIONS: Readonly<Record<string, true>> = {
  browser: true,
  'function.nextjs': true,
  'http.client': true,
  'http.server': true,
  'middleware.nextjs': true,
  navigation: true,
  pageload: true,
  'render.nextjs': true,
  'routehandler.nextjs': true,
  'servercomponent.nextjs': true,
  'ui.action.click': true,
};
const SAFE_MECHANISMS: Readonly<Record<string, true>> = {
  generic: true,
  'auto.browser.browserapierrors': true,
  'auto.browser.global_handlers.onerror': true,
  'auto.browser.global_handlers.onunhandledrejection': true,
  'auto.http.nextjs.on_request_error': true,
};
const SAFE_ERROR_CLASSES: Readonly<Record<string, true>> = {
  AggregateError: true,
  ClerkLoadTimeoutError: true,
  ConvexError: true,
  Error: true,
  EvalError: true,
  RangeError: true,
  ReferenceError: true,
  SentryPreviewDrillError: true,
  SyntaxError: true,
  TypeError: true,
  URIError: true,
  UnrecognizedActionError: true,
};
const COMMIT_RELEASE = /^[a-f0-9]{7,64}$/i;
const EVENT_ID = /^[a-f0-9]{32}$/i;
const TRACE_ID = /^[a-f0-9]{32}$/i;
const SPAN_ID = /^[a-f0-9]{16}$/i;
const SAFE_CORRELATION_ID = /^[A-Za-z0-9_-]{8,128}$/;

export type SentryReporterContext = {
  tags?: Record<string, string>;
  contexts?: { linejam: Record<string, string | number> };
};

function safeTag(key: keyof typeof SAFE_TAG_VALUES, value: unknown) {
  return typeof value === 'string' && Object.hasOwn(SAFE_TAG_VALUES[key], value)
    ? value
    : undefined;
}

function safeRelease(value: unknown) {
  return typeof value === 'string' && COMMIT_RELEASE.test(value)
    ? value
    : undefined;
}

function safeNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1_000_000_000, value));
}

function safeTimestamp(value: unknown) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 10_000_000_000
    ? value
    : undefined;
}

function safeCorrelationId(value: unknown) {
  return typeof value === 'string' && SAFE_CORRELATION_ID.test(value)
    ? value
    : undefined;
}

function sanitizeTags(tags: Record<string, unknown> | undefined) {
  if (!tags) return undefined;

  const safe = {
    runtime: safeTag('runtime', tags.runtime),
    environment: safeTag('environment', tags.environment),
    release: safeRelease(tags.release),
    operation: safeTag('operation', tags.operation),
    failure_code: safeTag('failureCode', tags.failure_code ?? tags.failureCode),
  };
  const compact = Object.fromEntries(
    Object.entries(safe).filter((entry): entry is [string, string] =>
      Boolean(entry[1])
    )
  );
  return Object.keys(compact).length ? compact : undefined;
}

function sanitizeLinejamContext(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;

  const source = value as Record<string, unknown>;
  const safe: Record<string, string | number> = {};
  for (const key of Object.keys(SAFE_NUMERIC_CONTEXT)) {
    const numeric = safeNumber(source[key]);
    if (numeric !== undefined) safe[key] = numeric;
  }
  for (const key of Object.keys(SAFE_CORRELATION_CONTEXT)) {
    const correlationId = safeCorrelationId(source[key]);
    if (correlationId) safe[key] = correlationId;
  }
  return Object.keys(safe).length ? safe : undefined;
}

function sanitizeTraceContext(
  value: unknown
): NonNullable<ErrorEvent['contexts']>['trace'] {
  if (!value || typeof value !== 'object') return undefined;

  const trace = value as Record<string, unknown>;
  const traceId =
    typeof trace.trace_id === 'string' && TRACE_ID.test(trace.trace_id)
      ? trace.trace_id
      : undefined;
  const spanId =
    typeof trace.span_id === 'string' && SPAN_ID.test(trace.span_id)
      ? trace.span_id
      : undefined;
  if (!traceId || !spanId) return undefined;

  const parentSpanId =
    typeof trace.parent_span_id === 'string' &&
    SPAN_ID.test(trace.parent_span_id)
      ? trace.parent_span_id
      : undefined;
  const operation =
    typeof trace.op === 'string' &&
    Object.hasOwn(SAFE_TRACE_OPERATIONS, trace.op)
      ? trace.op
      : undefined;
  const status =
    typeof trace.status === 'string' &&
    Object.hasOwn(SAFE_TRACE_STATUS, trace.status)
      ? trace.status
      : undefined;
  return {
    trace_id: traceId,
    span_id: spanId,
    ...(parentSpanId ? { parent_span_id: parentSpanId } : {}),
    ...(operation ? { op: operation } : {}),
    ...(status ? { status } : {}),
  };
}

function sanitizeContexts(contexts: Event['contexts']): ErrorEvent['contexts'] {
  if (!contexts) return undefined;

  const trace = sanitizeTraceContext(contexts.trace);
  const linejam = sanitizeLinejamContext(contexts.linejam);
  return trace || linejam
    ? {
        ...(trace ? { trace } : {}),
        ...(linejam ? { linejam } : {}),
      }
    : undefined;
}

function sanitizeFrame(frame: Record<string, unknown>) {
  const lineNumber = safeNumber(frame.lineno);
  const columnNumber = safeNumber(frame.colno);

  return {
    ...(lineNumber !== undefined ? { lineno: lineNumber } : {}),
    ...(columnNumber !== undefined ? { colno: columnNumber } : {}),
    ...(typeof frame.in_app === 'boolean' ? { in_app: frame.in_app } : {}),
  };
}

function sanitizeException(
  exception: Event['exception']
): ErrorEvent['exception'] {
  const values = exception?.values
    ?.map((value) => {
      const type =
        typeof value.type === 'string' &&
        Object.hasOwn(SAFE_ERROR_CLASSES, value.type)
          ? value.type
          : 'Error';
      const message = Object.hasOwn(SAFE_EXCEPTION_MESSAGES, value.value || '')
        ? value.value
        : undefined;
      const frames = value.stacktrace?.frames?.map((frame) =>
        sanitizeFrame(frame as unknown as Record<string, unknown>)
      );
      const mechanismType =
        typeof value.mechanism?.type === 'string' &&
        Object.hasOwn(SAFE_MECHANISMS, value.mechanism.type)
          ? value.mechanism.type
          : undefined;
      const mechanism = mechanismType
        ? {
            type: mechanismType,
            ...(typeof value.mechanism?.handled === 'boolean'
              ? { handled: value.mechanism.handled }
              : {}),
          }
        : undefined;

      return {
        type,
        ...(message ? { value: message } : {}),
        ...(frames?.length ? { stacktrace: { frames } } : {}),
        ...(mechanism ? { mechanism } : {}),
      };
    })
    .filter(Boolean);

  return values?.length ? { values } : undefined;
}

function sanitizeBaseEvent(event: Event): ErrorEvent {
  const eventId =
    typeof event.event_id === 'string' && EVENT_ID.test(event.event_id)
      ? event.event_id
      : undefined;
  const timestamp = safeTimestamp(event.timestamp);
  const level =
    typeof event.level === 'string' && Object.hasOwn(SAFE_LEVELS, event.level)
      ? event.level
      : undefined;
  const platform =
    typeof event.platform === 'string' &&
    Object.hasOwn(SAFE_PLATFORMS, event.platform)
      ? event.platform
      : undefined;
  const environment = safeTag('environment', event.environment);
  const release = safeRelease(event.release);
  const tags = sanitizeTags(event.tags);
  const contexts = sanitizeContexts(event.contexts);
  const exception = sanitizeException(event.exception);

  return {
    type: undefined,
    ...(eventId ? { event_id: eventId } : {}),
    ...(timestamp !== undefined ? { timestamp } : {}),
    ...(level ? { level } : {}),
    ...(platform ? { platform } : {}),
    ...(environment ? { environment } : {}),
    ...(release ? { release } : {}),
    ...(tags ? { tags } : {}),
    ...(contexts ? { contexts } : {}),
    ...(exception ? { exception } : {}),
  };
}

function safeTransactionName(value: unknown) {
  if (typeof value !== 'string') return 'unknown-route';

  const match = value.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) (.+)$/);
  const method = match?.[1];
  let route = match?.[2] || value;
  route = route.split(/[?#]/, 1)[0].replace(/^https?:\/\/[^/]+/, '');
  route = route.replace(/^\/room\/[^/]+$/, '/room/[code]');
  if (!Object.hasOwn(SAFE_ROUTES, route)) route = 'unknown-route';
  return method ? `${method} ${route}` : route;
}

function sanitizeSpans(
  spans: TransactionEvent['spans']
): TransactionEvent['spans'] {
  return spans
    ?.map((span) => {
      if (!TRACE_ID.test(span.trace_id) || !SPAN_ID.test(span.span_id)) {
        return undefined;
      }
      const operation =
        span.op && Object.hasOwn(SAFE_TRACE_OPERATIONS, span.op)
          ? span.op
          : undefined;
      const status =
        span.status && Object.hasOwn(SAFE_TRACE_STATUS, span.status)
          ? span.status
          : undefined;
      const startTimestamp = safeTimestamp(span.start_timestamp);
      const timestamp = safeTimestamp(span.timestamp);
      if (startTimestamp === undefined || timestamp === undefined) {
        return undefined;
      }
      const sanitized: NonNullable<TransactionEvent['spans']>[number] = {
        trace_id: span.trace_id,
        span_id: span.span_id,
        ...(span.parent_span_id && SPAN_ID.test(span.parent_span_id)
          ? { parent_span_id: span.parent_span_id }
          : {}),
        start_timestamp: startTimestamp,
        timestamp,
        data: {},
        ...(operation ? { op: operation } : {}),
        ...(status ? { status } : {}),
      };
      return sanitized;
    })
    .filter((span): span is NonNullable<typeof span> => Boolean(span));
}

/** Hard transport allowlist for error events. Unknown messages are discarded. */
export function beforeSend(
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent | null {
  if (isUnrecognizedServerActionError(hint.originalException)) return null;

  const safe = sanitizeBaseEvent(event);
  return safe.exception ? safe : null;
}

/** Transactions use the same privacy boundary and retain only trace topology. */
export function beforeSendTransaction(
  event: TransactionEvent
): TransactionEvent | null {
  const startTimestamp = safeTimestamp(event.start_timestamp);
  if (startTimestamp === undefined) return null;

  const safe = sanitizeBaseEvent(event);
  const spans = sanitizeSpans(event.spans);
  return {
    ...safe,
    type: 'transaction',
    transaction: safeTransactionName(event.transaction),
    start_timestamp: startTimestamp,
    ...(spans?.length ? { spans } : {}),
  };
}

/** Convert the shared reporter's legacy context into closed Sentry fields. */
export function sanitizeSentryReporterContext(
  context?: Record<string, unknown>
): SentryReporterContext | undefined {
  if (!context) return undefined;

  const tags = sanitizeTags({
    operation: context.operation,
    failureCode: context.failureCode,
  });
  const linejam = sanitizeLinejamContext(context);
  return tags || linejam
    ? {
        ...(tags ? { tags } : {}),
        ...(linejam ? { contexts: { linejam } } : {}),
      }
    : undefined;
}
