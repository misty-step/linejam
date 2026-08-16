import * as Sentry from '@sentry/nextjs';

/**
 * Next.js loads this hook once in each server runtime. Runtime-specific SDK
 * entrypoints keep Node-only integrations out of the Edge bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export type RequestErrorCapturer = typeof Sentry.captureRequestError;

export function onRequestError(
  error: Parameters<typeof Sentry.captureRequestError>[0],
  request: Parameters<typeof Sentry.captureRequestError>[1],
  context: Parameters<typeof Sentry.captureRequestError>[2],
  capturer: RequestErrorCapturer = Sentry.captureRequestError
) {
  if (
    process.env.NEXT_PUBLIC_SENTRY_ENABLED !== '1' ||
    !process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  ) {
    return;
  }

  capturer(error, request, context);
}
