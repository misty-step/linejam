import { test, expect } from '@playwright/test';

/**
 * E2E Test: Favorites Flow
 *
 * Tests the personal archive page and favorites display.
 *
 * Note: Full favorites testing (toggle, persist, unfavorite) requires:
 * 1. A completed game with poems
 * 2. GUEST_TOKEN_SECRET configured in Convex dev environment
 *
 * These tests verify the archive page structure and empty state.
 * Full integration testing should be done in staging/production.
 */

// Run tests serially for consistent state
test.describe.configure({ mode: 'serial' });

test.describe('Personal Archive Page', () => {
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

    // Verify page title (heading contains both words)
    await expect(
      page.getByRole('heading', { name: /Personal.*Archive/i })
    ).toBeVisible();

    // Verify sections exist (use heading role to be specific)
    await expect(
      page.getByRole('heading', { name: 'Marked Works' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Session History' })
    ).toBeVisible();

    // Verify empty state messages for new user
    await expect(page.getByText(/No marked works yet/i)).toBeVisible();
    await expect(page.getByText(/No sessions recorded/i)).toBeVisible();
  });

  test('archive page has navigation back to home', async ({ page }) => {
    await page.goto('/me/poems', { waitUntil: 'networkidle' });

    // Find and click "Return Home" link
    const returnHomeLink = page.getByRole('link', { name: /Return Home/i });
    await expect(returnHomeLink).toBeVisible();

    // Click and verify navigation
    await returnHomeLink.click();
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

    // Verify we're on the archive page
    await expect(
      page.getByRole('heading', { name: /Personal/i })
    ).toBeVisible();
  });
});

test.describe('Favorites Feature Structure', () => {
  test('marked works section exists with proper styling', async ({ page }) => {
    await page.goto('/me/poems', { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForSelector('h1', { state: 'visible', timeout: 10000 });

    // Verify the "Marked Works" section heading exists
    await expect(
      page.getByRole('heading', { name: 'Marked Works' })
    ).toBeVisible();

    // Verify "Session History" section heading exists
    await expect(
      page.getByRole('heading', { name: 'Session History' })
    ).toBeVisible();
  });

  // Note: The following tests would require completed poems in the database:
  // - Toggle favorite on poem → heart icon updates
  // - Favorited poem appears in Marked Works section
  // - Unfavorite → poem removed from Marked Works
  //
  // These scenarios require GUEST_TOKEN_SECRET for the submitLine mutation
  // which allows completing a 9-round game and creating poems.
  //
  // For now, the favorites toggle/persistence is covered by unit tests:
  // - tests/convex/favorites.test.ts (16 tests)
});
