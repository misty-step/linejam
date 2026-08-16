import { captureException } from '@sentry/nextjs';
import {
  captureReportedError,
  isSentryEnabled,
  type ErrorReportable,
  type ErrorReportContext,
  type ErrorReporter,
} from '@/lib/errorCore';
import { isExpectedConvexRateLimitError } from '@/lib/errorFeedback';
import { sanitizeSentryReporterContext } from '@/lib/sentryPrivacy';
const defaultReporter: ErrorReporter = {
  captureException,
  isEnabled: isSentryEnabled,
  sanitizeContext: sanitizeSentryReporterContext,
};

let customReporter: ErrorReporter | null = null;

export function setErrorReporterForTests(reporter: ErrorReporter | null) {
  customReporter = reporter;
}

/**
 * Capture an unexpected browser-safe failure through the shared reporting seam.
 * Context is reduced to closed tags and bounded numeric/correlation fields
 * before it reaches the SDK.
 */
export function captureError(
  error: ErrorReportable,
  context?: ErrorReportContext,
  reporter: ErrorReporter = customReporter ?? defaultReporter
) {
  if (isExpectedConvexRateLimitError(error)) return;

  captureReportedError(reporter, error, context);
}
