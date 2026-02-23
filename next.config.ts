import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import { validateEnv } from './lib/env';

// Validate required env vars during production builds
// This prevents deploying with missing configuration
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}

const nextConfig: NextConfig = {
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],

  // PostHog reverse proxy (bypass ad blockers)
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
};

// Only wrap with Sentry in production builds for faster dev startup
// Sentry instrumentation also skipped in development (see instrumentation.ts)
export default process.env.NODE_ENV === 'production'
  ? withSentryConfig(nextConfig, {
      // Sentry build options
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // Only upload source maps in CI/production builds
      silent: !process.env.CI,

      // Upload source maps for better error tracking
      widenClientFileUpload: true,

      // Automatically tree-shake Sentry SDK for smaller bundles
      disableLogger: true,

      // Configure source map handling
      sourcemaps: {
        // Hide source maps from browsers in production
        deleteSourcemapsAfterUpload: true,
      },

      // Automatically inject Sentry into client bundles
      automaticVercelMonitors: true,
    })
  : nextConfig;
