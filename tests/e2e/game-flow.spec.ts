import { test, expect } from '@playwright/test';

import {
  CANONICAL_GUEST_FLOW_LINES,
  GuestFlowSession,
} from '@/tests/e2e/support/guestFlow';

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

    expect(roomCode).toMatch(/^[A-Z]{4}$/);
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

  test('complete 9-round game and reveal poems', async () => {
    await activeSession().playCanonicalGame(CANONICAL_GUEST_FLOW_LINES);
    await activeSession().revealAllPoems(CANONICAL_GUEST_FLOW_LINES);
  });
});
