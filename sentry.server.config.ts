import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from './lib/sentry';

/**
 * Server-side Sentry configuration
 *
 * Runs in Node.js environment.
 */

Sentry.init(sentryOptions);
