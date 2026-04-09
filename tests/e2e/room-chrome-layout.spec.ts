import { test, expect, BrowserContext, Page, devices } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const missingGuestTokenSecret = !process.env.GUEST_TOKEN_SECRET;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET to the active Convex deployment secret to run room chrome layout E2E'
);

async function createRoom(page: Page, hostName: string) {
  await page.goto('/host', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input#name', {
    state: 'visible',
    timeout: 30000,
  });
  await page.fill('input#name', hostName);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 30000 });
  const roomCode = page.url().match(/\/room\/([A-Z]{4})$/)?.[1] || '';
  expect(roomCode).toMatch(/^[A-Z]{4}$/);
  return roomCode;
}

async function joinRoom(page: Page, roomCode: string, playerName: string) {
  await page.goto(`/join?code=${roomCode}`);
  await page.waitForSelector('input#name', {
    state: 'visible',
    timeout: 30000,
  });
  await page.fill('input#name', playerName);
  await page.click('button[type="submit"]');
  await page.waitForURL(`/room/${roomCode}`, { timeout: 30000 });
}

async function expectBelow(
  upper: ReturnType<Page['getByTestId']>,
  lower: ReturnType<Page['getByRole']> | ReturnType<Page['locator']>,
  minimumGap = 8
) {
  const upperBox = await upper.boundingBox();
  const lowerBox = await lower.boundingBox();

  expect(upperBox).not.toBeNull();
  expect(lowerBox).not.toBeNull();
  expect(lowerBox!.y).toBeGreaterThan(
    upperBox!.y + upperBox!.height + minimumGap
  );
}

async function expectStickyAfterScroll(
  page: Page,
  chrome: ReturnType<Page['getByTestId']>
) {
  const beforeScroll = await chrome.boundingBox();
  expect(beforeScroll).not.toBeNull();

  await page.evaluate(async () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'auto',
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });

  const afterScroll = await chrome.boundingBox();
  expect(afterScroll).not.toBeNull();
  expect(Math.abs(afterScroll!.y - beforeScroll!.y)).toBeLessThan(4);
}

test('room chrome does not cover lobby or writing content on desktop and mobile', async ({
  browser,
}, testInfo) => {
  let hostContext: BrowserContext | undefined;
  let guestContext: BrowserContext | undefined;
  let mobileContext: BrowserContext | undefined;

  try {
    hostContext = await browser.newContext();
    guestContext = await browser.newContext();
    mobileContext = await browser.newContext({
      ...devices['iPhone 14'],
    });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const mobilePage = await mobileContext.newPage();

    const roomCode = await createRoom(hostPage, 'Layout Host');
    await joinRoom(guestPage, roomCode, 'Layout Guest');
    await joinRoom(mobilePage, roomCode, 'Pocket Guest');

    const desktopChrome = hostPage.getByTestId('room-chrome');
    const mobileChrome = mobilePage.getByTestId('room-chrome');

    await expect(desktopChrome).toBeVisible();
    await expect(mobileChrome).toBeVisible();

    await expectBelow(
      desktopChrome,
      hostPage.getByRole('button', { name: /Start Linejam/i }).first()
    );
    await expectBelow(
      mobileChrome,
      mobilePage.getByRole('button', { name: /Waiting for host/i }).first()
    );

    await hostPage.screenshot({
      path: testInfo.outputPath('room-chrome-lobby-desktop.png'),
      fullPage: true,
    });
    await mobilePage.screenshot({
      path: testInfo.outputPath('room-chrome-lobby-mobile.png'),
      fullPage: true,
    });

    await hostPage.getByRole('button', { name: /Start Linejam/i }).click();

    await expect(hostPage.getByRole('textbox')).toBeVisible({
      timeout: 30000,
    });
    await expect(mobilePage.getByRole('textbox')).toBeVisible({
      timeout: 30000,
    });

    await expectBelow(desktopChrome, hostPage.getByRole('textbox'));
    await expectBelow(mobileChrome, mobilePage.getByRole('textbox'));
    await expectStickyAfterScroll(hostPage, desktopChrome);
    await expectStickyAfterScroll(mobilePage, mobileChrome);

    await hostPage.screenshot({
      path: testInfo.outputPath('room-chrome-writing-desktop.png'),
      fullPage: true,
    });
    await mobilePage.screenshot({
      path: testInfo.outputPath('room-chrome-writing-mobile.png'),
      fullPage: true,
    });
  } finally {
    await hostContext?.close();
    await guestContext?.close();
    await mobileContext?.close();
  }
});
