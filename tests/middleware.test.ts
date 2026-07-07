import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Regression coverage for linejam-942: a guest hitting /me/* must never be
 * redirected away. The pages under /me/* already resolve identity
 * themselves (Clerk session or guest cookie via useUser()/getUser()), so
 * middleware must not gate them.
 *
 * Only the guest-only (Clerk-not-configured) branch is unit-testable here:
 * middleware.ts intentionally dynamic-`require()`s '@clerk/nextjs/server'
 * (see the file's own comment) so the module isn't imported at all when
 * Clerk is unconfigured — that guard makes the require() unmockable via
 * vi.mock in this pool. The Clerk-configured path (the one that hit
 * production) is covered live in tests/e2e/guest-archive-access.spec.ts.
 */

const ORIGINAL_CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

afterEach(() => {
  if (ORIGINAL_CLERK_SECRET_KEY === undefined) {
    delete process.env.CLERK_SECRET_KEY;
  } else {
    process.env.CLERK_SECRET_KEY = ORIGINAL_CLERK_SECRET_KEY;
  }
  vi.resetModules();
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
