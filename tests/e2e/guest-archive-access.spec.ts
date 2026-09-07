import { test, expect } from '@playwright/test';
import {
  CANONICAL_GUEST_FLOW_LINES,
  GuestFlowSession,
  isolateGuestSessionIp,
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
    browser,
  }) => {
    const context = await browser.newContext();
    await isolateGuestSessionIp(context);
    const page = await context.newPage();

    try {
      await page.goto('/me/poems');
      await page.waitForLoadState('networkidle');

      // Never bounced to Clerk's hosted Account Portal or an in-app sign-in wall.
      expect(page.url()).toContain('/me/poems');
      expect(page.url()).not.toContain('accounts.');
      expect(page.url()).not.toContain('/sign-in');

      await expect(
        page.getByRole('heading', { name: 'Archive', exact: true })
      ).toBeVisible({
        timeout: 15000,
      });

      await expect(
        page.getByRole('link', { name: /Start a game/i })
      ).toHaveAttribute('href', '/host');
      await expect(
        page.getByRole('link', { name: /Join a room/i })
      ).toHaveAttribute('href', '/join');
    } finally {
      await context.close();
    }
  });

  test('a guest who never played reaches /me/profile directly, no redirect', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await isolateGuestSessionIp(context);
    const page = await context.newPage();

    try {
      await page.goto('/me/profile');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/me/profile');
      expect(page.url()).not.toContain('accounts.');
      expect(page.url()).not.toContain('/sign-in');

      await expect(
        page.getByRole('heading', { name: 'Your profile', exact: true })
      ).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByRole('link', { name: 'Home', exact: true })
      ).toBeVisible();
    } finally {
      await context.close();
    }
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
    await session.revealAssignedPoem('guest', CANONICAL_GUEST_FLOW_LINES);
    await session.expectSessionComplete();

    // Same guest session/cookie, navigating to the archive entry point —
    // never redirected away from the poem just written.
    await session.hostPage.goto('/me/poems');
    await session.hostPage.waitForLoadState('networkidle');

    expect(session.hostPage.url()).toContain('/me/poems');
    await expect(
      session.hostPage.getByRole('heading', { name: 'Archive', exact: true })
    ).toBeVisible({ timeout: 15000 });

    const poemLink = session.hostPage.getByTestId('poem-card').first();
    await expect(poemLink).toBeVisible();
    await poemLink.click();
    await session.hostPage.waitForURL(/\/poem\/[^/]+$/);
    const poemLines = session.hostPage.getByRole('list', {
      name: 'Poem lines',
    });
    await expect(poemLines.getByRole('listitem')).toHaveCount(9);
    for (const line of CANONICAL_GUEST_FLOW_LINES) {
      await expect(poemLines.getByText(line, { exact: true })).toBeVisible();
    }
  });
});
