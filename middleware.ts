import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

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
 */

const isProtectedRoute = createRouteMatcher(['/me(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
