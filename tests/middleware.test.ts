import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Regression coverage for linejam-942: a guest hitting /me/* must never be
 * redirected away. The pages under /me/* already resolve identity
 * themselves (Clerk session or guest cookie via useUser()/getUser()), so
 * middleware must not gate them.
 *
 * The full Clerk-configured *request* path (the one that hit production)
 * can't be unit-tested here — invoking the returned middleware against a
 * request drives Clerk's real session validation, which needs live keys
 * and network. That path is covered live in
 * tests/e2e/guest-archive-access.spec.ts. What *is* unit-testable, and
 * covered below, is that constructing the middleware when Clerk
 * credentials are present takes the success path (no
 * "initialization failed" fallback) without ever calling `auth.protect()`
 * — since nothing in this file calls it for any route.
 */

const ORIGINAL_CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

afterEach(() => {
  if (ORIGINAL_CLERK_SECRET_KEY === undefined) {
    delete process.env.CLERK_SECRET_KEY;
  } else {
    process.env.CLERK_SECRET_KEY = ORIGINAL_CLERK_SECRET_KEY;
  }
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('middleware — guest-only mode (Clerk not configured)', () => {
  it('does not redirect /me/poems away', async () => {
    delete process.env.CLERK_SECRET_KEY;
    vi.resetModules();

    const { default: middleware } = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/me/poems');
    const res = await middleware(req);

    expect(res.headers.get('location')).toBeNull();
  });

  it('does not redirect /me/profile away', async () => {
    delete process.env.CLERK_SECRET_KEY;
    vi.resetModules();

    const { default: middleware } = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/me/profile');
    const res = await middleware(req);

    expect(res.headers.get('location')).toBeNull();
  });
});

describe('middleware — Clerk configured', () => {
  it('takes the clerkMiddleware() success path, not the init-failure fallback', async () => {
    // Not a real credential — just needs to be a non-empty string so
    // isClerkConfigured is true. clerkMiddleware() itself doesn't validate
    // key format or touch the network until a request is actually handled
    // (Clerk's key/publishable-key checks live inside the per-request
    // handler), so this covers the `if (isClerkConfigured)` branch without
    // needing to drive a full authenticated request through Clerk.
    process.env.CLERK_SECRET_KEY = 'test-value-not-a-real-clerk-secret';
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { default: middleware } = await import('../middleware');

    // Proves the `try` succeeded (middleware is a real function, not the
    // passthrough init-failure fallback) with no auth.protect() call site
    // anywhere in this file.
    expect(typeof middleware).toBe('function');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
