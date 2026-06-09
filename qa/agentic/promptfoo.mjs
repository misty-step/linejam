import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function enabled(env) {
  return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(
    env.LINEJAM_PROMPTFOO_CRITIC || ''
  );
}

function spawnPromptfoo({ env, manifest, outputPath, spawnProcess }) {
  return new Promise((resolve) => {
    const child = spawnProcess(
      pnpmCommand(),
      [
        'exec',
        'promptfoo',
        'eval',
        '-c',
        'qa/agentic/promptfoo.yaml',
        '--var',
        `manifest=${JSON.stringify(manifest)}`,
        '--output',
        outputPath,
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      resolve({
        ok: false,
        skipped: false,
        code: null,
        reason: error instanceof Error ? error.message : String(error),
        stdout,
        stderr,
      });
    });
    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        skipped: false,
        code,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   manifest: unknown,
 *   runDir: string,
 *   spawnProcess?: typeof spawn,
 * }} options
 */
export async function runPromptfooCritic({
  env = process.env,
  manifest,
  runDir,
  spawnProcess = spawn,
} = {}) {
  const outputPath = path.join(runDir, 'promptfoo.json');

  if (!enabled(env)) {
    return {
      ok: true,
      skipped: true,
      reason: 'LINEJAM_PROMPTFOO_CRITIC is not enabled',
      outputPath,
    };
  }

  const result = await spawnPromptfoo({
    env,
    manifest,
    outputPath,
    spawnProcess,
  });
  await fs.writeFile(
    path.join(runDir, 'promptfoo-result.json'),
    `${JSON.stringify({ ...result, outputPath }, null, 2)}\n`
  );

  return {
    ...result,
    outputPath,
  };
}
