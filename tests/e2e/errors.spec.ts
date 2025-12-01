import { test, expect, BrowserContext, Page } from '@playwright/test';

/**
 * E2E Test: Error Scenarios and Validation
 *
 * Tests error handling and user feedback for common error scenarios.
 * Uses the errorToFeedback system to verify user-friendly messages.
 *
 * Test Cases:
 * - Invalid room code → friendly error message
 * - Game already started → join blocked with explanation
 * - Word count validation → submit disabled until correct
 */

// Run tests serially for consistent state
test.describe.configure({ mode: 'serial' });

test.describe('Join Room Error Handling', () => {
  // TODO: Enable when GUEST_TOKEN_SECRET is synchronized in Convex Dashboard
  test.fixme();

  test('shows error for invalid room code', async ({ page }) => {
    // Navigate to join page with invalid code
    await page.goto('/join?code=ZZZZ', { waitUntil: 'networkidle' });

    // Wait for guest session to initialize
    await page.waitForFunction(
      async () => {
        const res = await fetch('/api/guest/session');
        const data = await res.json();
        return data.guestId !== undefined;
      },
      { timeout: 10000 }
    );

    // Fill in name
    await page.fill('input#name', 'Test Player');

    // Click join button
    await page.click('button[type="submit"]');

    // Wait for error message to appear
    // The errorToFeedback maps "Room not found" to user-friendly message
    await expect(
      page.getByText(
        'Room code not found. Please check the code and try again.'
      )
    ).toBeVisible({ timeout: 30000 });
  });

  // Note: "Game already in progress" test is covered by game-flow.spec.ts
  // Testing this scenario E2E is complex and requires proper GUEST_TOKEN_SECRET
  // The errorToFeedback system for this case is unit tested in tests/lib/errorFeedback.test.ts
});

test.describe('Word Count Validation', () => {
  let hostContext: BrowserContext;
  let guestContext: BrowserContext;
  let hostPage: Page;
  let guestPage: Page;
  let roomCode: string;

  test.beforeAll(async ({ browser }) => {
    // Setup: Create room and start game with 2 players
    hostContext = await browser.newContext();
    guestContext = await browser.newContext();
    hostPage = await hostContext.newPage();
    guestPage = await guestContext.newPage();

    // Host creates room
    await hostPage.goto('/host', { waitUntil: 'networkidle' });
    await hostPage.waitForSelector('input#name', {
      state: 'visible',
      timeout: 10000,
    });
    await hostPage.fill('input#name', 'Host');
    await hostPage.click('button[type="submit"]');
    await hostPage.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 15000 });

    const url = hostPage.url();
    roomCode = url.match(/\/room\/([A-Z]{4})$/)?.[1] || '';

    // Guest joins room
    await guestPage.goto(`/join?code=${roomCode}`, {
      waitUntil: 'networkidle',
    });
    await guestPage.fill('input#name', 'Guest');
    await guestPage.click('button[type="submit"]');
    await guestPage.waitForURL(`/room/${roomCode}`, { timeout: 15000 });

    // Host starts game
    await hostPage.click('button:has-text("Start Linejam")');
    await expect(hostPage.getByText(/Round 1 \/ 9/)).toBeVisible({
      timeout: 15000,
    });
  });

  test.afterAll(async () => {
    await hostContext.close();
    await guestContext.close();
  });

  test('submit button is disabled when word count is wrong', async () => {
    // Round 1 requires exactly 1 word
    const submitButton = hostPage.getByRole('button', {
      name: /Seal Your Line/i,
    });

    // Initially disabled (0 words)
    await expect(submitButton).toBeDisabled();

    // Type 2 words - should still be disabled (too many)
    await hostPage.getByRole('textbox').fill('two words');
    await expect(submitButton).toBeDisabled();

    // Type exactly 1 word - should be enabled
    await hostPage.getByRole('textbox').fill('poetry');
    await expect(submitButton).toBeEnabled();

    // Clear and verify disabled again
    await hostPage.getByRole('textbox').fill('');
    await expect(submitButton).toBeDisabled();
  });

  test('word count indicator shows validation state', async () => {
    // Round 1 requires 1 word, shown as "0 / 1" initially
    await expect(hostPage.getByText('/ 1')).toBeVisible();

    // Type a word and verify count updates
    await hostPage.getByRole('textbox').fill('verse');

    // Submit button should now be enabled (valid word count)
    await expect(
      hostPage.getByRole('button', { name: /Seal Your Line/i })
    ).toBeEnabled();
  });
});

test.describe('Form Validation', () => {
  test('host form requires name before submitting', async ({ page }) => {
    await page.goto('/host', { waitUntil: 'networkidle' });
    await page.waitForSelector('input', {
      state: 'visible',
      timeout: 10000,
    });

    // Submit button should be disabled without name
    const submitButton = page.getByRole('button', { name: /Create Room/i });
    await expect(submitButton).toBeDisabled();

    // Fill name
    await page.getByRole('textbox').fill('Test Host');

    // Now button should be enabled
    await expect(submitButton).toBeEnabled();
  });

  test('join form requires both code and name', async ({ page }) => {
    await page.goto('/join', { waitUntil: 'networkidle' });

    const submitButton = page.getByRole('button', { name: /Enter Room/i });

    // Initially disabled (no code, no name)
    await expect(submitButton).toBeDisabled();

    // Fill only code
    await page.fill('input#code', 'ABCD');
    await expect(submitButton).toBeDisabled();

    // Clear code, fill only name
    await page.fill('input#code', '');
    await page.fill('input#name', 'Test Player');
    await expect(submitButton).toBeDisabled();

    // Fill both - now enabled
    await page.fill('input#code', 'ABCD');
    await expect(submitButton).toBeEnabled();
  });
});
