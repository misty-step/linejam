import { test, expect, BrowserContext, Page } from '@playwright/test';

/**
 * E2E Test: Authentication Flow
 *
 * Tests guest session creation and persistence.
 * The guest session flow:
 * 1. First visit → /api/guest/session creates session → sets HttpOnly cookie
 * 2. Subsequent visits → cookie sent → same guestId returned
 *
 * Note: Clerk auth testing requires test account configuration which is
 * out of scope for this project. The guest-only flow is the primary auth path.
 */

// Run tests serially since they depend on shared state (cookies)
test.describe.configure({ mode: 'serial' });

test.describe('Guest Session API', () => {
  // TODO: Enable when GUEST_TOKEN_SECRET is synchronized in Convex Dashboard
  test.fixme();

  test('returns guestId and token on first request', async ({ page }) => {
    // Navigate to trigger guest session creation
    await page.goto('/', { waitUntil: 'networkidle' });

    // Make API request after page load (cookies will be set)
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/guest/session');
      return res.json();
    });

    expect(response.guestId).toBeDefined();
    expect(response.token).toBeDefined();

    // guestId should be a UUID
    expect(response.guestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test('returns same guestId on subsequent requests', async ({ page }) => {
    // Navigate to trigger guest session creation
    await page.goto('/', { waitUntil: 'networkidle' });

    // First request
    const response1 = await page.evaluate(async () => {
      const res = await fetch('/api/guest/session');
      return res.json();
    });

    // Second request - should return same guestId
    const response2 = await page.evaluate(async () => {
      const res = await fetch('/api/guest/session');
      return res.json();
    });

    expect(response1.guestId).toBe(response2.guestId);
  });
});

test.describe('Guest Session Persistence', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('guest cookie is set on page visit', async () => {
    // Navigate to home page
    await page.goto('/', { waitUntil: 'networkidle' });

    // The guest session is fetched async by the useUser hook after Clerk loads
    // Wait for the API call to complete by checking network or polling cookies
    await page.waitForFunction(
      async () => {
        const res = await fetch('/api/guest/session');
        const data = await res.json();
        return data.guestId !== undefined;
      },
      { timeout: 10000 }
    );

    // Now the cookie should be set
    const cookies = await context.cookies();
    const guestCookie = cookies.find((c) => c.name === 'linejam_guest_token');

    expect(guestCookie).toBeDefined();
    expect(guestCookie?.httpOnly).toBe(true);
    expect(guestCookie?.sameSite).toBe('Lax');
  });

  test('guest cookie persists across page reloads', async () => {
    // Get initial cookie value
    let cookies = await context.cookies();
    const initialToken = cookies.find(
      (c) => c.name === 'linejam_guest_token'
    )?.value;
    expect(initialToken).toBeDefined();

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Get cookie after reload
    cookies = await context.cookies();
    const afterReloadToken = cookies.find(
      (c) => c.name === 'linejam_guest_token'
    )?.value;

    // Should be the same token
    expect(afterReloadToken).toBe(initialToken);
  });

  test('guest cookie persists across navigation', async () => {
    // Get cookie value before navigation
    let cookies = await context.cookies();
    const beforeNavToken = cookies.find(
      (c) => c.name === 'linejam_guest_token'
    )?.value;

    // Navigate to join page (public page)
    await page.goto('/join', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Get cookie after navigation
    cookies = await context.cookies();
    const afterNavToken = cookies.find(
      (c) => c.name === 'linejam_guest_token'
    )?.value;

    // Should be the same token
    expect(afterNavToken).toBe(beforeNavToken);
  });
});

test.describe('Isolated Guest Sessions', () => {
  test('different browser contexts get different guest sessions', async ({
    browser,
  }) => {
    // Create first context and trigger guest session
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('/', { waitUntil: 'networkidle' });

    // Wait for guest session API to be called and cookie set
    await page1.waitForFunction(
      async () => {
        const res = await fetch('/api/guest/session');
        const data = await res.json();
        return data.guestId !== undefined;
      },
      { timeout: 10000 }
    );
    const cookies1 = await context1.cookies();
    const token1 = cookies1.find(
      (c) => c.name === 'linejam_guest_token'
    )?.value;

    // Create second context and trigger guest session
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/', { waitUntil: 'networkidle' });

    // Wait for guest session API to be called and cookie set
    await page2.waitForFunction(
      async () => {
        const res = await fetch('/api/guest/session');
        const data = await res.json();
        return data.guestId !== undefined;
      },
      { timeout: 10000 }
    );
    const cookies2 = await context2.cookies();
    const token2 = cookies2.find(
      (c) => c.name === 'linejam_guest_token'
    )?.value;

    // Tokens should be different (different guest sessions)
    expect(token1).toBeDefined();
    expect(token2).toBeDefined();
    expect(token1).not.toBe(token2);

    await context1.close();
    await context2.close();
  });
});
