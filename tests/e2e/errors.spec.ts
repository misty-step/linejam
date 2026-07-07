import { test, expect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

import { GuestFlowSession } from './support/guestFlow';
import { E2E_TEST_IDS } from '../../lib/e2eTestIds';

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

    // The join form must surface the SPECIFIC friendly message — seeing the
    // generic fallback here means the ConvexError taxonomy regressed
    // (linejam-941: Convex redacts plain Error in prod).
    const errorAlert = page.getByTestId(E2E_TEST_IDS.joinErrorAlert);

    await expect(errorAlert).toBeVisible({ timeout: 30000 });
    await expect(errorAlert).toContainText(
      'Room code not found. Please check the code and try again.'
    );
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

// ─────────────────────────────────────────────────────────────────────────────
// Party-path error taxonomy (linejam-941)
//
// Every join/create failure a party guest can hit must render its SPECIFIC
// friendly message through the E2E_TEST_IDS contract. The generic fallback
// appearing in any of these flows means a Convex function threw plain Error
// (redacted in prod) instead of ConvexError.
// ─────────────────────────────────────────────────────────────────────────────

let ipCounter = 0;

/**
 * New browser context with a unique client IP (the app trusts
 * x-forwarded-for) so per-IP guest-session rate-limit buckets never bleed
 * between tests or into the other spec files sharing this dev server.
 */
async function newGuestContext(
  browser: Browser
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': `10.94.1.${++ipCounter}` },
  });
  const page = await context.newPage();
  return { context, page };
}

async function submitJoin(page: Page, code: string, name: string) {
  await page.goto(`/join?code=${code}`);
  await page
    .getByTestId(E2E_TEST_IDS.joinNameInput)
    .fill(name, { timeout: 30000 });
  await page.getByTestId(E2E_TEST_IDS.joinRoomButton).click();
}

function joinErrorAlert(page: Page) {
  return page.getByTestId(E2E_TEST_IDS.joinErrorAlert);
}

test.describe('Party-path error taxonomy', () => {
  test('joining a room with a game in progress shows the started message', async ({
    browser,
  }) => {
    const session = await GuestFlowSession.create(browser, {
      hostName: 'Taxonomy Host',
      guestName: 'Taxonomy Guest',
    });
    try {
      await session.createRoom();
      await session.joinRoom();
      await session.startGame();

      const { context, page } = await newGuestContext(browser);
      try {
        await submitJoin(page, session.roomCode, 'Latecomer');
        await expect(joinErrorAlert(page)).toContainText(
          'This game has already started. Please wait for the next session or ask the host to create a new room.',
          { timeout: 30000 }
        );
      } finally {
        await context.close();
      }
    } finally {
      await session.close();
    }
  });

  test('joining a full room shows the room-full message', async ({
    browser,
  }) => {
    test.setTimeout(240000); // fills 8 seats through the real UI

    const session = await GuestFlowSession.create(browser, {
      hostName: 'Full Host',
    });
    try {
      await session.createRoom();

      // Fill seats 2-8 (host holds seat 1)
      for (let i = 0; i < 7; i++) {
        const { context, page } = await newGuestContext(browser);
        try {
          await submitJoin(page, session.roomCode, `Filler ${i + 1}`);
          await page.waitForURL(`**/room/${session.roomCode}`, {
            timeout: 30000,
          });
        } finally {
          await context.close();
        }
      }

      // Seat 9 must bounce with the specific message
      const { context, page } = await newGuestContext(browser);
      try {
        await submitJoin(page, session.roomCode, 'Ninth Wheel');
        await expect(joinErrorAlert(page)).toContainText(
          'This room is full (8 players max). Ask the host to start a new room.',
          { timeout: 30000 }
        );
      } finally {
        await context.close();
      }
    } finally {
      await session.close();
    }
  });

  test('joining a closed room shows the closed message', async ({
    browser,
  }) => {
    const session = await GuestFlowSession.create(browser, {
      hostName: 'Closing Host',
    });
    try {
      await session.createRoom();
      const code = session.roomCode;

      await session.hostPage
        .getByRole('button', { name: /close room/i })
        .click();
      await session.hostPage.waitForURL('**/', { timeout: 30000 });

      const { context, page } = await newGuestContext(browser);
      try {
        await submitJoin(page, code, 'Latecomer');
        await expect(joinErrorAlert(page)).toContainText(
          'This room has been closed. Ask the host for a new room code.',
          { timeout: 30000 }
        );
      } finally {
        await context.close();
      }
    } finally {
      await session.close();
    }
  });

  test('rate-limited room creation shows the too-many-attempts message', async ({
    browser,
  }) => {
    test.setTimeout(240000);

    // createRoom allows 3 per user per window; the 4th must bounce with the
    // specific rate-limit message, not the generic fallback.
    const { context, page } = await newGuestContext(browser);
    try {
      for (let i = 0; i < 3; i++) {
        await page.goto('/host');
        await page
          .getByTestId(E2E_TEST_IDS.hostNameInput)
          .fill('Eager Host', { timeout: 30000 });
        await page.getByTestId(E2E_TEST_IDS.hostCreateRoomButton).click();
        await page.waitForURL('**/room/**', { timeout: 30000 });
      }

      await page.goto('/host');
      await page
        .getByTestId(E2E_TEST_IDS.hostNameInput)
        .fill('Eager Host', { timeout: 30000 });
      await page.getByTestId(E2E_TEST_IDS.hostCreateRoomButton).click();

      await expect(page.getByTestId(E2E_TEST_IDS.hostErrorAlert)).toContainText(
        'Too many attempts. Please wait a few minutes before trying again.',
        { timeout: 30000 }
      );
    } finally {
      await context.close();
    }
  });
});
