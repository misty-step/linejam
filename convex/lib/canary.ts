/**
 * Convex-side Canary error reporter.
 *
 * Reuses the same Canary API endpoint, payload shape, and context-scrubbing
 * discipline as the client-side reporter (lib/canaryCore.ts) so backend
 * failures land in the same incident system.
 */

const SERVICE = 'linejam';
const DEFAULT_CANARY_ENDPOINT = 'https://canary-obs-3jzhr.ondigitalocean.app';
const REQUEST_TIMEOUT_MS = 2_000;

const SAFE_CONTEXT_KEYS = new Set([
  'boundary',
  'digest',
  'method',
  'operation',
  'path',
  'poemId',
  'roomCode',
  'roomId',
  'route',
  'routePath',
  'source',
  'status',
  'durationMs',
]);

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      errorClass: error.name || error.constructor.name || 'Error',
      message: error.message || 'Unknown error',
      stackTrace: error.stack,
    };
  }

  if (typeof error === 'string') {
    return { errorClass: 'StringError', message: error };
  }

  return { errorClass: 'UnknownError', message: String(error) };
}

function scrubContext(
  context: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!context) return undefined;

  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SAFE_CONTEXT_KEYS.has(key)) {
      next[key] = value;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export interface BackendCanaryPayload {
  errorClass: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  stackTrace?: string;
  context?: Record<string, unknown>;
}

export function buildBackendCanaryPayload(
  error: unknown,
  context?: Record<string, unknown>
): BackendCanaryPayload {
  const normalized = normalizeError(error);
  const scrubbedContext = scrubContext(context);

  return {
    errorClass: normalized.errorClass,
    message: normalized.message,
    severity: 'error',
    stackTrace: normalized.stackTrace,
    context: scrubbedContext,
  };
}

function config() {
  const apiKey = process.env.CANARY_API_KEY?.trim();
  const endpoint =
    process.env.CANARY_ENDPOINT?.trim() || DEFAULT_CANARY_ENDPOINT;
  return { apiKey, endpoint };
}

export function isBackendCanaryEnabled(): boolean {
  const { apiKey } = config();
  return (apiKey?.length ?? 0) > 0;
}

/**
 * Send a payload to Canary. Must be called from an action (has fetch).
 */
export async function sendBackendCanaryPayload(
  payload: BackendCanaryPayload
): Promise<void> {
  const { apiKey, endpoint } = config();
  if (!apiKey) return;

  try {
    const response = await fetch(
      `${endpoint.replace(/\/$/, '')}/api/v1/errors`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: SERVICE,
          environment: process.env.CONVEX_CLOUD_URL?.includes('convex.cloud')
            ? 'production'
            : 'development',
          error_class: payload.errorClass,
          message: payload.message,
          severity: payload.severity,
          stack_trace: payload.stackTrace,
          context: payload.context,
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
    console.error('Canary capture failed (backend):', reportingError, {
      originalError: {
        errorClass: payload.errorClass,
        message: payload.message,
      },
    });
  }
}
