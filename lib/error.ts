import * as Sentry from '@sentry/nextjs';

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
  Sentry.captureException(error, {
    contexts: context ? { custom: context } : undefined,
  });
}
