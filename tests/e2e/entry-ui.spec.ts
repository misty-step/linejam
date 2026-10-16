import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

async function openHelp(page: Page) {
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
}

async function screenshot(page: Page, name: string) {
  const directory = path.join(
    process.env.LINEJAM_LOCAL_ARTIFACTS || '.qa/worker',
    'qa/entry-ui'
  );
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, name), fullPage: true });
}

test('Rust home retains canonical copy, artwork, links and phone themes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'A little room for words.'
    );
    await expect(
      page.getByText('A poetry game for people who don’t have to be poets.')
    ).toBeVisible();
    await expect(page.locator('html')).toHaveClass(new RegExp(colorScheme));
    const play = page.getByRole('navigation', { name: 'Play Linejam' });
    await expect(
      play.getByRole('link', { name: 'Start a game' })
    ).toHaveAttribute('href', '/host');
    await expect(
      play.getByRole('link', { name: 'Join a room' })
    ).toHaveAttribute('href', '/join');
    const avatars = page.locator('linejam-entry[view="home"] svg');
    await expect(avatars).toHaveCount(4);
    for (const avatar of await avatars.all()) {
      await expect(avatar).toHaveAttribute('width', '56');
      await expect(avatar).toHaveAttribute('height', '56');
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await screenshot(page, `home-320-${colorScheme}.png`);
  }
  await page.getByRole('link', { name: 'Start a game' }).click();
  await expect(page.getByRole('textbox', { name: /pen name/i })).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: 'Join a room', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Room code' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Rust help traps focus, closes by every action and restores scroll and opener', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => {
    document.body.style.overflow = 'clip';
    document.documentElement.style.fontSize = '125%';
  });
  const opener = page.getByRole('button', { name: 'More options' });
  for (const action of ['escape', 'close', 'confirm', 'backdrop'] as const) {
    await openHelp(page);
    const close = page.getByRole('button', { name: 'Close help' });
    const confirm = page.getByRole('button', { name: 'Got it' });
    await expect(close).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      'hidden'
    );
    await page.keyboard.press('Tab');
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(confirm).toBeFocused();
    await page.getByRole('heading', { name: 'Write a line' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByLabel('Words per round: 1, 2, 3, 4, 5, 4, 3, 2, 1')
    ).toBeVisible();
    if (action === 'escape') {
      await screenshot(page, 'help-keyboard.png');
      await page.keyboard.press('Escape');
    } else if (action === 'close') await close.click();
    else if (action === 'confirm') await confirm.click();
    else
      await page.getByRole('presentation').click({ position: { x: 2, y: 2 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      'clip'
    );
  }
  expect(errors).toEqual([]);
});

test('a refused WASM load is visible and retry loads the real Rust view', async ({
  page,
}) => {
  const home = page.locator('linejam-entry[view="home"]');
  const reported: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Rust entry view failed to load'))
      reported.push(message.text());
  });
  await page.route('**/entry-wasm/*.wasm', (route) => route.abort('failed'));
  await page.goto('/');
  await expect(home.getByRole('alert')).toContainText(
    'Could not load this view.'
  );
  expect(reported).toHaveLength(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  await page.unroute('**/entry-wasm/*.wasm');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A little room for words.'
  );
  await expect(home.getByRole('alert')).toHaveCount(0);
});

test('a delayed detached help cannot lock the page; reattachment and disposal recover', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const release = Promise.withResolvers<void>();
  await page.route('**/entry-wasm/*.wasm', async (route) => {
    await release.promise;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('linejam-entry[view="home"]')).toContainText(
    'Loading'
  );
  await page.evaluate(() => {
    const element = document.createElement('linejam-entry');
    element.id = 'delayed-help';
    element.setAttribute('view', 'help');
    document.body.append(element);
    element.remove();
    const holder = document.createElement('template');
    holder.id = 'help-holder';
    holder.content.append(element);
    document.body.append(holder);
  });
  release.resolve();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    'hidden'
  );
  await page.getByRole('button', { name: 'More options' }).focus();
  await page.evaluate(() => {
    const holder = document.getElementById('help-holder');
    if (!(holder instanceof HTMLTemplateElement))
      throw new Error('Missing detached help');
    document.body.append(holder.content);
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close help' })).toBeFocused();
  await page.evaluate(() => {
    const element = document.getElementById('delayed-help')!;
    element.addEventListener('entry-close', () => element.remove(), {
      once: true,
    });
  });
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'More options' })
  ).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    'hidden'
  );
  expect(errors).toEqual([]);
});
