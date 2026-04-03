#!/usr/bin/env node

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'https://www.linejam.app';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.LINEJAM_BASE_URL || DEFAULT_BASE_URL,
    outDir:
      process.env.LINEJAM_EVIDENCE_DIR ||
      path.join('/tmp', `linejam-evidence-${timestamp}`),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url' && argv[i + 1]) {
      args.baseUrl = argv[i + 1];
      i += 1;
    } else if (arg === '--out-dir' && argv[i + 1]) {
      args.outDir = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function makeRunner(cwd) {
  return (command, args) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(
          new Error(
            `${command} ${args.join(' ')} exited with ${code}\n${stderr || stdout}`
          )
        );
      });
    });
}

async function ensureVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 30000 });
  if (!(await locator.isVisible())) {
    throw new Error(`Expected visible: ${label}`);
  }
}

async function ensureEnabled(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 30000 });
  if (!(await locator.isEnabled())) {
    throw new Error(`Expected enabled: ${label}`);
  }
}

async function ensureDisabled(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 30000 });
  if (await locator.isEnabled()) {
    throw new Error(`Expected disabled: ${label}`);
  }
}

async function waitForPath(page, regex, label) {
  await page.waitForURL(regex, { timeout: 30000 });
  if (!regex.test(new URL(page.url()).pathname)) {
    throw new Error(`Unexpected URL for ${label}: ${page.url()}`);
  }
}

async function capture(page, outDir, name, options = {}) {
  const screenshotPath = path.join(outDir, name);
  await page.screenshot({ path: screenshotPath, fullPage: true, ...options });
  return screenshotPath;
}

