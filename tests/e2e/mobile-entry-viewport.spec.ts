import { expect, Page, test } from '@playwright/test';

import { E2E_TEST_IDS } from '../../lib/e2eTestIds';
import { isolateGuestSessionIp } from './support/guestFlow';

const PHONE_VIEWPORTS = [
  { width: 320, height: 667 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
] as const;

async function expectNoHorizontalScroll(page: Page) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
}

async function expectInsideViewportHorizontally(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    (await page.evaluate(() => window.innerWidth)) + 1
  );
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

test.beforeEach(async ({ context }) => {
  await isolateGuestSessionIp(context);
});

for (const viewport of PHONE_VIEWPORTS) {
  test(`join fields and action do not clip or overlap at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/join?code=ABCD', { waitUntil: 'domcontentloaded' });

    const code = page.getByTestId(E2E_TEST_IDS.joinRoomCodeInput);
    const name = page.getByTestId(E2E_TEST_IDS.joinNameInput);
    const action = page.getByTestId(E2E_TEST_IDS.joinRoomButton);
    await expect(code).toBeVisible();
    await expect(name).toBeVisible();
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();

    await expectNoHorizontalScroll(page);
    await expectInsideViewportHorizontally(
      page,
      E2E_TEST_IDS.joinRoomCodeInput
    );
    await expectInsideViewportHorizontally(page, E2E_TEST_IDS.joinNameInput);
    await expectInsideViewportHorizontally(page, E2E_TEST_IDS.joinRoomButton);

    const nameBox = await name.boundingBox();
    const actionBox = await action.boundingBox();
    expect(nameBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(boxesOverlap(nameBox!, actionBox!)).toBe(false);

    const controls = page.locator('header a:visible, header button:visible');
    for (let index = 0; index < (await controls.count()); index += 1) {
      const box = await controls.nth(index).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await page.locator('header a[href="/"]').evaluate((wordmark) => {
      // Emulate a 200% text-only preference without doubling touch geometry.
      wordmark.style.fontSize = '2.5rem';
    });
    await expectNoHorizontalScroll(page);
  });
}

for (const width of [320, 390]) {
  for (const entry of [
    { route: '/join', focusedTestId: E2E_TEST_IDS.joinRoomCodeInput },
    {
      route: '/join?code=ABCD',
      focusedTestId: E2E_TEST_IDS.joinNameInput,
    },
  ]) {
    test(`join remains scroll-reachable at ${width}px after focusing ${entry.focusedTestId}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 360 });
      await page.goto(entry.route, { waitUntil: 'domcontentloaded' });

      const focusedInput = page.getByTestId(entry.focusedTestId);
      const action = page.getByTestId(E2E_TEST_IDS.joinRoomButton);
      await focusedInput.focus();
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();

      const [inputBox, actionBox] = await Promise.all([
        focusedInput.boundingBox(),
        action.boundingBox(),
      ]);
      expect(inputBox).not.toBeNull();
      expect(actionBox).not.toBeNull();
      expect(boxesOverlap(inputBox!, actionBox!)).toBe(false);
      expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(361);
      await expectNoHorizontalScroll(page);
    });
  }
}

test('mobile sign-in presents the account task before the poem showcase', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });

  const heading = page.getByRole('heading', { name: /welcome back/i });
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
  await expect(page.getByText('Recent Creation')).toBeHidden();
  await expectNoHorizontalScroll(page);

  const clerkInput = page.locator('input').first();
  await expect(clerkInput).toBeVisible();
  const fontSize = await clerkInput.evaluate((input) =>
    Number.parseFloat(getComputedStyle(input).fontSize)
  );
  expect(fontSize).toBeGreaterThanOrEqual(16);

  await expect(page.getByText(/don(?:'|’)t have an account/i)).toHaveCount(1);
});

for (const viewport of [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
]) {
  test(`rotated phone keeps sign-in focused at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });

    const heading = page.getByRole('heading', { name: /welcome back/i });
    await expect(heading).toBeVisible();
    await expect(heading).toBeInViewport();
    await expect(page.getByText('Recent Creation')).toBeHidden();
    await expectNoHorizontalScroll(page);
  });
}

test('mobile sign-up presents one focused account task', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });

  const heading = page.getByRole('heading', { name: /join the jam/i });
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
  await expect(page.getByText('Recent Creation')).toBeHidden();
  await expectNoHorizontalScroll(page);
  await expect(page.getByText(/already have an account/i)).toHaveCount(1);
});
