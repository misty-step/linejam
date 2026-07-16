import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { PRESENCE_AWAY_MS } from '@/convex/lib/gameRules';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import {
  CANONICAL_GUEST_FLOW_LINES,
  isolateGuestSessionIp,
} from '@/tests/e2e/support/guestFlow';

test.describe.configure({ mode: 'serial' });

const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

const MOBILE_VIEWPORT = { width: 390, height: 844 };

function visibleTestId(page: Page, testId: string) {
  return page.getByTestId(testId).filter({ visible: true });
}

async function createRoom(page: Page, hostName: string) {
  await page.goto('/host');
  await visibleTestId(page, E2E_TEST_IDS.hostNameInput).fill(hostName);
  await visibleTestId(page, E2E_TEST_IDS.hostCreateRoomButton).click();
  await page.waitForURL(/\/room\/[A-Z]{4}$/);

  const roomCode = new URL(page.url()).pathname.split('/').pop() ?? '';
  expect(roomCode).toMatch(/^[A-Z]{4}$/);
  return roomCode;
}

async function joinRoom(page: Page, roomCode: string, name: string) {
  await page.goto(`/join?code=${roomCode}`);
  await visibleTestId(page, E2E_TEST_IDS.joinNameInput).fill(name);
  await visibleTestId(page, E2E_TEST_IDS.joinRoomButton).click();
  await page.waitForURL(`/room/${roomCode}`);
}

async function submitLine(page: Page, line: string) {
  await visibleTestId(page, E2E_TEST_IDS.writingLineInput).fill(line);
  await visibleTestId(page, E2E_TEST_IDS.writingSubmitLineButton).click();
}

async function revealAssignedPoem(page: Page) {
  const assignedButton = page
    .getByRole('button', { name: 'Reveal & Read', exact: true })
    .filter({ visible: true });
  await expect(assignedButton).toHaveCount(1);
  await assignedButton.click();
  await expect(visibleTestId(page, E2E_TEST_IDS.poemDoneButton)).toBeVisible();
  await visibleTestId(page, E2E_TEST_IDS.poemDoneButton).click();
}

test('three-player reveal survives an assigned reader disconnect on mobile', async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000);

  const contexts: BrowserContext[] = [];
  let departedContext: BrowserContext | null = null;

  try {
    const [hostContext, presentReaderContext, departedReaderContext] =
      await Promise.all(
        Array.from({ length: 3 }, () =>
          browser.newContext({ viewport: MOBILE_VIEWPORT })
        )
      );
    contexts.push(hostContext, presentReaderContext);
    departedContext = departedReaderContext;

    await Promise.all([
      isolateGuestSessionIp(hostContext),
      isolateGuestSessionIp(presentReaderContext),
      isolateGuestSessionIp(departedReaderContext),
    ]);

    const [hostPage, presentReaderPage, departedReaderPage] = await Promise.all(
      [
        hostContext.newPage(),
        presentReaderContext.newPage(),
        departedReaderContext.newPage(),
      ]
    );

    const roomCode = await createRoom(hostPage, 'Reveal Host');
    await joinRoom(presentReaderPage, roomCode, 'Reader Here');
    await joinRoom(departedReaderPage, roomCode, 'Reader Away');

    await expect(
      hostPage.getByText('Reader Away', { exact: true })
    ).toBeVisible();
    await visibleTestId(hostPage, E2E_TEST_IDS.lobbyStartGameButton).click();

    for (
      let roundIndex = 0;
      roundIndex < CANONICAL_GUEST_FLOW_LINES.length;
      roundIndex += 1
    ) {
      const line = CANONICAL_GUEST_FLOW_LINES[roundIndex];
      await Promise.all([
        submitLine(hostPage, line),
        submitLine(presentReaderPage, line),
        submitLine(departedReaderPage, line),
      ]);

      if (roundIndex < CANONICAL_GUEST_FLOW_LINES.length - 1) {
        await expect(
          visibleTestId(hostPage, E2E_TEST_IDS.writingPhase)
        ).toHaveAttribute('data-round', String(roundIndex + 2), {
          timeout: 15_000,
        });
      }
    }

    await Promise.all(
      [hostPage, presentReaderPage, departedReaderPage].map(async (page) => {
        const assignedButton = page
          .getByRole('button', { name: 'Reveal & Read', exact: true })
          .filter({ visible: true });
        await expect(assignedButton).toHaveCount(1, { timeout: 30_000 });
      })
    );

    await departedReaderContext.close();
    departedContext = null;

    await revealAssignedPoem(hostPage);
    await revealAssignedPoem(presentReaderPage);

    const fallbackButton = visibleTestId(
      hostPage,
      E2E_TEST_IDS.revealPoemButton
    );
    await expect(fallbackButton).toBeVisible({
      timeout: PRESENCE_AWAY_MS + 30_000,
    });
    await expect(fallbackButton).toHaveAccessibleName('Step In & Read');
    await expect(hostPage.getByText('Step in for Reader Away')).toBeVisible();

    await hostPage.screenshot({
      path: testInfo.outputPath('reveal-reader-fallback-mobile.png'),
      fullPage: true,
    });

    await fallbackButton.click();
    await expect(
      visibleTestId(hostPage, E2E_TEST_IDS.poemDoneButton)
    ).toBeVisible();
    await visibleTestId(hostPage, E2E_TEST_IDS.poemDoneButton).click();

    await Promise.all(
      [hostPage, presentReaderPage].map((page) =>
        expect(visibleTestId(page, E2E_TEST_IDS.sessionComplete)).toBeVisible({
          timeout: 15_000,
        })
      )
    );
  } finally {
    await departedContext?.close();
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
