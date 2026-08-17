#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  closeSync,
  writeFileSync,
  writeSync,
  fsyncSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROMPT_TEMPLATE_PATH = resolve(
  REPO_ROOT,
  'scripts/qa/play-scheduled.prompt.md'
);
const SCHEMA_RUN_ID =
  /^[0-9]{8}T[0-9]{6}Z-[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{32}-play$/;
const DEFAULT_PLAYER_COUNT = 4;
const DEFAULT_TIMEOUT_MS = 20 * 60_000;
const INSTALL_TIMEOUT_MS = 5 * 60_000;
const ALERT_THRESHOLD = 2;
const ALERT_LABEL = 'agent-play-qa';
const ALERT_TITLE = '[agent-play-qa] Scheduled play-linejam fleet failing';
const CLOSED_FAILURE_CODES = new Set([
  'interaction_failed',
  'navigation_failed',
  'page_failed',
  'room_closure_failed',
  'join_rejection_failed',
  'runtime_error',
  'semantic_wait_expired',
  'unknown_failure',
  'runner_failed',
]);

function fail(code, detail) {
  const suffix = detail ? `: ${detail}` : '';
  throw new Error(`scheduled-play rejected: ${code}${suffix}`);
}

function isLoopbackHost(hostname) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

export function gateEnvironment(env) {
  const target = env.LINEJAM_PLAY_TARGET;
  if (!target) fail('missing_target', 'set LINEJAM_PLAY_TARGET');

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    fail('invalid_target', 'target must be an absolute URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    fail('invalid_target', 'target must use http or https');
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/'
  ) {
    fail(
      'invalid_target',
      'target must be an origin without credentials, path, query, or hash'
    );
  }
  if (target !== parsed.origin) {
    fail('invalid_target', 'target must use its canonical origin form');
  }

  const loopback = isLoopbackHost(parsed.hostname);
  if (!loopback && env.LINEJAM_PLAY_AUTHORITY !== '1') {
    fail(
      'missing_authority',
      `remote target ${parsed.host} requires LINEJAM_PLAY_AUTHORITY=1 from the operator`
    );
  }

  const players = env.LINEJAM_PLAY_PLAYERS
    ? Number(env.LINEJAM_PLAY_PLAYERS)
    : DEFAULT_PLAYER_COUNT;
  if (!Number.isInteger(players) || players < 2 || players > 6) {
    fail('invalid_players', 'LINEJAM_PLAY_PLAYERS must be an integer 2-6');
  }

  const timeoutMs = env.LINEJAM_PLAY_TIMEOUT_MS
    ? Number(env.LINEJAM_PLAY_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 60_000) {
    fail('invalid_timeout', 'LINEJAM_PLAY_TIMEOUT_MS must be >= 60000');
  }

  const stateDir = resolve(
    env.LINEJAM_PLAY_STATE_DIR ??
      join(homedir(), '.local', 'state', 'linejam-play-qa')
  );
  const repoRoot = resolve(env.LINEJAM_PLAY_REPO ?? REPO_ROOT);

  return {
    target: parsed.origin,
    loopback,
    players,
    timeoutMs,
    stateDir,
    repoRoot,
  };
}

export function slugifyTarget(origin) {
  const parsed = new URL(origin);
  const hostSlug = parsed.host.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase();
  const slug = `${parsed.protocol.replace(':', '')}-${hostSlug}`.replaceAll(
    /-+/g,
    '-'
  );
  return slug.replace(/^-|-$/g, '');
}

export function buildRunId(now, target, entropyHex) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const runId = `${stamp}-${slugifyTarget(target)}-${entropyHex}-play`;
  if (!SCHEMA_RUN_ID.test(runId)) {
    fail('invalid_run_id', 'derived run id does not match the receipt schema');
  }
  return runId;
}

export function renderPrompt(template, values) {
  let rendered = template;
  for (const [key, value] of Object.entries(values)) {
    rendered = rendered.replaceAll(`{{${key}}}`, String(value));
  }
  if (/\{\{[A-Z_]+\}\}/.test(rendered)) {
    fail('prompt_template', 'template placeholders left unrendered');
  }
  return rendered;
}

