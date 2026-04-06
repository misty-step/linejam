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
    ? new RegExp(`/room/${roomCode}$`)
    : /\/room\/[A-Z]{4}$/;

  await page.waitForURL(pathPattern, { timeout: 30000 });

  if (!pathPattern.test(new URL(page.url()).pathname)) {
    throw new Error(`Unexpected URL for ${label}: ${page.url()}`);
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
    const hostContext = await browser.newContext({
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
    const guestContext = await browser.newContext({ viewport });
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
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
    await this.guestContext.close();
    await this.hostContext.close();
  }

  async createRoom() {
    await this.hostPage.goto('/host');
    await ensureVisible(this.hostPage.locator('input#name'), 'host name input');
    await this.hostPage.fill('input#name', this.hostName);
    await this.hostPage.getByRole('button', { name: /Create Room/i }).click();
    await waitForRoomPath(this.hostPage, 'host room');

    const roomCode =
      new URL(this.hostPage.url()).pathname.split('/').pop() ?? '';
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
      this.hostPage.getByRole('button', { name: /Need.*player/i })
    ).toBeVisible();
  }

  async openHelpModal() {
    await this.hostPage.getByRole('button', { name: /How to play/i }).click();
    await ensureVisible(
      this.hostPage.getByRole('heading', { name: /How to Play/i }),
      'help modal'
    );
  }

  async closeHelpModal() {
    await this.hostPage.getByRole('button', { name: /Got it/i }).click();
  }

  async chooseHyperTheme() {
    await this.hostPage.getByRole('button', { name: /Choose theme/i }).click();
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
      this.guestPage.locator('input#name'),
      'guest name input'
    );
    await this.guestPage.fill('input#name', this.guestName);
    await this.guestPage.getByRole('button', { name: /Enter Room/i }).click();
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
      this.hostPage.getByRole('button', { name: /Start Linejam/i })
    ).toBeEnabled();
    await expect(
      this.guestPage.getByRole('button', { name: /Waiting for Host/i })
    ).toBeVisible();
  }

  async startGame() {
    await this.hostPage.getByRole('button', { name: /Start Linejam/i }).click();
    await this.expectRound(1);
    await this.expectWritingUi();
  }

  async expectRound(round: number) {
    const roundLabel = `Round ${round} of ${TOTAL_ROUNDS}`;
    await expect(this.hostPage.getByText(roundLabel)).toBeVisible({
      timeout: 15000,
    });
    await expect(this.guestPage.getByText(roundLabel)).toBeVisible({
      timeout: 15000,
    });
  }

  async expectWritingUi() {
    await expect(this.hostPage.getByRole('textbox')).toBeVisible();
    await expect(this.guestPage.getByRole('textbox')).toBeVisible();
    await this.expectWordSlotsVisible('host');
    await this.expectWordSlotsVisible('guest');
  }

  async expectWordSlotsVisible(actor: Actor) {
    await expect(this.page(actor).locator('#word-slots')).toBeVisible();
  }

  async fillCurrentLine(actor: Actor, line: string) {
    await this.page(actor).getByRole('textbox').fill(line);
  }

  async expectSealDisabled(actor: Actor) {
    await expect(
      this.page(actor).getByRole('button', { name: /Seal Your Line/i })
    ).toBeDisabled();
  }

  async expectSealEnabled(actor: Actor) {
    await expect(
      this.page(actor).getByRole('button', { name: /Seal Your Line/i })
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
      .getByRole('button', { name: /Seal Your Line/i })
      .click();
  }

  async waitForWaitingState(actor: Actor) {
    await expect(
      this.page(actor).getByText(/Others are writing|Ready/i)
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
      this.hostPage.getByRole('heading', { name: /Reading Phase/i })
    ).toBeVisible({ timeout: 30000 });
    await expect(
      this.guestPage.getByRole('heading', { name: /Reading Phase/i })
    ).toBeVisible({ timeout: 30000 });
    await expect(
      this.hostPage.getByRole('button', { name: /Reveal & Read/i })
    ).toBeVisible();
    await expect(
      this.guestPage.getByRole('button', { name: /Reveal & Read/i })
    ).toBeVisible();
  }

  async revealAssignedPoem(
    actor: Actor,
    lines: readonly string[] = CANONICAL_GUEST_FLOW_LINES
  ) {
    const page = this.page(actor);

    await page.getByRole('button', { name: /Reveal & Read/i }).click();
    await expect(page.getByText(lines[0])).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(lines.at(-1) ?? '')).toBeVisible();
    await page.getByRole('button', { name: /Close|Done|Back/i }).click();
  }

  async revealAllPoems(lines: readonly string[] = CANONICAL_GUEST_FLOW_LINES) {
    await this.revealAssignedPoem('host', lines);
    await this.revealAssignedPoem('guest', lines);
    await this.expectSessionComplete();
  }

  async expectSessionComplete() {
    await expect(
      this.hostPage.getByRole('heading', { name: /Session Complete/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      this.guestPage.getByRole('heading', { name: /Session Complete/i })
    ).toBeVisible({ timeout: 15000 });
  }

  async capture(actor: Actor, path: string) {
    await this.page(actor).screenshot({ path, fullPage: true });
    return path;
  }

  private attachRuntimeErrorLogging() {
    this.attachPageErrorLogging(this.hostPage, 'host');
    this.attachPageErrorLogging(this.guestPage, 'guest');
  }

  private attachPageErrorLogging(page: Page, label: string) {
    page.on('pageerror', (error) => {
      this.runtimeErrors.push(`[${label}] pageerror: ${error.message}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.runtimeErrors.push(`[${label}] console: ${msg.text()}`);
      }
    });
  }

  private page(actor: Actor) {
    return actor === 'host' ? this.hostPage : this.guestPage;
  }

  private playerName(page: Page, name: string) {
    return page.locator('li span').filter({
      hasText: new RegExp(`^${escapeRegex(name)}$`),
    });
  }
}
