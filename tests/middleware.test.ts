import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { NextFetchEvent } from 'next/server';

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: () => (req: NextRequest) =>
    NextResponse.next({ request: { headers: req.headers } }),
}));

// Middleware's event parameter is only forwarded to upstream handlers; the
// mocked Clerk handler and passthrough ignore it, so a bare stub suffices.
const fetchEvent = {} as NextFetchEvent;

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
  it('drops malformed Server Action identifiers before Next.js logs them', async () => {
    delete process.env.CLERK_SECRET_KEY;
    vi.resetModules();

    const { default: middleware } = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/room/ABCD', {
      method: 'POST',
      headers: { 'next-action': 'not-a-server-action-id' },
    });
    const res = (await middleware(req, fetchEvent))!;

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([40, 64])(
    'allows a well-formed %i-character Server Action identifier to reach Next.js',
    async (length) => {
      delete process.env.CLERK_SECRET_KEY;
      vi.resetModules();

      const { default: middleware } = await import('../middleware');
      const req = new NextRequest('http://localhost:3000/room/ABCD', {
        method: 'POST',
        headers: { 'next-action': 'a'.repeat(length) },
      });
      const res = (await middleware(req, fetchEvent))!;

      expect(res.status).toBe(200);
    }
  );

  it('does not redirect /me/poems away', async () => {
    delete process.env.CLERK_SECRET_KEY;
    vi.resetModules();

    const { default: middleware } = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/me/poems');
    const res = (await middleware(req, fetchEvent))!;

    expect(res.headers.get('location')).toBeNull();
  });

  it('does not redirect /me/profile away', async () => {
    delete process.env.CLERK_SECRET_KEY;
    vi.resetModules();

    const { default: middleware } = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/me/profile');
    const res = (await middleware(req, fetchEvent))!;

    expect(res.headers.get('location')).toBeNull();
  });
});

describe('middleware — document CSP containment', () => {
  it('uses strict nonces for dynamic documents and a scoped policy for static releases', async () => {
    delete process.env.CLERK_SECRET_KEY;
    vi.resetModules();

    const { default: middleware } = await import('../middleware');
    const dynamic = (await middleware(
      new NextRequest('http://localhost:3000/room/ABCD', {
        headers: { accept: 'text/html' },
      }),
      fetchEvent
    ))!;
    const releases = (await middleware(
      new NextRequest('http://localhost:3000/releases', {
        headers: { accept: 'text/html' },
      }),
      fetchEvent
    ))!;
    const xml = (await middleware(
      new NextRequest('http://localhost:3000/releases.xml', {
        headers: { accept: 'application/xml' },
      }),
      fetchEvent
    ))!;

    const dynamicCsp = dynamic.headers.get('Content-Security-Policy') ?? '';
    const releasesCsp = releases.headers.get('Content-Security-Policy') ?? '';
    const xmlCsp = xml.headers.get('Content-Security-Policy') ?? '';

    expect(dynamicCsp).toMatch(/script-src[^;]*'nonce-[^']+'/);
    const nonce = dynamicCsp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(dynamic.headers.get('x-middleware-override-headers')).toContain(
      'x-nonce'
    );
    expect(dynamic.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(dynamicCsp).not.toContain("script-src 'unsafe-inline'");
    expect(releasesCsp).toContain("script-src 'self' 'unsafe-inline'");
    expect(xmlCsp).toContain("script-src 'self' 'unsafe-inline'");
    expect(releasesCsp).not.toMatch(/script-src[^;]*'nonce-/);
    expect(xmlCsp).not.toMatch(/script-src[^;]*'nonce-/);
  });

  it('does not add document CSP to API responses', async () => {
    delete process.env.CLERK_SECRET_KEY;
    vi.resetModules();

    const { default: middleware } = await import('../middleware');
    const response = (await middleware(
      new NextRequest('http://localhost:3000/api/health'),
      fetchEvent
    ))!;

    expect(response.headers.get('Content-Security-Policy')).toBeNull();
  });
});

describe('middleware — Clerk configured', () => {
  it('takes the clerkMiddleware() success path, not the init-failure fallback', async () => {
    // Not a real credential — just needs to be a non-empty string so
    // the request-time resolver takes the Clerk branch. The mocked handler
    // keeps this test local while exercising the lazy initialization path.
    process.env.CLERK_SECRET_KEY = 'test-value-not-a-real-clerk-secret';
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { default: middleware } = await import('../middleware');
    const response = (await middleware(
      new NextRequest('http://localhost:3000/api/health'),
      fetchEvent
    ))!;

    expect(response.status).toBe(200);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
