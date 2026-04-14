const REQUEST_TIMEOUT_MS = 2_000;
const SERVICE = 'linejam';
export const DEFAULT_CANARY_ENDPOINT = 'https://canary-obs.fly.dev';
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

export type CanaryPayload = {
  errorClass: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  stackTrace?: string;
  context?: Record<string, unknown>;
  fingerprint?: string[];
};

export type CanaryConfig = {
  apiKey: string;
  endpoint: string;
  environment: string;
};

export type CanaryConfigResolver = () => CanaryConfig;

export function normalizeApiKey(value: string | undefined): string {
  const normalized = value?.trim() || '';
  return PLACEHOLDER_API_KEYS.has(normalized) ? '' : normalized;
}

export function normalizeError(error: unknown): {
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

export function scrubErrorForLogs(error: unknown) {
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

export function isCanaryConfigured(
  resolveConfig: CanaryConfigResolver
): boolean {
  return resolveConfig().apiKey.length > 0;
}

export async function captureCanaryExceptionWith(
  resolveConfig: CanaryConfigResolver,
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const normalized = normalizeError(error);
  const scrubbedContext = scrubCanaryContext(context);

  await sendCanaryPayload(
    resolveConfig(),
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

export async function sendCanaryPayload(
  config: CanaryConfig,
  payload: CanaryPayload,
  originalError: unknown
): Promise<void> {
  if (!config.apiKey) return;

  try {
    const response = await fetch(
      `${config.endpoint.replace(/\/$/, '')}/api/v1/errors`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: SERVICE,
          environment: config.environment,
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
