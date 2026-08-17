/** @vitest-environment node */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRunId,
  gateEnvironment,
  parseReceipt,
  planAlert,
  renderPrompt,
  runScheduledPlay,
  slugifyTarget,
} from '@/scripts/qa/run-scheduled-play.mjs';

const RUN_ID_PATTERN = new RegExp(
  JSON.parse(
    readFileSync(
      path.resolve('.agents/skills/play-linejam/result.schema.json'),
      'utf8'
    )
  ).properties.runId.pattern
);

type ReceiptFixture = {
  runId: string;
  status: 'passed' | 'failed' | 'aborted';
  durationMs?: number;
  error?: string | null;
};

const ENTROPY = '00112233445566778899aabbccddeeff';
const NOW = new Date('2026-08-17T12:00:00.000Z');
const PROMPT_TEMPLATE =
  'target {{TARGET}} run {{RUN_ID}} players {{PLAYER_COUNT}}';

let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(path.join(tmpdir(), 'run-scheduled-play-'));
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function validEnv(overrides = {}) {
  return {
    LINEJAM_PLAY_TARGET: 'https://www.linejam.app',
    LINEJAM_PLAY_AUTHORITY: '1',
    LINEJAM_PLAY_STATE_DIR: path.join(scratch, 'state'),
    LINEJAM_PLAY_REPO: scratch,
    ...overrides,
  };
}

describe('gateEnvironment', () => {
  it('accepts an authorized canonical remote origin', () => {
    const config = gateEnvironment(validEnv());
    expect(config.target).toBe('https://www.linejam.app');
    expect(config.loopback).toBe(false);
    expect(config.players).toBe(4);
  });

  it('fails closed without a target', () => {
    expect(() =>
      gateEnvironment(validEnv({ LINEJAM_PLAY_TARGET: undefined }))
    ).toThrow('missing_target');
  });

  it('rejects non-origin and non-canonical targets', () => {
    expect(() =>
      gateEnvironment(
        validEnv({ LINEJAM_PLAY_TARGET: 'https://www.linejam.app/host' })
      )
    ).toThrow('invalid_target');
    expect(() =>
      gateEnvironment(
        validEnv({ LINEJAM_PLAY_TARGET: 'https://user@www.linejam.app' })
      )
    ).toThrow('invalid_target');
    expect(() =>
      gateEnvironment(
        validEnv({ LINEJAM_PLAY_TARGET: 'ftp://www.linejam.app' })
      )
    ).toThrow('invalid_target');
    expect(() =>
      gateEnvironment(
        validEnv({ LINEJAM_PLAY_TARGET: 'https://www.linejam.app:443' })
      )
    ).toThrow('invalid_target');
    expect(() =>
      gateEnvironment(validEnv({ LINEJAM_PLAY_TARGET: 'nope' }))
    ).toThrow('invalid_target');
  });

  it('requires explicit authority for every remote target', () => {
    expect(() =>
      gateEnvironment(validEnv({ LINEJAM_PLAY_AUTHORITY: undefined }))
    ).toThrow('missing_authority');
    expect(() =>
      gateEnvironment(validEnv({ LINEJAM_PLAY_AUTHORITY: 'true' }))
    ).toThrow('missing_authority');
  });

  it('allows loopback targets without the authority flag', () => {
    for (const target of [
      'http://localhost:3333',
      'http://127.0.0.1:3333',
      'http://[::1]:3000',
    ]) {
      const config = gateEnvironment(
        validEnv({
          LINEJAM_PLAY_TARGET: target,
          LINEJAM_PLAY_AUTHORITY: undefined,
        })
      );
      expect(config.loopback).toBe(true);
    }
  });

  it('bounds player count and timeout', () => {
    expect(() =>
      gateEnvironment(validEnv({ LINEJAM_PLAY_PLAYERS: '7' }))
    ).toThrow('invalid_players');
    expect(() =>
      gateEnvironment(validEnv({ LINEJAM_PLAY_PLAYERS: '1' }))
    ).toThrow('invalid_players');
    expect(() =>
      gateEnvironment(validEnv({ LINEJAM_PLAY_PLAYERS: 'four' }))
    ).toThrow('invalid_players');
    expect(
      gateEnvironment(validEnv({ LINEJAM_PLAY_PLAYERS: '6' })).players
    ).toBe(6);
    expect(() =>
      gateEnvironment(validEnv({ LINEJAM_PLAY_TIMEOUT_MS: '30000' }))
    ).toThrow('invalid_timeout');
  });
});

describe('slugifyTarget and buildRunId', () => {
  it('derives schema-safe slugs', () => {
    expect(slugifyTarget('https://www.linejam.app')).toBe(
      'https-www-linejam-app'
    );
    expect(slugifyTarget('http://localhost:3333')).toBe('http-localhost-3333');
  });

  it('builds run ids matching the receipt schema', () => {
    const runId = buildRunId(NOW, 'https://www.linejam.app', ENTROPY);
    expect(runId).toBe(
      '20260817T120000Z-https-www-linejam-app-00112233445566778899aabbccddeeff-play'
    );
    expect(RUN_ID_PATTERN.test(runId)).toBe(true);
  });

  it('rejects entropy that breaks the schema', () => {
    expect(() => buildRunId(NOW, 'https://www.linejam.app', 'XYZ')).toThrow(
      'invalid_run_id'
    );
  });
});

