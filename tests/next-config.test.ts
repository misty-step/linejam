import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig, { buildContentSecurityPolicy } from '../next.config';

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
    const retiredProvider = ['ver', 'cel'].join('');
    expect(csp).not.toContain(`${retiredProvider}-insights`);
    expect(csp).not.toContain(`${retiredProvider}-scripts`);
    expect(csp).not.toMatch(/\n/);
    expect(csp).not.toContain(' *');
  });

  it('uses the stable Canary hostname when no endpoint is configured', () => {
    vi.stubEnv('CANARY_ENDPOINT', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', '');

    const csp = buildContentSecurityPolicy();

    expect(csp).toContain('https://canary.mistystep.io');
    expect(csp).not.toContain('.fly.dev');
  });

  it('allows the production Clerk custom domain in every Clerk-bearing directive', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const csp = buildContentSecurityPolicy();
    const directive = (name: string) =>
      csp
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(name)) ?? '';

    // Production Clerk serves clerk-js and its frontend API from the custom
    // domain, not *.clerk.accounts.dev — blocking it dead-ends every auth
    // flow (2026-07-04 outage: /host hung on "Setting up your room...").
    expect(directive('script-src')).toContain('https://clerk.linejam.app');
    expect(directive('connect-src')).toContain('https://clerk.linejam.app');
    expect(directive('form-action')).toContain('https://clerk.linejam.app');
  });

  it('does not include development-only script or localhost allowances in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CANARY_ENDPOINT', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', '');

    const csp = buildContentSecurityPolicy();
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('localhost');
    expect(csp).not.toContain('127.0.0.1');
  });
});
