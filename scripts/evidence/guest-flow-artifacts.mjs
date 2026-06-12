import { constants as fsConstants, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { artifactIssue } from './verdict.mjs';

const DEFAULT_BASE_URL = 'https://www.linejam.app';

export function parseArgs(argv, env = process.env, now = new Date()) {
  const args = {
    allowlistPath: env.LINEJAM_EVIDENCE_ALLOWLIST || '',
    baseUrl: env.LINEJAM_BASE_URL || DEFAULT_BASE_URL,
    outDir:
      env.LINEJAM_EVIDENCE_DIR ||
      path.join(
        tmpdir(),
        `linejam-evidence-${now.toISOString().replace(/[:.]/g, '-')}`
      ),
    serverLogPath: env.LINEJAM_EVIDENCE_SERVER_LOG || '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allowlist' && argv[i + 1]) {
      args.allowlistPath = argv[i + 1];
      i += 1;
    } else if (arg === '--base-url' && argv[i + 1]) {
      args.baseUrl = argv[i + 1];
      i += 1;
    } else if (arg === '--out-dir' && argv[i + 1]) {
      args.outDir = argv[i + 1];
      i += 1;
    } else if (arg === '--server-log' && argv[i + 1]) {
      args.serverLogPath = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

export async function exists(targetPath) {
  try {
    await fs.access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function normalizeEvidenceResult(baseUrl, result, testError) {
  return {
    baseUrl:
      typeof result?.baseUrl === 'string' && result.baseUrl
        ? result.baseUrl
        : baseUrl,
    checks: Array.isArray(result?.checks)
      ? result.checks.map((check) => String(check))
      : [],
    flowError:
      typeof result?.flowError === 'string'
        ? result.flowError
        : testError
          ? errorMessage(testError)
          : null,
    rawVideoPath:
      typeof result?.rawVideoPath === 'string' ? result.rawVideoPath : null,
    roomCode: typeof result?.roomCode === 'string' ? result.roomCode : '',
    runtimeErrors: Array.isArray(result?.runtimeErrors)
      ? result.runtimeErrors.map((runtimeError) => String(runtimeError))
      : [],
    screenshots: Array.isArray(result?.screenshots)
      ? result.screenshots.map((screenshot) => String(screenshot))
      : [],
  };
}

export async function collectFileArtifactErrors({
  gifPath,
  outDir,
  screenshots,
  serverLogPath,
  videoPath,
}) {
  const artifactErrors = [];

  if (screenshots.length === 0) {
    artifactErrors.push(
      artifactIssue('screenshot', 'No screenshots were captured.')
    );
  }

  for (const screenshot of screenshots) {
    const screenshotPath = path.isAbsolute(screenshot)
      ? screenshot
      : path.join(outDir, screenshot);
    if (!(await exists(screenshotPath))) {
      artifactErrors.push(
        artifactIssue('screenshot', `Screenshot is missing: ${screenshot}`)
      );
    }
  }

  if (!videoPath || !(await exists(videoPath))) {
    artifactErrors.push(
      artifactIssue('video', 'Packaged host video is missing.')
    );
  }

  if (!gifPath || !(await exists(gifPath))) {
    artifactErrors.push(artifactIssue('gif', 'Generated GIF is missing.'));
  }

  if (!serverLogPath || !(await exists(serverLogPath))) {
    artifactErrors.push(
      artifactIssue('serverLog', 'Evidence server log is missing.')
    );
  }

  return artifactErrors;
}

export async function copyServerLog(serverLogSource, outDir) {
  if (!serverLogSource) {
    return {
      serverLogPath: null,
      artifactError: artifactIssue(
        'serverLog',
        'LINEJAM_EVIDENCE_SERVER_LOG is not configured.'
      ),
    };
  }

  if (!(await exists(serverLogSource))) {
    return {
      serverLogPath: null,
      artifactError: artifactIssue(
        'serverLog',
        `Evidence server log does not exist: ${serverLogSource}`
      ),
    };
  }

  const serverLogPath = path.join(outDir, 'server.log');
  await fs.copyFile(serverLogSource, serverLogPath);
  return { serverLogPath, artifactError: null };
}

function errorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
