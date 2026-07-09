/** @vitest-environment node */
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function createMockChild(exitCode: number) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: (signal: string) => void;
    exitCode: number;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  child.exitCode = exitCode;

  return child;
}

describe('shouldTriggerSmoke', () => {
  it('returns true for configured trigger events and false for others', async () => {
    vi.resetModules();
    const { shouldTriggerSmoke } =
      await import('@/scripts/canary/trigger-smoke.mjs');

    expect(shouldTriggerSmoke('error.new_class')).toBe(true);
    expect(shouldTriggerSmoke('error.regression')).toBe(true);
    expect(shouldTriggerSmoke('incident.opened')).toBe(true);
    expect(shouldTriggerSmoke('incident.updated')).toBe(true);
    expect(shouldTriggerSmoke('incident.resolved')).toBe(true);
    expect(shouldTriggerSmoke('health_check.down')).toBe(true);
    expect(shouldTriggerSmoke('health_check.degraded')).toBe(true);
    expect(shouldTriggerSmoke('health_check.recovered')).toBe(true);
    expect(shouldTriggerSmoke('health_check.tls_expiring')).toBe(true);
    expect(shouldTriggerSmoke('unknown')).toBe(false);
  });
});

describe('runSmoke', () => {
  const trackedEnvKeys = [
    'PLAYWRIGHT_BASE_URL',
    'PLAYWRIGHT_BROWSERS_PATH',
    'CANARY_SMOKE_TIMEOUT_MS',
    'CANARY_SMOKE_KILL_GRACE_MS',
    'LINEJAM_SMOKE_RUNNER',
    'LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST',
    'LINEJAM_ALLOWED_SMOKE_ORIGINS',
    'LINEJAM_ALLOWED_SMOKE_HOSTS',
    'LINEJAM_ALLOWED_SMOKE_HOST_PATTERN',
    'LINEJAM_AGENTIC_QA_AFTER_SMOKE',
    'LINEJAM_AGENTIC_QA_MISSION',
    'LINEJAM_AGENTIC_QA_TIMEOUT_MS',
    'LINEJAM_PROMPTFOO_CRITIC',
    'STAGEHAND_MODEL',
    'STAGEHAND_MODEL_API_KEY',
    'UNRELATED_SECRET',
    'PLAYWRIGHT_REQUIRE_AUTH_SMOKE',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'CANARY_API_KEY',
  ] as const;
  const originalEnv = Object.fromEntries(
    trackedEnvKeys.map((key) => [key, process.env[key]])
  ) as Record<(typeof trackedEnvKeys)[number], string | undefined>;

  afterEach(() => {
    for (const key of trackedEnvKeys) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('skips smoke when base url is not configured', async () => {
    delete process.env.PLAYWRIGHT_BASE_URL;
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const result = await runSmoke({
      eventName: 'error.new_class',
      deliveryId: 'evt-1',
    });

    expect(result).toEqual({
      ok: false,
      skipped: true,
      reason: 'PLAYWRIGHT_BASE_URL is not configured',
      eventName: 'error.new_class',
      deliveryId: 'evt-1',
    });
  });

  it('runs dagger smoke and returns successful execution result', async () => {
    const child = createMockChild(0);
    const spawnMock = vi.fn().mockReturnValue(child);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');
    process.env.CANARY_API_KEY = 'server-only-secret';

    const pending = runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-2',
      spawnProcess: spawnMock,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    child.stdout.emit('data', Buffer.from('smoke stdout'));
    child.stderr.emit('data', Buffer.from('smoke stderr'));
    child.emit('close', child.exitCode);
    const result = await pending;

    expect(spawnMock).toHaveBeenCalledWith(
      'pnpm',
      ['ci:dagger:smoke'],
      expect.objectContaining({
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: expect.objectContaining({
          PLAYWRIGHT_BASE_URL: 'https://www.linejam.app',
        }),
      })
    );
    expect(spawnMock.mock.calls[0]?.[2]?.env.CANARY_API_KEY).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('smoke stdout');
    expect(result.stderr).toContain('smoke stderr');
    expect(result.baseUrl).toBe('https://www.linejam.app');
    expect(result.runner).toBe('dagger');
  });

  it('can run smoke with the direct Playwright runner for hosted responders', async () => {
    const child = createMockChild(0);
    const spawnMock = vi.fn().mockReturnValue(child);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const pending = runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-playwright-runner',
      runner: 'playwright',
      spawnProcess: spawnMock,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    child.emit('close', child.exitCode);
    const result = await pending;

    expect(spawnMock).toHaveBeenCalledWith(
      'pnpm',
      ['test:e2e:smoke'],
      expect.objectContaining({
        cwd: REPO_ROOT,
      })
    );
    expect(result.runner).toBe('playwright');
  });

  it('returns failed execution result when smoke exits non-zero', async () => {
    const child = createMockChild(1);
    const spawnMock = vi.fn().mockReturnValue(child);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const pending = runSmoke({
      baseUrl: 'https://preview.linejam.app',
      eventName: 'incident.opened',
      deliveryId: 'evt-3',
      spawnProcess: spawnMock,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    child.emit('close', child.exitCode);
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.code).toBe(1);
  });

  it('waits for process exit after timeout before resolving', async () => {
    vi.useFakeTimers();

    const child = createMockChild(0);
    const spawnMock = vi.fn().mockReturnValue(child);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');
    let settled = false;

    const pending = runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'health_check.down',
      deliveryId: 'evt-timeout',
      spawnProcess: spawnMock,
      timeoutMs: 25,
    }).then((result) => {
      settled = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(30);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(settled).toBe(false);

    child.emit('close', null);
    const result = await pending;

    expect(result).toMatchObject({
      ok: false,
      skipped: false,
      timedOut: true,
    });
  });

  it('returns a failure result when spawning smoke command errors', async () => {
    const child = createMockChild(0);
    const spawnMock = vi.fn().mockReturnValue(child);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const pending = runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.regression',
      deliveryId: 'evt-error',
      spawnProcess: spawnMock,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    child.emit('error', new Error('spawn failed'));
    const result = await pending;

    expect(result).toMatchObject({
      ok: false,
      skipped: false,
      code: null,
      timedOut: false,
      reason: 'spawn failed',
    });
  });

  it('falls back to default timeout when CANARY_SMOKE_TIMEOUT_MS is invalid', async () => {
    process.env.CANARY_SMOKE_TIMEOUT_MS = 'invalid';
    process.env.CANARY_SMOKE_KILL_GRACE_MS = '1';
    vi.useFakeTimers();

    const child = createMockChild(0);
    const spawnMock = vi.fn().mockReturnValue(child);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const pending = runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-default-timeout',
      spawnProcess: spawnMock,
    });

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 2);
    const result = await pending;

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(result.timedOut).toBe(true);
    delete process.env.CANARY_SMOKE_TIMEOUT_MS;
  });

  it('forcibly finishes timed-out smoke when the child ignores SIGTERM', async () => {
    process.env.CANARY_SMOKE_KILL_GRACE_MS = '10';
    vi.useFakeTimers();

    const child = createMockChild(0);
    const spawnMock = vi.fn().mockReturnValue(child);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const pending = runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'health_check.down',
      deliveryId: 'evt-timeout-force-kill',
      spawnProcess: spawnMock,
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(40);
    const result = await pending;

    expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGTERM');
    expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
    expect(result).toMatchObject({
      ok: false,
      skipped: false,
      code: null,
      timedOut: true,
    });
  });

  it('bounds captured stdout and stderr from smoke runs', async () => {
    const child = createMockChild(0);
    const spawnMock = vi.fn().mockReturnValue(child);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const pending = runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-capped-output',
      spawnProcess: spawnMock,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    child.stdout.emit('data', Buffer.from('x'.repeat(70_000)));
    child.stderr.emit('data', Buffer.from('y'.repeat(70_000)));
    child.emit('close', child.exitCode);
    const result = await pending;

    expect(result.stdout.length).toBeLessThanOrEqual(65_536);
    expect(result.stderr.length).toBeLessThanOrEqual(65_536);
    expect(result.stdoutTruncated).toBe(true);
    expect(result.stderrTruncated).toBe(true);
  });

  it('forwards only the smoke allowlist into the child environment', async () => {
    process.env.UNRELATED_SECRET = 'should-not-leak';
    process.env.PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright';
    process.env.CLERK_SECRET_KEY = 'clerk-secret';
    process.env.STAGEHAND_MODEL = 'openai/gpt-4.1-mini';
    process.env.STAGEHAND_MODEL_API_KEY = 'stagehand-model-key';
    process.env.LINEJAM_PROMPTFOO_CRITIC = '1';
    process.env.LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST = '1';
    process.env.LINEJAM_ALLOWED_SMOKE_ORIGINS = 'https://www.linejam.app';
    process.env.LINEJAM_ALLOWED_SMOKE_HOSTS = 'www.linejam.app';
    process.env.LINEJAM_ALLOWED_SMOKE_HOST_PATTERN = '^linejam';

    const child = createMockChild(0);
    const spawnMock = vi.fn().mockReturnValue(child);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const pending = runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-env',
      spawnProcess: spawnMock,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    child.emit('close', child.exitCode);
    await pending;

    expect(spawnMock).toHaveBeenCalledWith(
      'pnpm',
      ['ci:dagger:smoke'],
      expect.objectContaining({
        env: expect.objectContaining({
          PLAYWRIGHT_BASE_URL: 'https://www.linejam.app',
          PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright',
          CLERK_SECRET_KEY: 'clerk-secret',
          LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST: '1',
          LINEJAM_ALLOWED_SMOKE_ORIGINS: 'https://www.linejam.app',
          LINEJAM_ALLOWED_SMOKE_HOSTS: 'www.linejam.app',
          LINEJAM_ALLOWED_SMOKE_HOST_PATTERN: '^linejam',
          LINEJAM_PROMPTFOO_CRITIC: '1',
          STAGEHAND_MODEL: 'openai/gpt-4.1-mini',
          STAGEHAND_MODEL_API_KEY: 'stagehand-model-key',
        }),
      })
    );

    const options = spawnMock.mock.calls[0]?.[2];
    expect(options.env.UNRELATED_SECRET).toBeUndefined();
  });

  it('attaches advisory agentic QA evidence after successful smoke when enabled', async () => {
    process.env.LINEJAM_AGENTIC_QA_AFTER_SMOKE = '1';
    process.env.LINEJAM_AGENTIC_QA_MISSION = 'signed-in-host-guest-join';
    process.env.STAGEHAND_MODEL_API_KEY = 'stagehand-model-key';
    const smokeChild = createMockChild(0);
    const agenticChild = createMockChild(0);
    const spawnMock = vi
      .fn()
      .mockReturnValueOnce(smokeChild)
      .mockReturnValueOnce(agenticChild);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const pending = runSmoke({
      baseUrl: 'https://preview.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-agentic',
      spawnProcess: spawnMock,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    smokeChild.emit('close', 0);
    await Promise.resolve();
    agenticChild.stdout.emit(
      'data',
      Buffer.from(
        `stagehand log before payload\n${JSON.stringify(
          {
            ok: true,
            runDir: '.qa/runs/run-1',
            manifest: '.qa/runs/run-1/manifest.json',
            criticSummary: '.qa/runs/run-1/critic-summary.md',
          },
          null,
          2
        )}`
      )
    );
    agenticChild.emit('close', 0);
    const result = await pending;

    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      'pnpm',
      [
        'qa:agentic:preview',
        '--mission',
        'signed-in-host-guest-join',
        '--base-url',
        'https://preview.linejam.app',
      ],
      expect.objectContaining({ cwd: REPO_ROOT })
    );
    expect(result.ok).toBe(true);
    expect(result.agenticQa).toMatchObject({
      ok: true,
      mission: 'signed-in-host-guest-join',
      manifest: '.qa/runs/run-1/manifest.json',
      criticSummary: '.qa/runs/run-1/critic-summary.md',
    });
    expect(spawnMock.mock.calls[1]?.[2]?.env.STAGEHAND_MODEL_API_KEY).toBe(
      'stagehand-model-key'
    );
  });

  it('does not let advisory agentic QA change a failed smoke verdict', async () => {
    process.env.LINEJAM_AGENTIC_QA_AFTER_SMOKE = '1';
    const child = createMockChild(1);
    const spawnMock = vi.fn().mockReturnValue(child);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const pending = runSmoke({
      baseUrl: 'https://preview.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-agentic-skipped',
      spawnProcess: spawnMock,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    child.emit('close', 1);
    const result = await pending;

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.agenticQa).toMatchObject({
      skipped: true,
      reason: 'deterministic smoke did not pass',
    });
  });

  it('bounds advisory agentic QA after successful smoke', async () => {
    vi.useFakeTimers();
    process.env.LINEJAM_AGENTIC_QA_AFTER_SMOKE = '1';
    process.env.LINEJAM_AGENTIC_QA_TIMEOUT_MS = '25';
    process.env.CANARY_SMOKE_KILL_GRACE_MS = '10';
    const smokeChild = createMockChild(0);
    const agenticChild = createMockChild(0);
    const spawnMock = vi
      .fn()
      .mockReturnValueOnce(smokeChild)
      .mockReturnValueOnce(agenticChild);
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const pending = runSmoke({
      baseUrl: 'https://preview.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-agentic-timeout',
      spawnProcess: spawnMock,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    smokeChild.emit('close', 0);
    await vi.advanceTimersByTimeAsync(40);
    const result = await pending;

    expect(agenticChild.kill).toHaveBeenNthCalledWith(1, 'SIGTERM');
    expect(agenticChild.kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
    expect(result.ok).toBe(true);
    expect(result.agenticQa).toMatchObject({
      ok: false,
      timedOut: true,
      reason: 'agentic QA timed out after 25ms',
    });
  });

  it('fails fast when LINEJAM_SMOKE_RUNNER is invalid', async () => {
    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const result = await runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-invalid-runner',
      runner: 'bogus',
    });

    expect(result).toMatchObject({
      ok: false,
      skipped: false,
      reason:
        'Unsupported LINEJAM_SMOKE_RUNNER: bogus. Expected one of dagger, playwright',
    });
  });

  it('fails fast when smoke allowlisting rejects the base url', async () => {
    process.env.LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST = '1';
    process.env.LINEJAM_ALLOWED_SMOKE_ORIGINS = 'https://www.linejam.app';

    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const result = await runSmoke({
      baseUrl: 'https://preview.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-untrusted-origin',
    });

    expect(result).toMatchObject({
      ok: false,
      skipped: false,
    });
    expect(result.reason).toContain(
      'Refusing to run smoke against untrusted origin'
    );
  });

  it('fails fast when production auth smoke still uses a test Clerk key', async () => {
    process.env.PLAYWRIGHT_REQUIRE_AUTH_SMOKE = '1';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';
    process.env.CLERK_SECRET_KEY = 'sk_live_example';

    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const result = await runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-test-key',
    });

    expect(result).toMatchObject({
      ok: false,
      skipped: false,
      reason:
        'Authenticated production smoke requires a live Clerk publishable key. Use production-aligned Clerk env instead of localhost test keys.',
    });
  });

  it('fails fast when production auth smoke still uses a test Clerk secret', async () => {
    process.env.PLAYWRIGHT_REQUIRE_AUTH_SMOKE = '1';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_example';
    process.env.CLERK_SECRET_KEY = 'sk_test_example';

    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const result = await runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-test-secret',
    });

    expect(result).toMatchObject({
      ok: false,
      skipped: false,
      reason:
        'Authenticated production smoke requires a live Clerk secret key. Use production-aligned Clerk env instead of localhost test keys.',
    });
  });

  it('fails fast when authenticated smoke is missing required Clerk credentials', async () => {
    process.env.PLAYWRIGHT_REQUIRE_AUTH_SMOKE = '1';
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;

    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const result = await runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-missing-clerk-creds',
    });

    expect(result).toMatchObject({
      ok: false,
      skipped: false,
      reason:
        'Authenticated smoke requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.',
    });
  });

  it('fails fast when authenticated smoke is missing the Clerk convex template', async () => {
    process.env.PLAYWRIGHT_REQUIRE_AUTH_SMOKE = '1';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_example';
    process.env.CLERK_SECRET_KEY = 'sk_live_example';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: [] }),
    } as Response);

    const { runSmoke } = await import('@/scripts/canary/trigger-smoke.mjs');

    const result = await runSmoke({
      baseUrl: 'https://www.linejam.app',
      eventName: 'error.new_class',
      deliveryId: 'evt-template-missing',
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      skipped: false,
    });
    expect(result.reason).toContain('Clerk JWT template "convex" is missing');
  });
});

