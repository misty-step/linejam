/** @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { withEnv } from '../helpers/envHelper';
import { setupConvexTest } from '../helpers/convexTest';

const ORIGINAL_ENV = { ...process.env };

/**
 * Health route tests on the real convex-test engine (backlog 018).
 *
 * convex/lib/env.ts captures process.env into a module-level frozen constant at
 * import time. To exercise different env configurations across test cases we
 * must reset the module cache before each test so a fresh import of
 * convex/http.ts (and its transitive dependency convex/lib/env.ts) re-reads
 * process.env. vi.resetModules() + withEnv() achieves this.
 *
 * vi.mock of convex/server and convex/_generated/server has been removed.
 * t.fetch() drives the real httpRouter → httpAction dispatch pipeline and
 * asserts the observable Response (status + JSON body) instead of stub call
 * counts.
 */

describe('convex/http health route', () => {
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(() => {
    // Reset the module registry so each test re-imports convex/http.ts and
    // convex/lib/env.ts fresh, picking up the process.env set by withEnv().
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  it('registers GET /api/health and returns 500 when guest verification is missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: undefined,
      },
      async () => {
        const t = setupConvexTest();
        const response = await t.fetch('/api/health');

        expect(response.status).toBe(500);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          status: 500,
          environment: 'production',
          capabilities: {
            guestTokenVerification: {
              status: 'missing_required',
              available: false,
              required: true,
            },
          },
        });
      }
    );
  });

  it('returns 200 when retained production configuration is complete', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.test',
        GUEST_TOKEN_SECRET: 'test-secret',
        LINEJAM_SENTRY_ENABLED: 'true',
        SENTRY_DSN: ['https://public', 'sentry.example.test/1'].join('@'),
        SENTRY_ENVIRONMENT: 'production',
        SENTRY_RELEASE: 'a'.repeat(40),
        SENTRY_AUTOMATION_PROVENANCE_SECRET:
          'test-provenance-secret-with-at-least-32-bytes',
      },
      async () => {
        const t = setupConvexTest();
        const response = await t.fetch('/api/health');

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expect(response.json()).resolves.toMatchObject({
          ok: true,
          status: 200,
          environment: 'production',
          capabilities: {
            guestTokenVerification: {
              status: 'ready',
              available: true,
              required: true,
            },
          },
        });
      }
    );
  });
});
