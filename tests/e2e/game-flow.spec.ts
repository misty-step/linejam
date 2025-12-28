import { test, expect, BrowserContext, Page } from '@playwright/test';

/**
 * E2E Test: Complete Game Flow
 *
 * Simulates a game session with 2 players (host + guest).
 * Tests room creation, joining, real-time synchronization, and game start.
 *
 * Note: Full 9-round testing requires Convex dev environment with proper
 * GUEST_TOKEN_SECRET configuration. The tests below verify the setup and
 * game initialization which are the most critical user-facing flows.
 */

// Run tests serially since they depend on shared state
test.describe.configure({ mode: 'serial' });

// Require matching guest token secret so Convex can verify tokens issued by Next
const missingGuestTokenSecret = !process.env.GUEST_TOKEN_SECRET;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET (same as Convex dashboard) to run game flow E2E'
);

test.describe('Complete Game Flow', () => {
  let hostContext: BrowserContext;
  let guestContext: BrowserContext;
  let hostPage: Page;
  let guestPage: Page;
  let roomCode: string;

  test.beforeAll(async ({ browser }) => {
    // Create separate contexts with isolated storage (different guest sessions)
    hostContext = await browser.newContext();
    guestContext = await browser.newContext();

    hostPage = await hostContext.newPage();
    guestPage = await guestContext.newPage();
  });

  test.afterAll(async () => {
    await hostContext.close();
    await guestContext.close();
  });

  test('host creates room and gets room code', async () => {
    // Enable console logging for debugging CI failures
    hostPage.on('console', (msg) =>
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`)
    );

    // Navigate to host page
    await hostPage.goto('/host', { waitUntil: 'networkidle' });

    // Wait for input to be ready
    await hostPage.waitForSelector('input#name', {
      state: 'visible',
      timeout: 10000,
    });

    // Fill in host name
    await hostPage.fill('input#name', 'Host Player');

    // Click create room button
    await hostPage.click('button[type="submit"]');

    // Wait for redirect to room page
    await hostPage.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 30000 });

    // Extract room code from URL
    const url = hostPage.url();
    roomCode = url.match(/\/room\/([A-Z]{4})$/)?.[1] || '';
    expect(roomCode).toMatch(/^[A-Z]{4}$/);

    // Verify we're in the lobby
    await expect(hostPage.getByText('Host Player')).toBeVisible();
    await expect(
      hostPage.getByRole('button', { name: /Need.*Poet.*to Jam/i })
    ).toBeVisible();
  });

  test('guest joins room and appears in lobby', async () => {
    // Navigate to join page with room code
    await guestPage.goto(`/join?code=${roomCode}`);

    // Fill in guest name
    await guestPage.fill('input#name', 'Guest Player');

    // Click join button
    await guestPage.click('button[type="submit"]');

    // Wait for redirect to room page
    await guestPage.waitForURL(`/room/${roomCode}`, { timeout: 15000 });

    // Verify guest is in lobby
    await expect(guestPage.getByText('Guest Player')).toBeVisible();
    await expect(guestPage.getByText('Host Player')).toBeVisible();

    // Host should also see the guest now (real-time sync)
    await expect(hostPage.getByText('Guest Player')).toBeVisible({
      timeout: 10000,
    });

    // Start button should now be enabled for host
    await expect(
      hostPage.getByRole('button', { name: /Start Linejam/i })
    ).toBeEnabled();

    // Guest sees "Waiting for Host" button
    await expect(
      guestPage.getByRole('button', { name: /Waiting for Host/i })
    ).toBeVisible();
  });

  test('host starts game and both players see round 1', async () => {
    // Host clicks Start Linejam
    await hostPage.click('button:has-text("Start Linejam")');

    // Both players should see Round 1 / 9
    await expect(hostPage.getByText(/Round 1 \/ 9/)).toBeVisible({
      timeout: 15000,
    });
    await expect(guestPage.getByText(/Round 1 \/ 9/)).toBeVisible({
      timeout: 15000,
    });

    // Both should see the writing textarea
    await expect(hostPage.getByRole('textbox')).toBeVisible();
    await expect(guestPage.getByRole('textbox')).toBeVisible();

    // Both should see the word count indicator (WordSlots component)
    await expect(hostPage.locator('#word-slots')).toBeVisible();
    await expect(guestPage.locator('#word-slots')).toBeVisible();
  });

  test('players can type in textarea and see word count update', async () => {
    // Host types a word
    const hostTextarea = hostPage.getByRole('textbox');
    await hostTextarea.fill('poetry');

    // Word slots should be visible (visual indicator updates)
    await expect(hostPage.locator('#word-slots')).toBeVisible();

    // Guest types a word
    const guestTextarea = guestPage.getByRole('textbox');
    await guestTextarea.fill('verse');

    // Word slots should be visible
    await expect(guestPage.locator('#word-slots')).toBeVisible();

    // Both submit buttons should now be enabled
    await expect(
      hostPage.getByRole('button', { name: /Seal Your Line/i })
    ).toBeEnabled();
    await expect(
      guestPage.getByRole('button', { name: /Seal Your Line/i })
    ).toBeEnabled();
  });

  test('complete 9-round game and reveal poems', async () => {
    // Word counts per round: 1,2,3,4,5,4,3,2,1
    const lines = [
      'poetry', // Round 1: 1 word
      'two words', // Round 2: 2 words
      'just three words', // Round 3: 3 words
      'this has four words', // Round 4: 4 words
      'this line has five words', // Round 5: 5 words
      'back to four now', // Round 6: 4 words
      'only three again', // Round 7: 3 words
      'two more', // Round 8: 2 words
      'end', // Round 9: 1 word
    ];

    for (let round = 0; round < 9; round++) {
      // Host submits
      await hostPage.getByRole('textbox').fill(lines[round]);
      await hostPage.getByRole('button', { name: /Seal Your Line/i }).click();

      // Wait for host's waiting state (submitted but waiting for others)
      await expect(hostPage.getByText(/Waiting/i)).toBeVisible({
        timeout: 15000,
      });

      // Guest submits
      await guestPage.getByRole('textbox').fill(lines[round]);
      await guestPage.getByRole('button', { name: /Seal Your Line/i }).click();

      // Wait for next round or reveal
      if (round < 8) {
        await expect(hostPage.getByText(`Round ${round + 2} / 9`)).toBeVisible({
          timeout: 15000,
        });
        await expect(guestPage.getByText(`Round ${round + 2} / 9`)).toBeVisible(
          { timeout: 15000 }
        );
      }
    }

    // After round 9, both should see reveal phase
    await expect(
      hostPage.getByRole('heading', { name: /Reading Phase/i })
    ).toBeVisible({ timeout: 30000 });
    await expect(
      guestPage.getByRole('heading', { name: /Reading Phase/i })
    ).toBeVisible({ timeout: 30000 });

    // Both players should have poems to reveal (each player reads one poem in 2-player game)
    await expect(
      hostPage.getByRole('button', { name: /Reveal & Read/i })
    ).toBeVisible();
    await expect(
      guestPage.getByRole('button', { name: /Reveal & Read/i })
    ).toBeVisible();

    // Host reveals their assigned poem
    await hostPage.getByRole('button', { name: /Reveal & Read/i }).click();

    // PoemDisplay should show with lines
    await expect(hostPage.getByText('poetry')).toBeVisible({ timeout: 10000 });
    await expect(hostPage.getByText('end')).toBeVisible();

    // Close the poem display
    await hostPage.getByRole('button', { name: /Close|Done|Back/i }).click();

    // Guest reveals their assigned poem
    await guestPage.getByRole('button', { name: /Reveal & Read/i }).click();
    await expect(guestPage.getByText('poetry')).toBeVisible({ timeout: 10000 });
    await guestPage.getByRole('button', { name: /Close|Done|Back/i }).click();

    // After both reveal, should show "Session Complete"
    await expect(
      hostPage.getByRole('heading', { name: /Session Complete/i })
    ).toBeVisible({ timeout: 15000 });
  });
});
