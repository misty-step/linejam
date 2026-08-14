import 'server-only';

import { captureException } from '@sentry/nextjs';
import { captureReportedError, isSentryEnabled } from '@/lib/errorCore';
import { sanitizeSentryReporterContext } from '@/lib/sentryPrivacy';

/** Server-only capture for handled failures that Next.js cannot auto-report. */
export function captureServerError(
  error: unknown,
  context?: Record<string, unknown>
) {
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
