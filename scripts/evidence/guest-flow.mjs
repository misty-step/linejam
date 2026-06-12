#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  collectFileArtifactErrors,
  copyServerLog,
  exists,
  normalizeEvidenceResult,
  parseArgs,
} from './guest-flow-artifacts.mjs';
import {
  artifactIssue,
  issueArtifact,
  issueMessage,
  parseEvidenceWaivers,
  resolveEvidenceVerdict,
} from './verdict.mjs';

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

async function loadEvidenceWaivers(allowlistPath) {
  if (!allowlistPath) {
    return parseEvidenceWaivers(null);
  }

  return parseEvidenceWaivers(
    JSON.parse(await fs.readFile(allowlistPath, 'utf8'))
  );
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
  serverLogPath,
  screenshots,
  verdict,
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

  if (verdict.waivedRuntimeErrors.length > 0) {
    lines.push(
      '',
      '## Runtime Error Waivers',
      ...verdict.waivedRuntimeErrors.map(
        ({ error, waiver }) =>
          `- ${error} (waived until ${waiver.expiresOn}: ${waiver.reason})`
      )
    );
  }

  if (flowError) {
    lines.push('', '## Flow Error', `- ${flowError}`);
  }

  if (artifactErrors.length > 0) {
    lines.push(
      '',
      '## Artifact Errors',
      ...artifactErrors.map(
        (artifactError) =>
          `- [${issueArtifact(artifactError)}] ${issueMessage(artifactError)}`
      )
    );
  }

  if (verdict.waivedArtifactErrors.length > 0) {
    lines.push(
      '',
      '## Artifact Waivers',
      ...verdict.waivedArtifactErrors.map(
        ({ error, waiver }) =>
          `- [${error.artifact}] ${error.message} (waived until ${waiver.expiresOn}: ${waiver.reason})`
      )
    );
  }

  lines.push(
    '',
    '## Artifacts',
    `- GIF: ${gifPath ? path.basename(gifPath) : 'Unavailable'}`,
    `- Server log: ${serverLogPath ? path.basename(serverLogPath) : 'Unavailable'}`,
    `- Video: ${videoPath ? path.basename(videoPath) : 'Unavailable'}`,
    ...screenshots.map((file) => `- Screenshot: ${file}`),
    ''
  );

  const summaryPath = path.join(outDir, 'qa-summary.md');
  await fs.writeFile(summaryPath, `${lines.join('\n')}\n`, 'utf8');
  return summaryPath;
}

async function main() {
  const { allowlistPath, baseUrl, outDir, serverLogPath: serverLogSource } =
    parseArgs(process.argv.slice(2));
  const resultFile = path.join(outDir, 'guest-flow.result.json');
  const run = makeRunner(process.cwd());

  await fs.mkdir(outDir, { recursive: true });
  const waivers = await loadEvidenceWaivers(allowlistPath);

  let testError = null;
  let rawResult = null;

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

  if (await exists(resultFile)) {
    try {
      rawResult = JSON.parse(await fs.readFile(resultFile, 'utf8'));
    } catch (error) {
      if (!testError) {
        testError = error instanceof Error ? error : new Error(String(error));
      }
    }
  } else if (!testError) {
    testError = new Error(`Evidence run did not produce ${resultFile}`);
  }

  const result = normalizeEvidenceResult(baseUrl, rawResult, testError);
  const artifactErrors = [];
  let videoPath = null;

  if (result.rawVideoPath) {
    const targetVideoPath = path.join(outDir, 'guest-flow.webm');

    try {
      if (result.rawVideoPath !== targetVideoPath) {
        await fs.rename(result.rawVideoPath, targetVideoPath);
      }
      videoPath = targetVideoPath;
    } catch (error) {
      artifactErrors.push(
        artifactIssue('video', `Video packaging failed: ${errorMessage(error)}`)
      );
    }
  } else {
    artifactErrors.push(
      artifactIssue('video', 'Playwright did not record host video.')
    );
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
      artifactErrors.push(
        artifactIssue('gif', `GIF generation failed: ${errorMessage(error)}`)
      );
      gifPath = null;
    }
  } else {
    artifactErrors.push(
      artifactIssue('gif', 'GIF generation skipped because video is missing.')
    );
  }

  const { serverLogPath, artifactError: serverLogError } = await copyServerLog(
    serverLogSource,
    outDir
  );
  if (serverLogError) {
    artifactErrors.push(serverLogError);
  }

  artifactErrors.push(
    ...(await collectFileArtifactErrors({
      gifPath,
      outDir,
      screenshots: result.screenshots ?? [],
      serverLogPath,
      videoPath,
    }))
  );

  const verdict = resolveEvidenceVerdict({
    artifactErrors,
    flowError: result.flowError,
    runtimeErrors: result.runtimeErrors ?? [],
    waivers,
  });

  const summaryPath = await writeSummary({
    artifactErrors,
    baseUrl: result.baseUrl || baseUrl,
    checks: result.checks ?? [],
    flowError: result.flowError,
    gifPath,
    outDir,
    result: verdict.result,
    roomCode: result.roomCode ?? '',
    runtimeErrors: result.runtimeErrors ?? [],
    serverLogPath,
    screenshots: result.screenshots ?? [],
    verdict,
    videoPath,
  });

  const manifest = {
    artifactErrors: artifactErrors.map((artifactError) => ({
      artifact: artifactError.artifact,
      message: artifactError.message,
    })),
    baseUrl: result.baseUrl || baseUrl,
    checks: result.checks ?? [],
    flowError: result.flowError,
    gif: gifPath ? path.basename(gifPath) : null,
    result: verdict.result,
    roomCode: result.roomCode ?? '',
    runtimeErrors: result.runtimeErrors ?? [],
    serverLog: serverLogPath ? path.basename(serverLogPath) : null,
    screenshots: result.screenshots ?? [],
    summary: path.basename(summaryPath),
    video: videoPath ? path.basename(videoPath) : null,
    waivedArtifactErrors: verdict.waivedArtifactErrors,
    waivedRuntimeErrors: verdict.waivedRuntimeErrors,
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
        result: verdict.result,
        manifest: path.join(outDir, 'manifest.json'),
        summary: summaryPath,
      },
      null,
      2
    )
  );

  if (testError) {
    throw testError;
  }

  if (result.flowError) {
    throw new Error(result.flowError);
  }

  if (verdict.result === 'FAIL') {
    const failures = [
      ...verdict.unwaivedRuntimeErrors.map(
        (runtimeError) => `runtime: ${runtimeError}`
      ),
      ...verdict.unwaivedArtifactErrors.map(
        (artifactError) =>
          `artifact:${artifactError.artifact}: ${artifactError.message}`
      ),
    ];
    throw new Error(`Evidence failed: ${failures.join('; ')}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
