import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route Protection Middleware
 *
 * Linejam uses hybrid auth: Clerk (authenticated) + guest tokens (anonymous).
 * Most routes are public since guests can play without accounts.
 *
 * Protected routes (require Clerk auth):
 * - /me/* - User profile and poem archive
 *
 * Public routes (no auth required):
 * - / - Homepage
 * - /room/* - Game rooms (guests use localStorage token)
 * - /sign-in, /sign-up - Auth pages
 * - /api/* - API routes handle their own auth
 *
 * When Clerk is not configured (no CLERK_SECRET_KEY), the app runs in
 * guest-only mode. Protected routes redirect to home, auth pages show
 * a message that auth is unavailable.
 */

// Check if Clerk is configured (secret key available)
const isClerkConfigured = !!process.env.CLERK_SECRET_KEY;

// Route matchers (simple path checking to avoid Clerk import)
function isProtectedRoute(pathname: string): boolean {
  return pathname.startsWith('/me');
}

// Fallback middleware for when Clerk is not configured
function guestOnlyMiddleware(req: NextRequest) {
  // Redirect protected routes to home in guest-only mode
  if (isProtectedRoute(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  // Auth routes will show "auth unavailable" via their page logic
  return NextResponse.next();
}

// Conditionally create middleware based on Clerk configuration
// We use a dynamic approach to avoid importing Clerk when not configured
let middleware: (
  req: NextRequest
) => Promise<NextResponse | Response> | NextResponse;

if (isClerkConfigured) {
  try {
    // Only import Clerk when configured to avoid initialization errors

    const {
      clerkMiddleware,
      createRouteMatcher,
    } = require('@clerk/nextjs/server'); // eslint-disable-line @typescript-eslint/no-require-imports
    const isProtectedClerkRoute = createRouteMatcher(['/me(.*)']);

    middleware = clerkMiddleware(
      async (auth: { protect: () => Promise<void> }, req: NextRequest) => {
        if (isProtectedClerkRoute(req)) {
          await auth.protect();
        }
      }
    );
  } catch {
    // If Clerk initialization fails, fall back to guest-only mode
    console.warn('Clerk initialization failed, running in guest-only mode');
    middleware = guestOnlyMiddleware;
  }
} else {
  middleware = guestOnlyMiddleware;
}

export default middleware;

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and analytics proxy routes
    '/((?!_next|ingest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
