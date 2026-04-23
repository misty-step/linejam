#!/usr/bin/env node

import { createClerkClient } from '@clerk/backend';
import { clerk } from '@clerk/testing/playwright';
import { chromium, expect } from '@playwright/test';
import { Stagehand } from '@browserbasehq/stagehand';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  assertAgenticMissionEnvironment,
  createAgenticRunId,
  normalizeAgenticTarget,
  resolveAgenticBaseUrl,
  resolveAgenticMission,
} from '../../qa/agentic/missions.mjs';
import {
  assertStagehandModelEnvironment,
  DEFAULT_STAGEHAND_MODEL,
  resolveStagehandModel,
} from '../../qa/agentic/modelEnv.mjs';
import {
  createAgenticManifest,
  markAgenticManifestFinished,
} from '../../qa/agentic/manifest.mjs';
import { writeAgenticCriticArtifacts } from '../../qa/agentic/critic.mjs';

const DEFAULT_CLERK_TEST_EMAIL = 'linejam-e2e+clerk_test@example.com';

function parseArgs(argv) {
  const args = {
    baseUrl: undefined,
    missionId: process.env.LINEJAM_AGENTIC_MISSION,
    outDir: process.env.LINEJAM_AGENTIC_OUT_DIR,
    target: 'local',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--base-url' && argv[i + 1]) {
      args.baseUrl = argv[i + 1];
      i += 1;
    } else if (arg === '--mission' && argv[i + 1]) {
      args.missionId = argv[i + 1];
      i += 1;
    } else if (arg === '--out-dir' && argv[i + 1]) {
      args.outDir = argv[i + 1];
      i += 1;
    } else if (arg === '--target' && argv[i + 1]) {
      args.target = argv[i + 1];
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/qa/agentic-runner.mjs [options]

Options:
  --target local|preview       Run posture. Local defaults to http://localhost:3000.
  --mission <id>              Mission id. Defaults to LINEJAM_AGENTIC_MISSION.
  --base-url <url>            Target URL. Required for preview runs.
  --out-dir <path>            Artifact directory. Defaults to .qa/runs/<run-id>.

Environment:
  LINEJAM_AGENTIC_MODE=deterministic skips Stagehand actions for harness debugging.
  LINEJAM_STAGEHAND_MODEL selects the Stagehand model, default ${DEFAULT_STAGEHAND_MODEL}.
`);
}

function shouldUseStagehand() {
  return process.env.LINEJAM_AGENTIC_MODE !== 'deterministic';
}

function requireStagehandModelEnv() {
  if (!shouldUseStagehand()) {
    return;
  }

  assertStagehandModelEnvironment();
}

async function createStagehand() {
  if (!shouldUseStagehand()) {
    return null;
  }

  const stagehand = new Stagehand({
    env: 'LOCAL',
    model: resolveStagehandModel(),
    disablePino: true,
    verbose: 0,
    localBrowserLaunchOptions: {
      headless: process.env.LINEJAM_AGENTIC_HEADFUL !== '1',
    },
  });

  await stagehand.init();
  return stagehand;
}

async function perform({
  actor,
  fallback,
  instruction,
  manifest,
  page,
  stagehand,
}) {
  if (stagehand) {
    const result = await stagehand.act(instruction, {
      page,
      timeout: 30_000,
      serverCache: true,
    });

    manifest.transcript.push({
      actor,
      instruction,
      mode: 'stagehand',
      result: result.message,
      success: result.success,
    });

    if (!result.success) {
      throw new Error(
        `Stagehand action failed for ${actor}: ${result.message}`
      );
    }

    return;
  }

  await fallback();
  manifest.transcript.push({
    actor,
    instruction,
    mode: 'deterministic',
    result: 'ok',
    success: true,
  });
}

async function runCheck(manifest, name, fn) {
  try {
    await fn();
    manifest.checks.push({ name, status: 'PASS' });
  } catch (error) {
    manifest.checks.push({
      name,
      status: 'FAIL',
      detail: errorMessage(error),
    });
    throw error;
  }
}

async function createContextPage(browser, baseUrl) {
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();
  return { context, page };
}

async function ensureClerkAuthState(page) {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required for signed-in agentic QA.');
  }
  process.env.CLERK_PUBLISHABLE_KEY ??=
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const emailAddress =
    process.env.PLAYWRIGHT_CLERK_TEST_EMAIL?.trim() || DEFAULT_CLERK_TEST_EMAIL;

  await ensureClerkSmokeUser(secretKey, emailAddress);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress });
  await clerk.loaded({ page });
  await page.waitForFunction(
    () => Boolean(window.Clerk?.loaded && window.Clerk?.session?.id),
    { timeout: 30_000 }
  );
  await page.waitForFunction(
    async () => {
      if (!window.Clerk?.loaded || !window.Clerk.session) {
        return false;
      }

      try {
        return Boolean(
          await window.Clerk.session.getToken({ template: 'convex' })
        );
      } catch {
        return false;
      }
    },
    { timeout: 30_000 }
  );
}

async function ensureClerkSmokeUser(secretKey, emailAddress) {
  const client = createClerkClient({ secretKey });
  const existing = await client.users.getUserList({
    emailAddress: [emailAddress],
  });
  if (existing.data[0]) return;

  if (secretKey.startsWith('sk_live_')) {
    throw new Error(
      `Refusing to auto-provision Clerk smoke user ${emailAddress} against a live Clerk instance. Create that user first or set PLAYWRIGHT_CLERK_TEST_EMAIL.`
    );
  }

  try {
    await client.users.createUser({
      emailAddress: [emailAddress],
      firstName: 'Linejam',
      lastName: 'Agentic QA',
      skipLegalChecks: true,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });
  } catch (error) {
    const retry = await client.users.getUserList({
      emailAddress: [emailAddress],
    });
    if (!retry.data[0]) {
      throw error;
    }
  }
}

function getRoomCode(page) {
  const roomCode = page.url().match(/\/room\/([A-Z]{4})$/)?.[1] || '';

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    throw new Error(`Unexpected room URL: ${page.url()}`);
  }

  return roomCode;
}

async function screenshot(manifest, page, outDir, label) {
  const file = `${String(manifest.screenshots.length + 1).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  manifest.screenshots.push({ label, file });
}

async function observe(manifest, page, actor, label) {
  const text = await page.locator('body').innerText({ timeout: 5_000 });
  manifest.observations.push({
    actor,
    label,
    text,
    url: page.url(),
  });
}

function attachRuntimeErrorLogging(page, actor, manifest) {
  page.on('pageerror', (error) => {
    manifest.runtimeErrors.push(`[${actor}] pageerror: ${error.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      manifest.runtimeErrors.push(`[${actor}] console: ${msg.text()}`);
    }
  });
}

async function runGuestHostSignedInJoin({
  baseUrl,
  browser,
  manifest,
  outDir,
  stagehand,
}) {
  const host = await createContextPage(browser, baseUrl);
  const joiner = await createContextPage(browser, baseUrl);
  attachRuntimeErrorLogging(host.page, 'guest-host', manifest);
  attachRuntimeErrorLogging(joiner.page, 'signed-in-joiner', manifest);

  try {
    await runCheck(manifest, 'guest host creates room', async () => {
      await host.page.goto('/host');
      await perform({
        actor: 'guest-host',
        fallback: async () => {
          await host.page.locator('input#name').fill('Agentic Guest Host');
          await host.page.getByRole('button', { name: /Create Room/i }).click();
        },
        instruction:
          'Fill the host pen name field with "Agentic Guest Host" and create the room.',
        manifest,
        page: host.page,
        stagehand,
      });
      await host.page.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 30_000 });
      await expect(host.page.getByText('Agentic Guest Host')).toBeVisible();
      await screenshot(manifest, host.page, outDir, 'host-lobby');
    });

    const roomCode = getRoomCode(host.page);
    await runCheck(manifest, 'signed-in player joins room', async () => {
      await ensureClerkAuthState(joiner.page);
      await joiner.page.goto(`/join?code=${roomCode}`);
      await perform({
        actor: 'signed-in-joiner',
        fallback: async () => {
          await joiner.page.locator('input#name').fill('Agentic Clerk User');
          await joiner.page
            .getByRole('button', { name: /Enter Room/i })
            .click();
        },
        instruction:
          'Fill the join pen name field with "Agentic Clerk User" and enter the room.',
        manifest,
        page: joiner.page,
        stagehand,
      });
      await joiner.page.waitForURL(`/room/${roomCode}`, { timeout: 30_000 });
      await expect(host.page.getByText('Agentic Clerk User')).toBeVisible({
        timeout: 15_000,
      });
      await screenshot(manifest, joiner.page, outDir, 'signed-in-joined');
    });

    await observe(manifest, host.page, 'guest-host', 'post-join lobby');
    await observe(manifest, joiner.page, 'signed-in-joiner', 'joined lobby');
  } finally {
    await Promise.allSettled([host.context.close(), joiner.context.close()]);
  }
}

async function runSignedInHostGuestJoin({
  baseUrl,
  browser,
  manifest,
  outDir,
  stagehand,
}) {
  const host = await createContextPage(browser, baseUrl);
  const guest = await createContextPage(browser, baseUrl);
  attachRuntimeErrorLogging(host.page, 'signed-in-host', manifest);
  attachRuntimeErrorLogging(guest.page, 'guest-joiner', manifest);

  try {
    await runCheck(manifest, 'signed-in host creates room', async () => {
      await ensureClerkAuthState(host.page);
      await host.page.goto('/host');
      await perform({
        actor: 'signed-in-host',
        fallback: async () => {
          await host.page.locator('input#name').fill('Agentic Clerk Host');
          await host.page.getByRole('button', { name: /Create Room/i }).click();
        },
        instruction:
          'Fill the host pen name field with "Agentic Clerk Host" and create the room.',
        manifest,
        page: host.page,
        stagehand,
      });
      await host.page.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 30_000 });
      await expect(host.page.getByText('Agentic Clerk Host')).toBeVisible();
      await screenshot(manifest, host.page, outDir, 'host-lobby');
    });

    const roomCode = getRoomCode(host.page);
    await runCheck(manifest, 'guest player joins room', async () => {
      await guest.page.goto(`/join?code=${roomCode}`);
      await perform({
        actor: 'guest-joiner',
        fallback: async () => {
          await guest.page.locator('input#name').fill('Agentic Guest User');
          await guest.page.getByRole('button', { name: /Enter Room/i }).click();
        },
        instruction:
          'Fill the join pen name field with "Agentic Guest User" and enter the room.',
        manifest,
        page: guest.page,
        stagehand,
      });
      await guest.page.waitForURL(`/room/${roomCode}`, { timeout: 30_000 });
      await expect(host.page.getByText('Agentic Guest User')).toBeVisible({
        timeout: 15_000,
      });
      await screenshot(manifest, guest.page, outDir, 'guest-joined');
    });

    await observe(manifest, host.page, 'signed-in-host', 'post-join lobby');
    await observe(manifest, guest.page, 'guest-joiner', 'joined lobby');
  } finally {
    await Promise.allSettled([host.context.close(), guest.context.close()]);
  }
}

async function runMission(options) {
  if (options.mission.id === 'guest-host-signed-in-join') {
    await runGuestHostSignedInJoin(options);
    return;
  }

  if (options.mission.id === 'signed-in-host-guest-join') {
    await runSignedInHostGuestJoin(options);
    return;
  }

  throw new Error(`No runner implemented for ${options.mission.id}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = normalizeAgenticTarget(args.target);
  const mission = resolveAgenticMission(args.missionId);
  const baseUrl = resolveAgenticBaseUrl({
    baseUrl: args.baseUrl,
    target,
  });

  assertAgenticMissionEnvironment(mission);
  requireStagehandModelEnv();

  const runId = createAgenticRunId({ missionId: mission.id, target });
  const outDir = args.outDir || path.join('.qa', 'runs', runId);
  const manifestPath = path.join(outDir, 'manifest.json');
  const manifest = createAgenticManifest({
    baseUrl,
    mission,
    runId,
    target,
  });

  await fs.mkdir(outDir, { recursive: true });

  let browser;
  let stagehand;
  let runError = null;

  try {
    stagehand = await createStagehand();
    browser = await chromium.launch({
      headless: process.env.LINEJAM_AGENTIC_HEADFUL !== '1',
    });
    await runMission({
      baseUrl,
      browser,
      manifest,
      mission,
      outDir,
      stagehand,
    });
    markAgenticManifestFinished(manifest, 'PASS');
  } catch (error) {
    runError = error;
    manifest.runtimeErrors.push(errorMessage(error));
    markAgenticManifestFinished(manifest, 'FAIL');
  } finally {
    await Promise.allSettled([browser?.close(), stagehand?.close()]);
  }

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const critic = await writeAgenticCriticArtifacts({
    manifest,
    mission,
    outDir,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        critic: critic.verdict,
        manifest: manifestPath,
        outDir,
        result: manifest.status,
        summary: critic.summaryPath,
      },
      null,
      2
    )}\n`
  );

  if (runError) {
    throw runError;
  }

  if (critic.verdict !== 'pass') {
    throw new Error(critic.summary);
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error) => {
    console.error(errorMessage(error));
    process.exit(1);
  });
}
