#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { constants as fsConstants, promises as fs } from 'node:fs';
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

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function makeRunner(cwd) {
  return (command, args, options = {}) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: options.env ?? process.env,
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

async function exists(targetPath) {
  try {
    await fs.access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveResult(flowError, runtimeErrors) {
  if (flowError) {
    return 'FAIL';
  }

  return runtimeErrors.length === 0 ? 'PASS' : 'PASS_WITH_ERRORS';
}

function humanizeResult(result) {
  return result.replaceAll('_', ' ');
}

function errorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function writeSummary({
  artifactErrors,
  baseUrl,
  checks,
  flowError,
  gifPath,
  outDir,
  result,
  roomCode,
  runtimeErrors,
  screenshots,
  videoPath,
}) {
  const lines = [
    '# Linejam Guest Flow QA Summary',
    '',
    `- Result: ${humanizeResult(result)}`,
    `- Base URL: ${baseUrl}`,
    `- Room code: ${roomCode || 'Unavailable'}`,
    `- Captured at: ${new Date().toISOString()}`,
    '',
    '## Checks',
    ...(checks.length === 0
      ? ['- No checks completed before the run failed.']
      : checks.map((check) => `- ${check}`)),
    '',
    '## Runtime Errors',
    ...(runtimeErrors.length === 0
      ? ['- None captured from browser console or pageerror events.']
      : runtimeErrors.map((runtimeError) => `- ${runtimeError}`)),
  ];

  if (flowError) {
    lines.push('', '## Flow Error', `- ${flowError}`);
  }

  if (artifactErrors.length > 0) {
    lines.push(
      '',
      '## Artifact Errors',
      ...artifactErrors.map((artifactError) => `- ${artifactError}`)
    );
  }

  lines.push(
    '',
    '## Artifacts',
    `- GIF: ${gifPath ? path.basename(gifPath) : 'Unavailable'}`,
    `- Video: ${videoPath ? path.basename(videoPath) : 'Unavailable'}`,
    ...screenshots.map((file) => `- Screenshot: ${file}`),
    ''
  );

  const summaryPath = path.join(outDir, 'qa-summary.md');
  await fs.writeFile(summaryPath, `${lines.join('\n')}\n`, 'utf8');
  return summaryPath;
}

async function main() {
  const { baseUrl, outDir } = parseArgs(process.argv.slice(2));
  const resultFile = path.join(outDir, 'guest-flow.result.json');
  const run = makeRunner(process.cwd());

  await fs.mkdir(outDir, { recursive: true });

  let testError = null;

  try {
    await run(pnpmCommand(), ['test:e2e:evidence'], {
      env: {
        ...process.env,
        E2E_BASE_URL: baseUrl,
        LINEJAM_EVIDENCE_DIR: outDir,
        LINEJAM_EVIDENCE_RESULT_FILE: resultFile,
        PLAYWRIGHT_HTML_OPEN: 'never',
      },
    });
  } catch (error) {
    testError = error;
  }

  if (!(await exists(resultFile))) {
    if (testError) {
      throw testError;
    }

    throw new Error(`Evidence run did not produce ${resultFile}`);
  }

  const result = JSON.parse(await fs.readFile(resultFile, 'utf8'));
  const artifactErrors = [];
  const resolvedResult = resolveResult(result.flowError, result.runtimeErrors);
  let videoPath = null;

  if (result.rawVideoPath) {
    const targetVideoPath = path.join(outDir, 'guest-flow.webm');

    try {
      if (result.rawVideoPath !== targetVideoPath) {
        await fs.rename(result.rawVideoPath, targetVideoPath);
      }
      videoPath = targetVideoPath;
    } catch (error) {
      artifactErrors.push(`Video packaging failed: ${errorMessage(error)}`);
    }
  } else {
    artifactErrors.push('Playwright did not record host video.');
  }

  let gifPath = null;

  if (videoPath) {
    gifPath = path.join(outDir, 'guest-flow.gif');

    try {
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
    } catch (error) {
      artifactErrors.push(`GIF generation failed: ${errorMessage(error)}`);
      gifPath = null;
    }
  }

  const summaryPath = await writeSummary({
    artifactErrors,
    baseUrl: result.baseUrl || baseUrl,
    checks: result.checks ?? [],
    flowError: result.flowError,
    gifPath,
    outDir,
    result: resolvedResult,
    roomCode: result.roomCode ?? '',
    runtimeErrors: result.runtimeErrors ?? [],
    screenshots: result.screenshots ?? [],
    videoPath,
  });

  const manifest = {
    artifactErrors,
    baseUrl: result.baseUrl || baseUrl,
    checks: result.checks ?? [],
    flowError: result.flowError,
    gif: gifPath ? path.basename(gifPath) : null,
    result: resolvedResult,
    roomCode: result.roomCode ?? '',
    runtimeErrors: result.runtimeErrors ?? [],
    screenshots: result.screenshots ?? [],
    summary: path.basename(summaryPath),
    video: videoPath ? path.basename(videoPath) : null,
  };

  await fs.writeFile(
    path.join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  console.log(
    JSON.stringify(
      {
        outDir,
        result: resolvedResult,
        summary: summaryPath,
      },
      null,
      2
    )
  );

  if (testError) {
    throw testError;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
