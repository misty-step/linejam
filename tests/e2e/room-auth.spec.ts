import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { ensureClerkAuthState, requireClerkBrowserAuth } from './support/clerk';
import { isolateGuestSessionIp } from './support/guestFlow';

test.describe.configure({ mode: 'serial' });

const missingGuestTokenSecret = !process.env.GUEST_TOKEN_SECRET;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET to the active Convex deployment secret to run authenticated room E2E'
);

async function openIsolatedPage(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = await browser.newContext();
  await isolateGuestSessionIp(context);
  const page = await context.newPage();
  return { context, page };
}

async function createHostedRoom(hostPage: Page, hostName: string) {
  await hostPage.goto('/host');
  await hostPage.waitForSelector('input#name', {
    state: 'visible',
    timeout: 10000,
  });
  await hostPage.fill('input#name', hostName);
  await hostPage.click('button[type="submit"]');
  await hostPage.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 30000 });

  const roomCode = hostPage.url().match(/\/room\/([A-Z]{4})$/)?.[1] || '';
  expect(roomCode).toMatch(/^[A-Z]{4}$/);
  return roomCode;
}

test.describe('Authenticated room joins', () => {
  test('signed-in player can join a guest-hosted room', async ({
    browser,
  }, testInfo) => {
    requireClerkBrowserAuth(testInfo, 'signed-in room join E2E');

    const { context: hostContext, page: hostPage } =
      await openIsolatedPage(browser);
    const { context: signedInContext, page: signedInPage } =
      await openIsolatedPage(browser);

    try {
      const roomCode = await createHostedRoom(hostPage, 'Guest Host');
      await ensureClerkAuthState(signedInPage);
      await signedInPage.goto(`/join?code=${roomCode}`);
      await signedInPage.waitForSelector('input#name', {
        state: 'visible',
        timeout: 10000,
      });
      await signedInPage.fill('input#name', 'Clerk Player');
      await signedInPage.click('button[type="submit"]');

      await signedInPage.waitForURL(`/room/${roomCode}`, { timeout: 15000 });

      await expect(hostPage.getByText('Clerk Player')).toBeVisible({
        timeout: 10000,
      });
      await expect(signedInPage.getByText('Guest Host')).toBeVisible();
      await expect(
        signedInPage.getByText(/unexpected error occurred/i)
      ).not.toBeVisible();
    } finally {
      await hostContext.close();
      await signedInContext.close();
    }
  });
});
