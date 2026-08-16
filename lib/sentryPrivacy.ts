import type { ErrorEvent, Event, EventHint } from '@sentry/nextjs';
import { isUnrecognizedServerActionError } from '@/lib/deploymentSkew';

type TransactionEvent = Event & { type: 'transaction' };
type SentryFrame = NonNullable<
  NonNullable<
    NonNullable<NonNullable<Event['exception']>['values']>[number]['stacktrace']
  >['frames']
>[number];

const SAFE_TAG_VALUES = {
  runtime: { browser: true, node: true, edge: true },
  environment: {
    development: true,
    preview: true,
    production: true,
    test: true,
  },
  operation: {
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
    sweepAbandonedGames: true,
    toggleFavorite: true,
  },
  failureCode: {
    reportingFailure: true,
    unexpected_error: true,
  },
} satisfies Record<string, Readonly<Record<string, true>>>;

const SAFE_NUMERIC_CONTEXT = {
  attempt: true,
  durationMs: true,
  maxAttempts: true,
  scanned: true,
  scheduled: true,
  statusCode: true,
} satisfies Readonly<Record<string, true>>;

const SAFE_CORRELATION_CONTEXT = {
  correlationId: true,
  requestId: true,
} satisfies Readonly<Record<string, true>>;

const SAFE_EXCEPTION_MESSAGES = {
  'Clerk did not load in time; continuing with guest play': true,
  'Linejam preview privacy drill': true,
} satisfies Readonly<Record<string, true>>;

const SAFE_LEVELS = {
  debug: true,
  info: true,
  warning: true,
  error: true,
  fatal: true,
} satisfies Readonly<Record<string, true>>;

const SAFE_PLATFORMS = {
  javascript: true,
  node: true,
} satisfies Readonly<Record<string, true>>;

const SAFE_TRACE_STATUS = {
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
} satisfies Readonly<Record<string, true>>;

const SAFE_ROUTES = {
  '/': true,
  '/auth/callback': true,
  '/host': true,
  '/join': true,
  '/api/guest/session': true,
  '/api/health': true,
  '/api/internal/sentry-preview-drill': true,
  '/room/[code]': true,
} satisfies Readonly<Record<string, true>>;

const SAFE_TRACE_OPERATIONS = {
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
} satisfies Readonly<Record<string, true>>;

const SAFE_MECHANISMS = {
  generic: true,
  'auto.browser.browserapierrors': true,
  'auto.browser.global_handlers.onerror': true,
  'auto.browser.global_handlers.onunhandledrejection': true,
  'auto.http.nextjs.on_request_error': true,
} satisfies Readonly<Record<string, true>>;

const SAFE_ERROR_CLASSES = {
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
} satisfies Readonly<Record<string, true>>;

const COMMIT_RELEASE = /^[a-f0-9]{40}$/;
const EVENT_ID = /^[a-f0-9]{32}$/i;
const TRACE_ID = /^[a-f0-9]{32}$/i;
const SPAN_ID = /^[a-f0-9]{16}$/i;
const SAFE_CORRELATION_ID = /^[A-Za-z0-9_-]{8,128}$/;
const DEBUG_ID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const STATIC_BUNDLE_SEGMENT = /^[A-Za-z0-9._~!$&'()+,;=@[\]-]+$/;
const STATIC_BUNDLE_EXTENSION = /\.(?:js|mjs)$/i;

export type SentryReporterContext = {
  tags?: Record<string, string>;
  contexts?: { linejam: Record<string, string | number> };
};

export type PrivacyScalar = string | number | boolean | null | undefined;
export type PrivacyContext = Record<string, PrivacyScalar>;
type SentryTagScalar = NonNullable<Event['tags']>[string];

function safeTag(
  key: keyof typeof SAFE_TAG_VALUES,
  value: SentryTagScalar
): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value);
  return Object.hasOwn(SAFE_TAG_VALUES[key], str) ? str : undefined;
}

function safeRelease(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return COMMIT_RELEASE.test(value) ? value : undefined;
}

function safeNumber(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(1_000_000_000, value));
}

function safeTimestamp(value: number | null | undefined): number | undefined {
  if (
    value !== null &&
    value !== undefined &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 10_000_000_000
  ) {
    return value;
  }
  return undefined;
}

function safeCorrelationId(
  value: string | null | undefined
): string | undefined {
  if (!value) return undefined;
  return SAFE_CORRELATION_ID.test(value) ? value : undefined;
}

