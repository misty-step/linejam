import { createClerkClient } from '@clerk/backend';
import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const DEFAULT_CLERK_TEST_EMAIL = 'linejam-e2e+clerk_test@example.com';
const CLERK_TEST_EMAIL =
  process.env.PLAYWRIGHT_CLERK_TEST_EMAIL?.trim() || DEFAULT_CLERK_TEST_EMAIL;

export function setClerkTestingEnv() {
  process.env.CLERK_PUBLISHABLE_KEY ??=
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

setClerkTestingEnv();

export const hasClerkBrowserAuth =
  Boolean(process.env.CLERK_SECRET_KEY) &&
  Boolean(process.env.CLERK_PUBLISHABLE_KEY);
const REQUIRE_AUTH_E2E =
  process.env.PLAYWRIGHT_REQUIRE_AUTH_E2E?.trim() === '1';
let ensureUserPromise: Promise<void> | null = null;

export function requireClerkBrowserAuth(
  testInfo: TestInfo,
  scope = 'authenticated E2E'
) {
  if (REQUIRE_AUTH_E2E && !hasClerkBrowserAuth) {
    throw new Error(
      `${scope} requires CLERK_SECRET_KEY and a Clerk publishable key`
    );
  }

  if (!hasClerkBrowserAuth) {
    test.skip(
      true,
      `Set CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY to run ${scope}`
    );
  }
}

export async function ensureClerkAuthState(page: Page) {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is required');
  }

  await ensureClerkTestUser(clerkSecretKey, CLERK_TEST_EMAIL);
  await page.goto('/');
  await clerk.signIn({
    page,
    emailAddress: CLERK_TEST_EMAIL,
  });
  await assertClerkConvexToken(page);
  await assertClerkProtectedRoute(page);
}

export async function assertClerkProtectedRoute(page: Page) {
  await page.goto('/me/profile', { waitUntil: 'networkidle' });
  await page.waitForURL(/\/me\/profile$/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible({
    timeout: 30000,
  });
}

async function assertClerkConvexToken(page: Page) {
  const token = await page.evaluate(async () => {
    if (!window.Clerk?.session) {
      return null;
    }

    return window.Clerk.session.getToken({ template: 'convex' });
  });

  if (!token) {
    throw new Error(
      'Clerk could not mint the "convex" JWT template. Ensure the Clerk Convex integration is active or bootstrap the template with scripts/ci/ensure-clerk-convex-template.mjs.'
    );
  }
}

async function ensureClerkTestUser(secretKey: string, emailAddress: string) {
  if (!ensureUserPromise) {
    ensureUserPromise = (async () => {
      const client = createClerkClient({ secretKey });
      const existing = await client.users.getUserList({
        emailAddress: [emailAddress],
      });
      if (existing.data[0]) return;

      try {
        await client.users.createUser({
          emailAddress: [emailAddress],
          firstName: 'Linejam',
          lastName: 'E2E',
          skipLegalChecks: true,
          skipPasswordChecks: true,
          skipPasswordRequirement: true,
        });
      } catch (error) {
        const retry = await client.users.getUserList({
          emailAddress: [emailAddress],
        });
        if (!retry.data[0]) {
          throw error;
        }
      }
    })();
  }

  await ensureUserPromise;
}
