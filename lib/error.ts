import { captureException } from '@sentry/nextjs';
import { captureReportedError, isSentryEnabled } from '@/lib/errorCore';
import { isExpectedConvexRateLimitError } from '@/lib/errorFeedback';
import { sanitizeSentryReporterContext } from '@/lib/sentryPrivacy';

/**
 * Capture an unexpected browser-safe failure through the shared reporting seam.
 * Context is reduced to closed tags and bounded numeric/correlation fields
 * before it reaches the SDK.
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>
) {
  if (isExpectedConvexRateLimitError(error)) return;

  captureReportedError(
    {
      captureException,
      isEnabled: isSentryEnabled,
      sanitizeContext: sanitizeSentryReporterContext,
    },
    error,
    context
  );
}