function safeSourceLocation(
  value: string | null | undefined
): string | undefined {
  if (!value || value.length > 1_024 || value.includes('\\')) {
    return undefined;
  }

  try {
    const candidate = value.startsWith('~/_next/static/')
      ? value.slice(1)
      : value;
    const parsed = new URL(candidate, 'https://linejam.invalid');
    if (
      !['http:', 'https:', 'app:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname.length > 512
    ) {
      return undefined;
    }

    const decodedPathname = decodeURIComponent(parsed.pathname);
    const segments = decodedPathname.split('/');
    const bundleSegments = segments.slice(3);
    if (
      segments[0] !== '' ||
      segments[1] !== '_next' ||
      segments[2] !== 'static' ||
      !bundleSegments.length ||
      bundleSegments.some(
        (segment) =>
          !segment ||
          segment === '.' ||
          segment === '..' ||
          !STATIC_BUNDLE_SEGMENT.test(segment)
      ) ||
      !STATIC_BUNDLE_EXTENSION.test(bundleSegments.at(-1) || '')
    ) {
      return undefined;
    }

    return `app://${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

function sanitizeDebugMeta(
  debugMeta: Event['debug_meta']
): ErrorEvent['debug_meta'] {
  const images = debugMeta?.images
    ?.map((image) => {
      const codeFile = safeSourceLocation(image.code_file);
      const debugId =
        image.debug_id && DEBUG_ID.test(image.debug_id)
          ? image.debug_id
          : undefined;
      if (image.type !== 'sourcemap' || !codeFile || !debugId) {
        return undefined;
      }
      return {
        type: 'sourcemap' as const,
        code_file: codeFile,
        debug_id: debugId,
      };
    })
    .filter((image): image is NonNullable<typeof image> => Boolean(image));

  return images?.length ? { images } : undefined;
}

function sanitizeTags(
  tags: Event['tags'] | Record<string, PrivacyScalar> | undefined
): Record<string, string> | undefined {
  if (!tags) return undefined;

  const safe = {
    runtime: safeTag('runtime', tags.runtime),
    environment: safeTag('environment', tags.environment),
    release: safeRelease(
      tags.release !== null && tags.release !== undefined
        ? String(tags.release)
        : undefined
    ),
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

function sanitizeLinejamContext(
  value: PrivacyContext | undefined
): Record<string, string | number> | undefined {
  if (!value) return undefined;

  const safe: Record<string, string | number> = {};
  for (const key of Object.keys(SAFE_NUMERIC_CONTEXT)) {
    const rawVal = value[key];
    const numeric =
      rawVal !== null && rawVal !== undefined
        ? safeNumber(Number(rawVal))
        : undefined;
    if (numeric !== undefined) safe[key] = numeric;
  }
  for (const key of Object.keys(SAFE_CORRELATION_CONTEXT)) {
    const rawVal = value[key];
    const correlationId =
      rawVal !== null && rawVal !== undefined
        ? safeCorrelationId(String(rawVal))
        : undefined;
    if (correlationId) safe[key] = correlationId;
  }
  return Object.keys(safe).length ? safe : undefined;
}

function sanitizeTraceContext(
  value: NonNullable<Event['contexts']>['trace'] | undefined
): NonNullable<ErrorEvent['contexts']>['trace'] {
  if (!value) return undefined;

  const traceId =
    value.trace_id && TRACE_ID.test(value.trace_id)
      ? value.trace_id
      : undefined;
  const spanId =
    value.span_id && SPAN_ID.test(value.span_id) ? value.span_id : undefined;
  if (!traceId || !spanId) return undefined;

  const parentSpanId =
    value.parent_span_id && SPAN_ID.test(value.parent_span_id)
      ? value.parent_span_id
      : undefined;
  const operation =
    value.op && Object.hasOwn(SAFE_TRACE_OPERATIONS, value.op)
      ? value.op
      : undefined;
  const status =
    value.status && Object.hasOwn(SAFE_TRACE_STATUS, value.status)
      ? value.status
      : undefined;

  const result: NonNullable<ErrorEvent['contexts']>['trace'] = {
    trace_id: traceId,
    span_id: spanId,
  };
  if (parentSpanId) {
    result.parent_span_id = parentSpanId;
  }
  if (operation) {
    result.op = operation;
  }
  if (status) {
    result.status = status;
  }
  return result;
}

function sanitizeContexts(contexts: Event['contexts']): ErrorEvent['contexts'] {
  if (!contexts) return undefined;

  const trace = sanitizeTraceContext(contexts.trace);
  // SAFETY: contexts.linejam contains custom Linejam reporting context conforming to PrivacyContext.
  const linejam = sanitizeLinejamContext(
    contexts.linejam as PrivacyContext | undefined
  );
  if (!trace && !linejam) return undefined;

  const result: NonNullable<ErrorEvent['contexts']> = {};
  if (trace) {
    result.trace = trace;
  }
  if (linejam) {
    result.linejam = linejam;
  }
  return result;
}

type StackFrame = {
  filename?: string;
  abs_path?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
};

type SanitizedMechanism = {
  type: string;
  handled?: boolean;
};

type SanitizedExceptionValue = {
  type: string;
  value?: string;
  stacktrace?: {
    frames: StackFrame[];
  };
  mechanism?: SanitizedMechanism;
};

function sanitizeFrame(frame: SentryFrame | StackFrame): StackFrame {
  const lineNumber = safeNumber(frame.lineno);
  const columnNumber = safeNumber(frame.colno);
  const sourceLocation = safeSourceLocation(frame.filename ?? frame.abs_path);

  const result: StackFrame = {};
  if (sourceLocation) {
    result.filename = sourceLocation;
    result.abs_path = sourceLocation;
  }
  if (lineNumber !== undefined) {
    result.lineno = lineNumber;
  }
  if (columnNumber !== undefined) {
    result.colno = columnNumber;
  }
  if (frame.in_app === true || frame.in_app === false) {
    result.in_app = frame.in_app;
  }
  return result;
}

function sanitizeException(
  exception: Event['exception']
): ErrorEvent['exception'] {
  const values = exception?.values
    ?.map((value) => {
      const type =
        value.type && Object.hasOwn(SAFE_ERROR_CLASSES, value.type)
          ? value.type
          : 'Error';
      const message = Object.hasOwn(SAFE_EXCEPTION_MESSAGES, value.value || '')
        ? value.value
        : undefined;
      const frames = value.stacktrace?.frames?.map((frame) =>
        sanitizeFrame(frame)
      );
      const mechanismType =
        value.mechanism?.type &&
        Object.hasOwn(SAFE_MECHANISMS, value.mechanism.type)
          ? value.mechanism.type
          : undefined;

      let mechanism: SanitizedMechanism | undefined;
      if (mechanismType) {
        mechanism = {
          type: mechanismType,
        };
        if (
          value.mechanism?.handled === true ||
          value.mechanism?.handled === false
        ) {
          mechanism.handled = value.mechanism.handled;
        }
      }

      const val: SanitizedExceptionValue = {
        type,
      };
      if (message) {
        val.value = message;
      }
      if (frames && frames.length > 0) {
        val.stacktrace = { frames };
      }
      if (mechanism) {
        val.mechanism = mechanism;
      }

      return val;
    })
    .filter(Boolean);

  return values?.length ? { values } : undefined;
}

function sanitizeBaseEvent(event: Event): ErrorEvent {
  const eventId =
    event.event_id && EVENT_ID.test(event.event_id)
      ? event.event_id
      : undefined;
  const timestamp = safeTimestamp(event.timestamp);
  const level =
    event.level && Object.hasOwn(SAFE_LEVELS, event.level)
      ? event.level
      : undefined;
  const platform =
    event.platform && Object.hasOwn(SAFE_PLATFORMS, event.platform)
      ? event.platform
      : undefined;
  const environment = safeTag('environment', event.environment);
  const release = safeRelease(event.release);
  const tags = sanitizeTags(event.tags);
  const contexts = sanitizeContexts(event.contexts);
  const exception = sanitizeException(event.exception);
  const debugMeta = sanitizeDebugMeta(event.debug_meta);

  const result: ErrorEvent = {
    type: undefined,
  };
  if (eventId) {
    result.event_id = eventId;
  }
  if (timestamp !== undefined) {
    result.timestamp = timestamp;
  }
  if (level) {
    result.level = level;
  }
  if (platform) {
    result.platform = platform;
  }
  if (environment) {
    result.environment = environment;
  }
  if (release) {
    result.release = release;
  }
  if (tags) {
    result.tags = tags;
  }
  if (contexts) {
    result.contexts = contexts;
  }
  if (exception) {
    result.exception = exception;
  }
  if (debugMeta) {
    result.debug_meta = debugMeta;
  }
  return result;
}

function safeTransactionName(value: string | null | undefined): string {
  if (!value) return 'unknown-route';

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
        start_timestamp: startTimestamp,
        timestamp,
        data: {},
      };
      if (span.parent_span_id && SPAN_ID.test(span.parent_span_id)) {
        sanitized.parent_span_id = span.parent_span_id;
      }
      if (operation) {
        sanitized.op = operation;
      }
      if (status) {
        sanitized.status = status;
      }
      return sanitized;
    })
    .filter((span): span is NonNullable<typeof span> => Boolean(span));
}

/** Hard transport allowlist for error events. Unknown messages are discarded. */
export function beforeSend(
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent | null {
  // SAFETY: hint.originalException is the unhandled exception or rejection reason delivered to Sentry.
  if (
    isUnrecognizedServerActionError(
      hint.originalException as Error | null | undefined
    )
  ) {
    return null;
  }

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
  const result: TransactionEvent = {
    ...safe,
    type: 'transaction',
    transaction: safeTransactionName(event.transaction),
    start_timestamp: startTimestamp,
  };
  if (spans && spans.length > 0) {
    result.spans = spans;
  }
  return result;
}

/** Convert the shared reporter's legacy context into closed Sentry fields. */
export function sanitizeSentryReporterContext(
  context?: PrivacyContext
): SentryReporterContext | undefined {
  if (!context) return undefined;

  const tags = sanitizeTags({
    operation: context.operation,
    failureCode: context.failureCode,
  });
  const linejam = sanitizeLinejamContext(context);
  if (!tags && !linejam) return undefined;

  const result: SentryReporterContext = {};
  if (tags) {
    result.tags = tags;
  }
  if (linejam) {
    result.contexts = { linejam };
  }
  return result;
}
