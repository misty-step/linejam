/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import {
  checkAppHealth,
  checkCanaryConfig,
  checkCanaryReachable,
  checkClerkConfig,
  checkConvexConfig,
  checkRequiredEnv,
  runDoctor,
} from '@/scripts/doctor.mjs';

function clerkKeyFor(host: string): string {
  return `pk_test_${Buffer.from(`${host}$`).toString('base64url')}`;
}

const GOOD_ENV = {
  GUEST_TOKEN_SECRET: 'x'.repeat(32),
  NEXT_PUBLIC_CONVEX_URL: 'https://exuberant-bloodhound-885.convex.cloud',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKeyFor(
    'great-moose-1.clerk.accounts.dev'
  ),
  CLERK_SECRET_KEY: 'sk_test_something',
  NEXT_PUBLIC_CANARY_API_KEY: 'real-key',
  NEXT_PUBLIC_CANARY_ENDPOINT: 'https://canary-obs.fly.dev',
};

describe('checkRequiredEnv', () => {
  it('passes when GUEST_TOKEN_SECRET is set', () => {
    expect(checkRequiredEnv(GOOD_ENV).status).toBe('pass');
  });

  it('fails loudly when GUEST_TOKEN_SECRET is missing', () => {
    const result = checkRequiredEnv({});
    expect(result.status).toBe('fail');
    expect(result.message).toContain('GUEST_TOKEN_SECRET');
  });
});

describe('checkConvexConfig', () => {
  it('passes for a real-looking Convex URL', () => {
    expect(checkConvexConfig(GOOD_ENV).status).toBe('pass');
  });

  it('fails when unset', () => {
    expect(checkConvexConfig({}).status).toBe('fail');
  });

  it('fails when the URL is not a Convex deployment', () => {
    expect(
      checkConvexConfig({ NEXT_PUBLIC_CONVEX_URL: 'http://localhost:8187' })
        .status
    ).toBe('fail');
  });

  it('fails on a malformed URL rather than throwing', () => {
    expect(
      checkConvexConfig({ NEXT_PUBLIC_CONVEX_URL: 'not a url' }).status
    ).toBe('fail');
  });
});

describe('checkClerkConfig', () => {
  it('passes and reports the decoded origin for a well-formed key', () => {
    const result = checkClerkConfig(GOOD_ENV);
    expect(result.status).toBe('pass');
    expect(result.message).toBe('https://great-moose-1.clerk.accounts.dev');
  });

  it('fails when either Clerk var is missing', () => {
    expect(
      checkClerkConfig({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_x' })
        .status
    ).toBe('fail');
  });

  it('fails when the key does not decode to a host', () => {
    expect(
      checkClerkConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'not-a-real-key',
        CLERK_SECRET_KEY: 'sk_test_x',
      }).status
    ).toBe('fail');
  });
});

describe('checkCanaryConfig', () => {
  it('passes with a real key and endpoint', () => {
    expect(checkCanaryConfig(GOOD_ENV).status).toBe('pass');
  });

  it('fails on the .env.example placeholder key', () => {
    expect(
      checkCanaryConfig({
        NEXT_PUBLIC_CANARY_API_KEY: 'example_canary_write_key',
        NEXT_PUBLIC_CANARY_ENDPOINT: 'https://canary-obs.fly.dev',
      }).status
    ).toBe('fail');
  });

  it('fails when missing', () => {
    expect(checkCanaryConfig({}).status).toBe('fail');
  });
});

describe('checkCanaryReachable', () => {
  it('skips when no endpoint is configured', async () => {
    const result = await checkCanaryReachable({});
    expect(result.status).toBe('skip');
  });

  it('passes on a 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await checkCanaryReachable({
      url: 'https://canary-obs.fly.dev',
      fetchImpl,
    });
    expect(result.status).toBe('pass');
  });

  it('warns (not fails) on network error -- Canary being down should not block local dev', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed'));
    const result = await checkCanaryReachable({
      url: 'https://canary-obs.fly.dev',
      fetchImpl,
    });
    expect(result.status).toBe('warn');
  });
});

describe('checkAppHealth', () => {
  it("defaults to the actual `pnpm dev` port, not Playwright's E2E port", async () => {
    // Regression: an earlier version of this default pointed at :3333
    // (Playwright's dedicated E2E port, reserved specifically to avoid
    // colliding with a running dev server per playwright.config.ts) instead
    // of :3000 (`pnpm dev`, per README). Following doctor's own instruction
    // ("start it with `pnpm dev` and re-run `pnpm doctor`") always produced
    // a false "no app running" warning against a real, healthy dev server.
    // Found live via a fresh-context critic curling both ports.
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await checkAppHealth({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/api/health',
      expect.anything()
    );
  });

  it('passes when the app reports ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    const result = await checkAppHealth({ fetchImpl });
    expect(result.status).toBe('pass');
  });

  it('fails loudly when the app is running but unhealthy', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'error' }),
    });
    const result = await checkAppHealth({ fetchImpl });
    expect(result.status).toBe('fail');
  });

  it('warns rather than fails when no app is running yet', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));
    const result = await checkAppHealth({ fetchImpl });
    expect(result.status).toBe('warn');
    expect(result.message).toContain('pnpm dev');
  });
});

describe('runDoctor', () => {
  it('runs every check and includes Canary reachability when Canary is configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });

    const results = await runDoctor({ env: GOOD_ENV, fetchImpl });
    const names = results.map((r) => r.name);

    expect(names).toContain('required env');
    expect(names).toContain('Convex');
    expect(names).toContain('Clerk');
    expect(names).toContain('Canary');
    expect(names).toContain('Canary reachability');
    expect(names).toContain('app health');
    expect(results.every((r) => r.status === 'pass')).toBe(true);
  });

  it('skips Canary reachability when Canary config itself already failed', async () => {
    const results = await runDoctor({ env: {}, fetchImpl: vi.fn() });
    expect(results.map((r) => r.name)).not.toContain('Canary reachability');
  });
});
