import type { SentryReporterContext } from '@/lib/sentryPrivacy';

type ErrorReporter = {
  captureException: (
    error: unknown,
    context?: SentryReporterContext
  ) => unknown;
  isEnabled: () => boolean;
  sanitizeContext: (
    context?: Record<string, unknown>
  ) => SentryReporterContext | undefined;
};

export function isSentryEnabled() {
  return (
    process.env.NEXT_PUBLIC_SENTRY_ENABLED === '1' &&
    Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim())
  );
}

export function captureReportedError(
  reporter: ErrorReporter,
  error: unknown,
  context?: Record<string, unknown>
) {
  const scrubbedContext = reporter.sanitizeContext(context);

  if (!reporter.isEnabled()) {
    logCapturedError(
      'Error captured (Sentry disabled):',
      error,
      scrubbedContext
    );
    return;
  }

  reporter.captureException(error, scrubbedContext);

  if (process.env.NODE_ENV === 'development') {
    logCapturedError('Captured error:', error, scrubbedContext);
  }
}

function logCapturedError(
  message: string,
  error: unknown,
  context?: SentryReporterContext
) {
  if (context) {
    console.error(message, error, context);
    return;
  }

  console.error(message, error);
}
