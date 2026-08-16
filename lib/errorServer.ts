import 'server-only';

import { captureException } from '@sentry/nextjs';
import {
  captureReportedError,
  isSentryEnabled,
  type ErrorReportable,
  type ErrorReportContext,
  type ErrorReporter,
} from '@/lib/errorCore';
import { sanitizeSentryReporterContext } from '@/lib/sentryPrivacy';

const defaultServerReporter: ErrorReporter = {
  captureException,
  isEnabled: isSentryEnabled,
  sanitizeContext: sanitizeSentryReporterContext,
};

let customServerReporter: ErrorReporter | null = null;

export function setServerReporterForTests(reporter: ErrorReporter | null) {
  customServerReporter = reporter;
}

/** Server-only capture for handled failures that Next.js cannot auto-report. */
export function captureServerError(
  error: ErrorReportable,
  context?: ErrorReportContext,
  reporter: ErrorReporter = customServerReporter ?? defaultServerReporter
) {
  captureReportedError(reporter, error, context);
}
