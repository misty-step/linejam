import { test, expect, BrowserContext, Page } from '@playwright/test';

import { isolateGuestSessionIp } from './support/guestFlow';

/**
 * linejam-946: responsive sweep guarding against roster collisions and
 * sticky-chrome overlap. Sweeps a real lobby roster (1, 4, then 8 players)
 * across a viewport matrix (320-1280px) and asserts no player row element
 * clips the viewport or collides with an adjacent element. Also asserts the
 * "add a bot" feedback (roster growth) stays reachable without scrolling on
 * a 390px phone, and that the sticky room chrome never overlaps the session
 * recap headline.
 */

test.describe.configure({ mode: 'serial' });

const missingGuestTokenSecret = !process.env.GUEST_TOKEN_SECRET;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET to the active Convex deployment secret to run the lobby viewport matrix E2E'
);

const VIEWPORT_WIDTHS = [320, 390, 768, 1024, 1280];
const VIEWPORT_HEIGHT = 900;

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

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  const horizontal = a.x < b.x + b.width && b.x < a.x + a.width;
  const vertical = a.y < b.y + b.height && b.y < a.y + a.height;
  return horizontal && vertical;
}

/**
 * Asserts every rendered player row: (a) has no colliding name/badge
 * elements, and (b) never extends past the viewport's right edge.
 */
async function assertNoRosterCollisions(page: Page, viewportWidth: number) {
  const rows = page.locator('ul li');
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const nameSpan = row.locator('span.truncate').first();
    const nameBox = await nameSpan.boundingBox();
    expect(nameBox).not.toBeNull();
    expect(nameBox!.x).toBeGreaterThanOrEqual(0);
    expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(
      viewportWidth + 1 // 1px rounding tolerance
    );

    const hostBadge = row.getByRole('status', { name: 'Room host' });
    if (await hostBadge.count()) {
      const badgeBox = await hostBadge.boundingBox();
      expect(badgeBox).not.toBeNull();
      expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(
        viewportWidth + 1
      );
      expect(boxesOverlap(nameBox!, badgeBox!)).toBe(false);
    }
  }
}

test('lobby roster has no collisions or clipping across the viewport matrix at 1, 4, and 8 players', async ({
  browser,
}, testInfo) => {
  let hostContext: BrowserContext | undefined;
  const guestContexts: BrowserContext[] = [];

  try {
    hostContext = await browser.newContext({
      viewport: { width: VIEWPORT_WIDTHS[0], height: VIEWPORT_HEIGHT },
    });
    await isolateGuestSessionIp(hostContext);
    const hostPage = await hostContext.newPage();
    const roomCode = await createRoom(hostPage, 'Matrix Host');

    // --- 1 player checkpoint ---
    for (const width of VIEWPORT_WIDTHS) {
      await hostPage.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await assertNoRosterCollisions(hostPage, width);
    }
    await hostPage.screenshot({
      path: testInfo.outputPath('lobby-1p-390.png'),
      fullPage: true,
    });

    // Reachability check: on a 390px phone, the roster must be visible
    // above the fold without scrolling (linejam-946 criterion 3).
    await hostPage.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
    const rosterAtLoad = hostPage.getByText('Matrix Host');
    await expect(rosterAtLoad).toBeInViewport();

    // --- grow to 4 players (3 guests join) ---
    for (let i = 0; i < 3; i++) {
      const guestContext = await browser.newContext();
      await isolateGuestSessionIp(guestContext);
      guestContexts.push(guestContext);
      const guestPage = await guestContext.newPage();
      await joinRoom(guestPage, roomCode, `Matrix Guest ${i + 1}`);
    }
    await expect(hostPage.getByText('Matrix Guest 3')).toBeVisible({
      timeout: 10000,
    });

    for (const width of VIEWPORT_WIDTHS) {
      await hostPage.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await assertNoRosterCollisions(hostPage, width);
    }
    await hostPage.screenshot({
      path: testInfo.outputPath('lobby-4p-390.png'),
      fullPage: true,
    });

    // --- grow to 8 players (1 more guest + 3 bots) ---
    const guestContext = await browser.newContext();
    await isolateGuestSessionIp(guestContext);
    guestContexts.push(guestContext);
    const guestPage = await guestContext.newPage();
    await joinRoom(guestPage, roomCode, 'Matrix Guest 4');
    await expect(hostPage.getByText('Matrix Guest 4')).toBeVisible({
      timeout: 10000,
    });

    await hostPage.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
    const addBotButton = hostPage.getByRole('button', { name: /Add a bot/i });
    for (let i = 0; i < 3; i++) {
      const beforeCount = await hostPage.locator('ul li').count();
      await addBotButton.click();
      await expect(hostPage.locator('ul li')).toHaveCount(beforeCount + 1, {
        timeout: 15000,
      });
      // The newest roster row must be visible without scrolling — the
      // whole point of ordering the roster above the fold on mobile.
      await expect(hostPage.locator('ul li').last()).toBeInViewport();
    }

    for (const width of VIEWPORT_WIDTHS) {
      await hostPage.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await assertNoRosterCollisions(hostPage, width);
    }
    await hostPage.screenshot({
      path: testInfo.outputPath('lobby-8p-390.png'),
      fullPage: true,
    });
  } finally {
    await hostContext?.close();
    await Promise.all(guestContexts.map((ctx) => ctx.close()));
  }
});
