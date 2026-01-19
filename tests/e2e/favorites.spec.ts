import { test, expect } from '@playwright/test';

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

// Skip all archive tests if Clerk is not configured
const isClerkConfigured = !!process.env.CLERK_SECRET_KEY;

test.describe('Personal Archive Page', () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!isClerkConfigured) {
      testInfo.skip(true, 'Clerk auth not configured (guest-only mode)');
    }
  });

  test('archive page loads and shows empty state', async ({ page }) => {
    // Navigate to archive page
    await page.goto('/me/poems', { waitUntil: 'networkidle' });

    // Wait for guest session to initialize
    await page.waitForFunction(
      async () => {
        const res = await fetch('/api/guest/session');
        const data = await res.json();
        return data.guestId !== undefined;
      },
      { timeout: 10000 }
    );

    // Verify page title (exact match to avoid matching "Your archive awaits")
    await expect(
      page.getByRole('heading', { name: 'Archive', exact: true })
    ).toBeVisible();

    // Verify empty state for new user
    await expect(
      page.getByRole('heading', { name: /Your archive awaits/i })
    ).toBeVisible();
    // Use role to select the actual button, not paragraph text
    await expect(
      page.getByRole('link', { name: 'Start a Game' })
    ).toBeVisible();
  });

  test('archive page has navigation back to home via wordmark', async ({
    page,
  }) => {
    await page.goto('/me/poems', { waitUntil: 'networkidle' });

    // Find and click "Linejam" wordmark in header
    const wordmark = page.getByRole('link', { name: /Linejam/i });
    await expect(wordmark).toBeVisible();

    // Click and verify navigation
    await wordmark.click();
    await page.waitForURL('/', { timeout: 10000 });
  });

  test('archive page accessible from home', async ({ page }) => {
    // Start from home page
    await page.goto('/', { waitUntil: 'networkidle' });

    // Find archive link
    const archiveLink = page.getByRole('link', { name: /Archive/i }).first();
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

test.describe('Favorites Feature Structure', () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!isClerkConfigured) {
      testInfo.skip(true, 'Clerk auth not configured (guest-only mode)');
    }
  });

  test('archive page shows empty state for new user', async ({ page }) => {
    await page.goto('/me/poems', { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForSelector('h1', { state: 'visible', timeout: 10000 });

    // Verify empty state is shown (new user has no poems)
    await expect(
      page.getByRole('heading', { name: /Your archive awaits/i })
    ).toBeVisible();

    // Verify CTAs exist
    await expect(
      page.getByRole('link', { name: /Start a Game/i })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Join a Room/i })
    ).toBeVisible();
  });

  // Note: The following tests would require completed poems in the database:
  // - Toggle favorite on poem → heart icon updates
  // - Favorited poems sorted to top of archive
  //
  // These scenarios require GUEST_TOKEN_SECRET for the submitLine mutation
  // which allows completing a 9-round game and creating poems.
  //
  // For now, the favorites toggle/persistence is covered by unit tests:
  // - tests/convex/favorites.test.ts (16 tests)
});
