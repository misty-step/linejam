import type { SentryReporterContext } from '@/lib/sentryPrivacy';

export type ErrorReportContext = Record<
  string,
  string | number | boolean | null | undefined
>;

export type ErrorReportable =
  | Error
  | { name?: string; message?: string; stack?: string; data?: string }
  | string
  | null
  | undefined;

export function toErrorReportable(cause: unknown): ErrorReportable {
  if (cause instanceof Error) {
    return cause;
  }
  if (cause === null || cause === undefined) {
    return cause;
  }
  if (cause instanceof Object) {
    const message =
      'message' in cause && cause.message != null
        ? String(cause.message)
        : undefined;
    const name =
      'name' in cause && cause.name != null ? String(cause.name) : undefined;
    const stack =
      'stack' in cause && cause.stack != null ? String(cause.stack) : undefined;
    const data =
      'data' in cause && cause.data != null ? String(cause.data) : undefined;
    if (
      message !== undefined ||
      name !== undefined ||
      stack !== undefined ||
      data !== undefined
    ) {
      return { name, message, stack, data };
    }
  }
  return String(cause);
}

export type ErrorReporter = {
  captureException: (
    error: ErrorReportable,
    context?: SentryReporterContext
  ) => void | string;
  isEnabled: () => boolean;
  sanitizeContext: (
    context?: ErrorReportContext
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
  error: ErrorReportable,
  context?: ErrorReportContext
): void {
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
  error: ErrorReportable,
  context?: SentryReporterContext
): void {
  if (context) {
    console.error(message, error, context);
    return;
  }

  console.error(message, error);
}