export function parseReceipt(worktree, runId, read = readFileSync) {
  const receiptPath = join(worktree, '.qa', 'runs', runId, 'result.json');
  if (!existsSync(receiptPath)) {
    return { status: 'runner_failed', error: 'runner_failed' };
  }
  let receipt;
  try {
    receipt = JSON.parse(read(receiptPath, 'utf8'));
  } catch {
    return { status: 'runner_failed', error: 'runner_failed' };
  }
  if (receipt?.runId !== runId) {
    return { status: 'runner_failed', error: 'runner_failed' };
  }
  if (receipt.status === 'passed') {
    return { status: 'passed', error: null, durationMs: receipt.durationMs };
  }
  const code = CLOSED_FAILURE_CODES.has(receipt.error)
    ? receipt.error
    : 'unknown_failure';
  return {
    status: receipt.status === 'aborted' ? 'aborted' : 'failed',
    error: code,
  };
}

export function readState(stateDir, read = readFileSync) {
  const statePath = join(stateDir, 'state.json');
  try {
    const parsed = JSON.parse(read(statePath, 'utf8'));
    return {
      consecutiveFailures: Number.isInteger(parsed.consecutiveFailures)
        ? parsed.consecutiveFailures
        : 0,
      alertIssue: Number.isInteger(parsed.alertIssue)
        ? parsed.alertIssue
        : null,
    };
  } catch {
    return { consecutiveFailures: 0, alertIssue: null };
  }
}

export function planAlert(state, outcome) {
  if (outcome.status === 'passed') {
    return state.alertIssue === null
      ? { action: 'none', consecutiveFailures: 0 }
      : {
          action: 'close',
          issue: state.alertIssue,
          consecutiveFailures: 0,
        };
  }
  const consecutiveFailures = state.consecutiveFailures + 1;
  if (consecutiveFailures < ALERT_THRESHOLD) {
    return { action: 'none', consecutiveFailures };
  }
  return state.alertIssue === null
    ? { action: 'open', consecutiveFailures }
    : {
        action: 'comment',
        issue: state.alertIssue,
        consecutiveFailures,
      };
}

function acquireLock(stateDir) {
  const lockPath = join(stateDir, 'lock');
  try {
    const fd = openSync(lockPath, 'wx');
    closeSync(fd);
    return lockPath;
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      fail(
        'already_running',
        'a previous run holds the lock; remove it only after confirming that run exited'
      );
    }
    throw error;
  }
}

function writeState(stateDir, state) {
  mkdirSync(stateDir, { recursive: true });
  const statePath = join(stateDir, 'state.json');
  const tmp = `${statePath}.tmp`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, JSON.stringify(state, null, 2));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, statePath);
}

function buildAlertBody(outcome, runId, target) {
  const code = outcome.error ?? 'unknown_failure';
  const host = new URL(target).host;
  return [
    'Scheduled play-linejam fleet failed two consecutive runs.',
    '',
    `- Run id: ${runId}`,
    `- Outcome: ${outcome.status}`,
    `- Closed error code: ${code}`,
    `- Target host: ${host}`,
    '',
    'Receipts and screenshots stay on the runner host under the play-qa state directory; they are private evidence and are not attached here.',
  ].join('\n');
}

function recoverBody(runId) {
  return [
    'Scheduled play-linejam fleet recovered with a passing run.',
    '',
    `- Run id: ${runId}`,
  ].join('\n');
}

