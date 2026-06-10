/** @vitest-environment node */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gradeAgenticManifest } from '@/qa/agentic/critic.mjs';
import {
  createAgenticManifest,
  createFailedManifest,
} from '@/qa/agentic/manifest.mjs';
import { getMission } from '@/qa/agentic/missions.mjs';
import { runPromptfooCritic } from '@/qa/agentic/promptfoo.mjs';
import { runStagehandExploration } from '@/qa/agentic/stagehand.mjs';
import { parseArgs, runAgenticQa } from '@/scripts/qa/agentic.mjs';

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true }))
  );
  tempDirs = [];
  vi.restoreAllMocks();
});

function healthyManifest(runDir: string) {
  return createAgenticManifest({
    artifacts: [
      { kind: 'screenshot', path: path.join(runDir, 'host-lobby.png') },
      { kind: 'screenshot', path: path.join(runDir, 'signed-in-join.png') },
    ],
    baseUrl: 'https://preview.linejam.app',
    deterministicChecks: [
      { name: 'guest host created room', status: 'pass' },
      { name: 'signed-in player joined room', status: 'pass' },
      { name: 'host sees signed-in player', status: 'pass' },
      { name: 'signed-in player sees host', status: 'pass' },
      { name: 'generic error UI absent', status: 'pass' },
    ],
    stagehand: {
      ok: true,
      skipped: false,
      modelName: 'openai/gpt-4.1-mini',
      artifacts: [
        {
          kind: 'screenshot',
          path: path.join(runDir, 'stagehand-overview.png'),
        },
      ],
      transcript: [{ actor: 'stagehand', text: 'Observed join flow.' }],
    },
    finishedAt: '2026-06-06T00:00:01.000Z',
    mission: 'guest-host-signed-in-join',
    result: 'pass',
    runDir,
    runId: 'run-1',
    runtimeErrors: [],
    startedAt: '2026-06-06T00:00:00.000Z',
    target: 'preview',
    transcript: [{ actor: 'harness', text: 'signed-in player joined room' }],
  });
}

function createMockChild(exitCode: number) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  queueMicrotask(() => child.emit('close', exitCode));
  return child;
}

const runStagehand = runStagehandExploration as (
  options: Record<string, unknown>
) => Promise<Record<string, unknown>>;

describe('agentic QA missions', () => {
  it('defines both oracle missions as auth-required browser missions', () => {
    expect(getMission('guest-host-signed-in-join')).toMatchObject({
      requiresAuth: true,
    });
    expect(getMission('signed-in-host-guest-join')).toMatchObject({
      requiresAuth: true,
    });
  });
});

describe('agentic QA critic', () => {
  it('fails malformed manifests before reading mission evidence', () => {
    expect(gradeAgenticManifest(null)).toEqual({
      verdict: 'fail',
      score: 0,
      findings: ['Manifest is missing or malformed.'],
    });
  });

  it('passes a healthy join manifest', () => {
    const result = gradeAgenticManifest(healthyManifest('/tmp/run'));

    expect(result.verdict).toBe('pass');
    expect(result.findings).toEqual([]);
  });

  it('fails a manifest that omits expected mission evidence', () => {
    const manifest = createAgenticManifest({
      artifacts: [{ kind: 'screenshot', path: '/tmp/run/host-lobby.png' }],
      baseUrl: 'https://preview.linejam.app',
      deterministicChecks: [
        { name: 'generic error UI absent', status: 'pass' },
      ],
      finishedAt: '2026-06-06T00:00:01.000Z',
      mission: 'guest-host-signed-in-join',
      result: 'pass',
      runDir: '/tmp/run',
      runId: 'run-incomplete',
      startedAt: '2026-06-06T00:00:00.000Z',
      target: 'preview',
      stagehand: {
        ok: true,
        skipped: false,
        artifacts: [],
        transcript: [],
      },
    });

    const result = gradeAgenticManifest(manifest);

    expect(result.verdict).toBe('fail');
    expect(result.findings.join('\n')).toContain(
      'Missing expected check: guest host created room.'
    );
    expect(result.findings.join('\n')).toContain(
      'Missing expected screenshot: signed-in-join.png.'
    );
  });

  it('fails an injected generic join error', () => {
    const manifest = {
      ...healthyManifest('/tmp/run'),
      runtimeErrors: ['Generic join error: unexpected error occurred'],
    };

    const result = gradeAgenticManifest(manifest);

    expect(result.verdict).toBe('fail');
    expect(result.findings.join('\n')).toMatch(/Generic error surfaced/);
  });

  it('fails a manifest without passing Stagehand exploration', () => {
    const manifest = {
      ...healthyManifest('/tmp/run'),
      stagehand: {
        ok: false,
        skipped: true,
        reason: 'missing model key',
      },
    };

    const result = gradeAgenticManifest(manifest);

    expect(result.verdict).toBe('fail');
    expect(result.findings.join('\n')).toContain(
      'Stagehand exploration did not pass'
    );
  });

  it('reports unknown missions and unnamed failed deterministic checks', () => {
    const manifest = {
      result: 'fail',
      mission: 'unknown-mission',
      deterministicChecks: [{ status: 'fail' }],
      stagehand: null,
      artifacts: [{ kind: 'log', path: 'agentic.log' }],
      transcript: [{ actor: 'browser', text: 'Something went wrong' }],
    };

    const result = gradeAgenticManifest(manifest);

    expect(result.verdict).toBe('fail');
    expect(result.findings.join('\n')).toContain('Mission result is fail.');
    expect(result.findings.join('\n')).toContain(
      'Unknown agentic QA mission: unknown-mission.'
    );
    expect(result.findings.join('\n')).toContain(
      'Deterministic check failed: unnamed.'
    );
    expect(result.findings.join('\n')).toContain(
      'No screenshot artifact was recorded.'
    );
  });
});

