type ErrorReporter = {
  captureCanaryException: (
    error: unknown,
    context?: Record<string, unknown>
  ) => Promise<void>;
  isCanaryEnabled: () => boolean;
  scrubCanaryContext: (
    context?: Record<string, unknown>
  ) => Record<string, unknown> | undefined;
};

export function captureReportedError(
  reporter: ErrorReporter,
  error: unknown,
  context?: Record<string, unknown>
) {
  const scrubbedContext = reporter.scrubCanaryContext(context);

  if (!reporter.isCanaryEnabled()) {
    logCapturedError(
      'Error captured (Canary disabled):',
      error,
      scrubbedContext
    );
    return;
  }

  void reporter.captureCanaryException(error, context);

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
