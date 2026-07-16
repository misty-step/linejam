import { expect, Locator, Page, test } from '@playwright/test';

import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import {
  attachGuestFlowRuntimeErrorLogging,
  CANONICAL_GUEST_FLOW_LINES,
  GuestFlowSession,
} from './support/guestFlow';
import { GHOSTWRITER_OVERTIME_MS } from '@/convex/lib/gameRules';

test.describe.configure({ mode: 'serial' });

test.skip(
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

type Box = { x: number; y: number; width: number; height: number };

function boxesOverlap(a: Box, b: Box) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function clippedIntersection(box: Box, clip: Box): Box | null {
  const left = Math.max(box.x, clip.x);
  const top = Math.max(box.y, clip.y);
  const right = Math.min(box.x + box.width, clip.x + clip.width);
  const bottom = Math.min(box.y + box.height, clip.y + clip.height);

  return right > left && bottom > top
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : null;
}

async function expectNoHorizontalScroll(page: Page) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

async function expectNoHorizontalOverflow(locator: Locator) {
  const geometry = await locator.evaluate((element) => {
    const containerBox = element.getBoundingClientRect();
    const offenders = Array.from(element.querySelectorAll<HTMLElement>('*'))
      .map((child) => {
        const box = child.getBoundingClientRect();
        return {
          label:
            child.dataset.testid ??
            child.getAttribute('aria-label') ??
            child.textContent?.trim().slice(0, 48) ??
            child.tagName.toLowerCase(),
          left: Math.round(box.left),
          right: Math.round(box.right),
          clientWidth: child.clientWidth,
          scrollWidth: child.scrollWidth,
        };
      })
      .filter(
        (child) =>
          child.left < containerBox.left - 1 ||
          child.right > containerBox.right + 1 ||
          child.scrollWidth > child.clientWidth + 1
      )
      .slice(0, 8);

    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      offenders,
    };
  });
  expect(
    geometry.scrollWidth,
    `horizontal overflow: ${JSON.stringify(geometry.offenders)}`
  ).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

async function expectContentFits(locator: Locator) {
  const geometry = await locator.evaluate((element) => ({
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
}

async function installSyntheticVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const nativeViewport = window.visualViewport;
    const events = new EventTarget();
    const state: { height: number | null; offsetTop: number } = {
      height: null,
      offsetTop: 0,
    };
    const viewport = {
      get width() {
        return nativeViewport?.width ?? window.innerWidth;
      },
      get height() {
        return state.height ?? nativeViewport?.height ?? window.innerHeight;
      },
      get offsetLeft() {
        return nativeViewport?.offsetLeft ?? 0;
      },
      get offsetTop() {
        return state.offsetTop;
      },
      get pageLeft() {
        return nativeViewport?.pageLeft ?? window.scrollX;
      },
      get pageTop() {
        return nativeViewport?.pageTop ?? window.scrollY;
      },
      get scale() {
        return nativeViewport?.scale ?? 1;
      },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    };

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    });
    Object.defineProperty(window, '__linejamSetVisualViewport', {
      configurable: true,
      value: (height: number | null, offsetTop = 0) => {
        state.height = height;
        state.offsetTop = offsetTop;
        events.dispatchEvent(new Event('resize'));
        events.dispatchEvent(new Event('scroll'));
      },
    });
  });
}

async function setSyntheticVisualViewport(
  page: Page,
  height: number | null,
  offsetTop = 0
) {
  await page.evaluate(
    ({ nextHeight, nextOffsetTop }) => {
      const testWindow = window as typeof window & {
        __linejamSetVisualViewport: (
          height: number | null,
          offsetTop: number
        ) => void;
      };
      testWindow.__linejamSetVisualViewport(nextHeight, nextOffsetTop);
    },
    { nextHeight: height, nextOffsetTop: offsetTop }
  );
  const expected = await page.evaluate(() => ({
    height: `${Math.round(window.visualViewport?.height ?? window.innerHeight)}px`,
    offsetTop: `${Math.round(window.visualViewport?.offsetTop ?? 0)}px`,
  }));
  await expect
    .poll(() =>
      page.evaluate(() => ({
        height: document.documentElement.style.getPropertyValue(
          '--lj-visual-viewport-height'
        ),
        offsetTop: document.documentElement.style.getPropertyValue(
          '--lj-visual-viewport-offset-top'
        ),
      }))
    )
    .toEqual(expected);
}

