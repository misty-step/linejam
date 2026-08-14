import type { NextConfig } from 'next';
import { resolveDeploymentId } from './lib/deploymentId';
import { validateEnv } from './lib/env';

// Validate required env vars during production builds
// This prevents deploying with missing configuration
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}

export { buildContentSecurityPolicy } from './lib/contentSecurityPolicy';

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()',
      'clipboard-write=(self)',
      'fullscreen=(self)',
    ].join(', '),
  },
];

const nextConfig: NextConfig = {
  deploymentId: resolveDeploymentId(process.env.NEXT_DEPLOYMENT_ID),
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

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

export default nextConfig;
