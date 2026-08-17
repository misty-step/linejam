import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installSentryAgentLoop } from '../../scripts/ops/install-sentry-agent-loop.mjs';
const runCommand = vi.fn();

describe('Sentry agent loop installer', () => {
  beforeEach(() => {
    runCommand.mockReset();
  });

  it('never exposes the claimant secret to preflight children', async () => {
    const secret = 'claimant-secret-at-least-thirty-two-characters';
    runCommand.mockImplementation(
      async (
        _file: string,
        _args: string[],
        options: { env?: NodeJS.ProcessEnv }
      ) => {
        expect(options.env?.SENTRY_AGENT_LOOP_SECRET).toBeUndefined();
        return { status: 1, signal: null, stdout: '', stderr: 'stop' };
      }
    );

    await expect(
      installSentryAgentLoop(
        {
          ...process.env,
          LINEJAM_SENTRY_AGENT_ENDPOINT: 'https://linejam.example',
          LINEJAM_AGENT_FORK_REPOSITORY: 'operator/linejam',
          SENTRY_AGENT_LOOP_SECRET: secret,
          LINEJAM_SENTRY_AGENT_TIMEOUT_MS: '2100000',
        },
        runCommand
      )
    ).rejects.toThrow('sentry auth status failed with exit 1: stop');
    expect(runCommand).toHaveBeenCalledOnce();
  });

  it('rejects an explicit non-executable OMP runtime path', async () => {
    runCommand.mockResolvedValue({
      status: 0,
      signal: null,
      stdout: '',
      stderr: '',
    });

    await expect(
      installSentryAgentLoop(
        {
          ...process.env,
          LINEJAM_SENTRY_AGENT_ENDPOINT: 'https://linejam.example',
          LINEJAM_AGENT_FORK_REPOSITORY: 'operator/linejam',
          SENTRY_AGENT_LOOP_SECRET:
            'claimant-secret-at-least-thirty-two-characters',
          LINEJAM_OMP_BINARY: '/definitely/missing/omp',
          LINEJAM_SENTRY_AGENT_TIMEOUT_MS: '2100000',
        },
        runCommand
      )
    ).rejects.toThrow('LINEJAM_OMP_BINARY must be an executable file');
    expect(runCommand.mock.calls.some(([file]) => file === 'which')).toBe(
      false
    );
  });

  it('resolves PATH-only OMP and rejects a missing skill override', async () => {
    runCommand.mockImplementation(async (file: string) => ({
      status: 0,
      signal: null,
      stdout: file === 'which' ? process.execPath : '',
      stderr: '',
    }));

    await expect(
      installSentryAgentLoop(
        {
          ...process.env,
          LINEJAM_SENTRY_AGENT_ENDPOINT: 'https://linejam.example',
          LINEJAM_AGENT_FORK_REPOSITORY: 'operator/linejam',
          SENTRY_AGENT_LOOP_SECRET:
            'claimant-secret-at-least-thirty-two-characters',
          LINEJAM_OMP_BINARY: '',
          LINEJAM_EVIDENCE_SKILL: '/definitely/missing/evidence-packet',
          LINEJAM_SENTRY_AGENT_TIMEOUT_MS: '2100000',
        },
        runCommand
      )
    ).rejects.toThrow(
      'LINEJAM_EVIDENCE_SKILL must contain a readable evidence-packet skill'
    );
    expect(runCommand).toHaveBeenCalledWith(
      'which',
      ['omp'],
      expect.any(Object)
    );
  });
});