async function expectInitiallyInsideVisualViewport(
  page: Page,
  locator: Locator
) {
  await expect(locator).toBeVisible();

  const [box, viewport, ancestors] = await Promise.all([
    locator.boundingBox(),
    page.evaluate(() => {
      const visualViewport = window.visualViewport;
      return {
        left: visualViewport?.offsetLeft ?? 0,
        top: visualViewport?.offsetTop ?? 0,
        width: visualViewport?.width ?? window.innerWidth,
        height: visualViewport?.height ?? window.innerHeight,
      };
    }),
    locator.evaluate((element) => {
      const layout: Array<Record<string, string | number>> = [];
      let current: Element | null = element;

      while (current && layout.length < 7) {
        const rect = current.getBoundingClientRect();
        const style = window.getComputedStyle(current);
        layout.push({
          element:
            current.getAttribute('data-testid') ??
            current.getAttribute('aria-label') ??
            current.tagName.toLowerCase(),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
          position: style.position,
          overflowY: style.overflowY,
          flex: style.flex,
          minHeight: style.minHeight,
        });
        current = current.parentElement;
      }

      return layout;
    }),
  ]);
  const message = `visual viewport geometry: ${JSON.stringify({ box, viewport, ancestors })}`;

  expect(box, message).not.toBeNull();
  expect(box!.x, message).toBeGreaterThanOrEqual(viewport.left - 1);
  expect(box!.x + box!.width, message).toBeLessThanOrEqual(
    viewport.left + viewport.width + 1
  );
  expect(box!.y, message).toBeGreaterThanOrEqual(viewport.top - 1);
  expect(box!.y + box!.height, message).toBeLessThanOrEqual(
    viewport.top + viewport.height + 1
  );
}

async function expectReachableInsideVisualViewport(
  page: Page,
  locator: Locator
) {
  await locator.scrollIntoViewIfNeeded();
  await expectInitiallyInsideVisualViewport(page, locator);
}

async function waitForStableBoundingBox(page: Page, locator: Locator) {
  let previous: string | null = null;
  let stableSamples = 0;

  await expect
    .poll(async () => {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          })
      );
      const box = await locator.boundingBox();
      const sample = box
        ? [box.x, box.y, box.width, box.height]
            .map((value) => Math.round(value * 10) / 10)
            .join(':')
        : null;
      stableSamples =
        sample !== null && sample === previous ? stableSamples + 1 : 0;
      previous = sample;
      return stableSamples >= 1;
    })
    .toBe(true);
}

