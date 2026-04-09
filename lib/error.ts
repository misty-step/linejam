import {
  captureCanaryException,
  isCanaryEnabled,
  scrubCanaryContext,
} from '@/lib/canary';

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
  if (!isCanaryEnabled()) {
    logCapturedError(
      'Error captured (Canary disabled):',
      error,
      scrubCanaryContext(context)
    );
    return;
  }

  void captureCanaryException(error, context);

  // Log to console in development for visibility
  if (process.env.NODE_ENV === 'development') {
    logCapturedError('Captured error:', error, scrubCanaryContext(context));
  }
}

function logCapturedError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  if (context) {
    console.error(message, error, context);
    return;
  }

  console.error(message, error);
}