describe('renderPrompt', () => {
  it('renders every placeholder', () => {
    expect(
      renderPrompt(PROMPT_TEMPLATE, {
        TARGET: 'https://www.linejam.app',
        RUN_ID: 'rid',
        PLAYER_COUNT: 4,
      })
    ).toBe('target https://www.linejam.app run rid players 4');
  });

  it('fails when placeholders remain', () => {
    expect(() =>
      renderPrompt(PROMPT_TEMPLATE, {
        TARGET: 'https://www.linejam.app',
        RUN_ID: 'rid',
      })
    ).toThrow('prompt_template');
  });
});

describe('parseReceipt', () => {
  function writeReceipt(runId: string, body: ReceiptFixture) {
    const dir = path.join(scratch, 'wt', '.qa', 'runs', runId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'result.json'), JSON.stringify(body));
  }

  const runId = buildRunId(NOW, 'https://www.linejam.app', ENTROPY);

  it('maps a passed receipt', () => {
    writeReceipt(runId, { runId, status: 'passed', durationMs: 600000 });
    expect(parseReceipt(path.join(scratch, 'wt'), runId)).toEqual({
      status: 'passed',
      error: null,
      durationMs: 600000,
    });
  });

  it('keeps closed failure codes and rejects free-form errors', () => {
    writeReceipt(runId, {
      runId,
      status: 'failed',
      error: 'room_closure_failed',
    });
    expect(parseReceipt(path.join(scratch, 'wt'), runId)).toEqual({
      status: 'failed',
      error: 'room_closure_failed',
    });

    writeReceipt(runId, {
      runId,
      status: 'failed',
      error: 'Room ABCD exploded with poem text',
    });
    expect(parseReceipt(path.join(scratch, 'wt'), runId)).toEqual({
      status: 'failed',
      error: 'unknown_failure',
    });
  });

  it('fails closed on missing, corrupt, or mismatched receipts', () => {
    expect(parseReceipt(path.join(scratch, 'wt'), runId)).toEqual({
      status: 'runner_failed',
      error: 'runner_failed',
    });

    writeReceipt(runId, { runId: 'other-run', status: 'passed' });
    expect(parseReceipt(path.join(scratch, 'wt'), runId)).toEqual({
      status: 'runner_failed',
      error: 'runner_failed',
    });
  });
});

describe('planAlert', () => {
  const failure = { status: 'failed', error: 'semantic_wait_expired' };
  const passed = { status: 'passed', error: null };

  it('escalates only on the second consecutive failure', () => {
    const clean = { consecutiveFailures: 0, alertIssue: null };
    expect(planAlert(clean, failure)).toEqual({
      action: 'none',
      consecutiveFailures: 1,
    });
    expect(
      planAlert({ consecutiveFailures: 1, alertIssue: null }, failure)
    ).toEqual({
      action: 'open',
      consecutiveFailures: 2,
    });
    expect(
      planAlert({ consecutiveFailures: 2, alertIssue: 461 }, failure)
    ).toEqual({
      action: 'comment',
      issue: 461,
      consecutiveFailures: 3,
    });
  });

  it('closes the alert issue on recovery and is quiet otherwise', () => {
    expect(
      planAlert({ consecutiveFailures: 0, alertIssue: null }, passed)
    ).toEqual({
      action: 'none',
      consecutiveFailures: 0,
    });
    expect(
      planAlert({ consecutiveFailures: 2, alertIssue: 461 }, passed)
    ).toEqual({
      action: 'close',
      issue: 461,
      consecutiveFailures: 0,
    });
  });
});