async function expectSplitPaneGeometry(
  page: Page,
  scrollRegion: Locator,
  actionZone: Locator,
  primaryAction: Locator,
  content: Locator[] = []
) {
  await waitForStableBoundingBox(page, actionZone);
  await Promise.all([
    expectInitiallyInsideVisualViewport(page, actionZone),
    expectInitiallyInsideVisualViewport(page, primaryAction),
    expectContentFits(primaryAction),
    expectNoHorizontalOverflow(scrollRegion),
    expectNoHorizontalOverflow(actionZone),
    expectNoHorizontalScroll(page),
  ]);

  const [scrollBox, actionBox] = await Promise.all([
    scrollRegion.boundingBox(),
    actionZone.boundingBox(),
  ]);
  expect(scrollBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(scrollBox!.y + scrollBox!.height).toBeLessThanOrEqual(
    actionBox!.y + 1
  );
  expect(boxesOverlap(scrollBox!, actionBox!)).toBe(false);

  for (const locator of content) {
    await locator.scrollIntoViewIfNeeded();
    const [contentBox, currentScrollBox, currentActionBox] = await Promise.all([
      locator.boundingBox(),
      scrollRegion.boundingBox(),
      actionZone.boundingBox(),
    ]);
    expect(contentBox).not.toBeNull();
    expect(currentScrollBox).not.toBeNull();
    expect(currentActionBox).not.toBeNull();
    const paintedContentBox = clippedIntersection(
      contentBox!,
      currentScrollBox!
    );
    expect(paintedContentBox).not.toBeNull();
    expect(boxesOverlap(paintedContentBox!, currentActionBox!)).toBe(false);
  }
}

async function expectOwnsVisualViewport(page: Page, frame: Locator) {
  const [frameBox, visibleViewport] = await Promise.all([
    frame.boundingBox(),
    page.evaluate(() => ({
      height: Math.round(window.visualViewport?.height ?? window.innerHeight),
      offsetTop: Math.round(window.visualViewport?.offsetTop ?? 0),
    })),
  ]);
  expect(frameBox).not.toBeNull();
  expect(frameBox!.y).toBeCloseTo(visibleViewport.offsetTop, 0);
  expect(frameBox!.height).toBeCloseTo(visibleViewport.height, 0);
  expect(frameBox!.y + frameBox!.height).toBeCloseTo(
    visibleViewport.offsetTop + visibleViewport.height,
    0
  );
}

async function expectWritingGeometry(page: Page) {
  const phase = page.getByTestId(E2E_TEST_IDS.writingPhase);
  const scrollRegion = page.getByTestId(E2E_TEST_IDS.writingScrollRegion);
  const actionZone = page.getByTestId(E2E_TEST_IDS.writingActionZone);
  const input = page.getByTestId(E2E_TEST_IDS.writingLineInput);
  const slots = page.getByTestId(E2E_TEST_IDS.writingWordSlots);

  await input.focus();
  await waitForStableBoundingBox(page, actionZone);
  await expectInitiallyInsideVisualViewport(page, actionZone);
  await expectInitiallyInsideVisualViewport(
    page,
    page.getByTestId(E2E_TEST_IDS.writingSubmitLineButton)
  );
  await expectNoHorizontalScroll(page);

  await Promise.all([
    expectNoHorizontalOverflow(scrollRegion),
    expectNoHorizontalOverflow(actionZone),
  ]);

  const [scrollBox, actionBox] = await Promise.all([
    scrollRegion.boundingBox(),
    actionZone.boundingBox(),
  ]);
  expect(scrollBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(scrollBox!.y + scrollBox!.height).toBeLessThanOrEqual(
    actionBox!.y + 1
  );
  expect(boxesOverlap(scrollBox!, actionBox!)).toBe(false);

  for (const content of [input, slots]) {
    await content.scrollIntoViewIfNeeded();
    const [contentBox, currentActionBox] = await Promise.all([
      content.boundingBox(),
      actionZone.boundingBox(),
    ]);
    expect(contentBox).not.toBeNull();
    expect(currentActionBox).not.toBeNull();
    const paintedContentBox = clippedIntersection(contentBox!, scrollBox!);
    expect(paintedContentBox).not.toBeNull();
    expect(boxesOverlap(paintedContentBox!, currentActionBox!)).toBe(false);
  }

  const carriedLine = page.getByTestId(E2E_TEST_IDS.writingCarriedLine);
  if (await carriedLine.count()) {
    await carriedLine.scrollIntoViewIfNeeded();
    const [carriedBox, currentActionBox] = await Promise.all([
      carriedLine.boundingBox(),
      actionZone.boundingBox(),
    ]);
    expect(carriedBox).not.toBeNull();
    expect(currentActionBox).not.toBeNull();
    const paintedCarriedBox = clippedIntersection(carriedBox!, scrollBox!);
    expect(paintedCarriedBox).not.toBeNull();
    expect(boxesOverlap(paintedCarriedBox!, currentActionBox!)).toBe(false);
  }

  await expectOwnsVisualViewport(page, phase);
}

test('the complete mobile game holds primary actions through keyboard, rotation, and text scaling', async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const runtimeErrors: string[] = [];
  const session = await GuestFlowSession.create(browser, {
    hostName: 'Mobile Host',
    guestName: 'Mobile Guest',
    viewport: { width: 375, height: 667 },
    runtimeErrors,
  });

  try {
    await Promise.all([
      installSyntheticVisualViewport(session.hostPage),
      installSyntheticVisualViewport(session.guestPage),
    ]);
    await session.hostPage.setViewportSize({ width: 320, height: 667 });
    await session.hostPage.goto('/host', { waitUntil: 'domcontentloaded' });
    await expect(
      session.hostPage.locator('meta[name="viewport"]')
    ).toHaveAttribute(
      'content',
      /viewport-fit=cover.*interactive-widget=resizes-content/
    );
    const hostName = session.hostPage.getByTestId(E2E_TEST_IDS.hostNameInput);
    const createRoom = session.hostPage.getByTestId(
      E2E_TEST_IDS.hostCreateRoomButton
    );
    await expect(hostName).toBeVisible();
    await session.hostPage.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expectSplitPaneGeometry(
      session.hostPage,
      session.hostPage.getByTestId(E2E_TEST_IDS.hostScrollRegion),
      session.hostPage.getByTestId(E2E_TEST_IDS.hostActionZone),
      createRoom,
      [hostName]
    );
    await session.hostPage.screenshot({
      path: testInfo.outputPath('host-320x667-200-percent.png'),
    });
    await session.hostPage.evaluate(() => {
      document.documentElement.style.removeProperty('font-size');
    });

    await session.hostPage.setViewportSize({ width: 375, height: 667 });
    await session.createRoom();
    await session.hostPage.setViewportSize({ width: 320, height: 667 });
    const lobbyScrollRegion = session.hostPage.getByTestId(
      E2E_TEST_IDS.lobbyScrollRegion
    );
    const lobbyActionZone = session.hostPage.getByTestId(
      E2E_TEST_IDS.lobbyActionZone
    );
    const soloStart = session.hostPage.getByTestId(
      E2E_TEST_IDS.lobbyStartGameButton
    );
    await session.hostPage.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expectSplitPaneGeometry(
      session.hostPage,
      lobbyScrollRegion,
      lobbyActionZone,
      soloStart
    );
    await Promise.all([
      expectContentFits(
        session.hostPage.getByRole('button', { name: /Add a bot/i })
      ),
      expectContentFits(
        session.hostPage.getByTestId(E2E_TEST_IDS.lobbyPresentationButton)
      ),
    ]);
    await session.hostPage.evaluate(() => {
      document.documentElement.style.removeProperty('font-size');
    });

    await session.joinRoom();
    const start = session.hostPage.getByTestId(
      E2E_TEST_IDS.lobbyStartGameButton
    );

    await session.hostPage.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const roomChrome = session.hostPage.getByTestId('room-chrome');
    await Promise.all(
      [
        roomChrome,
        session.hostPage.getByRole('button', { name: /Share room invite/i }),
        session.hostPage.getByRole('button', { name: /More options/i }),
        start,
      ].map((locator) =>
        expectInitiallyInsideVisualViewport(session.hostPage, locator)
      )
    );
    await expectSplitPaneGeometry(
      session.hostPage,
      lobbyScrollRegion,
      lobbyActionZone,
      start,
      [session.hostPage.getByText('Share this code')]
    );

    const moreOptions = session.hostPage.getByRole('button', {
      name: /More options/i,
    });
    await moreOptions.click();
    const menuPopover = session.hostPage.locator('.lj-room-popover').filter({
      visible: true,
    });
    await expectInitiallyInsideVisualViewport(session.hostPage, menuPopover);
    await expectNoHorizontalOverflow(menuPopover);
    await session.hostPage.getByRole('button', { name: 'Theme' }).click();
    const themePopover = session.hostPage.locator('.lj-room-popover').filter({
      visible: true,
    });
    await expectInitiallyInsideVisualViewport(session.hostPage, themePopover);
    await expectNoHorizontalOverflow(themePopover);
    await session.hostPage.keyboard.press('Escape');

    await session.hostPage
      .getByRole('button', { name: /Open QR and copy options for room code/i })
      .click();
    const qrPopover = session.hostPage.locator('.lj-room-popover').filter({
      visible: true,
    });
    await expectInitiallyInsideVisualViewport(session.hostPage, qrPopover);
    await expectNoHorizontalOverflow(qrPopover);
    await session.hostPage.keyboard.press('Escape');
    await session.hostPage.screenshot({
      path: testInfo.outputPath('lobby-320x667-200-percent.png'),
    });
    await session.hostPage.evaluate(() => {
      document.documentElement.style.removeProperty('font-size');
    });

    await session.hostPage
      .getByTestId(E2E_TEST_IDS.lobbyPresentationButton)
      .click();
    await session.hostPage.setViewportSize({ width: 667, height: 375 });
    await session.hostPage.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(
      session.hostPage.getByTestId(E2E_TEST_IDS.lobbyPresentationStage)
    ).toHaveCSS('position', 'fixed');
    await expectInitiallyInsideVisualViewport(
      session.hostPage,
      session.hostPage.getByRole('button', { name: 'Exit presentation' })
    );
    await expectNoHorizontalScroll(session.hostPage);
    await session.hostPage.screenshot({
      path: testInfo.outputPath('lobby-stage-667x375-200-percent.png'),
    });
    await session.hostPage.evaluate(() => {
      document.documentElement.style.removeProperty('font-size');
    });
    await session.hostPage
      .getByRole('button', { name: 'Exit presentation' })
      .click();

    await Promise.all([
      session.hostPage.setViewportSize({ width: 320, height: 667 }),
      session.guestPage.setViewportSize({ width: 390, height: 844 }),
    ]);
    await session.startGame();
    await session.hostPage.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await Promise.all([
      expectWritingGeometry(session.hostPage),
      expectInitiallyInsideVisualViewport(
        session.hostPage,
        session.hostPage.getByTestId('room-chrome')
      ),
      expectInitiallyInsideVisualViewport(
        session.hostPage,
        session.hostPage.getByRole('button', { name: /Share room invite/i })
      ),
      expectInitiallyInsideVisualViewport(
        session.hostPage,
        session.hostPage.getByRole('button', { name: /More options/i })
      ),
    ]);
    await session.hostPage.screenshot({
      path: testInfo.outputPath('writing-320x667-200-percent.png'),
    });
    await session.hostPage.evaluate(() => {
      document.documentElement.style.removeProperty('font-size');
    });
    await session.hostPage.setViewportSize({ width: 375, height: 667 });
    await Promise.all([
      expectWritingGeometry(session.hostPage),
      expectWritingGeometry(session.guestPage),
    ]);

    for (
      let roundIndex = 0;
      roundIndex < CANONICAL_GUEST_FLOW_LINES.length;
      roundIndex += 1
    ) {
      const hostViewport =
        roundIndex % 2 === 0
          ? { width: 375, height: 667, visibleHeight: 360 }
          : { width: 390, height: 844, visibleHeight: 430 };
      const guestViewport =
        roundIndex % 2 === 0
          ? { width: 390, height: 844, visibleHeight: 430 }
          : { width: 375, height: 667, visibleHeight: 360 };
      await Promise.all([
        session.hostPage.setViewportSize(hostViewport),
        session.guestPage.setViewportSize(guestViewport),
      ]);
      await Promise.all([
        setSyntheticVisualViewport(
          session.hostPage,
          hostViewport.visibleHeight,
          roundIndex % 3 === 0 ? 20 : 0
        ),
        setSyntheticVisualViewport(
          session.guestPage,
          guestViewport.visibleHeight,
          roundIndex % 3 === 0 ? 20 : 0
        ),
      ]);

      if (roundIndex === 0) {
        await Promise.all(
          [session.hostPage, session.guestPage].map((page) =>
            page.evaluate(() => {
              document.documentElement.style.fontSize = '200%';
            })
          )
        );
      }

      await Promise.all([
        expectWritingGeometry(session.hostPage),
        expectWritingGeometry(session.guestPage),
      ]);

      if (roundIndex === 0) {
        await session.hostPage.screenshot({
          path: testInfo.outputPath(
            'writing-round-1-synthetic-visual-viewport.png'
          ),
        });
        await Promise.all(
          [session.hostPage, session.guestPage].map((page) =>
            page.evaluate(() => {
              document.documentElement.style.removeProperty('font-size');
            })
          )
        );
      }

      if (roundIndex === CANONICAL_GUEST_FLOW_LINES.length - 1) {
        await session.hostPage.setViewportSize({ width: 667, height: 375 });
        await setSyntheticVisualViewport(session.hostPage, 300, 10);
        await expectWritingGeometry(session.hostPage);
        await session.hostPage.screenshot({
          path: testInfo.outputPath('writing-final-round-landscape.png'),
        });
      }

      await session.submitCurrentLine(
        'host',
        CANONICAL_GUEST_FLOW_LINES[roundIndex]
      );
      await session.waitForWaitingState('host');
      await expectNoHorizontalScroll(session.hostPage);
      const waitingPhase = session.hostPage.getByTestId(
        E2E_TEST_IDS.waitingPhase
      );
      if (roundIndex === 0) {
        await session.hostPage.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      }
      await expectReachableInsideVisualViewport(
        session.hostPage,
        waitingPhase.getByText('Mobile Guest', { exact: true })
      );
      await expectNoHorizontalOverflow(waitingPhase);
      if (roundIndex === 0) {
        const directWaitingPage = await session.hostPage.context().newPage();
        attachGuestFlowRuntimeErrorLogging(
          directWaitingPage,
          'direct waiting reload',
          runtimeErrors
        );
        try {
          await installSyntheticVisualViewport(directWaitingPage);
          await directWaitingPage.clock.setFixedTime(
            Date.now() + GHOSTWRITER_OVERTIME_MS + 5_000
          );
          await directWaitingPage.setViewportSize({
            width: 375,
            height: 667,
          });
          await directWaitingPage.goto(`/room/${session.roomCode}`, {
            waitUntil: 'domcontentloaded',
          });
          await setSyntheticVisualViewport(directWaitingPage, 360, 20);
          await directWaitingPage.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });

          const directWaitingPhase = directWaitingPage.getByTestId(
            E2E_TEST_IDS.waitingPhase
          );
          await expect(directWaitingPhase).toBeVisible();
          await expectOwnsVisualViewport(
            directWaitingPage,
            directWaitingPhase.locator('..')
          );
          await expectNoHorizontalScroll(directWaitingPage);
          await expectNoHorizontalOverflow(directWaitingPhase);
          await expectReachableInsideVisualViewport(
            directWaitingPage,
            directWaitingPage.getByRole('button', {
              name: 'Summon the ghostwriter',
            })
          );
          await directWaitingPage.screenshot({
            path: testInfo.outputPath(
              'waiting-reload-overtime-375x667-200-percent.png'
            ),
          });
        } finally {
          await directWaitingPage.close();
        }

        await session.hostPage.screenshot({
          path: testInfo.outputPath('waiting-200-percent.png'),
        });
        await session.hostPage.evaluate(() => {
          document.documentElement.style.removeProperty('font-size');
        });
      }
      await session.submitCurrentLine(
        'guest',
        CANONICAL_GUEST_FLOW_LINES[roundIndex]
      );

      if (roundIndex < CANONICAL_GUEST_FLOW_LINES.length - 1) {
        await session.expectRound(roundIndex + 2);
      }
    }

    await Promise.all([
      session.hostPage.setViewportSize({ width: 390, height: 844 }),
      session.guestPage.setViewportSize({ width: 390, height: 844 }),
    ]);
    await Promise.all([
      setSyntheticVisualViewport(session.hostPage, null),
      setSyntheticVisualViewport(session.guestPage, null),
    ]);
    await session.expectReadingPhase();
    for (const [pageIndex, page] of [
      session.hostPage,
      session.guestPage,
    ].entries()) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      const revealAction = page
        .getByTestId(E2E_TEST_IDS.revealPoemButton)
        .first();
      await expectInitiallyInsideVisualViewport(page, revealAction);
      await expectNoHorizontalScroll(page);
      const revealPhase = page.getByTestId(E2E_TEST_IDS.revealPhase);
      await expectNoHorizontalOverflow(revealPhase);
      await expectOwnsVisualViewport(page, revealPhase.locator('..'));
      if (pageIndex === 0) {
        await page.screenshot({
          path: testInfo.outputPath('reveal-390x844-200-percent.png'),
        });
      }
      await page.evaluate(() => {
        document.documentElement.style.removeProperty('font-size');
      });
    }
    await session.hostPage
      .getByTestId(E2E_TEST_IDS.revealPresentationButton)
      .click();
    await session.hostPage.setViewportSize({ width: 844, height: 390 });
    await session.hostPage.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(
      session.hostPage.getByTestId(E2E_TEST_IDS.revealPresentationStage)
    ).toHaveCSS('position', 'fixed');
    await expectInitiallyInsideVisualViewport(
      session.hostPage,
      session.hostPage.getByRole('button', { name: 'Exit presentation' })
    );
    await expectReachableInsideVisualViewport(
      session.hostPage,
      session.hostPage.getByRole('button', {
        name: /Reveal on stage|Step in on stage|Read on stage/,
      })
    );
    await expectNoHorizontalScroll(session.hostPage);
    await session.hostPage.screenshot({
      path: testInfo.outputPath('reveal-stage-844x390-200-percent.png'),
    });
    await session.hostPage.evaluate(() => {
      document.documentElement.style.removeProperty('font-size');
    });
    await session.hostPage
      .getByRole('button', { name: 'Exit presentation' })
      .click();

    await session.hostPage.setViewportSize({ width: 390, height: 844 });
    await session.hostPage
      .getByTestId(E2E_TEST_IDS.revealPoemButton)
      .first()
      .click();
    const poemDone = session.hostPage.getByTestId(E2E_TEST_IDS.poemDoneButton);
    await expect(poemDone).toBeVisible({ timeout: 15_000 });
    await expect(
      session.hostPage.locator('.lj-game-frame.lj-viewport-offset.fixed')
    ).toHaveCSS('position', 'fixed');
    await expectReachableInsideVisualViewport(session.hostPage, poemDone);
    await expectNoHorizontalScroll(session.hostPage);
    await session.hostPage.screenshot({
      path: testInfo.outputPath('poem-display-390x844.png'),
    });

    expect(runtimeErrors).toEqual([]);
  } finally {
    await session.close();
  }
});
