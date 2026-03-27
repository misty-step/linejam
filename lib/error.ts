import * as Sentry from '@sentry/nextjs';
import {
  captureCanaryException,
  isCanaryEnabled,
  scrubCanaryContext,
} from '@/lib/canary';
import { isSentryEnabled } from '@/lib/sentry';

/**
 * Capture an error to Sentry with optional context.
 *
 * This is a deep module: simple interface hiding Sentry's API complexity.
 * Use this in both client and server code for consistent error tracking.
 *
 * @example
 * captureError(error, { roomCode: 'ABCD', poemId: '123' });
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>
) {
  const scrubbedContext = scrubCanaryContext(context);

  if (isSentryEnabled) {
    Sentry.captureException(error, {
      contexts: scrubbedContext ? { custom: scrubbedContext } : undefined,
    });
  }

  if (isCanaryEnabled()) {
    void captureCanaryException(error, scrubbedContext);
  }

  if (!isSentryEnabled && !isCanaryEnabled()) {
    logCapturedError(
      'Error captured (Sentry disabled):',
      error,
      scrubbedContext
    );
    return;
  }

  // Log to console in development for visibility
  if (process.env.NODE_ENV === 'development') {
    logCapturedError('Captured error:', error, scrubbedContext);
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
