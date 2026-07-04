import { test } from '@playwright/test';

import {
  CANONICAL_GUEST_FLOW_LINES,
  GuestFlowSession,
} from '@/tests/e2e/support/guestFlow';

const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

test('frozen selector smoke reaches the reveal phase @early-smoke', async ({
  browser,
}) => {
  test.setTimeout(90_000);

  const session = await GuestFlowSession.create(browser, {
    guestName: 'Smoke Guest',
    hostName: 'Smoke Host',
  });

  try {
    await session.createRoom();
    await session.joinRoom();
    await session.startGame();
    await session.verifyRoundOneValidation();
    await session.playCanonicalGame(CANONICAL_GUEST_FLOW_LINES);
  } finally {
    await session.close();
  }
});