describe('agentic QA manifest', () => {
  it('preserves raw artifact paths and string errors for failed manifests without a run directory', () => {
    const manifest = createFailedManifest({
      artifacts: [{ kind: 'screenshot', path: '/tmp/failure.png' }],
      baseUrl: 'http://localhost:3333',
      error: 'playwright exited early',
      finishedAt: '2026-06-06T00:00:01.000Z',
      mission: 'guest-host-signed-in-join',
      runId: 'run-failed',
      stagehand: { ok: false },
      startedAt: '2026-06-06T00:00:00.000Z',
      target: 'local',
      runDir: undefined,
    });

    expect(manifest.deterministicChecks[0].detail).toBe(
      'playwright exited early'
    );
    expect(manifest.runtimeErrors).toEqual(['playwright exited early']);
    expect(manifest.artifacts).toEqual([
      { kind: 'screenshot', path: '/tmp/failure.png' },
    ]);
  });
});

describe('agentic QA CLI', () => {
  it('prints usage for --help without requiring a mission', async () => {
    const writeOut = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;

    await runAgenticQa({
      argv: ['--help'],
      writeOut,
      writeErr: vi.fn(),
      exit,
    });

    expect(writeOut).toHaveBeenCalledWith(
      expect.stringContaining('Usage: pnpm qa:agentic')
    );
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('returns a parse error when mission is missing', async () => {
    const writeErr = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;

    await runAgenticQa({
      argv: ['--target', 'local'],
      writeOut: vi.fn(),
      writeErr,
      exit,
    });

    expect(writeErr).toHaveBeenCalledWith(
      expect.stringContaining('--mission is required')
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('requires preview runs to pass an explicit base URL', () => {
    expect(() =>
      parseArgs([
        '--target',
        'preview',
        '--mission',
        'guest-host-signed-in-join',
      ])
    ).toThrow(/--base-url is required/);
  });

  it('writes a manifest and critic summary when the mission result exists', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);
    const spawnProcess = vi.fn((_command, _args, options) => {
      const manifest = healthyManifest(options.env.LINEJAM_AGENTIC_RUN_DIR);
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(async () => {
        await writeFile(
          options.env.LINEJAM_AGENTIC_RESULT_FILE,
          `${JSON.stringify(manifest, null, 2)}\n`
        );
        child.emit('close', 0);
      });
      return child;
    });
    const writeOut = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const stagehandRunner = vi.fn().mockResolvedValue({
      ok: true,
      skipped: false,
      artifacts: [
        {
          kind: 'screenshot',
          path: path.join(tempDir, 'stagehand-overview.png'),
        },
      ],
      transcript: [{ actor: 'stagehand', text: 'Observed join flow.' }],
    });

    await runAgenticQa({
      argv: [
        '--target',
        'preview',
        '--mission',
        'guest-host-signed-in-join',
        '--base-url',
        'https://preview.linejam.app',
        '--out-dir',
        tempDir,
      ],
      spawnProcess: spawnProcess as never,
      promptfooRunner: vi.fn().mockResolvedValue({
        ok: true,
        skipped: true,
        reason: 'disabled',
        outputPath: path.join(tempDir, 'promptfoo.json'),
      }),
      stagehandRunner,
      writeOut,
      writeErr: vi.fn(),
      exit,
    });

    const manifest = JSON.parse(
      await readFile(path.join(tempDir, 'manifest.json'), 'utf8')
    );
    expect(manifest.critic.verdict).toBe('pass');
    expect(manifest.promptfoo.skipped).toBe(true);
    expect(manifest.stagehand.ok).toBe(true);
    expect(
      await readFile(path.join(tempDir, 'critic-summary.md'), 'utf8')
    ).toContain('Agentic QA Critic Summary');
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('normalizes missing manifest arrays and relative Stagehand artifacts', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);
    const writeOut = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const stagehandRunner = vi.fn().mockResolvedValue({
      ok: true,
      skipped: false,
      artifacts: [
        {
          kind: 'screenshot',
          path: path.join(tempDir, 'stagehand-overview.png'),
        },
      ],
      transcript: [{ actor: 'stagehand', text: 'Observed join flow.' }],
    });
    const spawnProcess = vi.fn((_command, _args, options) => {
      const manifest = {
        ...healthyManifest(options.env.LINEJAM_AGENTIC_RUN_DIR),
        artifacts: null,
        transcript: null,
      };
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(async () => {
        await writeFile(
          options.env.LINEJAM_AGENTIC_RESULT_FILE,
          `${JSON.stringify(manifest, null, 2)}\n`
        );
        child.emit('close', 0);
      });
      return child;
    });

    await runAgenticQa({
      argv: [
        '--target',
        'local',
        '--mission',
        'guest-host-signed-in-join',
        '--out-dir',
        tempDir,
      ],
      spawnProcess: spawnProcess as never,
      promptfooRunner: vi.fn().mockResolvedValue({
        ok: true,
        skipped: true,
        reason: 'disabled',
        outputPath: path.join(tempDir, 'promptfoo.json'),
      }),
      stagehandRunner,
      writeOut,
      writeErr: vi.fn(),
      exit,
    });

    const manifest = JSON.parse(
      await readFile(path.join(tempDir, 'manifest.json'), 'utf8')
    );
    expect(manifest.artifacts).toEqual([
      { kind: 'screenshot', path: 'stagehand-overview.png' },
    ]);
    expect(manifest.transcript).toEqual([
      { actor: 'stagehand', text: 'Observed join flow.' },
    ]);
  });

  it('records a failed manifest when Playwright exits before writing results', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);
    const writeOut = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const stagehandRunner = vi.fn().mockResolvedValue({
      ok: false,
      skipped: true,
      reason: 'missing model key',
      artifacts: [],
      transcript: [],
    });

    await runAgenticQa({
      argv: [
        '--target',
        'local',
        '--mission',
        'signed-in-host-guest-join',
        '--base-url',
        'http://localhost:3333',
        '--out-dir',
        tempDir,
      ],
      spawnProcess: vi.fn(() => createMockChild(1)) as never,
      promptfooRunner: vi.fn().mockResolvedValue({
        ok: true,
        skipped: true,
        reason: 'disabled',
        outputPath: path.join(tempDir, 'promptfoo.json'),
      }),
      stagehandRunner,
      writeOut,
      writeErr: vi.fn(),
      exit,
    });

    const manifest = JSON.parse(
      await readFile(path.join(tempDir, 'manifest.json'), 'utf8')
    );
    expect(manifest.result).toBe('fail');
    expect(manifest.critic.verdict).toBe('fail');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('copies failure screenshots and preserves spawn errors in failed manifests', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);
    const outputDir = path.join(tempDir, 'playwright-output', 'nested');
    const writeOut = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;

    await runAgenticQa({
      argv: [
        '--target',
        'local',
        '--mission',
        'signed-in-host-guest-join',
        '--out-dir',
        tempDir,
      ],
      spawnProcess: vi.fn(() => {
        const child = new EventEmitter() as EventEmitter & {
          stdout: EventEmitter;
          stderr: EventEmitter;
        };
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        queueMicrotask(async () => {
          await mkdir(outputDir, { recursive: true });
          await writeFile(path.join(outputDir, 'failure.png'), 'png');
          child.emit('error', new Error('playwright spawn failed'));
        });
        return child;
      }) as never,
      promptfooRunner: vi.fn().mockResolvedValue({
        ok: true,
        skipped: true,
        reason: 'disabled',
        outputPath: path.join(tempDir, 'promptfoo.json'),
      }),
      stagehandRunner: vi.fn().mockResolvedValue({
        ok: false,
        skipped: true,
        reason: 'missing model key',
        artifacts: [],
        transcript: [],
      }),
      writeOut,
      writeErr: vi.fn(),
      exit,
    });

    const manifest = JSON.parse(
      await readFile(path.join(tempDir, 'manifest.json'), 'utf8')
    );
    expect(manifest.runtimeErrors).toContain('playwright spawn failed');
    expect(manifest.artifacts).toEqual([
      { kind: 'screenshot', path: 'failure-1.png' },
    ]);
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('agentic QA Promptfoo adapter', () => {
  it('records a skipped advisory critic when disabled', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);

    const result = await runPromptfooCritic({
      env: { ...process.env, LINEJAM_PROMPTFOO_CRITIC: '' },
      manifest: healthyManifest(tempDir),
      runDir: tempDir,
      spawnProcess: vi.fn() as never,
    });

    expect(result).toMatchObject({
      ok: true,
      skipped: true,
      reason: 'LINEJAM_PROMPTFOO_CRITIC is not enabled',
      outputPath: path.join(tempDir, 'promptfoo.json'),
    });
  });

  it('runs promptfoo eval and writes a receipt when enabled', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);
    const spawnProcess = vi.fn(() => createMockChild(0));

    const result = await runPromptfooCritic({
      env: { ...process.env, LINEJAM_PROMPTFOO_CRITIC: '1' },
      manifest: healthyManifest(tempDir),
      runDir: tempDir,
      spawnProcess: spawnProcess as never,
    });

    expect(spawnProcess).toHaveBeenCalledWith(
      expect.stringMatching(/^pnpm/),
      expect.arrayContaining([
        'promptfoo',
        'eval',
        '-c',
        'qa/agentic/promptfoo.yaml',
        '--output',
        path.join(tempDir, 'promptfoo.json'),
      ]),
      expect.objectContaining({
        env: expect.objectContaining({ LINEJAM_PROMPTFOO_CRITIC: '1' }),
      })
    );
    expect(result).toMatchObject({
      ok: true,
      skipped: false,
      code: 0,
      outputPath: path.join(tempDir, 'promptfoo.json'),
    });
    expect(
      JSON.parse(
        await readFile(path.join(tempDir, 'promptfoo-result.json'), 'utf8')
      )
    ).toMatchObject({ ok: true, outputPath: result.outputPath });
  });

  it('captures promptfoo stdout and stderr when the process errors', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);
    const spawnProcess = vi.fn(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(() => {
        child.stdout.emit('data', Buffer.from('partial stdout'));
        child.stderr.emit('data', Buffer.from('partial stderr'));
        child.emit('error', new Error('promptfoo spawn failed'));
      });
      return child;
    });

    const result = await runPromptfooCritic({
      env: { ...process.env, LINEJAM_PROMPTFOO_CRITIC: 'yes' },
      manifest: healthyManifest(tempDir),
      runDir: tempDir,
      spawnProcess: spawnProcess as never,
    });

    expect(result).toMatchObject({
      ok: false,
      skipped: false,
      code: null,
      reason: 'promptfoo spawn failed',
      stdout: 'partial stdout',
      stderr: 'partial stderr',
      outputPath: path.join(tempDir, 'promptfoo.json'),
    });
    expect(
      JSON.parse(
        await readFile(path.join(tempDir, 'promptfoo-result.json'), 'utf8')
      )
    ).toMatchObject({
      ok: false,
      reason: 'promptfoo spawn failed',
      stdout: 'partial stdout',
      stderr: 'partial stderr',
    });
  });
});

