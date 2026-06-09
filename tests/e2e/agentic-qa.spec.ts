import { promises as fs } from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ensureClerkAuthState, hasClerkBrowserAuth } from './support/clerk';
import { createAgenticManifest } from '@/qa/agentic/manifest.mjs';

const RUN_DIR = process.env.LINEJAM_AGENTIC_RUN_DIR;
const RESULT_FILE = process.env.LINEJAM_AGENTIC_RESULT_FILE;

async function openPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

async function createRoom(hostPage: Page, hostName: string) {
  await hostPage.goto('/host');
  await hostPage.waitForSelector('input#name', {
    state: 'visible',
    timeout: 10000,
  });
  await hostPage.fill('input#name', hostName);
  await hostPage.click('button[type="submit"]');
  await hostPage.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 30000 });
  const roomCode = hostPage.url().match(/\/room\/([A-Z]{4})$/)?.[1] || '';
  expect(roomCode).toMatch(/^[A-Z]{4}$/);
  return roomCode;
}

async function joinRoom(page: Page, roomCode: string, playerName: string) {
  await page.goto(`/join?code=${roomCode}`);
  await page.waitForSelector('input#name', {
    state: 'visible',
    timeout: 10000,
  });
  await page.fill('input#name', playerName);
  await page.click('button[type="submit"]');
  await page.waitForURL(`/room/${roomCode}`, { timeout: 15000 });
}

async function expectNoGenericError(...pages: Page[]) {
  for (const page of pages) {
    await expect(
      page.getByText(
        /unexpected error occurred|application error|something went wrong|generic join error/i
      )
    ).not.toBeVisible();
  }
}

function attachRuntimeErrorLogging(page: Page, runtimeErrors: string[]) {
  page.on('pageerror', (error) => {
    runtimeErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(message.text());
    }
  });
  page.on('requestfailed', (request) => {
    runtimeErrors.push(
      `Request failed: ${request.method()} ${request.url()} ${
        request.failure()?.errorText || ''
      }`.trim()
    );
  });
}

async function screenshot(page: Page, name: string) {
  if (!RUN_DIR) return null;
  const target = path.join(RUN_DIR, name);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

async function writeResult(data: {
  artifacts: Array<{ kind: string; path: string }>;
  baseUrl: string;
  checks: string[];
  mission: string;
  result: 'pass' | 'fail';
  runtimeErrors: string[];
  startedAt: string;
  target: string;
}) {
  if (!RESULT_FILE || !RUN_DIR) return;
  const deterministicChecks = data.checks.map((name) => ({
    name,
    status: 'pass',
  }));
  const manifest = createAgenticManifest({
    artifacts: data.artifacts,
    baseUrl: data.baseUrl,
    deterministicChecks,
    finishedAt: new Date().toISOString(),
    mission: data.mission,
    result: data.result,
    runDir: RUN_DIR,
    runId: path.basename(RUN_DIR),
    runtimeErrors: data.runtimeErrors,
    startedAt: data.startedAt,
    target: data.target,
    transcript: data.checks.map((check) => ({
      actor: 'harness',
      text: check,
    })),
  });

  await fs.writeFile(RESULT_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
}

function requireAuth() {
  if (!hasClerkBrowserAuth) {
    throw new Error(
      'Agentic QA mission requires CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/CLERK_PUBLISHABLE_KEY'
    );
  }
}

test.describe('agentic QA missions', () => {
  test('guest-host-signed-in-join @agentic:guest-host-signed-in-join', async ({
    browser,
    baseURL,
  }) => {
    requireAuth();
    const startedAt = new Date().toISOString();
    const runtimeErrors: string[] = [];
    const artifacts: Array<{ kind: string; path: string }> = [];
    const { context: hostContext, page: hostPage } = await openPage(browser);
    const { context: signedInContext, page: signedInPage } =
      await openPage(browser);
    attachRuntimeErrorLogging(hostPage, runtimeErrors);
    attachRuntimeErrorLogging(signedInPage, runtimeErrors);

    try {
      const roomCode = await createRoom(hostPage, 'Agentic Guest Host');
      await ensureClerkAuthState(signedInPage);
      await joinRoom(signedInPage, roomCode, 'Agentic Clerk Join');

      await expect(hostPage.getByText('Agentic Clerk Join')).toBeVisible();
      await expect(signedInPage.getByText('Agentic Guest Host')).toBeVisible();
      await expectNoGenericError(hostPage, signedInPage);

      const hostShot = await screenshot(hostPage, 'host-lobby.png');
      const joinShot = await screenshot(signedInPage, 'signed-in-join.png');
      for (const shot of [hostShot, joinShot]) {
        if (shot) artifacts.push({ kind: 'screenshot', path: shot });
      }

      await writeResult({
        artifacts,
        baseUrl: baseURL || '',
        checks: [
          'guest host created room',
          'signed-in player joined room',
          'host sees signed-in player',
          'signed-in player sees host',
          'generic error UI absent',
        ],
        mission: 'guest-host-signed-in-join',
        result: 'pass',
        runtimeErrors,
        startedAt,
        target: process.env.LINEJAM_AGENTIC_TARGET || 'local',
      });
    } finally {
      await Promise.all([hostContext.close(), signedInContext.close()]);
    }
  });

  test('signed-in-host-guest-join @agentic:signed-in-host-guest-join', async ({
    browser,
    baseURL,
  }) => {
    requireAuth();
    const startedAt = new Date().toISOString();
    const runtimeErrors: string[] = [];
    const artifacts: Array<{ kind: string; path: string }> = [];
    const { context: hostContext, page: hostPage } = await openPage(browser);
    const { context: guestContext, page: guestPage } = await openPage(browser);
    attachRuntimeErrorLogging(hostPage, runtimeErrors);
    attachRuntimeErrorLogging(guestPage, runtimeErrors);

    try {
      await ensureClerkAuthState(hostPage);
      const roomCode = await createRoom(hostPage, 'Agentic Clerk Host');
      await joinRoom(guestPage, roomCode, 'Agentic Guest Join');

      await expect(hostPage.getByText('Agentic Guest Join')).toBeVisible();
      await expect(guestPage.getByText('Agentic Clerk Host')).toBeVisible();
      await expectNoGenericError(hostPage, guestPage);

      const hostShot = await screenshot(hostPage, 'signed-in-host-lobby.png');
      const joinShot = await screenshot(guestPage, 'guest-join.png');
      for (const shot of [hostShot, joinShot]) {
        if (shot) artifacts.push({ kind: 'screenshot', path: shot });
      }

      await writeResult({
        artifacts,
        baseUrl: baseURL || '',
        checks: [
          'signed-in host created room',
          'guest player joined room',
          'signed-in host sees guest',
          'guest sees signed-in host',
          'generic error UI absent',
        ],
        mission: 'signed-in-host-guest-join',
        result: 'pass',
        runtimeErrors,
        startedAt,
        target: process.env.LINEJAM_AGENTIC_TARGET || 'local',
      });
    } finally {
      await Promise.all([hostContext.close(), guestContext.close()]);
    }
  });
});
