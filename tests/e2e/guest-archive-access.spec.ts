import { test, expect } from '@playwright/test';
import {
  CANONICAL_GUEST_FLOW_LINES,
  GuestFlowSession,
} from '@/tests/e2e/support/guestFlow';

/**
 * Regression coverage for linejam-942.
 *
 * Live prod bug (2026-07-06): tapping the header archive icon as a guest
 * redirected (middleware.ts protecting /me/*) to accounts.linejam.app —
 * Clerk's hosted Account Portal, stock violet, "Secured by Clerk" — with no
 * way back to the poems the guest just wrote. /me/poems and /me/profile
 * already resolved guest identity themselves via the guest cookie; the
 * middleware gate was the only thing standing between a guest and their own
 * archive.
 */

test.describe.configure({ mode: 'serial' });

const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

test.describe('guest archive access (no account)', () => {
  test('a guest who never played reaches /me/poems directly, no redirect', async ({
    page,
  }) => {
    await page.goto('/me/poems');
    await page.waitForLoadState('networkidle');

    // Never bounced to Clerk's hosted Account Portal or an in-app sign-in wall.
    expect(page.url()).toContain('/me/poems');
    expect(page.url()).not.toContain('accounts.');
    expect(page.url()).not.toContain('/sign-in');

    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible({
      timeout: 15000,
    });

    // Never a dead end: the guest identity explainer is always present.
    await expect(page.getByText(/saved to this browser only/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up/i })).toHaveAttribute(
      'href',
      '/sign-up'
    );
  });

  test('a guest who never played reaches /me/profile directly, no redirect', async ({
    page,
  }) => {
    await page.goto('/me/profile');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/me/profile');
    expect(page.url()).not.toContain('accounts.');
    expect(page.url()).not.toContain('/sign-in');

    await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText(/authenticate to preserve your works/i)
    ).toBeVisible();
  });
});

test.describe('guest archive access after a played game @slow', () => {
  let session: GuestFlowSession | null = null;

  test.afterEach(async () => {
    await session?.close();
    session = null;
  });

  test('a guest who just played reaches their poem from the archive entry point', async ({
    browser,
  }) => {
    session = await GuestFlowSession.create(browser);
    await session.createRoom();
    await session.joinRoom();
    await session.startGame();
    await session.playCanonicalGame(CANONICAL_GUEST_FLOW_LINES);
    await session.revealAssignedPoem('host', CANONICAL_GUEST_FLOW_LINES);
    await session.expectSessionComplete();

    // Same guest session/cookie, navigating to the archive entry point —
    // never redirected away from the poem just written.
    await session.hostPage.goto('/me/poems');
    await session.hostPage.waitForLoadState('networkidle');

    expect(session.hostPage.url()).toContain('/me/poems');
    await expect(
      session.hostPage.getByRole('heading', { name: 'Archive' })
    ).toBeVisible({ timeout: 15000 });

    // The poem this guest just wrote is reachable without an account.
    await expect(
      session.hostPage.getByText(/saved to this browser only/i)
    ).toBeVisible();
    const emptyState = session.hostPage.getByText(/your archive awaits/i);
    await expect(emptyState).toHaveCount(0);
  });
});
