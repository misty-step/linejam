const DEFAULT_ENDPOINT = 'https://canary-obs.fly.dev';
const REQUEST_TIMEOUT_MS = 2_000;
const SERVICE = 'linejam';
const PLACEHOLDER_API_KEYS = new Set([
  'example_canary_server_key',
  'example_canary_write_key',
]);
const SAFE_CONTEXT_KEYS = new Set([
  'boundary',
  'digest',
  'method',
  'operation',
  'path',
  'poemId',
  'revalidateReason',
  'roomCode',
  'route',
  'routePath',
  'routeType',
  'routerKind',
  'renderSource',
  'source',
]);

/**
 * Returns whether the write-only Canary ingest key is configured.
 */
export function isCanaryEnabled(): boolean {
  return getApiKey().length > 0;
}

/**
 * Reports an exception to Canary without throwing back into the caller.
 *
 * Context is reduced to a small allowlist before it leaves the process so
 * user identifiers and content do not reach Canary or fallback logs.
 */
export async function captureCanaryException(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const normalized = normalizeError(error);
  const scrubbedContext = scrubCanaryContext(context);

  await sendCanaryPayload(
    {
      errorClass: normalized.errorClass,
      message: normalized.message,
      severity: 'error',
      stackTrace: normalized.stackTrace,
      context: scrubbedContext,
    },
    normalized
  );
}

/**
 * Removes everything except the small set of safe observability keys.
 */
export function scrubCanaryContext(
  context: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!context) return undefined;

  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue;

    const scrubbedValue = scrubValue(value);
    if (scrubbedValue !== undefined) {
      next[key] = scrubbedValue;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Resolves the Canary ingest endpoint, defaulting to production.
 */
function getEndpoint(): string {
  return (
    process.env.CANARY_ENDPOINT?.trim() ||
    process.env.NEXT_PUBLIC_CANARY_ENDPOINT?.trim() ||
    DEFAULT_ENDPOINT
  );
}

/**
 * Reads the browser-safe Canary ingest key.
 */
function getApiKey(): string {
  return (
    normalizeApiKey(process.env.CANARY_API_KEY) ||
    normalizeApiKey(process.env.NEXT_PUBLIC_CANARY_API_KEY) ||
    ''
  );
}

function normalizeApiKey(value: string | undefined): string {
  const normalized = value?.trim() || '';
  return PLACEHOLDER_API_KEYS.has(normalized) ? '' : normalized;
}

/**
 * Normalizes arbitrary thrown values into the shape Canary expects.
 */
function normalizeError(error: unknown): {
  errorClass: string;
  message: string;
  stackTrace?: string;
} {
  if (error instanceof Error) {
    return {
      errorClass: error.name || error.constructor.name || 'Error',
      message: error.message || 'Unknown error',
      stackTrace: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      errorClass: 'StringError',
      message: error,
    };
  }

  return {
    errorClass: 'UnknownError',
    message: String(error),
  };
}

function scrubErrorForLogs(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    typeof (error as { errorClass?: unknown }).errorClass === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return {
      errorClass: (error as { errorClass: string }).errorClass,
      message: (error as { message: string }).message,
      stackTrace:
        typeof (error as { stackTrace?: unknown }).stackTrace === 'string'
          ? (error as { stackTrace?: string }).stackTrace
          : undefined,
    };
  }

  const normalized = normalizeError(error);
  return {
    errorClass: normalized.errorClass,
    message: normalized.message,
    stackTrace: normalized.stackTrace,
  };
}

type CanaryPayload = {
  errorClass: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  stackTrace?: string;
  context?: Record<string, unknown>;
  fingerprint?: string[];
};

async function sendCanaryPayload(
  payload: CanaryPayload,
  originalError: unknown
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const response = await fetch(
      `${getEndpoint().replace(/\/$/, '')}/api/v1/errors`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: SERVICE,
          environment:
            process.env.CANARY_ENVIRONMENT ||
            process.env.NODE_ENV ||
            'production',
          error_class: payload.errorClass,
          message: payload.message,
          severity: payload.severity,
          stack_trace: payload.stackTrace,
          context: payload.context,
          fingerprint: payload.fingerprint,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Canary capture returned ${response.status} ${response.statusText}`.trim()
      );
    }
  } catch (reportingError) {
    console.error('Canary capture failed:', reportingError, {
      originalError: scrubErrorForLogs(originalError),
      context: payload.context,
    });
  }
}

/**
 * Recursively strips nested values down to the same allowlist.
 */
function scrubValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    const next = value
      .map((entry) => scrubValue(entry))
      .filter((entry) => entry !== undefined);
    return next.length > 0 ? next : undefined;
  }

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue;

    const scrubbedEntry = scrubValue(entry);
    if (scrubbedEntry !== undefined) {
      next[key] = scrubbedEntry;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}
