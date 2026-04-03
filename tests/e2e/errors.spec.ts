import { test, expect } from '@playwright/test';

import { GuestFlowSession } from './support/guestFlow';

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

// Require matching guest token secret so Convex can verify tokens issued by Next
const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

test.describe('Join Room Error Handling', () => {
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
  let session: GuestFlowSession;

  test.beforeAll(async ({ browser }) => {
    session = await GuestFlowSession.create(browser, {
      guestName: 'Guest',
      hostName: 'Host',
    });
    await session.createRoom();
    await session.joinRoom();
    await session.startGame();
  });

  test.afterAll(async () => {
    await session.close();
  });

  test('submit button is disabled when word count is wrong', async () => {
    await session.expectSealDisabled('host');

    await session.fillCurrentLine('host', 'two words');
    await session.expectSealDisabled('host');

    await session.fillCurrentLine('host', 'poetry');
    await session.expectSealEnabled('host');

    await session.fillCurrentLine('host', '');
    await session.expectSealDisabled('host');
  });

  test('word count indicator shows validation state', async () => {
    await session.expectWordSlotsVisible('host');
    await session.fillCurrentLine('host', 'verse');
    await session.expectSealEnabled('host');
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
