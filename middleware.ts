import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

// Check if Clerk is configured (secret key available)
const isClerkConfigured = !!process.env.CLERK_SECRET_KEY;

function passthroughMiddleware() {
  return NextResponse.next();
}

// Conditionally create middleware based on Clerk configuration
// We use a dynamic approach to avoid importing Clerk when not configured
let upstreamMiddleware: (
  req: NextRequest
) => Promise<NextResponse | Response> | NextResponse;

if (isClerkConfigured) {
  try {
    // Only import Clerk when configured to avoid initialization errors
    const { clerkMiddleware } = require('@clerk/nextjs/server'); // eslint-disable-line @typescript-eslint/no-require-imports

    // clerkMiddleware still wraps every request so Clerk can attach the
    // session state (cookies/JWT) that useAuth()/ConvexProviderWithClerk
    // read client-side. It intentionally takes no handler — nothing calls
    // auth.protect() because no route is Clerk-only.
    upstreamMiddleware = clerkMiddleware();
  } catch {
    // If Clerk initialization fails, fall back to guest-only mode
    console.warn('Clerk initialization failed, running in guest-only mode');
    upstreamMiddleware = passthroughMiddleware;
  }
} else {
  upstreamMiddleware = passthroughMiddleware;
}

const SERVER_ACTION_ID = /^[a-f0-9]{40,64}$/;

export default function middleware(req: NextRequest) {
  const actionId = req.headers.get('next-action');
  if (actionId && !SERVER_ACTION_ID.test(actionId)) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return upstreamMiddleware(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and analytics proxy routes
    '/((?!_next|ingest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
