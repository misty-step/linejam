import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  GuestFlowSession,
  closeHostedRoom,
  isolateGuestSessionIp,
} from './support/guestFlow';
import { AVATAR_NAMES } from '../../lib/avatars';

async function screenshot(page: Page, name: string) {
  const directory = path.join(
    process.env.LINEJAM_LOCAL_ARTIFACTS || '.qa/worker',
    'qa/join-ui'
  );
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, name), fullPage: true });
}

test.beforeEach(async ({ context }) => {
  await isolateGuestSessionIp(context);
});

test('Rust join normalizes invitations, preserves rejection details, then joins and refreshes one seat', async ({
  browser,
}) => {
  const session = await GuestFlowSession.create(browser, {
    hostName: 'Join host',
    guestName: 'Ada',
  });
  try {
    await session.createRoom();
    const page = session.guestPage;
    const releaseJoin = Promise.withResolvers<void>();
    let pauseJoin = false;
    let pendingRequests = 0;
    await page.routeWebSocket('**/api/*/sync', (socket) => {
      const server = socket.connectToServer();
      socket.onMessage((message) => {
        const frame = JSON.parse(String(message));
        if (
          pauseJoin &&
          frame.type === 'Mutation' &&
          frame.udfPath === 'rooms:joinRoom'
        ) {
          pendingRequests += 1;
          void releaseJoin.promise.then(() => server.send(message));
        } else server.send(message);
      });
    });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.addInitScript(() => {
      Math.random = () => 0.99;
    });
    // Invalid five-character input is normalized, never put in a request as-is.
    await page.goto('/join?code=z-z zZextra&name=MustNotPrefill');
    const code = page.getByRole('textbox', { name: 'Room code' });
    const name = page.getByRole('textbox', { name: 'Your pen name' });
    const submit = page.getByRole('button', { name: 'Join room', exact: true });
    const avatar = page.getByRole('button', { name: /^Change avatar,/ });
    await expect(code).toHaveValue('ZZZZ');
    await expect(code).toHaveAttribute('autocorrect', 'off');
    await expect(name).toHaveValue('');
    await expect(name).toBeFocused();
    await expect(avatar).toHaveAccessibleName(/Ode selected/);
    await code.fill('---!');
    await expect(code).toHaveValue('');
    await name.fill('Ada');
    await expect(submit).toBeDisabled();
    await code.fill('z-z zZextra');
    await expect(code).toHaveValue('ZZZZ');
    await code.press('Enter');
    await expect(name).toBeFocused();
    await name.fill('   ');
    await expect(submit).toBeDisabled();
    await name.fill('  Ada  ');
    await avatar.click();
    await page.getByRole('button', { name: 'Doodle', exact: true }).click();
    await submit.click();
    await expect(page.getByTestId('join-error-alert')).toContainText(
      'Room code not found. Please check the code and try again.'
    );
    await expect(page).toHaveURL(/\/join\?/);
    await expect(code).toHaveValue('ZZZZ');
    await expect(name).toHaveValue('  Ada  ');
    await expect(avatar).toHaveAccessibleName(/Doodle selected/);
    await expect(submit).toBeEnabled();
    await screenshot(page, 'join-refusal.png');
    await code.fill(session.roomCode.toLowerCase());
    pauseJoin = true;
    await submit.click();
    await expect(
      page.getByRole('button', { name: 'Joining room…' })
    ).toBeDisabled();
    await expect(code).toBeDisabled();
    await expect(name).toBeDisabled();
    await expect(avatar).toBeDisabled();
    await page.getByRole('form', { name: 'Join room' }).evaluate((form) => {
      if (!(form instanceof HTMLFormElement))
        throw new Error('Missing join form');
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect.poll(() => pendingRequests).toBe(1);
    await screenshot(page, 'join-pending.png');
    releaseJoin.resolve();
    await session.expectJoinedLobby();
    await page.reload();
    await session.expectJoinedLobby();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Ada' })
    ).toHaveCount(1);
    await closeHostedRoom(session.hostPage, session.roomCode);
  } finally {
    await session.close();
  }
});

for (const route of ['/join?code=ABCD', '/host']) {
  test(`the shared Rust picker preserves keyboard, dismissal, canonical art and choice on ${route}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(route);
    const trigger = page.getByRole('button', { name: /^Change avatar,/ });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Choose your avatar' });
    const cast = dialog.getByRole('group');
    for (const name of Object.values(AVATAR_NAMES)) {
      const choice = cast.getByRole('button', { name, exact: true });
      await expect(choice.locator('svg')).toHaveAttribute('width', '44');
    }
    await expect(cast.locator('[aria-pressed=true]')).toBeFocused();
    await page.getByRole('button', { name: 'Doodle', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAccessibleName(/Doodle selected/);
    for (const action of ['escape', 'close', 'outside'] as const) {
      await trigger.click();
      await expect(
        page.getByRole('button', { name: 'Doodle', exact: true })
      ).toBeFocused();
      const close = page.getByRole('button', { name: 'Close avatar picker' });
      const last = page.getByRole('button', { name: 'Ode', exact: true });
      await close.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(last).toBeFocused();
      await page.keyboard.press('Tab');
      // Native modal focus containment can include the dialog itself between
      // endpoints; another Tab must stay inside and reach its first control.
      if (!(await close.evaluate((el) => el === document.activeElement)))
        await page.keyboard.press('Tab');
      await expect(close).toBeFocused();
      if (action === 'escape') await page.keyboard.press('Escape');
      else if (action === 'close') await close.click();
      else
        await dialog
          .locator(':scope > div')
          .click({ position: { x: 1, y: 1 } });
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAccessibleName(/Doodle selected/);
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
        'hidden'
      );
    }
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.evaluate(() => {
      const entry = document.querySelector(
        'linejam-entry[view="avatar-picker"], linejam-entry[view="join"]'
      )!;
      if (entry.getAttribute('view') === 'join')
        entry.setAttribute('ready', 'false');
      else entry.setAttribute('disabled', '');
    });
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeDisabled();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .not.toBe('hidden');
    await page.evaluate(() => {
      const entry = document.querySelector(
        'linejam-entry[view="avatar-picker"], linejam-entry[view="join"]'
      )!;
      entry.setAttribute('ready', 'true');
      entry.removeAttribute('disabled');
    });
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.evaluate(() =>
      document
        .querySelector(
          'linejam-entry[view="avatar-picker"], linejam-entry[view="join"]'
        )
        ?.remove()
    );
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      'hidden'
    );
    expect(errors).toEqual([]);
  });
}

test('guest-session delay does not steal toolbar focus and a refused session offers real retry', async ({
  page,
}) => {
  const release = Promise.withResolvers<void>();
  let requests = 0;
  await page.route('**/api/guest/session*', async (route) => {
    requests += 1;
    if (requests === 1) {
      await release.promise;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{}',
      });
    } else await route.continue();
  });
  await page.goto('/join?code=ABCD');
  const appearance = page.getByRole('button', { name: /^Color mode:/ });
  await appearance.focus();
  release.resolve();
  await expect(
    page.getByRole('alert').filter({ hasText: /unable to connect/i })
  ).toBeVisible();
  await expect(page.getByRole('form', { name: 'Join room' })).toBeHidden();
  await screenshot(page, 'join-session-recovery.png');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await appearance.focus();
  await expect(
    page.getByRole('textbox', { name: 'Your pen name' })
  ).toBeVisible();
  await expect(appearance).toBeFocused();
  expect(requests).toBe(2);
});

test('an unexpected admission-boundary rejection restores the real Rust form without exposing its cause', async ({
  page,
}) => {
  await page.goto('/join?code=ABCD');
  await page.getByRole('textbox', { name: 'Your pen name' }).fill('Ada');
  await page.evaluate(() => {
    document.querySelector('linejam-entry[view="join"]')!.addEventListener(
      'entry-submit',
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!(event instanceof CustomEvent))
          throw new Error('Missing admission event');
        event.detail.reject(new Error('private-sink-canary'));
      },
      { once: true }
    );
  });
  const submit = page.getByRole('button', { name: 'Join room', exact: true });
  await submit.click();
  const alert = page.getByTestId('join-error-alert');
  await expect(alert).toContainText(/try again.*refresh/i);
  await expect(alert).not.toContainText('private-sink-canary');
  await expect(submit).toBeEnabled();
  await expect(
    page.getByRole('textbox', { name: 'Your pen name' })
  ).toHaveValue('Ada');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Rust join stays reachable at phone, keyboard and 200% text sizes in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 360 },
      { width: 740, height: 320 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/join?code=ABCD');
      const action = page.getByRole('button', {
        name: 'Join room',
        exact: true,
      });
      await expect(
        page.getByRole('textbox', { name: 'Your pen name' })
      ).toBeVisible();
      await screenshot(
        page,
        `join-${colorScheme}-${viewport.width}x${viewport.height}.png`
      );
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true);
      await screenshot(
        page,
        `join-${colorScheme}-${viewport.width}x${viewport.height}-text200.png`
      );
      await page.getByRole('button', { name: /^Change avatar,/ }).click();
      const picker = page.getByRole('dialog', { name: 'Choose your avatar' });
      await expect(picker).toBeVisible();
      await picker
        .getByRole('button', { name: 'Ode', exact: true })
        .scrollIntoViewIfNeeded();
      await screenshot(
        page,
        `picker-${colorScheme}-${viewport.width}x${viewport.height}-text200.png`
      );
      await picker.getByRole('button', { name: 'Ode', exact: true }).click();
      await expect(picker).toBeHidden();
    }
  });
}
