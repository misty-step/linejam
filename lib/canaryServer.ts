import 'server-only';

import {
  DEFAULT_CANARY_ENDPOINT,
  captureCanaryExceptionWith,
  isCanaryConfigured,
  normalizeApiKey,
  scrubCanaryContext,
} from '@/lib/canaryCore';

function getCanaryConfig() {
  return {
    apiKey:
      normalizeApiKey(process.env.CANARY_API_KEY) ||
      normalizeApiKey(process.env.NEXT_PUBLIC_CANARY_API_KEY),
    endpoint:
      process.env.CANARY_ENDPOINT?.trim() ||
      process.env.NEXT_PUBLIC_CANARY_ENDPOINT?.trim() ||
      DEFAULT_CANARY_ENDPOINT,
    environment:
      process.env.CANARY_ENVIRONMENT || process.env.NODE_ENV || 'production',
  };
}

/**
 * Returns whether server-side or fallback public Canary ingest is configured.
 */
export function isCanaryEnabled(): boolean {
  return isCanaryConfigured(getCanaryConfig);
}

/**
 * Reports an exception to Canary without throwing back into the caller.
 *
 * Server-side runtime can prefer private `CANARY_*` credentials while still
 * falling back to the public ingest key used by the browser.
 */
export async function captureCanaryException(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  await captureCanaryExceptionWith(getCanaryConfig, error, context);
}

export { scrubCanaryContext };
