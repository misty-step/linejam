import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from './lib/sentry';

/**
 * Edge runtime Sentry configuration
 *
 * Runs in Vercel Edge Runtime / middleware.
 */

Sentry.init(sentryOptions);
