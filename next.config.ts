import type { NextConfig } from 'next';
import { validateEnv } from './lib/env';

// Validate required env vars during production builds
// This prevents deploying with missing configuration
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}

const STATIC_CLERK_SOURCES = [
  'https://*.clerk.accounts.dev',
  'https://*.clerk.com',
  'https://api.clerk.com',
  // Production Clerk serves clerk-js and its frontend API from the custom
  // domain; omitting it blocks auth entirely and dead-ends every room flow.
  'https://clerk.linejam.app',
];

const LOCAL_CONNECT_SOURCES = [
  'http://localhost:*',
  'https://localhost:*',
  'ws://localhost:*',
  'wss://localhost:*',
  'http://127.0.0.1:*',
  'ws://127.0.0.1:*',
];

function originFrom(value: string | undefined): string | null {
  if (!value?.trim() || value.startsWith('/')) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function websocketOriginFrom(value: string | undefined): string | null {
  const origin = originFrom(value);
  if (!origin) return null;
  return origin.replace(/^http/, 'ws');
}

function compactSources(values: Array<string | null | undefined>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

export function buildContentSecurityPolicy() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const convexOrigin = originFrom(process.env.NEXT_PUBLIC_CONVEX_URL);
  const convexWsOrigin = websocketOriginFrom(
    process.env.NEXT_PUBLIC_CONVEX_URL
  );
  const canaryOrigin =
    originFrom(process.env.NEXT_PUBLIC_CANARY_ENDPOINT) ||
    originFrom(process.env.CANARY_ENDPOINT) ||
    'https://canary.mistystep.io';
  const posthogOrigin = originFrom(process.env.NEXT_PUBLIC_POSTHOG_HOST);

  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['base-uri', ["'self'"]],
    ['object-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['form-action', ["'self'", ...STATIC_CLERK_SOURCES]],
    [
      'script-src',
      compactSources([
        "'self'",
        // Next.js, Clerk, PostHog, and the theme bootstrap all inject
        // inline scripts today. Nonces are the follow-up once app wiring exists.
        "'unsafe-inline'",
        isDevelopment ? "'unsafe-eval'" : null,
        ...STATIC_CLERK_SOURCES,
        'https://challenges.cloudflare.com',
        'https://us-assets.i.posthog.com',
      ]),
    ],
    [
      'style-src',
      compactSources([
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        ...STATIC_CLERK_SOURCES,
      ]),
    ],
    [
      'img-src',
      compactSources([
        "'self'",
        'data:',
        'blob:',
        'https://img.clerk.com',
        'https://images.clerk.dev',
        ...STATIC_CLERK_SOURCES,
      ]),
    ],
    [
      'font-src',
      compactSources(["'self'", 'data:', 'https://fonts.gstatic.com']),
    ],
    [
      'connect-src',
      compactSources([
        "'self'",
        convexOrigin,
        convexWsOrigin,
        'https://*.convex.cloud',
        'wss://*.convex.cloud',
        ...STATIC_CLERK_SOURCES,
        'https://challenges.cloudflare.com',
        'https://us.i.posthog.com',
        'https://us-assets.i.posthog.com',
        'https://us.posthog.com',
        posthogOrigin,
        canaryOrigin,
        ...(isDevelopment ? LOCAL_CONNECT_SOURCES : []),
      ]),
    ],
    [
      'frame-src',
      compactSources([
        "'self'",
        ...STATIC_CLERK_SOURCES,
        'https://challenges.cloudflare.com',
      ]),
    ],
    ['worker-src', ["'self'", 'blob:']],
    ['media-src', ["'self'", 'data:', 'blob:']],
    ['manifest-src', ["'self'"]],
  ];

  return directives
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

export function resolveDeploymentId(value: string | undefined) {
  return value?.trim() || undefined;
}

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: buildContentSecurityPolicy(),
  },
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
