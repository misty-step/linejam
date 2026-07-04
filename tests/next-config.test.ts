import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig, { buildContentSecurityPolicy } from '../next.config';

// Mirrors scripts/lib/clerk-domain.mjs's encoding so tests exercise real
// derivation rather than a hardcoded string. Clerk's own key format:
// pk_(test|live)_<base64url(frontendApiHost + "$")>.
function publishableKeyFor(frontendApiHost: string, live = true): string {
  const encoded = Buffer.from(`${frontendApiHost}$`).toString('base64url');
  return `pk_${live ? 'live' : 'test'}_${encoded}`;
}

describe('nextConfig security headers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets the public-launch security header contract globally', async () => {
    const entries = await nextConfig.headers?.();
    const globalHeaders = entries?.find((entry) => entry.source === '/(.*)');

    expect(globalHeaders).toBeDefined();
    const headers = new Map(
      globalHeaders!.headers.map((header) => [header.key, header.value])
    );

    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload'
    );
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.get('Permissions-Policy')).toContain('microphone=()');

    const csp = headers.get('Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain('https://img.clerk.com');
    expect(csp).toContain('https://vitals.vercel-insights.com');
    expect(csp).not.toMatch(/\n/);
    expect(csp).not.toContain(' *');
  });

  it('allows the production Clerk custom domain in every Clerk-bearing directive', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      publishableKeyFor('clerk.linejam.app')
    );

    const csp = buildContentSecurityPolicy();
    const directive = (name: string) =>
      csp
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(name)) ?? '';

    // Production Clerk serves clerk-js and its frontend API from the custom
    // domain, not *.clerk.accounts.dev — blocking it dead-ends every auth
    // flow (2026-07-04 outage: /host hung on "Setting up your room...").
    // Regression tripwire for the exact domain that outage was scoped to.
    expect(directive('script-src')).toContain('https://clerk.linejam.app');
    expect(directive('connect-src')).toContain('https://clerk.linejam.app');
    expect(directive('form-action')).toContain('https://clerk.linejam.app');
  });

  it('derives the CSP Clerk origin from the publishable key, not a hardcoded list', () => {
    // A DIFFERENT custom domain than the tripwire above — proves genuine
    // base64url derivation, not a coincidental match against a known string.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      publishableKeyFor('auth.example-tenant.com')
    );

    const csp = buildContentSecurityPolicy();
    expect(csp).toContain('https://auth.example-tenant.com');
  });

  it('derives the preview Clerk origin from a dev publishable key', () => {
    // Preview deploys build in production mode (NODE_ENV=production is a
    // Next.js build-time invariant) but run against a dev/test Clerk
    // instance under *.clerk.accounts.dev — the wildcard already covers
    // this, but derivation must still resolve the exact host correctly so
    // preview and production never rely on different code paths.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      publishableKeyFor('great-moose-1.clerk.accounts.dev', false)
    );

    const csp = buildContentSecurityPolicy();
    expect(csp).toContain('https://great-moose-1.clerk.accounts.dev');
  });

  it('omits a derived Clerk origin when no publishable key is configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', '');

    // Should not throw, and should fall back to the generic Clerk hosts only.
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain('https://*.clerk.accounts.dev');
    expect(csp).not.toContain('undefined');
  });

  it('does not include development-only script or localhost allowances in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const csp = buildContentSecurityPolicy();
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('localhost');
    expect(csp).not.toContain('127.0.0.1');
  });
});
