#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createFailedManifest } from '../../qa/agentic/manifest.mjs';
import {
  gradeAgenticManifest,
  renderCriticSummary,
} from '../../qa/agentic/critic.mjs';
import { getMission } from '../../qa/agentic/missions.mjs';
import { runPromptfooCritic } from '../../qa/agentic/promptfoo.mjs';
import { runStagehandExploration } from '../../qa/agentic/stagehand.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_LOCAL_BASE_URL = 'http://localhost:3333';
const RUN_ID_PATTERN = /[^a-zA-Z0-9._-]/g;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function usage() {
  return [
    'Usage: pnpm qa:agentic:{local|preview} --mission <name> [--base-url <url>] [--out-dir <path>]',
    '',
    'Missions:',
    '  guest-host-signed-in-join',
    '  signed-in-host-guest-join',
  ].join('\n');
}

export function parseArgs(argv, env = process.env) {
  const args = {
    baseUrl: env.PLAYWRIGHT_BASE_URL || DEFAULT_LOCAL_BASE_URL,
    mission: '',
    outDir: '',
    target: 'local',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      return { ...args, help: true };
    }
    if (arg === '--target' && argv[i + 1]) {
      args.target = argv[i + 1];
      i += 1;
    } else if (arg === '--mission' && argv[i + 1]) {
      args.mission = argv[i + 1];
      i += 1;
    } else if (arg === '--base-url' && argv[i + 1]) {
      args.baseUrl = argv[i + 1];
      i += 1;
    } else if (arg === '--out-dir' && argv[i + 1]) {
      args.outDir = argv[i + 1];
      i += 1;
    }
  }

  if (!args.mission) {
    throw new Error(`--mission is required\n${usage()}`);
  }

  getMission(args.mission);

  if (args.target === 'preview' && !argv.includes('--base-url')) {
    throw new Error('--base-url is required for preview agentic QA runs');
  }

  return args;
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

