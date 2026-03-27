const DEFAULT_ENDPOINT = 'https://canary-obs.fly.dev';
const REQUEST_TIMEOUT_MS = 2_000;
const SERVICE = 'linejam';
const SCRUB_FIELDS = new Set([
  'text',
  'displayName',
  'poemText',
  'lineText',
  'lines',
  'content',
  'previousLine',
  'currentLine',
  'submittedLine',
]);

export function isCanaryEnabled(): boolean {
  return getApiKey().length > 0;
}

export async function captureCanaryException(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const normalized = normalizeError(error);

  try {
    await fetch(`${getEndpoint().replace(/\/$/, '')}/api/v1/errors`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: SERVICE,
        environment:
          process.env.SENTRY_ENVIRONMENT ||
          process.env.NODE_ENV ||
          'production',
        error_class: normalized.errorClass,
        message: normalized.message,
        severity: 'error',
        stack_trace: normalized.stackTrace,
        context: scrubContext(context),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.error('Canary capture failed:', error, context);
    }
  }
}

function getEndpoint(): string {
  return process.env.NEXT_PUBLIC_CANARY_ENDPOINT?.trim() || DEFAULT_ENDPOINT;
}

function getApiKey(): string {
  return process.env.NEXT_PUBLIC_CANARY_API_KEY?.trim() || '';
}

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

function scrubContext(
  context: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!context) return undefined;

  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SCRUB_FIELDS.has(key)) continue;
    next[key] = scrubValue(value);
  }

  return next;
}

function scrubValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry));
  }

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SCRUB_FIELDS.has(key)) continue;
    next[key] = scrubValue(entry);
  }
  return next;
}
