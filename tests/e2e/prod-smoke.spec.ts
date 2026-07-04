import { test, expect, Browser, Page } from '@playwright/test';
import {
  ensureClerkAuthState,
  hasClerkBrowserAuth,
  requireClerkBrowserAuth,
} from './support/clerk';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';

const REQUIRE_AUTH_SMOKE =
  process.env.PLAYWRIGHT_REQUIRE_AUTH_SMOKE?.trim() === '1';

async function createHostedRoom(hostPage: Page, hostName: string) {
  await hostPage.goto('/host');
  await hostPage.waitForSelector('input#name', {
    state: 'visible',
    timeout: 10000,
  });
  await hostPage.getByTestId(E2E_TEST_IDS.hostNameInput).fill(hostName);
  await hostPage.getByTestId(E2E_TEST_IDS.hostCreateRoomButton).click();

  await hostPage.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 30000 });
  const roomCode = hostPage.url().match(/\/room\/([A-Z]{4})$/)?.[1] || '';
  expect(roomCode).toMatch(/^[A-Z]{4}$/);
  return roomCode;
}

async function openContextPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

function visibleTestId(page: Page, testId: string) {
  return page.getByTestId(testId).filter({ visible: true });
}

test.describe('Deployment Smoke', () => {
  test('guest multiplayer flow works on the deployed app', async ({
    browser,
  }) => {
    const { context: hostContext, page: hostPage } =
      await openContextPage(browser);
    const { context: guestContext, page: guestPage } =
      await openContextPage(browser);

    try {
      const roomCode = await createHostedRoom(hostPage, 'Canary Host');

      await guestPage.goto(`/join?code=${roomCode}`);
      await guestPage.waitForSelector('input#name', {
        state: 'visible',
        timeout: 10000,
      });
      await guestPage
        .getByTestId(E2E_TEST_IDS.joinNameInput)
        .fill('Canary Guest');
      await guestPage.getByTestId(E2E_TEST_IDS.joinRoomButton).click();

      await guestPage.waitForURL(`/room/${roomCode}`, { timeout: 15000 });

      await expect(hostPage.getByText('Canary Guest')).toBeVisible({
        timeout: 10000,
      });
      await expect(guestPage.getByText('Canary Host')).toBeVisible();

      await expect(
        visibleTestId(hostPage, E2E_TEST_IDS.lobbyStartGameButton)
      ).toBeEnabled();
      await visibleTestId(hostPage, E2E_TEST_IDS.lobbyStartGameButton).click();

      await expect(
        hostPage.getByTestId(E2E_TEST_IDS.writingPhase)
      ).toHaveAttribute('data-round', '1', { timeout: 15000 });
      await expect(
        guestPage.getByTestId(E2E_TEST_IDS.writingPhase)
      ).toHaveAttribute('data-round', '1', { timeout: 15000 });

      await expect(
        hostPage.getByText(/unexpected error occurred/i)
      ).not.toBeVisible();
      await expect(
        guestPage.getByText(/unexpected error occurred/i)
      ).not.toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('signed-in user can join a hosted room', async ({ browser }) => {
    if (REQUIRE_AUTH_SMOKE && !hasClerkBrowserAuth) {
      throw new Error(
        'Authenticated smoke is required, but CLERK_SECRET_KEY or a Clerk publishable key is missing'
      );
    }
    requireClerkBrowserAuth(test.info(), 'authenticated smoke');

    const { context: hostContext, page: hostPage } =
      await openContextPage(browser);
    const { context: signedInContext, page: signedInPage } =
      await openContextPage(browser);

    try {
      const roomCode = await createHostedRoom(hostPage, 'Canary Guest Host');

      await ensureClerkAuthState(signedInPage);
      await signedInPage.goto(`/join?code=${roomCode}`);
      await signedInPage.waitForSelector('input#name', {
        state: 'visible',
        timeout: 10000,
      });
      await signedInPage
        .getByTestId(E2E_TEST_IDS.joinNameInput)
        .fill('Canary Clerk User');
      await signedInPage.getByTestId(E2E_TEST_IDS.joinRoomButton).click();

      await signedInPage.waitForURL(`/room/${roomCode}`, { timeout: 15000 });

      await expect(hostPage.getByText('Canary Clerk User')).toBeVisible({
        timeout: 10000,
      });
      await expect(signedInPage.getByText('Canary Guest Host')).toBeVisible();
      await expect(
        signedInPage.getByText(/unexpected error occurred/i)
      ).not.toBeVisible();
    } finally {
      await hostContext.close();
      await signedInContext.close();
    }
  });
});
