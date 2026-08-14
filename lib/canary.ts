import {
  DEFAULT_CANARY_ENDPOINT,
  captureCanaryExceptionWith,
  isCanaryConfigured,
  normalizeApiKey,
  scrubCanaryContext,
} from '@/lib/canaryCore';

function getCanaryConfig() {
  return {
    apiKey: normalizeApiKey(process.env.NEXT_PUBLIC_CANARY_API_KEY),
    endpoint:
      process.env.NEXT_PUBLIC_CANARY_ENDPOINT?.trim() ||
      DEFAULT_CANARY_ENDPOINT,
    environment: process.env.NODE_ENV || 'production',
  };
}

/**
 * Returns whether the browser-safe Canary ingest key is configured.
 */
export function isCanaryEnabled(): boolean {
  return isCanaryConfigured(getCanaryConfig);
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
  await captureCanaryExceptionWith(getCanaryConfig, error, context);
}

export { scrubCanaryContext };
