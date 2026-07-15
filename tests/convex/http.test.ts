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

  it('registers GET /api/health and returns 500 when required capabilities are missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: undefined,
        OPENROUTER_API_KEY: undefined,
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
            aiLineGeneration: {
              status: 'missing_required',
              available: false,
              required: true,
            },
          },
        });
      }
    );
  });

  it('returns 200 when production env is complete', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        CANARY_API_KEY: 'test-canary-key',
        CANARY_ENDPOINT: 'https://canary.test',
        CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.test',
        GUEST_TOKEN_SECRET: 'test-secret',
        OPENROUTER_API_KEY: 'test-openrouter-key',
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
            aiLineGeneration: {
              status: 'ready',
              available: true,
              required: true,
            },
          },
        });
      }
    );
  });

  it('returns 500 when only one required capability is missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: 'test-secret',
        OPENROUTER_API_KEY: undefined,
      },
      async () => {
        const t = setupConvexTest();
        const response = await t.fetch('/api/health');

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          status: 500,
          environment: 'production',
          capabilities: {
            guestTokenVerification: {
              status: 'ready',
              available: true,
              required: true,
            },
            aiLineGeneration: {
              status: 'missing_required',
              available: false,
              required: true,
            },
          },
        });
      }
    );
  });
});
