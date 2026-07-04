import { expect } from '@playwright/test';
import type {
  Browser,
  BrowserContext,
  Locator,
  Page,
  Video,
  ViewportSize,
} from '@playwright/test';
import { WORD_COUNTS } from '@/convex/lib/gameRules';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';

export const CANONICAL_GUEST_FLOW_LINES = [
  'poetry',
  'two words',
  'just three words',
  'this has four words',
  'this line has five words',
  'back to four now',
  'only three again',
  'two more',
  'end',
] as const;

export const TOTAL_ROUNDS = WORD_COUNTS.length;

if (CANONICAL_GUEST_FLOW_LINES.length !== TOTAL_ROUNDS) {
  throw new Error(
    `Canonical guest flow expects ${TOTAL_ROUNDS} rounds, received ${CANONICAL_GUEST_FLOW_LINES.length}.`
  );
}

export const GUEST_FLOW_EVIDENCE_FILES = {
  hostLobby: '01-host-lobby.png',
  helpModal: '02-help-modal.png',
  themeHyperLobby: '03-theme-hyper-lobby.png',
  twoPlayerLobby: '04-two-player-lobby.png',
  writingValid: '05-writing-valid.png',
  waiting: '06-waiting.png',
  reveal: '07-reveal.png',
  sessionComplete: '08-session-complete.png',
} as const;

type Actor = 'host' | 'guest';

const DEFAULT_VIEWPORT: ViewportSize = {
  width: 1440,
  height: 960,
};

