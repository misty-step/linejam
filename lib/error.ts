import {
  captureCanaryException,
  isCanaryEnabled,
  scrubCanaryContext,
} from '@/lib/canary';
import { captureReportedError } from '@/lib/errorCore';
import { isExpectedConvexRateLimitError } from '@/lib/errorFeedback';

/**
 * Capture an error to Canary with optional context.
 *
 * This is a deep module: callers report failures without learning transport
 * details. Observability stays behind Canary.
 *
 * @example
 * captureError(error, { roomCode: 'ABCD', poemId: '123' });
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>
) {
  if (isExpectedConvexRateLimitError(error)) return;

  captureReportedError(
    { captureCanaryException, isCanaryEnabled, scrubCanaryContext },
    error,
    context
  );
}