describe('agentic QA Stagehand adapter', () => {
  it('skips browser exploration when no model key is configured', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);
    const StagehandClass = vi.fn();

    const result = await runStagehand({
      baseUrl: 'http://localhost:3333',
      env: { NODE_ENV: process.env.NODE_ENV || 'test' },
      mission: 'guest-host-signed-in-join',
      runDir: tempDir,
      StagehandClass,
    });

    expect(StagehandClass).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      skipped: true,
      modelName: 'openai/gpt-4.1-mini',
      artifacts: [],
      transcript: [],
    });
    expect('reason' in result ? result.reason : '').toMatch(
      /Stagehand model API key is required/
    );
  });

  it('writes a successful Stagehand receipt with sanitized observations', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);
    const page = {
      goto: vi.fn(),
      screenshot: vi.fn(async ({ path: screenshotPath }) => {
        await writeFile(screenshotPath, 'png');
      }),
    };
    const close = vi.fn().mockResolvedValue(undefined);
    const constructorSpy = vi.fn();
    class FakeStagehand {
      init = vi.fn().mockResolvedValue(undefined);
      context = {
        pages: vi.fn(() => []),
        newPage: vi.fn().mockResolvedValue(page),
      };
      observe = vi
        .fn()
        .mockResolvedValue([
          { description: 'Click Join', method: 'click' },
          'Plain observation',
        ]);
      close = close;

      constructor(options: unknown) {
        constructorSpy(options);
      }
    }

    const result = await runStagehand({
      baseUrl: 'http://localhost:3333',
      env: {
        ...process.env,
        STAGEHAND_MODEL: 'custom-model',
        STAGEHAND_MODEL_API_KEY: 'model-key',
      },
      mission: 'guest-host-signed-in-join',
      runDir: tempDir,
      StagehandClass: FakeStagehand,
    });

    expect(constructorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        env: 'LOCAL',
        model: { modelName: 'custom-model', apiKey: 'model-key' },
      })
    );
    expect(page.goto).toHaveBeenCalledWith('http://localhost:3333', {
      waitUntil: 'load',
      timeout: 30000,
    });
    expect(close).toHaveBeenCalledWith({ force: true });
    expect(result).toMatchObject({
      ok: true,
      skipped: false,
      modelName: 'custom-model',
      observations: [
        { description: 'Click Join', method: 'click' },
        { description: 'Plain observation' },
      ],
      artifacts: [
        {
          kind: 'screenshot',
          path: path.join(tempDir, 'stagehand-overview.png'),
        },
      ],
    });
    expect(
      JSON.parse(await readFile(path.join(tempDir, 'stagehand.json'), 'utf8'))
    ).toMatchObject({
      ok: true,
      observations: [
        { description: 'Click Join', method: 'click' },
        { description: 'Plain observation' },
      ],
    });
  });

  it('records Stagehand failures and still closes the browser', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);
    const close = vi.fn().mockResolvedValue(undefined);
    class FakeStagehand {
      init = vi.fn().mockResolvedValue(undefined);
      context = {
        pages: vi.fn(() => [
          {
            goto: vi.fn().mockRejectedValue(new Error('navigation failed')),
          },
        ]),
      };
      close = close;
    }

    const result = await runStagehand({
      baseUrl: 'http://localhost:3333',
      env: { ...process.env, OPENAI_API_KEY: 'model-key' },
      mission: 'signed-in-host-guest-join',
      runDir: tempDir,
      StagehandClass: FakeStagehand,
    });

    expect(result).toMatchObject({
      ok: false,
      skipped: false,
      reason: 'navigation failed',
      artifacts: [],
      transcript: [],
    });
    expect(close).toHaveBeenCalledWith({ force: true });
    expect(
      JSON.parse(await readFile(path.join(tempDir, 'stagehand.json'), 'utf8'))
    ).toMatchObject({
      ok: false,
      reason: 'navigation failed',
    });
  });

  it('uses an existing Stagehand page and tolerates non-array observations', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'linejam-agentic-'));
    tempDirs.push(tempDir);
    const page = {
      goto: vi.fn(),
      screenshot: vi.fn(async ({ path: screenshotPath }) => {
        await writeFile(screenshotPath, 'png');
      }),
    };
    const newPage = vi.fn();
    const close = vi.fn().mockResolvedValue(undefined);
    class FakeStagehand {
      init = vi.fn().mockResolvedValue(undefined);
      context = {
        pages: vi.fn(() => [page]),
        newPage,
      };
      observe = vi.fn().mockResolvedValue(null);
      close = close;
    }

    const result = await runStagehand({
      baseUrl: 'http://localhost:3333',
      env: { ...process.env, ANTHROPIC_API_KEY: 'model-key' },
      mission: 'guest-host-signed-in-join',
      runDir: tempDir,
      StagehandClass: FakeStagehand,
    });

    expect(newPage).not.toHaveBeenCalled();
    expect(page.goto).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      skipped: false,
      observations: [],
      transcript: [
        {
          actor: 'stagehand',
          text: 'Observed 0 candidate actions for guest-host-signed-in-join.',
        },
      ],
    });
  });
});
