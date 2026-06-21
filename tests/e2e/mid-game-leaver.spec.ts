import { test, expect } from '@playwright/test';

import {
  CANONICAL_GUEST_FLOW_LINES,
  GuestFlowSession,
} from '@/tests/e2e/support/guestFlow';
import { AUTO_GHOST_FILL_MS } from '@/convex/lib/gameRules';

/**
 * E2E grader for backlog 016 — "never let the room die".
 *
 * Falsifier: start a game, drop one player's browser mid-game, and wait. If the
 * room is still IN_PROGRESS after the per-turn timeout, the claim is false.
 *
 * Here the guest plays through round 8, then their browser is closed before the
 * final round. The host submits their own last line and does NOTHING else — no
 * "summon ghostwriter", no refresh. The durable per-turn floor must ghost-fill
 * the departed guest's final turn and carry the room to the reveal on its own.
 *
 * Tagged @slow: it waits out a real AUTO_GHOST_FILL_MS timeout against live
 * Convex, so it runs on release branches / on demand (pnpm test:e2e:leaver),
 * not in the fast per-PR lane. The deterministic invariant is covered by
 * tests/convex/abandonment.test.ts.
 */

test.describe.configure({ mode: 'serial' });

const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

test.describe('mid-game leaver self-heals @slow', () => {
  let session: GuestFlowSession | null = null;
  const activeSession = () => {
    if (!session) throw new Error('Guest flow session was not created.');
    return session;
  };

  test.beforeAll(async ({ browser }) => {
    session = await GuestFlowSession.create(browser, {
      guestName: 'Leaver',
      hostName: 'Stayer',
    });
  });

  test.afterAll(async () => {
    await session?.close();
  });

  test('host reaches the reveal after the guest drops, with no manual nudge', async () => {
    // Eight live rounds plus a real per-turn timeout exceed the default budget.
    test.slow();

    const s = activeSession();
    await s.createRoom();
    await s.joinRoom();
    await s.startGame();

    const lines = CANONICAL_GUEST_FLOW_LINES;
    const finalRound = lines.length - 1;

    // Play every round but the last with both players present.
    for (let round = 0; round < finalRound; round += 1) {
      await s.submitCurrentLine('host', lines[round]);
      await s.waitForWaitingState('host');
      await s.submitCurrentLine('guest', lines[round]);
      await s.expectRound(round + 2);
    }

    // The guest's browser disappears before the final round resolves.
    await s.guestContext.close();

    // Host seals their own final line and then waits — no ghostwriter summon.
    await s.submitCurrentLine('host', lines[finalRound]);

    // The per-turn floor must fill the departed guest's last turn and complete
    // the room. Allow the real timeout plus generous slack for the live stack.
    await expect(
      s.hostPage.getByRole('heading', { name: /Reveal poems/i })
    ).toBeVisible({ timeout: AUTO_GHOST_FILL_MS + 30_000 });
    await expect(
      s.hostPage.getByRole('button', { name: /Reveal & Read/i })
    ).toBeVisible();
  });
});
