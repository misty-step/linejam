import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { isSentryEnabled } from '../../lib/errorCore';

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

test('landing salon spread offers pen name, emblems, New room and Join on phones', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Linejam');
    await expect(page.locator('html')).toHaveClass(new RegExp(colorScheme));
    await expect(page.getByRole('textbox', { name: 'Pen name' })).toBeVisible();
    const emblems = page
      .getByRole('radiogroup', { name: 'Emblem' })
      .getByRole('radio');
    await expect(emblems).toHaveCount(8);
    await expect(
      page.getByRole('button', { name: 'New room', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Room code' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Join', exact: true })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await screenshot(page, `home-320-${colorScheme}.png`);
  }
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await expect(page.getByText('Add a pen name')).toBeVisible();
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
  // The landing is React; the Rust island loads only for help. Connect the
  // detached help after the element is defined so its WASM load is in flight.
  await page.evaluate(() => customElements.whenDefined('linejam-entry'));
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

for (const [kind, asset] of [
  ['WASM', '*.wasm'],
  ['JavaScript module', 'entry.js*'],
]) {
  test(`a refused ${kind} load is visible and retry loads the real Rust view`, async ({
    page,
  }) => {
    const help = page.locator('linejam-entry[view="help"]');
    const reported: string[] = [];
    if (isSentryEnabled()) {
      // Production reporting is silent. Observe the real browser SDK's
      // transport without sending deliberate test failures to the hosted sink.
      await page.route('**/api/*/envelope/**', async (route) => {
        for (const line of (route.request().postData() || '').split('\n')) {
          try {
            if (JSON.parse(line)?.exception) reported.push('sdk-exception');
          } catch {
            // Envelope headers and payload lines are independently framed.
          }
        }
        await route.fulfill({ status: 200, body: '{}' });
      });
    } else {
      page.on('console', (message) => {
        if (message.text().includes('Rust entry view failed to load'))
          reported.push('disabled-sink-console');
      });
    }
    await page.route(`**/entry-wasm/${asset}`, (route) =>
      route.abort('failed')
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(help.getByRole('alert')).toContainText(
      'Could not load this view.'
    );
    await expect.poll(() => reported.length).toBe(1);
    await expect(page.getByRole('dialog', { name: 'How to play' })).toHaveCount(
      0
    );
    await page.unroute(`**/entry-wasm/${asset}`);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'How to play' })
    ).toBeVisible();
    await expect(help.getByRole('alert')).toHaveCount(0);
    expect(reported).toHaveLength(1);
  });
}

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
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The landing is React; the Rust island loads only for help. Connect the
  // detached help after the element is defined so its WASM load is in flight.
  await page.evaluate(() => customElements.whenDefined('linejam-entry'));
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
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.includes('/entry-wasm/'))
      )
    )
    .toBe(true);
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
