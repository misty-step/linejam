import { test, expect } from '@playwright/test';
import { ensureClerkAuthState, requireClerkBrowserAuth } from './support/clerk';
import { isolateGuestSessionIp } from './support/guestFlow';

/**
 * E2E Test: Favorites Flow
 *
 * Tests the personal archive page structure and navigation.
 * Favorites toggle/persistence is covered by unit tests (tests/convex/favorites.test.ts).
 *
 * Note: These tests require Clerk authentication. When CLERK_SECRET_KEY is not
 * configured (guest-only mode), the /me/* routes redirect to home, so these
 * tests are skipped.
 */

// Run tests serially for consistent state
test.describe.configure({ mode: 'serial' });

test.describe('Personal Archive Page', () => {
  test.beforeEach(async ({ context, page }, testInfo) => {
    requireClerkBrowserAuth(testInfo, 'archive E2E');
    await isolateGuestSessionIp(context);
    await ensureClerkAuthState(page);
  });

  test('archive page loads and shows empty state', async ({ page }) => {
    // Navigate to archive page
    await page.goto('/me/poems');

    await expect(
      page.getByRole('heading', { name: 'Archive', exact: true })
    ).toBeVisible();

    // Use role to select the actual button, not paragraph text
    await expect(
      page.getByRole('link', { name: /Start a game/i })
    ).toBeVisible();
  });

  test('archive page has navigation back to home via wordmark', async ({
    page,
  }) => {
    await page.goto('/me/poems');

    // Find and click "Linejam" wordmark in header
    const wordmark = page.getByRole('link', { name: /Linejam/i });
    await expect(wordmark).toBeVisible();

    // Click and verify navigation
    await wordmark.click();
    await page.waitForURL('/', { timeout: 10000 });
  });

  test('archive page accessible from home', async ({ page }) => {
    // Start from home page
    await page.goto('/');

    await page.getByRole('button', { name: 'More options' }).click();
    // Find archive link
    const archiveLink = page.getByRole('link', {
      name: 'Your poems',
      exact: true,
    });
    await expect(archiveLink).toBeVisible();

    // Click and verify navigation
    await archiveLink.click();
    await page.waitForURL('/me/poems', { timeout: 10000 });

    // Verify we're on the archive page (exact match to avoid matching "Your archive awaits")
    await expect(
      page.getByRole('heading', { name: 'Archive', exact: true })
    ).toBeVisible();
  });
});