describe('trigger-smoke CLI entrypoint', () => {
  it('uses default stdout/exit callbacks in success path', async () => {
    const { runCli } = await import('@/scripts/canary/trigger-smoke.mjs');
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    const result = await runCli({
      args: ['error.new_class', 'evt-cli-defaults-ok'],
      run: vi.fn().mockResolvedValue({
        ok: true,
        skipped: false,
        code: 0,
      }),
    });

    expect(result).toMatchObject({ ok: true, code: 0 });
    expect(stdoutSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('uses default stderr/exit callbacks in failure path', async () => {
    const { runCli } = await import('@/scripts/canary/trigger-smoke.mjs');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    const result = await runCli({
      args: ['error.new_class', 'evt-cli-defaults-fail'],
      run: vi.fn().mockRejectedValue(new Error('default failure')),
    });

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      'Smoke trigger failed',
      expect.any(Error)
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('writes JSON output and exits with success when smoke is ok', async () => {
    const { runCli } = await import('@/scripts/canary/trigger-smoke.mjs');
    const writeOut = vi.fn();
    const writeErr = vi.fn();
    const exitMock = vi.fn();
    const exit = exitMock as unknown as (code: number) => never;

    const result = await runCli({
      args: ['error.new_class', 'evt-cli-ok'],
      run: vi.fn().mockResolvedValue({
        ok: true,
        skipped: false,
        code: 0,
      }),
      writeOut,
      writeErr,
      exit,
    });

    expect(result).toMatchObject({ ok: true, code: 0 });
    expect(writeOut).toHaveBeenCalledWith(
      expect.stringContaining('"ok": true')
    );
    expect(writeErr).not.toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('writes error output and exits with failure when smoke runner throws', async () => {
    const { runCli } = await import('@/scripts/canary/trigger-smoke.mjs');
    const writeOut = vi.fn();
    const writeErr = vi.fn();
    const exitMock = vi.fn();
    const exit = exitMock as unknown as (code: number) => never;

    const result = await runCli({
      args: ['error.new_class', 'evt-cli-fail'],
      run: vi.fn().mockRejectedValue(new Error('cli failure')),
      writeOut,
      writeErr,
      exit,
    });

    expect(result).toBeNull();
    expect(writeOut).not.toHaveBeenCalled();
    expect(writeErr).toHaveBeenCalledWith(
      'Smoke trigger failed',
      expect.any(Error)
    );
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('exits successfully when invoked without PLAYWRIGHT_BASE_URL', async () => {
    const scriptPath = path.resolve('scripts/canary/trigger-smoke.mjs');

    const result = await new Promise<{
      code: number | null;
      stdout: string;
      stderr: string;
    }>((resolve) => {
      const child = spawn(process.execPath, [scriptPath, 'manual', 'manual'], {
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const stdout: string[] = [];
      const stderr: string[] = [];
      child.stdout.on('data', (chunk: Buffer) => stdout.push(String(chunk)));
      child.stderr.on('data', (chunk: Buffer) => stderr.push(String(chunk)));
      child.on('close', (code: number | null) => {
        resolve({
          code,
          stdout: stdout.join(''),
          stderr: stderr.join(''),
        });
      });
    });

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('"skipped": true');
    expect(result.stdout).toContain(
      '"reason": "PLAYWRIGHT_BASE_URL is not configured"'
    );
  });
});