type GuestFlowSessionOptions = {
  guestName?: string;
  hostName?: string;
  recordHostVideoDir?: string;
  runtimeErrors?: string[];
  viewport?: ViewportSize;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

async function closeContexts(
  ...contexts: Array<BrowserContext | null | undefined>
) {
  const results = await Promise.allSettled(
    contexts
      .filter((context): context is BrowserContext => context != null)
      .map((context) => context.close())
  );

  return results.flatMap((result) =>
    result.status === 'rejected' ? [toError(result.reason)] : []
  );
}

async function ensureVisible(locator: Locator, label: string) {
  try {
    await locator.waitFor({ state: 'visible', timeout: 30000 });
  } catch (error) {
    throw new Error(
      `Expected visible: ${label}${error instanceof Error ? ` (${error.message})` : ''}`
    );
  }
}

async function waitForRoomPath(page: Page, label: string, roomCode?: string) {
  const pathPattern = roomCode
    ? new RegExp(`/room/${escapeRegex(roomCode)}$`)
    : /\/room\/[A-Z]{4}$/;

  await page.waitForURL(pathPattern, { timeout: 30000 });

  if (!pathPattern.test(new URL(page.url()).pathname)) {
    throw new Error(`Unexpected URL for ${label}: ${page.url()}`);
  }
}

function visibleTestId(page: Page, testId: string) {
  return page.getByTestId(testId).filter({ visible: true });
}

export function attachGuestFlowRuntimeErrorLogging(
  page: Page,
  label: string,
  runtimeErrors: string[]
) {
  page.on('pageerror', (error) => {
    runtimeErrors.push(`[${label}] pageerror: ${error.message}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      if (
        isIgnoredRuntimeUrl(msg.location().url) ||
        isIgnoredConsoleError(msg.text())
      ) {
        return;
      }

      runtimeErrors.push(`[${label}] console: ${msg.text()}`);
    }
  });

  page.on('requestfailed', (request) => {
    if (
      isIgnoredFailedRequest(
        request.method(),
        request.url(),
        request.failure()?.errorText
      )
    ) {
      return;
    }

    runtimeErrors.push(
      `[${label}] requestfailed: ${request.method()} ${request.url()} ${
        request.failure()?.errorText || ''
      }`.trim()
    );
  });

  page.on('response', (response) => {
    if (isIgnoredRuntimeUrl(response.url())) {
      return;
    }

    if (response.status() >= 400) {
      const request = response.request();
      runtimeErrors.push(
        `[${label}] response: ${response.status()} ${request.method()} ${response.url()}`
      );
    }
  });
}

function isIgnoredFailedRequest(
  method: string,
  requestUrl: string,
  errorText = ''
) {
  if (isIgnoredRuntimeUrl(requestUrl)) {
    return true;
  }

  if (method === 'GET' && errorText === 'net::ERR_ABORTED') {
    return hasSearchParam(requestUrl, '_rsc');
  }

  return false;
}

function isIgnoredRuntimeUrl(requestUrl: string) {
  try {
    const url = new URL(requestUrl);
    return (
      url.pathname === '/_vercel/insights/script.js' ||
      url.pathname === '/_vercel/speed-insights/script.js'
    );
  } catch {
    return false;
  }
}

function isIgnoredConsoleError(text: string) {
  const scriptUrl =
    /Refused to execute script from '([^']+)' because its MIME type \('text\/html'\) is not executable/.exec(
      text
    )?.[1];

  return scriptUrl ? isIgnoredRuntimeUrl(scriptUrl) : false;
}

function hasSearchParam(requestUrl: string, param: string) {
  try {
    return new URL(requestUrl).searchParams.has(param);
  } catch {
    return false;
  }
}

export class GuestFlowSession {
  readonly guestContext: BrowserContext;
  readonly guestName: string;
  readonly guestPage: Page;
  readonly hostContext: BrowserContext;
  readonly hostName: string;
  readonly hostPage: Page;

  roomCode = '';

  private readonly hostVideo: Video | null;
  private readonly runtimeErrors: string[];

  private constructor({
    guestContext,
    guestName,
    guestPage,
    hostContext,
    hostName,
    hostPage,
    runtimeErrors,
  }: {
    guestContext: BrowserContext;
    guestName: string;
    guestPage: Page;
    hostContext: BrowserContext;
    hostName: string;
    hostPage: Page;
    runtimeErrors: string[];
  }) {
    this.guestContext = guestContext;
    this.guestName = guestName;
    this.guestPage = guestPage;
    this.hostContext = hostContext;
    this.hostName = hostName;
    this.hostPage = hostPage;
    this.hostVideo = hostPage.video();
    this.runtimeErrors = runtimeErrors;

    this.attachRuntimeErrorLogging();
  }

  static async create(browser: Browser, options: GuestFlowSessionOptions = {}) {
    const viewport = options.viewport ?? DEFAULT_VIEWPORT;
    let hostContext: BrowserContext | null = null;
    let guestContext: BrowserContext | null = null;

    try {
      hostContext = await browser.newContext({
        viewport,
        ...(options.recordHostVideoDir
          ? {
              recordVideo: {
                dir: options.recordHostVideoDir,
                size: viewport,
              },
            }
          : {}),
      });
      guestContext = await browser.newContext({ viewport });

      const [hostPage, guestPage] = await Promise.all([
        hostContext.newPage(),
        guestContext.newPage(),
      ]);
      const timestamp = Math.floor(Date.now() / 1000);

      return new GuestFlowSession({
        guestContext,
        guestName: options.guestName ?? `Guest ${timestamp}`,
        guestPage,
        hostContext,
        hostName: options.hostName ?? `Host ${timestamp}`,
        hostPage,
        runtimeErrors: options.runtimeErrors ?? [],
      });
    } catch (error) {
      const setupError = toError(error);
      const closeErrors = await closeContexts(guestContext, hostContext);

      if (closeErrors.length > 0) {
        throw new AggregateError(
          [setupError, ...closeErrors],
          'GuestFlowSession.create failed'
        );
      }

      throw setupError;
    }
  }

  get recordedHostVideo() {
    return this.hostVideo;
  }

  mirrorConsole(actor: Actor) {
    this.page(actor).on('console', (msg) => {
      console.log(`[Browser Console][${actor}] ${msg.type()}: ${msg.text()}`);
    });
  }

  async close() {
    const closeErrors = await closeContexts(
      this.guestContext,
      this.hostContext
    );

    if (closeErrors.length === 1) {
      throw closeErrors[0];
    }

    if (closeErrors.length > 1) {
      throw new AggregateError(
        closeErrors,
        'Failed to close guest flow session'
      );
    }
  }

  async createRoom() {
    await this.hostPage.goto('/host');
    await ensureVisible(
      this.hostPage.getByTestId(E2E_TEST_IDS.hostNameInput),
      'host name input'
    );
    await this.hostPage
      .getByTestId(E2E_TEST_IDS.hostNameInput)
      .fill(this.hostName);
    await this.hostPage.getByTestId(E2E_TEST_IDS.hostCreateRoomButton).click();
    await waitForRoomPath(this.hostPage, 'host room');

    const roomCode =
      new URL(this.hostPage.url()).pathname
        .replace(/\/+$/, '')
        .split('/')
        .pop() ?? '';
    if (!/^[A-Z]{4}$/.test(roomCode)) {
      throw new Error(`Unexpected room code: ${roomCode}`);
    }

    this.roomCode = roomCode;
    await this.expectHostLobby();

    return roomCode;
  }

  async expectHostLobby() {
    await expect(this.playerName(this.hostPage, this.hostName)).toBeVisible();
    await expect(
      visibleTestId(this.hostPage, E2E_TEST_IDS.lobbyStartGameButton)
    ).toBeVisible();
  }

  async openHelpModal() {
    // Help / Theme / archive now live behind the overflow ("More options") menu.
    await this.hostPage.getByRole('button', { name: /More options/i }).click();
    await this.hostPage
      .getByRole('button', { name: /How to play/i })
      .last()
      .click();
    await ensureVisible(
      this.hostPage.getByRole('heading', { name: /How to Play/i }),
      'help modal'
    );
  }

  async closeHelpModal() {
    await this.hostPage.getByRole('button', { name: /Got it/i }).click();
  }

  async chooseHyperTheme() {
    await this.hostPage.getByRole('button', { name: /More options/i }).click();
    await this.hostPage.getByRole('button', { name: /^Theme$/i }).click();
    await this.hostPage
      .getByRole('radio', { name: /Hyper theme: Digital chaos & brutalism/i })
      .click();
    await this.hostPage.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') === 'hyper'
    );
    await this.hostPage.keyboard.press('Escape');
  }

  async joinRoom() {
    if (!this.roomCode) {
      throw new Error('Create the room before joining it.');
    }

    await this.guestPage.goto(`/join?code=${this.roomCode}`);
    await ensureVisible(
      this.guestPage.getByTestId(E2E_TEST_IDS.joinNameInput),
      'guest name input'
    );
    await this.guestPage
      .getByTestId(E2E_TEST_IDS.joinNameInput)
      .fill(this.guestName);
    await this.guestPage.getByTestId(E2E_TEST_IDS.joinRoomButton).click();
    await waitForRoomPath(this.guestPage, 'guest room', this.roomCode);
    await this.expectJoinedLobby();
  }

  async expectJoinedLobby() {
    await expect(this.playerName(this.guestPage, this.guestName)).toBeVisible();
    await expect(this.playerName(this.guestPage, this.hostName)).toBeVisible();
    await expect(this.playerName(this.hostPage, this.guestName)).toBeVisible({
      timeout: 10000,
    });
    await expect(
      visibleTestId(this.hostPage, E2E_TEST_IDS.lobbyStartGameButton)
    ).toBeEnabled();
    await expect(
      visibleTestId(this.guestPage, E2E_TEST_IDS.lobbyWaitingForHostButton)
    ).toBeVisible();
  }

  async startGame() {
    await visibleTestId(
      this.hostPage,
      E2E_TEST_IDS.lobbyStartGameButton
    ).click();
    await this.expectRound(1);
    await this.expectWritingUi();
  }

  async expectRound(round: number) {
    await expect(
      this.hostPage.getByTestId(E2E_TEST_IDS.writingPhase)
    ).toHaveAttribute('data-round', String(round), { timeout: 15000 });
    await expect(
      this.guestPage.getByTestId(E2E_TEST_IDS.writingPhase)
    ).toHaveAttribute('data-round', String(round), { timeout: 15000 });
  }

  async expectWritingUi() {
    await expect(
      this.hostPage.getByTestId(E2E_TEST_IDS.writingLineInput)
    ).toBeVisible();
    await expect(
      this.guestPage.getByTestId(E2E_TEST_IDS.writingLineInput)
    ).toBeVisible();
    await this.expectWordSlotsVisible('host');
    await this.expectWordSlotsVisible('guest');
  }

  async expectWordSlotsVisible(actor: Actor) {
    await expect(
      this.page(actor).getByTestId(E2E_TEST_IDS.writingWordSlots)
    ).toBeVisible();
  }

  async fillCurrentLine(actor: Actor, line: string) {
    await this.page(actor)
      .getByTestId(E2E_TEST_IDS.writingLineInput)
      .fill(line);
  }

  async expectSealDisabled(actor: Actor) {
    await expect(
      this.page(actor).getByTestId(E2E_TEST_IDS.writingSubmitLineButton)
    ).toBeDisabled();
  }

  async expectSealEnabled(actor: Actor) {
    await expect(
      this.page(actor).getByTestId(E2E_TEST_IDS.writingSubmitLineButton)
    ).toBeEnabled();
  }

  async verifyRoundOneValidation(
    actor: Actor = 'host',
    options: { invalidLine?: string; validLine?: string } = {}
  ) {
    const invalidLine = options.invalidLine ?? 'two words';
    const validLine = options.validLine ?? CANONICAL_GUEST_FLOW_LINES[0];

    await this.expectSealDisabled(actor);
    await this.fillCurrentLine(actor, invalidLine);
    await this.expectSealDisabled(actor);
    await this.fillCurrentLine(actor, validLine);
    await this.expectSealEnabled(actor);
  }

  async submitCurrentLine(actor: Actor, line: string) {
    await this.fillCurrentLine(actor, line);
    await this.page(actor)
      .getByTestId(E2E_TEST_IDS.writingSubmitLineButton)
      .click();
  }

  async waitForWaitingState(actor: Actor) {
    await expect(
      this.page(actor).getByTestId(E2E_TEST_IDS.waitingPhase)
    ).toBeVisible({ timeout: 15000 });
  }

  async playCanonicalGame(
    lines: readonly string[] = CANONICAL_GUEST_FLOW_LINES,
    options: { onHostWaiting?: (roundIndex: number) => Promise<void> } = {}
  ) {
    if (lines.length !== TOTAL_ROUNDS) {
      throw new Error(
        `Expected ${TOTAL_ROUNDS} lines for the canonical flow, received ${lines.length}.`
      );
    }

    for (let roundIndex = 0; roundIndex < lines.length; roundIndex += 1) {
      await this.submitCurrentLine('host', lines[roundIndex]);
      await this.waitForWaitingState('host');

      if (options.onHostWaiting) {
        await options.onHostWaiting(roundIndex);
      }

      await this.submitCurrentLine('guest', lines[roundIndex]);

      if (roundIndex < lines.length - 1) {
        await this.expectRound(roundIndex + 2);
      }
    }

    await this.expectReadingPhase();
  }

  async expectReadingPhase() {
    await expect(
      this.hostPage.getByTestId(E2E_TEST_IDS.revealPhase)
    ).toBeVisible({ timeout: 30000 });
    await expect(
      this.guestPage.getByTestId(E2E_TEST_IDS.revealPhase)
    ).toBeVisible({ timeout: 30000 });
    await expect(
      this.hostPage.getByTestId(E2E_TEST_IDS.revealPoemButton).first()
    ).toBeVisible();
    await expect(
      this.guestPage.getByTestId(E2E_TEST_IDS.revealPoemButton).first()
    ).toBeVisible();
  }

  async revealAssignedPoem(
    actor: Actor,
    lines: readonly string[] = CANONICAL_GUEST_FLOW_LINES
  ) {
    const page = this.page(actor);

    await page.getByTestId(E2E_TEST_IDS.revealPoemButton).first().click();
    await expect(page.getByText(lines[0])).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(lines.at(-1) ?? '')).toBeVisible({
      timeout: 12000,
    });
    await page.getByTestId(E2E_TEST_IDS.poemDoneButton).click();
  }

  async revealAllPoems(lines: readonly string[] = CANONICAL_GUEST_FLOW_LINES) {
    await this.revealAssignedPoem('host', lines);
    await this.revealAssignedPoem('guest', lines);
    await this.expectSessionComplete();
  }

  async expectSessionComplete() {
    await expect(
      this.hostPage.getByTestId(E2E_TEST_IDS.sessionComplete)
    ).toBeVisible({ timeout: 15000 });
    await expect(
      this.guestPage.getByTestId(E2E_TEST_IDS.sessionComplete)
    ).toBeVisible({ timeout: 15000 });
  }

  async capture(actor: Actor, path: string) {
    await this.page(actor).screenshot({ path, fullPage: true });
    return path;
  }

  private attachRuntimeErrorLogging() {
    attachGuestFlowRuntimeErrorLogging(
      this.hostPage,
      'host',
      this.runtimeErrors
    );
    attachGuestFlowRuntimeErrorLogging(
      this.guestPage,
      'guest',
      this.runtimeErrors
    );
  }

  private page(actor: Actor) {
    return actor === 'host' ? this.hostPage : this.guestPage;
  }

  private playerName(page: Page, name: string) {
    return page.getByText(new RegExp(`^${escapeRegex(name)}$`));
  }
}