export async function runScheduledPlay(env, deps = {}) {
  const run =
    deps.run ??
    ((file, args, options) =>
      spawnSync(file, args, { encoding: 'utf8', ...options }));
  const now = deps.now ?? (() => new Date());
  const randomHex = deps.randomHex ?? (() => randomBytes(16).toString('hex'));

  const config = gateEnvironment(env);
  const runId = buildRunId(now(), config.target, randomHex());
  mkdirSync(config.stateDir, { recursive: true });
  const lockPath = acquireLock(config.stateDir);
  const outDir = join(config.stateDir, 'runs', runId);
  const worktree = mkdtempSync(
    join(tmpdir(), `linejam-play-${runId.slice(0, 15)}-`)
  );
  const socketDir = mkdtempSync(join(tmpdir(), 'ljp-ab-'));

  try {
    mkdirSync(outDir, { recursive: true });

    const fetched = run('git', ['-C', config.repoRoot, 'fetch', 'origin'], {
      timeout: 120_000,
    });
    if (fetched.status !== 0) fail('runner_failed', 'git fetch origin failed');
    const head = run(
      'git',
      ['-C', config.repoRoot, 'symbolic-ref', 'refs/remotes/origin/HEAD'],
      { timeout: 10_000 }
    );
    if (head.status !== 0) fail('runner_failed', 'cannot resolve origin HEAD');
    const branch =
      head.stdout.trim().replace('refs/remotes/', '') || 'origin/master';
    const added = run(
      'git',
      ['-C', config.repoRoot, 'worktree', 'add', '--detach', worktree, branch],
      { timeout: 60_000 }
    );
    if (added.status !== 0) fail('runner_failed', 'worktree add failed');

    const installed = run('pnpm', ['install', '--frozen-lockfile'], {
      cwd: worktree,
      timeout: INSTALL_TIMEOUT_MS,
    });
    if (installed.status !== 0) {
      fail('runner_failed', 'pnpm install failed in the run worktree');
    }

    const template = readFileSync(PROMPT_TEMPLATE_PATH, 'utf8');
    const prompt = renderPrompt(template, {
      TARGET: config.target,
      RUN_ID: runId,
      PLAYER_COUNT: config.players,
    });
    const promptPath = join(outDir, 'prompt.md');
    writeFileSync(promptPath, prompt);

    const agent = run(
      'omp',
      [
        '--auto-approve',
        '--no-session',
        '--max-time',
        `${Math.floor(config.timeoutMs / 1000)}s`,
        '--cwd',
        worktree,
        '-p',
        `@${promptPath}`,
      ],
      {
        timeout: config.timeoutMs + 120_000,
        env: {
          ...process.env,
          AGENT_BROWSER_SOCKET_DIR: socketDir,
          LINEJAM_PLAY_BASE_URL: config.target,
        },
      }
    );
    if (agent.stdout) {
      writeFileSync(join(outDir, 'agent.log'), agent.stdout);
    }

    const outcome =
      agent.status === 0
        ? parseReceipt(worktree, runId)
        : { status: 'runner_failed', error: 'runner_failed' };

    const runEvidence = join(worktree, '.qa', 'runs', runId);
    if (existsSync(runEvidence)) {
      cpSync(runEvidence, join(outDir, 'qa-run'), { recursive: true });
    }

    const state = readState(config.stateDir);
    const plan = planAlert(state, outcome);
    const nextState = {
      consecutiveFailures: plan.consecutiveFailures,
      alertIssue: state.alertIssue,
      lastRunId: runId,
    };

    if (plan.action === 'open') {
      const created = run(
        'gh',
        [
          'issue',
          'create',
          '--repo',
          'misty-step/linejam',
          '--title',
          ALERT_TITLE,
          '--label',
          ALERT_LABEL,
          '--body',
          buildAlertBody(outcome, runId, config.target),
        ],
        { timeout: 60_000 }
      );
      if (created.status === 0) {
        const url = created.stdout.trim();
        const numberMatch = /\/issues\/(\d+)/.exec(url);
        nextState.alertIssue = numberMatch ? Number(numberMatch[1]) : null;
      }
    } else if (plan.action === 'comment') {
      run(
        'gh',
        [
          'issue',
          'comment',
          String(plan.issue),
          '--repo',
          'misty-step/linejam',
          '--body',
          buildAlertBody(outcome, runId, config.target),
        ],
        { timeout: 60_000 }
      );
    } else if (plan.action === 'close') {
      run(
        'gh',
        [
          'issue',
          'comment',
          String(plan.issue),
          '--repo',
          'misty-step/linejam',
          '--body',
          recoverBody(runId),
        ],
        { timeout: 60_000 }
      );
      run(
        'gh',
        ['issue', 'close', String(plan.issue), '--repo', 'misty-step/linejam'],
        { timeout: 60_000 }
      );
      nextState.alertIssue = null;
    }

    writeState(config.stateDir, nextState);

    const host = new URL(config.target).host;
    const receiptLine = `linejam-play-qa ${runId} ${outcome.status} ${outcome.error ?? 'ok'} players=${config.players} target=${host}`;
    process.stdout.write(`${receiptLine}\n`);

    return outcome.status === 'passed' ? 0 : 1;
  } finally {
    rmSync(worktree, { recursive: true, force: true });
    run('git', ['-C', config.repoRoot, 'worktree', 'prune'], {
      timeout: 60_000,
    });
    rmSync(socketDir, { recursive: true, force: true });
    rmSync(lockPath, { force: true });
  }
}

async function main() {
  const code = await runScheduledPlay(process.env);
  process.exitCode = code;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