function attachErrorLogging(page, label, sink) {
  page.on('pageerror', (error) => {
    sink.push(`[${label}] pageerror: ${error.message}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      sink.push(`[${label}] console: ${msg.text()}`);
    }
  });
}

async function writeSummary({
  outDir,
  baseUrl,
  roomCode,
  checks,
  runtimeErrors,
  screenshots,
  gifPath,
  videoPath,
}) {
  const lines = [
    '# Linejam Guest Flow QA Summary',
    '',
    `- Result: ${runtimeErrors.length === 0 ? 'PASS' : 'PASS WITH ERRORS'}`,
    `- Base URL: ${baseUrl}`,
    `- Room code: ${roomCode}`,
    `- Captured at: ${new Date().toISOString()}`,
    '',
    '## Checks',
    ...checks.map((check) => `- ${check}`),
    '',
    '## Runtime Errors',
    ...(runtimeErrors.length === 0
      ? ['- None captured from browser console or pageerror events.']
      : runtimeErrors.map((error) => `- ${error}`)),
    '',
    '## Artifacts',
    `- GIF: ${path.basename(gifPath)}`,
    `- Video: ${path.basename(videoPath)}`,
    ...screenshots.map((file) => `- Screenshot: ${path.basename(file)}`),
    '',
  ];

  const summaryPath = path.join(outDir, 'qa-summary.md');
  await fs.writeFile(summaryPath, `${lines.join('\n')}\n`, 'utf8');
  return summaryPath;
}

async function main() {
  const { baseUrl, outDir } = parseArgs(process.argv.slice(2));
  const run = makeRunner(process.cwd());

  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.join(outDir, 'raw-video'), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const hostContext = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    recordVideo: {
      dir: path.join(outDir, 'raw-video'),
      size: { width: 1440, height: 960 },
    },
  });
  const guestContext = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });

  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();
  const runtimeErrors = [];
  const checks = [];
  const screenshots = [];

  attachErrorLogging(hostPage, 'host', runtimeErrors);
  attachErrorLogging(guestPage, 'guest', runtimeErrors);

  const hostName = `Host ${Math.floor(Date.now() / 1000)}`;
  const guestName = `Guest ${Math.floor(Date.now() / 1000)}`;
  const lines = [
    'poetry',
    'two words',
    'just three words',
    'this has four words',
    'this line has five words',
    'back to four now',
    'only three again',
    'two more',
    'end',
  ];

  let roomCode = '';
  const hostVideo = hostPage.video();

  try {
    await hostPage.goto(`${baseUrl}/host`, { waitUntil: 'networkidle' });
    await ensureVisible(hostPage.locator('input#name'), 'host name input');
    await hostPage.fill('input#name', hostName);
    await hostPage.getByRole('button', { name: /Create Room/i }).click();
    await waitForPath(hostPage, /\/room\/[A-Z]{4}$/, 'host room');
    roomCode = new URL(hostPage.url()).pathname.split('/').pop() || '';
    if (!/^[A-Z]{4}$/.test(roomCode)) {
      throw new Error(`Unexpected room code: ${roomCode}`);
    }
    checks.push('Host can create a room and land in the lobby.');
    screenshots.push(await capture(hostPage, outDir, '01-host-lobby.png'));

    await hostPage.getByRole('button', { name: /How to play/i }).click();
    await ensureVisible(
      hostPage.getByRole('heading', { name: /How to Play/i }),
      'help modal'
    );
    checks.push('Lobby help modal opens from room chrome.');
    screenshots.push(await capture(hostPage, outDir, '02-help-modal.png'));
    await hostPage.getByRole('button', { name: /Got it/i }).click();

    await hostPage.getByRole('button', { name: /Choose theme/i }).click();
    await hostPage
      .getByRole('radio', { name: /Hyper theme: Digital chaos & brutalism/i })
      .click();
    await hostPage.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') === 'hyper'
    );
    checks.push(
      'Theme picker can switch the room to Hyper without breaking the lobby.'
    );
    screenshots.push(
      await capture(hostPage, outDir, '03-theme-hyper-lobby.png')
    );
    await hostPage.keyboard.press('Escape');

    await guestPage.goto(`${baseUrl}/join?code=${roomCode}`, {
      waitUntil: 'networkidle',
    });
    await ensureVisible(guestPage.locator('input#name'), 'guest name input');
    await guestPage.fill('input#name', guestName);
    await guestPage.getByRole('button', { name: /Enter Room/i }).click();
    await waitForPath(
      guestPage,
      new RegExp(`/room/${roomCode}$`),
      'guest room'
    );
    await ensureVisible(hostPage.getByText(guestName), 'guest in host lobby');
    checks.push(
      'Guest can join from a separate browser context and appears in real time.'
    );
    screenshots.push(
      await capture(hostPage, outDir, '04-two-player-lobby.png')
    );

    await hostPage.getByRole('button', { name: /Start Linejam/i }).click();
    await ensureVisible(hostPage.getByText(/Round 1 \/ 9/), 'host round 1');
    await ensureVisible(guestPage.getByText(/Round 1 \/ 9/), 'guest round 1');
    checks.push('Host can start a live 2-player game.');

    const submitButton = hostPage.getByRole('button', {
      name: /Seal Your Line/i,
    });
    const textarea = hostPage.getByRole('textbox');

    await ensureDisabled(submitButton, 'empty submit button');
    await textarea.fill('two words');
    await ensureDisabled(submitButton, 'invalid 2-word submit button');
    await textarea.fill(lines[0]);
    await ensureEnabled(submitButton, 'valid 1-word submit button');
    checks.push(
      'Word-count validation disables invalid submissions and enables exact matches.'
    );
    screenshots.push(await capture(hostPage, outDir, '05-writing-valid.png'));

    for (let round = 0; round < lines.length; round += 1) {
      await hostPage.getByRole('textbox').fill(lines[round]);
      await hostPage.getByRole('button', { name: /Seal Your Line/i }).click();
      await ensureVisible(
        hostPage.getByText(/Others are writing|Ready/i),
        'host waiting state'
      );

      if (round === 0) {
        screenshots.push(await capture(hostPage, outDir, '06-waiting.png'));
      }

      await guestPage.getByRole('textbox').fill(lines[round]);
      await guestPage.getByRole('button', { name: /Seal Your Line/i }).click();

      if (round < lines.length - 1) {
        await ensureVisible(
          hostPage.getByText(`Round ${round + 2} / 9`),
          `host round ${round + 2}`
        );
        await ensureVisible(
          guestPage.getByText(`Round ${round + 2} / 9`),
          `guest round ${round + 2}`
        );
      }
    }

    await ensureVisible(
      hostPage.getByRole('heading', { name: /Reading Phase/i }),
      'host reading phase'
    );
    await ensureVisible(
      guestPage.getByRole('heading', { name: /Reading Phase/i }),
      'guest reading phase'
    );
    checks.push(
      'A full 9-round game reaches the reading phase for both players.'
    );

    await hostPage.getByRole('button', { name: /Reveal & Read/i }).click();
    await ensureVisible(
      hostPage.getByText(lines[0]),
      'revealed poem first line'
    );
    await ensureVisible(
      hostPage.getByText(lines.at(-1)),
      'revealed poem last line'
    );
    screenshots.push(await capture(hostPage, outDir, '07-reveal.png'));
    await hostPage.getByRole('button', { name: /Close/i }).click();

    await guestPage.getByRole('button', { name: /Reveal & Read/i }).click();
    await ensureVisible(
      guestPage.getByText(lines[0]),
      'guest revealed poem first line'
    );
    await guestPage.getByRole('button', { name: /Close/i }).click();

    await ensureVisible(
      hostPage.getByRole('heading', { name: /Session Complete/i }),
      'host session complete'
    );
    await ensureVisible(
      guestPage.getByRole('heading', { name: /Session Complete/i }),
      'guest session complete'
    );
    checks.push('Both players can finish reveal and reach Session Complete.');
    screenshots.push(
      await capture(hostPage, outDir, '08-session-complete.png')
    );
  } finally {
    await guestContext.close();
    await hostContext.close();
    await browser.close();
  }

  if (!hostVideo) {
    throw new Error('Playwright did not record host video.');
  }

  const rawVideoPath = await hostVideo.path();
  const videoPath = path.join(outDir, 'guest-flow.webm');
  await fs.rename(rawVideoPath, videoPath);

  const gifPath = path.join(outDir, 'guest-flow.gif');
  await run('ffmpeg', [
    '-y',
    '-i',
    videoPath,
    '-vf',
    'fps=6,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
    '-loop',
    '0',
    gifPath,
  ]);

  const summaryPath = await writeSummary({
    outDir,
    baseUrl,
    roomCode,
    checks,
    runtimeErrors,
    screenshots,
    gifPath,
    videoPath,
  });

  const manifest = {
    baseUrl,
    roomCode,
    result: runtimeErrors.length === 0 ? 'PASS' : 'PASS_WITH_ERRORS',
    screenshots: screenshots.map((file) => path.basename(file)),
    video: path.basename(videoPath),
    gif: path.basename(gifPath),
    summary: path.basename(summaryPath),
    checks,
    runtimeErrors,
  };

  await fs.writeFile(
    path.join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  console.log(JSON.stringify({ outDir, summary: summaryPath }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
