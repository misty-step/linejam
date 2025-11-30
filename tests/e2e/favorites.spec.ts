import { test, expect, Locator } from '@playwright/test';

/**
 * E2E Test: Favorites Flow
 *
 * Tests the personal archive page and favorites display.
 *
 * Note: Full favorites testing (toggle, persist, unfavorite) requires seeded data.
 * Opt-in by providing:
 *  - E2E_FAVORITES_ENABLED=true
 *  - E2E_FAVORITES_POEM_ID=<poem Id<'poems'> visible to the guest>
 *  - E2E_FAVORITES_POEM_PREVIEW=<preview snippet shown on archive card>
 *  - E2E_FAVORITES_GUEST_TOKEN=<linejam_guest_token cookie for a player who wrote in that room>
 *
 * Without these env vars, the toggle tests are skipped; structural archive tests still run.
 */

// Run tests serially for consistent state
test.describe.configure({ mode: 'serial' });

const favoritesEnabled =
  process.env.E2E_FAVORITES_ENABLED === 'true' &&
  !!process.env.E2E_FAVORITES_POEM_ID &&
  !!process.env.E2E_FAVORITES_GUEST_TOKEN &&
  !!process.env.E2E_FAVORITES_POEM_PREVIEW;

const POEM_ID = process.env.E2E_FAVORITES_POEM_ID!;
const GUEST_TOKEN = process.env.E2E_FAVORITES_GUEST_TOKEN!;
const POEM_PREVIEW = process.env.E2E_FAVORITES_POEM_PREVIEW!;

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

const favoritesSuite = favoritesEnabled ? test.describe : test.describe.skip;

favoritesSuite('Favorites toggle (requires seeded poem + guest token)', () => {
  const isFavorited = async (heart: Locator) =>
    (await heart.getAttribute('fill')) === 'currentColor';

  const setFavoriteState = async (
    heart: Locator,
    toggleButton: Locator,
    shouldBeFavorited: boolean
  ) => {
    const currentlyFavorited = await isFavorited(heart);
    if (currentlyFavorited !== shouldBeFavorited) {
      await toggleButton.click();
      await expect
        .poll(() => isFavorited(heart), { timeout: 10000 })
        .toBe(shouldBeFavorited);
    }
  };

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'linejam_guest_token',
        value: GUEST_TOKEN,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  });

  test('user can favorite a poem and see it in Marked Works', async ({
    page,
  }) => {
    await page.goto(`/poem/${POEM_ID}`, { waitUntil: 'networkidle' });

    const toggleButton = page.getByLabel('Toggle favorite');
    const heart = toggleButton.locator('svg');

    await setFavoriteState(heart, toggleButton, true);

    await page.goto('/me/poems', { waitUntil: 'networkidle' });

    const favorites = page
      .locator('[data-testid="favorite-card"]')
      .filter({ hasText: POEM_PREVIEW });

    await expect(favorites).toHaveCount(1);
  });

  test('user can unfavorite a poem and it disappears from Marked Works', async ({
    page,
  }) => {
    await page.goto(`/poem/${POEM_ID}`, { waitUntil: 'networkidle' });
    const toggleButton = page.getByLabel('Toggle favorite');
    const heart = toggleButton.locator('svg');

    await setFavoriteState(heart, toggleButton, false);

    await page.goto('/me/poems', { waitUntil: 'networkidle' });

    const favorites = page
      .locator('[data-testid="favorite-card"]')
      .filter({ hasText: POEM_PREVIEW });

    await expect(favorites).toHaveCount(0);
  });
});