describe('runScheduledPlay', () => {
  function fakeRun(outcome: {
    agentStatus: number;
    receipt?: (runId: string) => ReceiptFixture;
  }) {
    const calls: Array<[string, string[]]> = [];
    const run = vi.fn((file, args) => {
      calls.push([file, args]);
      if (file === 'git' && args[2] === 'fetch') {
        return { status: 0, stdout: '' };
      }
      if (file === 'git' && args[2] === 'symbolic-ref') {
        return { status: 0, stdout: 'refs/remotes/origin/master\n' };
      }
      if (file === 'git' && args[2] === 'worktree' && args[3] === 'add') {
        mkdirSync(args[5], { recursive: true });
        return { status: 0, stdout: '' };
      }
      if (file === 'git' && args[2] === 'worktree' && args[3] === 'prune') {
        return { status: 0, stdout: '' };
      }
      if (file === 'pnpm') {
        return { status: 0, stdout: '' };
      }
      if (file === 'omp') {
        const promptArg = args.find((arg: string) => arg.startsWith('@'));
        const runId = /runs\/([^/]+)\/prompt\.md$/.exec(promptArg)?.[1];
        const worktree = args[args.indexOf('--cwd') + 1];
        if (outcome.agentStatus === 0 && runId && outcome.receipt) {
          const dir = path.join(worktree, '.qa', 'runs', runId);
          mkdirSync(dir, { recursive: true });
          writeFileSync(
            path.join(dir, 'result.json'),
            JSON.stringify(outcome.receipt(runId))
          );
          writeFileSync(path.join(dir, 'artifact-0001.png'), 'png');
        }
        return { status: outcome.agentStatus, stdout: 'agent output' };
      }
      if (file === 'gh' && args[1] === 'create') {
        return {
          status: 0,
          stdout: 'https://github.com/misty-step/linejam/issues/461\n',
        };
      }
      if (file === 'gh') {
        return { status: 0, stdout: '' };
      }
      return { status: 1, stdout: '' };
    });
    return { run, calls };
  }

  const passedReceipt = (runId: string): ReceiptFixture => ({
    runId,
    status: 'passed',
    durationMs: 600000,
  });

  it('runs the fleet, persists evidence, and writes state on success', async () => {
    const { run, calls } = fakeRun({ agentStatus: 0, receipt: passedReceipt });
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const code = await runScheduledPlay(validEnv(), {
      run,
      now: () => NOW,
      randomHex: () => ENTROPY,
    });

    expect(code).toBe(0);
    const runId = buildRunId(NOW, 'https://www.linejam.app', ENTROPY);
    const stateDir = path.join(scratch, 'state');
    expect(
      existsSync(path.join(stateDir, 'runs', runId, 'qa-run', 'result.json'))
    ).toBe(true);
    expect(
      existsSync(
        path.join(stateDir, 'runs', runId, 'qa-run', 'artifact-0001.png')
      )
    ).toBe(true);
    expect(
      JSON.parse(readFileSync(path.join(stateDir, 'state.json'), 'utf8'))
    ).toMatchObject({
      consecutiveFailures: 0,
      alertIssue: null,
      lastRunId: runId,
    });
    expect(existsSync(path.join(stateDir, 'lock'))).toBe(false);
    expect(calls.some(([file]) => file === 'gh')).toBe(false);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('passed ok players=4 target=www.linejam.app')
    );
    const ompCall = calls.find(([file]) => file === 'omp');
    expect(ompCall).toBeDefined();
  });

  it('opens an alert issue only on the second consecutive failure', async () => {
    const env = validEnv();
    const failedReceipt = (runId: string): ReceiptFixture => ({
      runId,
      status: 'failed',
      error: 'room_closure_failed',
    });

    const first = fakeRun({ agentStatus: 0, receipt: failedReceipt });
    const code1 = await runScheduledPlay(env, {
      run: first.run,
      now: () => NOW,
      randomHex: () => ENTROPY,
    });
    expect(code1).toBe(1);
    expect(first.calls.some(([file]) => file === 'gh')).toBe(false);

    const second = fakeRun({ agentStatus: 0, receipt: failedReceipt });
    const code2 = await runScheduledPlay(env, {
      run: second.run,
      now: () => new Date('2026-08-17T16:00:00.000Z'),
      randomHex: () => '11223344556677889900aabbccddeeff',
    });
    expect(code2).toBe(1);
    const created = second.calls.find(
      ([file, args]) => file === 'gh' && args[1] === 'create'
    );
    expect(created).toBeDefined();
    expect(created?.[1]).toContain('agent-play-qa');

    const recovered = fakeRun({ agentStatus: 0, receipt: passedReceipt });
    const code3 = await runScheduledPlay(env, {
      run: recovered.run,
      now: () => new Date('2026-08-17T20:00:00.000Z'),
      randomHex: () => '22334455667788990011aabbccddeeff',
    });
    expect(code3).toBe(0);
    expect(
      recovered.calls.some(
        ([file, args]) =>
          file === 'gh' && args[1] === 'close' && args[2] === '461'
      )
    ).toBe(true);
    expect(
      JSON.parse(
        readFileSync(path.join(scratch, 'state', 'state.json'), 'utf8')
      )
    ).toMatchObject({ consecutiveFailures: 0, alertIssue: null });
  });

  it('maps an agent crash to runner_failed without touching gh below threshold', async () => {
    const { run, calls } = fakeRun({ agentStatus: 1 });
    const code = await runScheduledPlay(validEnv(), {
      run,
      now: () => NOW,
      randomHex: () => ENTROPY,
    });
    expect(code).toBe(1);
    expect(calls.some(([file]) => file === 'gh')).toBe(false);
  });

  it('refuses a second concurrent run while the lock is held', async () => {
    const stateDir = path.join(scratch, 'state');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(path.join(stateDir, 'lock'), '');
    await expect(
      runScheduledPlay(validEnv(), { now: () => NOW, randomHex: () => ENTROPY })
    ).rejects.toThrow('already_running');
  });
});
