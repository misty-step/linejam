import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from './lib/sentry';

/**
 * Client-side Sentry configuration
 *
 * Runs in browser. Includes replay integration for error debugging.
 */

Sentry.init({
  ...sentryOptions,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
