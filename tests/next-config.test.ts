import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig, { buildContentSecurityPolicy } from '../next.config';
import { resolveDeploymentId } from '@/lib/deploymentId';

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

    // Document CSP is owned by middleware so each response gets exactly one
    // request-bound nonce-bearing policy instead of intersecting static and
    // dynamic policies.
    expect(headers.has('Content-Security-Policy')).toBe(false);
  });

  it('builds a nonce-bearing script policy without unsafe-inline', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const csp = buildContentSecurityPolicy('nonce-for-test');
    const scriptDirective =
      csp
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('script-src')) ?? '';

    expect(scriptDirective).toContain("'nonce-nonce-for-test'");
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(csp).not.toMatch(/\n/);
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

describe('nextConfig deployment skew protection', () => {
  it('uses the provider commit as the deployment identifier', () => {
    expect(resolveDeploymentId('  abc123_DEF-9  ')).toBe('abc123_DEF-9');
  });

  it('leaves local builds unversioned when the provider supplies no commit', () => {
    expect(resolveDeploymentId(undefined)).toBeUndefined();
    expect(resolveDeploymentId(false)).toBeUndefined();
    expect(resolveDeploymentId('   ')).toBeUndefined();
  });
});
