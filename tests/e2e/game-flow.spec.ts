import { test, expect } from '@playwright/test';

import {
  CANONICAL_GUEST_FLOW_LINES,
  GuestFlowSession,
  closeHostedRoom,
  isolateGuestSessionIp,
} from '@/tests/e2e/support/guestFlow';

const REMATCH_GUEST_FLOW_LINES = [
  'rematch',
  'fresh verse',
  'new human lines',
  'players write these words',
  'second cycle keeps every word',
  'mobile poets stay present',
  'fresh lines remain',
  'still human',
  'preserved',
] as const;

/**
 * E2E Test: Complete Game Flow
 *
 * Simulates a game session with 2 players (host + guest).
 * Tests room creation, joining, real-time synchronization, and game start.
 *
 * Runs unchanged against the configured backend, including local workerd/DO.
 */

// Run tests serially since they depend on shared state
test.describe.configure({ mode: 'serial' });

// Require matching guest token secret so Convex can verify tokens issued by Next
const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

test.describe('Complete Game Flow', () => {
  let session: GuestFlowSession | null = null;
  const activeSession = () => {
    if (!session) {
      throw new Error('Guest flow session was not created.');
    }

    return session;
  };

  test.beforeAll(async ({ browser }) => {
    session = await GuestFlowSession.create(browser, {
      guestName: 'Guest Player',
      hostName: 'Host Player',
    });
    session.mirrorConsole('host');
  });

  test.afterAll(async () => {
    await session?.close();
  });

  test('host creates room and gets room code', async () => {
    const roomCode = await activeSession().createRoom();

    expect(roomCode).toMatch(/^[A-Z0-9]{4}$/);
  });

  test('guest joins room and appears in lobby', async () => {
    await activeSession().joinRoom();
  });

  test('host starts game and both players see round 1', async () => {
    await activeSession().startGame();
  });

  test('players can type in textarea and see word count update', async () => {
    await activeSession().fillCurrentLine(
      'host',
      CANONICAL_GUEST_FLOW_LINES[0]
    );
    await activeSession().expectWordSlotsVisible('host');
    await activeSession().expectSealEnabled('host');

    await activeSession().fillCurrentLine('guest', 'verse');
    await activeSession().expectWordSlotsVisible('guest');
    await activeSession().expectSealEnabled('guest');
  });

  test('reconnect restores the same seat and unsubmitted draft', async () => {
    const { guestPage } = activeSession();
    await guestPage.reload();
    await expect(guestPage.getByTestId('writing-line-input')).toHaveValue(
      'verse'
    );
    await activeSession().expectSealEnabled('guest');
  });

  test('complete 9-round game and reveal poems', async () => {
    await activeSession().playCanonicalGame(CANONICAL_GUEST_FLOW_LINES);
    await activeSession().revealAllPoems(CANONICAL_GUEST_FLOW_LINES);
  });

  test('play again completes a second game with its human lines intact', async () => {
    await activeSession().startNextRound();
    await activeSession().playCanonicalGame(REMATCH_GUEST_FLOW_LINES);
    await activeSession().revealAllPoems(REMATCH_GUEST_FLOW_LINES);
  });

  test('a closed invitation refuses a fresh guest', async ({ browser }) => {
    const { hostPage, roomCode } = activeSession();
    await hostPage
      .getByRole('button', { name: 'Back to lobby', exact: true })
      .click();
    await closeHostedRoom(hostPage, roomCode);
    const context = await browser.newContext();
    try {
      await isolateGuestSessionIp(context);
      const page = await context.newPage();
      await page.goto(`/join?code=${roomCode}`);
      await page.getByTestId('join-name-input').fill('Refused Guest');
      await page.getByTestId('join-room-button').click();
      await expect(page.getByTestId('join-error-alert')).toBeVisible();
      await expect(page).toHaveURL(/\/join\?/);
    } finally {
      await context.close();
    }
  });
});
