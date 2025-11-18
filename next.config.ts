import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
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
});
