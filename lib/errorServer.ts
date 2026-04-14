import 'server-only';

import {
  captureCanaryException,
  isCanaryEnabled,
  scrubCanaryContext,
} from '@/lib/canaryServer';
import { captureReportedError } from '@/lib/errorCore';

/**
 * Server-only error capture helper that can prefer private Canary credentials.
 */
export function captureServerError(
  error: unknown,
  context?: Record<string, unknown>
) {
  captureReportedError(
    { captureCanaryException, isCanaryEnabled, scrubCanaryContext },
    error,
    context
  );
}
