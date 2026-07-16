import { NextRequest, NextResponse } from 'next/server';
import type { NextFetchEvent, NextMiddleware } from 'next/server';
import { buildContentSecurityPolicy } from './lib/contentSecurityPolicy';

/**
 * Root Middleware
 *
 * Linejam uses hybrid identity: Clerk (authenticated) + guest tokens
 * (anonymous, HttpOnly cookie). Every route is public; there is no
 * Clerk-only route today.
 *
 * `/me/poems` and `/me/profile` look account-gated but are NOT — both
 * resolve identity themselves via `useUser()` client-side and
 * `getUser(ctx, guestToken)` in Convex, and work for guests and signed-in
 * users alike. Do NOT reintroduce an `auth.protect()` gate on `/me/*` (or
 * any future page built the same hybrid way) here: Clerk's `protect()`
 * falls back to the hosted Account Portal (accounts.<domain>) when no
 * in-app sign-in page is configured for it, which is exactly the "guest
 * gets dumped on a stock wall with no way back to their poems" bug this
 * middleware used to cause (linejam-942). A page that genuinely requires
 * a Clerk account belongs behind its own guard in the page component, not
 * a middleware-wide redirect.
 *
 * When Clerk is not configured (no CLERK_SECRET_KEY), the app runs in
 * guest-only mode and this middleware is a no-op passthrough.
 */

function passthroughMiddleware(req: NextRequest) {
  return NextResponse.next({ request: { headers: req.headers } });
}

// Resolve Clerk at request time so build-time and runtime environments cannot
// disagree about whether authentication middleware is available.
type UpstreamMiddleware = NextMiddleware;

let upstreamMiddleware: UpstreamMiddleware | undefined;
let upstreamConfigured: boolean | undefined;

async function resolveUpstreamMiddleware(): Promise<UpstreamMiddleware> {
  const isClerkConfigured = Boolean(process.env.CLERK_SECRET_KEY);
  if (upstreamMiddleware && upstreamConfigured === isClerkConfigured) {
    return upstreamMiddleware;
  }

  upstreamConfigured = isClerkConfigured;
  if (!isClerkConfigured) {
    upstreamMiddleware = passthroughMiddleware;
    return upstreamMiddleware;
  }

  try {
    // Only import Clerk when configured to avoid initialization errors.
    // A dynamic import (not require()) keeps this Edge-runtime compatible
    // and lets Vitest's module mocks intercept the call in tests.
    const { clerkMiddleware } = await import('@clerk/nextjs/server');

    // clerkMiddleware still wraps every request so Clerk can attach the
    // session state (cookies/JWT) that useAuth()/ConvexProviderWithClerk
    // read client-side. It intentionally takes no handler — nothing calls
    // auth.protect() because no route is Clerk-only.
    upstreamMiddleware = clerkMiddleware();
  } catch {
    // If Clerk initialization fails, fall back to guest-only mode.
    console.warn('Clerk initialization failed, running in guest-only mode');
    upstreamMiddleware = passthroughMiddleware;
  }
  if (upstreamMiddleware) return upstreamMiddleware;
  return passthroughMiddleware;
}
const SERVER_ACTION_ID = /^[a-f0-9]{40,64}$/;
const STATIC_ASSET =
  /\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)$/i;
const STATIC_CSP_ROUTES = new Set(['/releases', '/releases.xml']);

function isDocumentRequest(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/trpc' ||
    pathname.startsWith('/trpc/')
  ) {
    return false;
  }
  return !STATIC_ASSET.test(pathname);
}

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function forwardRequestHeaders(
  response: NextResponse | Response,
  requestHeaders: Headers
) {
  const forwarded = NextResponse.next({ request: { headers: requestHeaders } });
  const forwardedNames = forwarded.headers.get('x-middleware-override-headers');
  if (!forwardedNames) return response;

  const existingNames = response.headers.get('x-middleware-override-headers');
  const names = new Set(
    [...(existingNames?.split(',') ?? []), ...forwardedNames.split(',')].filter(
      Boolean
    )
  );
  response.headers.set('x-middleware-override-headers', [...names].join(','));
  for (const [key, value] of forwarded.headers) {
    if (key.startsWith('x-middleware-request-')) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent
) {
  const actionId = req.headers.get('next-action');
  if (actionId && !SERVER_ACTION_ID.test(actionId)) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!isDocumentRequest(req)) {
    return (await resolveUpstreamMiddleware())(req, event);
  }

  // These public, unauthenticated, non-user-generated force-static routes
  // retain inline scripts for their cached RSC/theme HTML. This is a scoped
  // exception: every other document gets a fresh nonce policy.
  const isScopedStaticRoute = STATIC_CSP_ROUTES.has(req.nextUrl.pathname);
  const nonce = isScopedStaticRoute ? undefined : createNonce();
  const csp = buildContentSecurityPolicy(nonce, {
    allowUnsafeInlineScript: isScopedStaticRoute,
  });
  const requestHeaders = new Headers(req.headers);
  if (nonce) requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const requestWithNonce = new NextRequest(req, { headers: requestHeaders });
  const upstreamResponse = await (
    await resolveUpstreamMiddleware()
  )(requestWithNonce, event);
  const response =
    upstreamResponse ??
    NextResponse.next({ request: { headers: requestHeaders } });
  forwardRequestHeaders(response, requestHeaders);
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and analytics proxy routes
    '/((?!_next|ingest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
