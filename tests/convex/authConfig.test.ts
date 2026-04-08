/** @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { withEnv } from '../helpers/envHelper';

const ORIGINAL_ENV = { ...process.env };

describe('convex/auth.config', () => {
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  it('registers Clerk as a Convex auth provider when CLERK_JWT_ISSUER_DOMAIN is set', async () => {
    await withEnv(
      {
        CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.linejam.app',
        CLERK_FRONTEND_API_URL: undefined,
      },
      async () => {
        const config = (await import('../../convex/auth.config')).default;

        expect(config).toEqual({
          providers: [
            {
              domain: 'https://clerk.linejam.app',
              applicationID: 'convex',
            },
          ],
        });
      }
    );
  });

  it('falls back to CLERK_FRONTEND_API_URL for Clerk integration compatibility', async () => {
    await withEnv(
      {
        CLERK_JWT_ISSUER_DOMAIN: undefined,
        CLERK_FRONTEND_API_URL: 'https://solid-beetle-24.clerk.accounts.dev',
      },
      async () => {
        const config = (await import('../../convex/auth.config')).default;

        expect(config).toEqual({
          providers: [
            {
              domain: 'https://solid-beetle-24.clerk.accounts.dev',
              applicationID: 'convex',
            },
          ],
        });
      }
    );
  });

  it('derives the Clerk issuer from NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', async () => {
    await withEnv(
      {
        CLERK_JWT_ISSUER_DOMAIN: undefined,
        CLERK_FRONTEND_API_URL: undefined,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'dummy_key_Y2xlcmsubGluZWphbS5hcHAk',
      },
      async () => {
        const config = (await import('../../convex/auth.config')).default;

        expect(config).toEqual({
          providers: [
            {
              domain: 'https://clerk.linejam.app',
              applicationID: 'convex',
            },
          ],
        });
      }
    );
  });

  it('stays guest-only when Clerk backend auth is not configured', async () => {
    await withEnv(
      {
        CLERK_JWT_ISSUER_DOMAIN: undefined,
        CLERK_FRONTEND_API_URL: undefined,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined,
      },
      async () => {
        const config = (await import('../../convex/auth.config')).default;

        expect(config).toEqual({ providers: [] });
      }
    );
  });
});
