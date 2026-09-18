import { test, expect } from '@playwright/test';
import {
  GuestFlowSession,
  closeHostedRoom,
  isolateGuestSessionIp,
} from './support/guestFlow';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';

const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

test('keeps the same-identity draft across renewal with unavailable session storage', async ({
  browser,
}) => {
  const session = await GuestFlowSession.create(browser, {
    hostName: 'Renewal Host',
    guestName: 'Renewal Guest',
  });
  const hostIp = await isolateGuestSessionIp(session.hostContext);
  let releaseRenewal!: () => void;
  const renewalGate = new Promise<void>((resolve) => {
    releaseRenewal = resolve;
  });
  let requests = 0;
  let initialGuestId: string | undefined;
  let renewedSameIdentity = false;
  await session.hostPage.clock.install();
  await session.hostContext.route('**/api/guest/session*', async (route) => {
    const response = await route.fetch({
      headers: { ...route.request().headers(), 'do-connecting-ip': hostIp },
    });
    const body = await response.json();
    requests += 1;
    if (requests === 1) {
      initialGuestId = body.guestId;
      // Shorten only the browser horizon, preserving the actual issuer's proof.
      // The held renewal response lets the test observe the expired-proof fence.
      await route.fulfill({ response, json: { ...body, validForMs: 60000 } });
    } else {
      renewedSameIdentity = body.guestId === initialGuestId;
      await renewalGate;
      await route.fulfill({ response });
    }
  });
  try {
    await session.createRoom();
    await session.joinRoom();
    await session.startGame();
    await session.hostPage.evaluate(() => {
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get() {
          throw new DOMException(
            'Storage disabled for renewal proof',
            'SecurityError'
          );
        },
      });
    });
    const input = session.hostPage.getByTestId(E2E_TEST_IDS.writingLineInput);
    await input.fill('Remembered');
    await expect(input).toHaveValue('Remembered');
    await session.hostPage.clock.fastForward(61000);
    await expect.poll(() => requests).toBe(2);
    await expect(input).toHaveCount(0);
    await expect(
      session.hostPage.getByTestId(E2E_TEST_IDS.writingSubmitLineButton)
    ).toHaveCount(0);
    releaseRenewal();
    await expect.poll(() => renewedSameIdentity).toBe(true);
    await expect(input).toHaveValue('Remembered');
  } finally {
    releaseRenewal();
    if (session.roomCode) {
      await session.hostPage
        .getByRole('button', { name: 'Room options', exact: true })
        .click();
      await session.hostPage
        .getByRole('button', { name: 'End game', exact: true })
        .click();
      await expect(
        session.hostPage.getByRole('heading', {
          name: 'End this game?',
          exact: true,
        })
      ).toBeVisible();
      await session.hostPage
        .getByRole('button', { name: 'End game', exact: true })
        .click();
      await expect(
        session.hostPage.getByTestId(E2E_TEST_IDS.lobbyStartGameButton)
      ).toBeVisible();
      await closeHostedRoom(session.hostPage, session.roomCode);
    }
    await session.close();
  }
});