async function exists(filePath) {
  try {
    await fs.access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function makeRunId({ mission, target }) {
  return `${timestamp()}-${target}-${mission}`.replace(RUN_ID_PATTERN, '-');
}

function spawnPlaywright({
  baseUrl,
  mission,
  outputDir,
  resultFile,
  runDir,
  spawnProcess,
  target,
}) {
  return new Promise((resolve) => {
    const child = spawnProcess(
      pnpmCommand(),
      [
        'exec',
        'playwright',
        'test',
        'tests/e2e/agentic-qa.spec.ts',
        '--grep',
        `@agentic:${mission}`,
        '--project=chromium',
        '--workers=1',
        '--retries=0',
        '--reporter=line',
        '--output',
        outputDir,
      ],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          E2E_BASE_URL: baseUrl,
          LINEJAM_AGENTIC_MISSION: mission,
          LINEJAM_AGENTIC_RESULT_FILE: resultFile,
          LINEJAM_AGENTIC_RUN_DIR: runDir,
          LINEJAM_AGENTIC_TARGET: target,
          PLAYWRIGHT_HTML_OPEN: 'never',
        },
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
      resolve({ code: 1, error, stdout, stderr });
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function writeManifestAndCritic({ manifest, runDir }) {
  const critic = gradeAgenticManifest(manifest);
  const nextManifest = {
    ...manifest,
    critic,
  };
  const manifestPath = path.join(runDir, 'manifest.json');
  const criticPath = path.join(runDir, 'critic.json');
  const summaryPath = path.join(runDir, 'critic-summary.md');

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(nextManifest, null, 2)}\n`
  );
  await fs.writeFile(criticPath, `${JSON.stringify(critic, null, 2)}\n`);
  await fs.writeFile(
    summaryPath,
    renderCriticSummary({ manifest: nextManifest, critic })
  );

  return {
    critic,
    criticPath,
    manifestPath,
    summaryPath,
  };
}

function relativizeStagehandArtifacts(stagehand, runDir) {
  if (!stagehand || typeof stagehand !== 'object') {
    return stagehand;
  }

  return {
    ...stagehand,
    artifacts: Array.isArray(stagehand.artifacts)
      ? stagehand.artifacts.map((artifact) => ({
          ...artifact,
          path: path.isAbsolute(artifact.path)
            ? path.relative(runDir, artifact.path)
            : artifact.path,
        }))
      : [],
  };
}

async function collectFailureArtifacts({ outputDir, runDir }) {
  const artifacts = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const source = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(source);
        continue;
      }
      if (!/\.(png|jpg|jpeg)$/i.test(entry.name)) {
        continue;
      }

      const target = path.join(runDir, `failure-${artifacts.length + 1}.png`);
      await fs.copyFile(source, target);
      artifacts.push({ kind: 'screenshot', path: target });
    }
  }

  await walk(outputDir);
  return artifacts;
}

export async function runAgenticQa({
  argv = process.argv.slice(2),
  env = process.env,
  spawnProcess = spawn,
  promptfooRunner = runPromptfooCritic,
  stagehandRunner = runStagehandExploration,
  writeOut = (value) => process.stdout.write(value),
  writeErr = (...value) => console.error(...value),
  exit = (code) => process.exit(code),
} = {}) {
  let args;
  try {
    args = parseArgs(argv, env);
  } catch (error) {
    writeErr(error instanceof Error ? error.message : String(error));
    exit(1);
    return null;
  }

  if (args.help) {
    writeOut(`${usage()}\n`);
    exit(0);
    return null;
  }

  const runId = makeRunId(args);
  const runDir = path.resolve(args.outDir || path.join('.qa', 'runs', runId));
  const outputDir = path.join(runDir, 'playwright-output');
  const resultFile = path.join(runDir, 'agentic-result.json');
  const startedAt = new Date().toISOString();

  await fs.mkdir(runDir, { recursive: true });

  const stagehand = await stagehandRunner({
    baseUrl: args.baseUrl,
    env,
    mission: args.mission,
    runDir,
  });
  const manifestStagehand = relativizeStagehandArtifacts(stagehand, runDir);

  const execution = await spawnPlaywright({
    baseUrl: args.baseUrl,
    mission: args.mission,
    outputDir,
    resultFile,
    runDir,
    spawnProcess,
    target: args.target,
  });

  let manifest;
  if (await exists(resultFile)) {
    manifest = JSON.parse(await fs.readFile(resultFile, 'utf8'));
    manifest = {
      ...manifest,
      artifacts: [
        ...(Array.isArray(manifest.artifacts) ? manifest.artifacts : []),
        ...stagehand.artifacts.map((artifact) => ({
          kind: artifact.kind,
          path: path.relative(runDir, artifact.path),
        })),
      ],
      stagehand: manifestStagehand,
      transcript: [
        ...(Array.isArray(manifest.transcript) ? manifest.transcript : []),
        ...stagehand.transcript,
      ],
    };
  } else {
    const failureArtifacts = await collectFailureArtifacts({
      outputDir,
      runDir,
    });
    manifest = createFailedManifest({
      artifacts: [...failureArtifacts, ...stagehand.artifacts],
      baseUrl: args.baseUrl,
      error:
        execution.error ||
        new Error(
          `Agentic Playwright mission exited with ${execution.code ?? 'unknown'}`
        ),
      finishedAt: new Date().toISOString(),
      mission: args.mission,
      runId,
      stagehand: manifestStagehand,
      startedAt,
      target: args.target,
      runDir,
    });
  }

  const promptfoo = await promptfooRunner({
    env,
    manifest,
    runDir,
    spawnProcess,
  });
  const evidence = await writeManifestAndCritic({
    manifest: {
      ...manifest,
      promptfoo,
    },
    runDir,
  });
  const ok = manifest.result === 'pass' && evidence.critic.verdict === 'pass';
  const payload = {
    ok,
    runDir,
    manifest: evidence.manifestPath,
    criticSummary: evidence.summaryPath,
    critic: evidence.critic,
    promptfoo,
  };

  writeOut(`${JSON.stringify(payload, null, 2)}\n`);
  exit(ok ? 0 : 1);
  return payload;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runAgenticQa();
}
