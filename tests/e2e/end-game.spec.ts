import { expect, test } from '@playwright/test';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import {
  CANONICAL_GUEST_FLOW_LINES,
  GuestFlowSession,
} from '@/tests/e2e/support/guestFlow';

const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;

test('host can end an incomplete game without revealing partial poems', async ({
  browser,
}) => {
  test.skip(
    missingGuestTokenSecret,
    'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
  );

  const session = await GuestFlowSession.create(browser, {
    guestName: 'End Game Guest',
    hostName: 'End Game Host',
  });

  try {
    await session.createRoom();
    await session.joinRoom();
    await session.startGame();
    await session.submitCurrentLine('host', CANONICAL_GUEST_FLOW_LINES[0]);
    await session.waitForWaitingState('host');

    await session.hostPage.getByRole('button', { name: 'End game' }).click();
    await expect(
      session.hostPage.getByRole('heading', { name: 'End this game?' })
    ).toBeVisible();
    await expect(
      session.hostPage.getByText('Partial poems are not revealed.')
    ).toBeVisible();
    await session.hostPage.getByRole('button', { name: 'End game' }).click();

    await expect(
      session.hostPage.getByTestId(E2E_TEST_IDS.lobbyStartGameButton)
    ).toBeVisible({ timeout: 15000 });
    await expect(
      session.guestPage.getByTestId(E2E_TEST_IDS.lobbyWaitingForHostButton)
    ).toBeVisible({ timeout: 15000 });
    await expect(
      session.hostPage.getByTestId(E2E_TEST_IDS.revealPhase)
    ).toHaveCount(0);
    await expect(
      session.guestPage.getByTestId(E2E_TEST_IDS.revealPhase)
    ).toHaveCount(0);
  } finally {
    await session.close();
  }
});
