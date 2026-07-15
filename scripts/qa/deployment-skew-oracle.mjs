import { chromium } from '@playwright/test';

const BASE_URL = new URL(
  process.env.PLAYWRIGHT_BASE_URL || 'https://www.linejam.app'
).origin;
const TIMEOUT_MS = positiveInteger(
  process.env.LINEJAM_SKEW_ORACLE_TIMEOUT_MS,
  30 * 60 * 1000
);
const POLL_INTERVAL_MS = 5_000;
const DRAFT = 'continuity';

const TEST_ID = {
  hostName: 'host-name-input',
  createRoom: 'host-create-room-button',
  joinName: 'join-name-input',
  joinRoom: 'join-room-button',
  startGame: 'lobby-start-game-button',
  writingPhase: 'writing-phase',
  writingInput: 'writing-line-input',
};

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function readDeploymentId(page) {
  const response = await page.request.get(`${BASE_URL}/api/deployment`, {
    failOnStatusCode: true,
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json();
  const id = payload?.deployment?.id;
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Production returned no deployment receipt');
  }
  return id;
}

async function establishHeldDraft(browser) {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await hostPage.goto(`${BASE_URL}/host`);
  await hostPage.getByTestId(TEST_ID.hostName).fill('Rollout Host');
  await hostPage.getByTestId(TEST_ID.createRoom).click();
  await hostPage.waitForURL(/\/room\/[A-Z]{4}$/);
  const roomCode = new URL(hostPage.url()).pathname.split('/').pop();
  if (!roomCode || !/^[A-Z]{4}$/.test(roomCode)) {
    throw new Error('Host did not reach a valid room');
  }

  await guestPage.goto(`${BASE_URL}/join?code=${roomCode}`);
  await guestPage.getByTestId(TEST_ID.joinName).fill('Rollout Guest');
  await guestPage.getByTestId(TEST_ID.joinRoom).click();
  await guestPage.waitForURL(new RegExp(`/room/${roomCode}$`));

  const start = hostPage.getByTestId(TEST_ID.startGame).filter({
    visible: true,
  });
  await start.waitFor({ state: 'visible' });
  await start.click();
  await hostPage
    .getByTestId(TEST_ID.writingPhase)
    .waitFor({ state: 'visible' });
  await guestPage
    .getByTestId(TEST_ID.writingPhase)
    .waitFor({ state: 'visible' });

  const input = hostPage.getByTestId(TEST_ID.writingInput);
  await input.fill(DRAFT);
  if ((await input.inputValue()) !== DRAFT) {
    throw new Error('Draft was not accepted before rollout');
  }

  return { guestContext, hostContext, hostPage };
}

async function waitForNextDeployment(page, initialId) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const currentId = await readDeploymentId(page);
    if (currentId !== initialId) return currentId;
  }
  throw new Error(`No new deployment became active within ${TIMEOUT_MS}ms`);
}

async function verifyRecovery(page) {
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  const banner = page.getByRole('status', { name: /linejam was updated/i });
  await banner.waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: /reload linejam/i }).click();

  const input = page.getByTestId(TEST_ID.writingInput);
  await input.waitFor({ state: 'visible', timeout: 30_000 });
  if ((await input.inputValue()) !== DRAFT) {
    throw new Error('Draft did not survive the deployment reload');
  }
  await page.getByText('Draft restored', { exact: true }).waitFor({
    state: 'visible',
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let session;

  try {
    const receiptContext = await browser.newContext();
    const receiptPage = await receiptContext.newPage();
    const initialId = await readDeploymentId(receiptPage);
    await receiptContext.close();
    session = await establishHeldDraft(browser);
    const stagedId = await readDeploymentId(session.hostPage);
    if (stagedId !== initialId) {
      throw new Error('Deployment changed while the held room was staged');
    }

    console.log(`READY deployment=${initialId}`);
    const nextId = await waitForNextDeployment(session.hostPage, initialId);
    console.log(`DETECTED deployment=${nextId}`);
    await verifyRecovery(session.hostPage);
    console.log('PASS stale client reloaded with its draft restored');
  } finally {
    await Promise.allSettled([
      session?.guestContext.close(),
      session?.hostContext.close(),
    ]);
    await browser.close();
  }
}

await main();
