import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

import { isolateGuestSessionIp } from './support/guestFlow';

/**
 * linejam-946: responsive sweep guarding against roster collisions and
 * the mid-width overflow captured in live prod. Sweeps a real lobby
 * roster (1, 4, then 8 real guests — no AI bots, whose mutation adds
 * enough round-trip latency in CI to blow the suite's per-test timeout)
 * across a viewport matrix (320-1280px, including the ~837px width the
 * live prod regression was captured at) and asserts no player row element
 * clips the viewport or collides with an adjacent element. Also asserts
 * a freshly-joined player is visible without scrolling on a 390px phone.
 */

test.describe.configure({ mode: 'serial' });

const missingGuestTokenSecret = !process.env.GUEST_TOKEN_SECRET;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET to the active Convex deployment secret to run the lobby viewport matrix E2E'
);

// A representative sample across 320-1280px, anchored on the exact ~837px
// width the live prod collision (linejam-946) was captured at.
const VIEWPORT_WIDTHS = [320, 390, 837, 1280];
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

async function openGuestAndJoin(
  browser: Browser,
  roomCode: string,
  playerName: string
) {
  const context = await browser.newContext();
  await isolateGuestSessionIp(context);
  const page = await context.newPage();
  await joinRoom(page, roomCode, playerName);
  return context;
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
  await rows.first().waitFor({ state: 'visible', timeout: 15000 });
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

async function sweepViewports(page: Page) {
  for (const width of VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await assertNoRosterCollisions(page, width);
  }
}

test('lobby roster has no collisions or clipping across the viewport matrix at 1, 4, and 8 players', async ({
  browser,
}, testInfo) => {
  // Real multiplayer joins across three roster sizes and four viewports;
  // give this more headroom than the suite default so CI resource
  // contention doesn't turn a slow pass into a false failure.
  test.setTimeout(180000);

  let hostContext: BrowserContext | undefined;
  const guestContexts: BrowserContext[] = [];

  try {
    hostContext = await browser.newContext({
      viewport: { width: VIEWPORT_WIDTHS[0], height: VIEWPORT_HEIGHT },
    });
    await isolateGuestSessionIp(hostContext);
    const hostPage = await hostContext.newPage();
    const roomCode = await createRoom(hostPage, 'Matrix Host');
    await expect(hostPage.getByText('Matrix Host')).toBeVisible({
      timeout: 15000,
    });

    // --- 1 player checkpoint ---
    await sweepViewports(hostPage);
    await hostPage.screenshot({
      path: testInfo.outputPath('lobby-1p-390.png'),
      fullPage: true,
    });

    // Reachability check: on a 390px phone, a freshly-joined player's row
    // must be visible above the fold without scrolling (linejam-946
    // criterion 3).
    await hostPage.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
    const firstGuest = await openGuestAndJoin(
      browser,
      roomCode,
      'Matrix Guest 1'
    );
    guestContexts.push(firstGuest);
    await expect(hostPage.getByText('Matrix Guest 1')).toBeInViewport();

    // --- grow to 4 players (2 more guests join, in parallel) ---
    const secondWaveGuests = await Promise.all([
      openGuestAndJoin(browser, roomCode, 'Matrix Guest 2'),
      openGuestAndJoin(browser, roomCode, 'Matrix Guest 3'),
    ]);
    guestContexts.push(...secondWaveGuests);
    await expect(hostPage.getByText('Matrix Guest 3')).toBeVisible({
      timeout: 10000,
    });

    await sweepViewports(hostPage);
    await hostPage.screenshot({
      path: testInfo.outputPath('lobby-4p-390.png'),
      fullPage: true,
    });

    // --- grow to 8 players (4 more guests join, in parallel) ---
    const thirdWaveGuests = await Promise.all([
      openGuestAndJoin(browser, roomCode, 'Matrix Guest 4'),
      openGuestAndJoin(browser, roomCode, 'Matrix Guest 5'),
      openGuestAndJoin(browser, roomCode, 'Matrix Guest 6'),
      openGuestAndJoin(browser, roomCode, 'Matrix Guest 7'),
    ]);
    guestContexts.push(...thirdWaveGuests);
    await expect(hostPage.getByText('Matrix Guest 7')).toBeVisible({
      timeout: 10000,
    });

    await sweepViewports(hostPage);
    await hostPage.screenshot({
      path: testInfo.outputPath('lobby-8p-390.png'),
      fullPage: true,
    });
  } finally {
    await hostContext?.close();
    await Promise.all(guestContexts.map((ctx) => ctx.close()));
  }
});
