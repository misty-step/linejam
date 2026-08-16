import { createHmac } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAgentPrompt,
  collectVmArtifacts,
  publishPatch,
  dispatchSentryAgent as dispatchSentryAgentImpl,
  parseAgentClaim,
  parseAgentTimeoutMs,
  readPublicationJournal,
  signedAgentHeaders,
  sanitizeGitEnvironment,
  runCommand,
  startAuthGateway,
  validatePatchPolicy,
  writePublicationJournal,
} from '../../scripts/ops/sentry-agent-loop.mjs';

const SECRET = 'agent-loop-test-secret-at-least-32-characters';
const LEASE = '11111111-1111-4111-8111-111111111111';
const CLAIM = {
  _id: 'receipt123',
  dedupKey: 'v1:installation:42:123456',
  projectId: '42',
  sentryIssueId: '123456',
  sentryEventId: '0123456789abcdef0123456789abcdef',
  githubIssueNumber: 426,
  environment: 'production',
  release: 'a'.repeat(40),
  operation: 'finishAbandonedGame',
  failureCode: 'unexpected_error',
  level: 'error',
  leaseId: LEASE,
  agentAttempts: 1,
  agentLeaseExpiresAt: 6_000_000,
};

function env(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    LINEJAM_REPOSITORY_PATH: '/srv/linejam',
    LINEJAM_SENTRY_AGENT_ENDPOINT: 'https://linejam.example',
    SENTRY_AGENT_LOOP_SECRET: SECRET,
    LINEJAM_SENTRY_AGENT_TIMEOUT_MS: '10000',
    LINEJAM_OMP_BINARY: '/opt/omp',
    LINEJAM_EVIDENCE_SKILL: '/opt/evidence-packet',
  };
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function endpointMock(
  requests: Array<{ url: string; body: Record<string, unknown> }>
) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ url, body });
    if (body.action === 'claim') {
      return response({ ...CLAIM, leaseId: body.leaseId });
    }
    return new Response(null, { status: 202 });
  });
}

let dispatchStateDir: string;

beforeEach(() => {
  dispatchStateDir = mkdtempSync(join(tmpdir(), 'linejam-agent-state-'));
});

afterEach(() => {
  rmSync(dispatchStateDir, { recursive: true, force: true });
});

function dispatchSentryAgent(
  options: Parameters<typeof dispatchSentryAgentImpl>[0] = {}
) {
  return dispatchSentryAgentImpl({ ...options, stateDir: dispatchStateDir });
}

describe('Sentry agent loop', () => {
  it('validates the complete sanitized claim contract before dispatch', () => {
    expect(parseAgentClaim(null)).toBeNull();
    expect(parseAgentClaim(CLAIM)).toEqual(CLAIM);
    expect(() => parseAgentClaim({ ...CLAIM, failureCode: undefined })).toThrow(
      'claim.failureCode must be a non-empty string'
    );
    expect(() => parseAgentClaim({ ...CLAIM, githubIssueNumber: 0 })).toThrow(
      'claim.githubIssueNumber must be a positive integer'
    );
    expect(() =>
      parseAgentClaim({
        ...CLAIM,
        _id: '../../../../.docker/config',
      })
    ).toThrow('claim._id must be a bounded identifier');
  });

  it('signs the exact request body and timestamp used by the real route', () => {
    const body = JSON.stringify({ action: 'claim', leaseId: LEASE });
    const headers = signedAgentHeaders(SECRET, body, 1_234_567_890_123);
    const expected = createHmac('sha256', SECRET)
      .update('1234567890123\n')
      .update(body)
      .digest('hex');
    expect(headers).toMatchObject({
      'Linejam-Agent-Timestamp': '1234567890123',
      'Linejam-Agent-Signature': expected,
    });
  });

  it('closes a receipt without starting a VM when the issue is closed', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchImpl = endpointMock(requests);
    const run = vi.fn(async (file: string, args: string[]) => {
      expect(file).toBe('gh');
      expect(args.slice(0, 3)).toEqual(['issue', 'view', '426']);
      return {
        status: 0,
        stdout: JSON.stringify({
          number: 426,
          state: 'CLOSED',
          url: 'https://github.com/misty-step/linejam/issues/426',
          labels: [],
        }),
        stderr: '',
      };
    });

    const result = await dispatchSentryAgent({
      env: env(),
      fetchImpl,
      run,
      now: () => 1_000,
    });

    expect(result).toMatchObject({ status: 'issue_closed', issueNumber: 426 });
    expect(requests[1]).toMatchObject({
      url: 'https://linejam.example/api/agents/sentry',
      body: {
        action: 'complete',
        receiptId: 'receipt123',
        outcome: 'issue_closed',
      },
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('recovers signed completion before mutable issue gates', async () => {
    for (const issue of [
      {
        number: 426,
        state: 'CLOSED',
        url: 'https://github.com/misty-step/linejam/issues/426',
        labels: [{ name: 'source/sentry' }, { name: 'source/agent' }],
      },
      {
        number: 426,
        state: 'OPEN',
        url: 'https://github.com/misty-step/linejam/issues/426',
        labels: [],
      },
    ]) {
      const requests: Array<{ url: string; body: Record<string, unknown> }> =
        [];
      const run = vi.fn(async () => ({
        status: 0,
        stdout: JSON.stringify(issue),
        stderr: '',
      }));
      const removePublicationJournal = vi.fn();

      await expect(
        dispatchSentryAgent({
          env: env(),
          fetchImpl: endpointMock(requests),
          run,
          now: () => 1_000,
          hasCompletionJournal: () => true,
          removePublicationJournal,
        })
      ).resolves.toMatchObject({
        status: 'recovered',
        issueNumber: 426,
        issueUrl: 'https://github.com/misty-step/linejam/issues/426',
      });
      expect(run).not.toHaveBeenCalled();
      expect(removePublicationJournal).toHaveBeenCalledOnce();
      expect(requests[1]).toMatchObject({
        body: {
          action: 'complete',
          receiptId: 'receipt123',
          outcome: 'completed',
        },
      });
    }
  });

  it('runs OMP only in a credential-free exe.dev VM and publishes the report', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchImpl = endpointMock(requests);
    const run = vi.fn(
      async (
        file: string,
        args: string[],
        options?: { env?: NodeJS.ProcessEnv }
      ) => {
        if (args.includes('ExitOnForwardFailure=yes')) {
          expect(options?.env).not.toHaveProperty('SENTRY_AGENT_LOOP_SECRET');
        }
        if (file === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return {
            status: 0,
            stdout: JSON.stringify({
              number: 426,
              state: 'OPEN',
              url: 'https://github.com/misty-step/linejam/issues/426',
              labels: [{ name: 'source/sentry' }, { name: 'source/agent' }],
            }),
            stderr: '',
          };
        }
        if (file === 'sentry') {
          return {
            status: 0,
            stdout: JSON.stringify({
              id: '123456',
              shortId: 'LINEJAM-1',
              count: '1',
              userCount: 0,
              firstSeen: '2026-08-16T00:00:00Z',
              lastSeen: '2026-08-16T00:00:01Z',
              level: 'error',
              status: 'unresolved',
              permalink: 'https://misty-step.sentry.io/issues/123456',
              priority: 'high',
              platform: 'javascript',
              isUnhandled: false,
              seerFixabilityScore: null,
            }),
            stderr: '',
          };
        }
        if (file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'new') {
          const vmName = args[args.indexOf('--name') + 1];
          return {
            status: 0,
            stdout: JSON.stringify({
              vm_name: vmName,
              ssh_dest: `${vmName}.exe.xyz`,
            }),
            stderr: '',
          };
        }
        return { status: 0, stdout: '', stderr: '' };
      }
    );
    const stopGateway = vi.fn(async () => undefined);
    const startAuthGateway = vi.fn(async ({ runtimeEnv }) => {
      expect(runtimeEnv).not.toHaveProperty('SENTRY_AGENT_LOOP_SECRET');
      expect(runtimeEnv).not.toHaveProperty('LINEJAM_SENTRY_AGENT_ENDPOINT');
      return { port: 48_766, stop: stopGateway };
    });
    const collectVmArtifacts = vi.fn(async () => ({
      report: '## Finding\n\nNo source patch was justified.',
      patch: '',
    }));
    const writeCompletionJournal = vi.fn();

    const result = await dispatchSentryAgent({
      env: env(),
      fetchImpl,
      run,
      now: () => 1_000,
      startAuthGateway,
      collectVmArtifacts,
      hasCompletionJournal: () => false,
      writeCompletionJournal,
    });

    expect(result).toMatchObject({ status: 'completed', prUrl: null });
    expect(
      existsSync(join(dispatchStateDir, 'packets', 'receipt123.json'))
    ).toBe(true);
    expect(run.mock.calls.some(([file]) => file === 'omp')).toBe(false);
    const isolatedCall = run.mock.calls.find(
      ([file, args]) =>
        file === 'ssh' && args.includes('ExitOnForwardFailure=yes')
    );
    expect(isolatedCall).toBeDefined();
    expect(isolatedCall?.[1]).toEqual(
      expect.arrayContaining([
        '-tt',
        '-R',
        '127.0.0.1:48766:127.0.0.1:48766',
        expect.stringMatching(/^lj-sentry-426-[0-9a-f]{8}\.exe\.xyz$/),
      ])
    );
    expect(String(isolatedCall?.[1].at(-1))).toContain(
      '/tmp/linejam-agent/omp'
    );
    expect(isolatedCall?.[2]?.env).not.toHaveProperty(
      'SENTRY_AGENT_LOOP_SECRET'
    );
    expect(stopGateway).toHaveBeenCalledOnce();
    expect(
      run.mock.calls.some(
        ([file, args]) =>
          file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'rm'
      )
    ).toBe(true);
    const worktreeRemoveCall = run.mock.calls.find(
      ([file, args]) =>
        file === 'git' && args[0] === 'worktree' && args[1] === 'remove'
    );
    expect(String(worktreeRemoveCall?.[1][3])).toMatch(
      /\/linejam-sentry-426-[0-9a-f]{8}$/
    );
    const branchDeleteCall = run.mock.calls.find(
      ([file, args]) =>
        file === 'git' && args[0] === 'branch' && args[1] === '-D'
    );
    expect(String(branchDeleteCall?.[1][2])).toMatch(
      /^forest\/sentry-426-[0-9a-f]{8}$/
    );

    const issueViewCall = run.mock.calls.find(
      ([file, args]) =>
        file === 'gh' && args[0] === 'issue' && args[1] === 'view'
    );
    expect(issueViewCall?.[1].at(-1)).toBe('number,state,url,labels');
    const sentryCall = run.mock.calls.find(([file]) => file === 'sentry');
    expect(sentryCall?.[1].join(' ')).not.toMatch(/title|culprit|event/);
    expect(writeCompletionJournal).toHaveBeenCalledOnce();
    expect(requests.at(-1)).toMatchObject({
      body: {
        action: 'complete',
        receiptId: 'receipt123',
        outcome: 'completed',
      },
    });
    const commentBodies = run.mock.calls
      .filter(
        ([file, args]) =>
          file === 'gh' && args[0] === 'issue' && args[1] === 'comment'
      )
      .map(([, args]) => args.at(-1));
    expect(commentBodies).toHaveLength(3);
    expect(commentBodies[1]).toContain('No source patch was justified');
    expect(commentBodies[2]).toMatch(
      /<!-- linejam-agent-result:v1:receipt123:[0-9a-f-]{36}:completed:[0-9a-f]{64} -->/
    );
  });

  it('cleans every resource after delayed setup and a near-budget timeout', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchImpl = endpointMock(requests);
    let elapsedMs = 0;
    const run = vi.fn(
      async (
        file: string,
        args: string[],
        options?: { timeoutMs?: number }
      ) => {
        if (file === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return {
            status: 0,
            stdout: JSON.stringify({
              number: 426,
              state: 'OPEN',
              url: 'https://github.com/misty-step/linejam/issues/426',
              labels: [{ name: 'source/sentry' }, { name: 'source/agent' }],
            }),
            stderr: '',
          };
        }
        if (file === 'sentry') {
          return {
            status: 0,
            stdout: JSON.stringify({
              id: '123456',
              shortId: 'LINEJAM-1',
              count: '1',
              userCount: 0,
              firstSeen: '2026-08-16T00:00:00Z',
              lastSeen: '2026-08-16T00:00:01Z',
              level: 'error',
              status: 'unresolved',
              permalink: 'https://misty-step.sentry.io/issues/123456',
              priority: 'high',
              platform: 'javascript',
              isUnhandled: false,
              seerFixabilityScore: null,
            }),
            stderr: '',
          };
        }
        if (file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'new') {
          const vmName = args[args.indexOf('--name') + 1];
          return {
            status: 0,
            stdout: JSON.stringify({
              vm_name: vmName,
              ssh_dest: `${vmName}.exe.xyz`,
            }),
            stderr: '',
          };
        }
        if (file === 'git' && args[0] === 'fetch') {
          elapsedMs = 20 * 60 * 1_000;
          return { status: 0, stdout: '', stderr: '' };
        }
        if (file === 'ssh' && args.includes('ExitOnForwardFailure=yes')) {
          expect(options?.timeoutMs).toBe(25 * 60 * 1_000);
          elapsedMs = 45 * 60 * 1_000 - 1_000;
          return { status: 124, stdout: '', stderr: 'agent timed out' };
        }
        return { status: 0, stdout: '', stderr: '' };
      }
    );
    const stopGateway = vi.fn(async () => undefined);

    const result = await dispatchSentryAgent({
      env: { ...env(), LINEJAM_SENTRY_AGENT_TIMEOUT_MS: '2700000' },
      fetchImpl,
      run,
      now: () => 1_000,
      monotonicNow: () => elapsedMs,
      startAuthGateway: async () => ({ port: 48_766, stop: stopGateway }),
      hasCompletionJournal: () => false,
      writeCompletionJournal: vi.fn(),
    });

    expect(result).toMatchObject({ status: 'retry', issueNumber: 426 });
    expect(stopGateway).toHaveBeenCalledOnce();
    const vmRemoveCall = run.mock.calls.find(
      ([file, args]) =>
        file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'rm'
    );
    expect(vmRemoveCall?.[2]?.timeoutMs).toBe(2 * 60 * 1_000);
    const worktreeRemoveCall = run.mock.calls.find(
      ([file, args]) =>
        file === 'git' && args[0] === 'worktree' && args[1] === 'remove'
    );
    expect(String(worktreeRemoveCall?.[1][3])).toMatch(
      /\/linejam-sentry-426-[0-9a-f]{8}$/
    );
    expect(worktreeRemoveCall?.[2]?.timeoutMs).toBe(2 * 60 * 1_000);
    const branchDeleteCall = run.mock.calls.find(
      ([file, args]) =>
        file === 'git' && args[0] === 'branch' && args[1] === '-D'
    );
    expect(String(branchDeleteCall?.[1][2])).toMatch(
      /^forest\/sentry-426-[0-9a-f]{8}$/
    );
    expect(branchDeleteCall?.[2]?.timeoutMs).toBe(2 * 60 * 1_000);
    expect(requests.at(-1)).toMatchObject({
      body: {
        action: 'complete',
        receiptId: 'receipt123',
        outcome: 'retry',
      },
    });
  });

  it('cleans unknown-outcome worktree and VM acquisitions', async () => {
    for (const failureAt of [
      'worktree-created',
      'worktree-absent',
      'vm-created',
      'vm-absent',
    ]) {
      let worktreePresent = false;
      let branchPresent = false;
      let vmPresent = false;
      const run = vi.fn(async (file: string, args: string[]) => {
        if (file === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return {
            status: 0,
            stdout: JSON.stringify({
              number: 426,
              state: 'OPEN',
              url: 'https://github.com/misty-step/linejam/issues/426',
              labels: [{ name: 'source/sentry' }, { name: 'source/agent' }],
            }),
            stderr: '',
          };
        }
        if (file === 'sentry') {
          return {
            status: 0,
            stdout: JSON.stringify({ id: CLAIM.sentryIssueId }),
            stderr: '',
          };
        }
        if (file === 'git' && args[0] === 'worktree' && args[1] === 'add') {
          if (failureAt === 'worktree-created') {
            worktreePresent = true;
            branchPresent = true;
          }
          if (failureAt.startsWith('worktree-')) {
            return { status: 124, stdout: '', stderr: 'command timed out' };
          }
          worktreePresent = true;
          branchPresent = true;
          return { status: 0, stdout: '', stderr: '' };
        }
        if (file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'new') {
          if (failureAt === 'vm-created') vmPresent = true;
          return { status: 124, stdout: '', stderr: 'command timed out' };
        }
        if (file === 'git' && args[0] === 'worktree' && args[1] === 'remove') {
          if (!worktreePresent) {
            return { status: 1, stdout: '', stderr: 'not found' };
          }
          worktreePresent = false;
          return { status: 0, stdout: '', stderr: '' };
        }
        if (file === 'git' && args[0] === 'worktree' && args[1] === 'list') {
          return {
            status: 0,
            stdout: worktreePresent ? 'worktree /unexpected\n' : '',
            stderr: '',
          };
        }
        if (file === 'git' && args[0] === 'branch' && args[1] === '-D') {
          if (!branchPresent) {
            return { status: 1, stdout: '', stderr: 'not found' };
          }
          branchPresent = false;
          return { status: 0, stdout: '', stderr: '' };
        }
        if (file === 'git' && args[0] === 'show-ref') {
          return {
            status: branchPresent ? 0 : 1,
            stdout: '',
            stderr: '',
          };
        }
        if (file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'rm') {
          if (!vmPresent) {
            return { status: 1, stdout: '', stderr: 'not found' };
          }
          vmPresent = false;
          return { status: 0, stdout: '', stderr: '' };
        }
        if (file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'ls') {
          return {
            status: 0,
            stdout: JSON.stringify({
              vms: vmPresent ? [{ vm_name: 'unexpected' }] : [],
            }),
            stderr: '',
          };
        }
        return { status: 0, stdout: '', stderr: '' };
      });

      await expect(
        dispatchSentryAgent({
          env: env(),
          fetchImpl: endpointMock([]),
          run,
          now: () => 1_000,
          hasCompletionJournal: () => false,
          writeCompletionJournal: vi.fn(),
        })
      ).rejects.toThrow('failed with exit 124');
      expect(worktreePresent).toBe(false);
      expect(branchPresent).toBe(false);
      expect(vmPresent).toBe(false);
      expect(
        run.mock.calls.filter(
          ([file, args]) =>
            file === 'git' && args[0] === 'worktree' && args[1] === 'remove'
        )
      ).toHaveLength(1);
      expect(
        run.mock.calls.filter(
          ([file, args]) =>
            file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'rm'
        )
      ).toHaveLength(failureAt.startsWith('vm-') ? 1 : 0);
    }
  });

  it('recovers push and pull request crash windows without duplicates', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchImpl = endpointMock(requests);
    let commentAttempts = 0;
    let prCreations = 0;
    let completionWritten = false;
    let stagedPublication: Record<string, unknown> | null = null;
    let failUrlJournal = true;
    let apiAttempts = 0;
    let remoteBranchOid: string | null = null;
    const headOid = 'a'.repeat(40);
    const run = vi.fn(async (file: string, args: string[]) => {
      if (file === 'gh' && args[0] === 'issue' && args[1] === 'view') {
        return {
          status: 0,
          stdout: JSON.stringify({
            number: 426,
            state: 'OPEN',
            url: 'https://github.com/misty-step/linejam/issues/426',
            labels: [{ name: 'source/sentry' }, { name: 'source/agent' }],
          }),
          stderr: '',
        };
      }
      if (file === 'gh' && args[0] === 'issue' && args[1] === 'comment') {
        commentAttempts += 1;
        return { status: 0, stdout: '', stderr: '' };
      }
      if (file === 'gh' && args[0] === 'api') {
        expect(args).toEqual([
          'api',
          '--method',
          'GET',
          'repos/misty-step/linejam/pulls',
          '-f',
          'state=all',
          '-f',
          'head=operator:forest/sentry-426-receipt123',
          '-f',
          'per_page=2',
        ]);
        apiAttempts += 1;
        if (apiAttempts === 1) {
          return { status: 9, stdout: '', stderr: 'crash after push' };
        }
        return {
          status: 0,
          stdout: JSON.stringify(
            prCreations > 0
              ? [
                  {
                    html_url: 'https://github.com/misty-step/linejam/pull/999',
                    head: {
                      ref: 'forest/sentry-426-receipt123',
                      sha: headOid,
                      repo: { owner: { login: 'operator' } },
                    },
                  },
                ]
              : []
          ),
          stderr: '',
        };
      }
      if (file === 'gh' && args[0] === 'pr' && args[1] === 'create') {
        prCreations += 1;
        return {
          status: 0,
          stdout: 'https://github.com/misty-step/linejam/pull/999',
          stderr: '',
        };
      }
      if (file === 'sentry') {
        return {
          status: 0,
          stdout: JSON.stringify({
            id: '123456',
            shortId: 'LINEJAM-1',
            count: '1',
            userCount: 0,
            firstSeen: '2026-08-16T00:00:00Z',
            lastSeen: '2026-08-16T00:00:01Z',
            level: 'error',
            status: 'unresolved',
            permalink: 'https://misty-step.sentry.io/issues/123456',
            priority: 'high',
            platform: 'javascript',
            isUnhandled: false,
            seerFixabilityScore: null,
          }),
          stderr: '',
        };
      }
      if (file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'new') {
        const vmName = args[args.indexOf('--name') + 1];
        return {
          status: 0,
          stdout: JSON.stringify({
            vm_name: vmName,
            ssh_dest: `${vmName}.exe.xyz`,
          }),
          stderr: '',
        };
      }
      if (file === 'git' && args[0] === 'rev-parse') {
        return { status: 0, stdout: headOid, stderr: '' };
      }
      if (file === 'git' && args.includes('push')) {
        remoteBranchOid = headOid;
        return { status: 0, stdout: '', stderr: '' };
      }
      if (file === 'git' && args[0] === 'ls-remote') {
        return {
          status: 0,
          stdout: remoteBranchOid
            ? `${remoteBranchOid}\trefs/heads/forest/sentry-426-receipt123\n`
            : '',
          stderr: '',
        };
      }
      if (file === 'git' && args[0] === 'apply' && args[1] === '--numstat') {
        return {
          status: 0,
          stdout: '1\t0\ttests/probe.test.ts\0',
          stderr: '',
        };
      }
      return { status: 0, stdout: '', stderr: '' };
    });
    const options = {
      env: {
        ...env(),
        LINEJAM_AGENT_FORK_REPOSITORY: 'operator/linejam',
      },
      fetchImpl,
      run,
      now: () => 1_000,
      startAuthGateway: async () => ({
        port: 48_766,
        stop: async () => undefined,
      }),
      collectVmArtifacts: async () => ({
        report: '## Finding\n\nCandidate fix.',
        patch:
          'diff --git a/tests/probe.test.ts b/tests/probe.test.ts\n' +
          'new file mode 100644\n' +
          '--- /dev/null\n' +
          '+++ b/tests/probe.test.ts\n' +
          '@@ -0,0 +1 @@\n' +
          '+export const fixed = true;\n',
      }),
      hasCompletionJournal: () => completionWritten,
      writeCompletionJournal: () => {
        completionWritten = true;
      },
      readPublicationJournal: () => stagedPublication,
      writePublicationJournal: (
        _stateDir: string,
        _receiptId: string,
        _secret: string,
        journal: Record<string, unknown>
      ) => {
        if (journal.prUrl && failUrlJournal) {
          failUrlJournal = false;
          throw new Error('publication URL journal failed');
        }
        stagedPublication = journal;
      },
      removePublicationJournal: () => {
        stagedPublication = null;
      },
    };

    await expect(dispatchSentryAgent(options)).rejects.toThrow(
      'failed with exit 9'
    );
    expect(completionWritten).toBe(false);
    expect(stagedPublication).toMatchObject({
      branch: 'forest/sentry-426-receipt123',
      headOid,
      prUrl: null,
      reportDelivered: false,
      completionDelivered: false,
    });
    expect(prCreations).toBe(0);
    remoteBranchOid = 'b'.repeat(40);
    await expect(dispatchSentryAgent(options)).rejects.toThrow(
      'invalid publication branch result'
    );
    expect(prCreations).toBe(0);
    remoteBranchOid = headOid;

    await expect(dispatchSentryAgent(options)).rejects.toThrow(
      'publication URL journal failed'
    );
    expect(prCreations).toBe(1);
    const createdHead = run.mock.calls.find(
      ([file, args]) =>
        file === 'gh' && args[0] === 'pr' && args[1] === 'create'
    )?.[1];
    expect(createdHead?.[createdHead.indexOf('--head') + 1]).toBe(
      'operator:forest/sentry-426-receipt123'
    );

    await expect(dispatchSentryAgent(options)).resolves.toMatchObject({
      status: 'recovered',
      issueNumber: 426,
    });
    expect(prCreations).toBe(1);
    expect(completionWritten).toBe(true);
    expect(stagedPublication).toBeNull();
    expect(commentAttempts).toBe(3);
    expect(
      run.mock.calls.filter(
        ([file, args]) =>
          file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'new'
      )
    ).toHaveLength(1);
  });

  it('rejects a saved pull request after its fork branch OID changes', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const headOid = 'a'.repeat(40);
    let completionWritten = false;
    let stagedPublication: Record<string, unknown> | null = {
      receiptId: CLAIM._id,
      branch: 'forest/sentry-426-receipt123',
      headOid,
      prUrl: 'https://github.com/misty-step/linejam/pull/999',
      report: '## Finding\n\nCandidate fix.',
      reportDelivered: false,
      completionDelivered: false,
    };
    const run = vi.fn(async (file: string, args: string[]) => {
      if (file === 'gh' && args[0] === 'issue' && args[1] === 'view') {
        return {
          status: 0,
          stdout: JSON.stringify({
            number: 426,
            state: 'OPEN',
            url: 'https://github.com/misty-step/linejam/issues/426',
            labels: [{ name: 'source/sentry' }, { name: 'source/agent' }],
          }),
          stderr: '',
        };
      }
      if (file === 'git' && args[0] === 'ls-remote') {
        return {
          status: 0,
          stdout: `${'b'.repeat(40)}\trefs/heads/forest/sentry-426-receipt123\n`,
          stderr: '',
        };
      }
      if (file === 'gh' && args[0] === 'issue' && args[1] === 'comment') {
        return { status: 9, stdout: '', stderr: 'fresh investigation stopped' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    await expect(
      dispatchSentryAgent({
        env: {
          ...env(),
          LINEJAM_AGENT_FORK_REPOSITORY: 'operator/linejam',
        },
        fetchImpl: endpointMock(requests),
        run,
        now: () => 1_000,
        hasCompletionJournal: () => completionWritten,
        writeCompletionJournal: () => {
          completionWritten = true;
        },
        readPublicationJournal: () => stagedPublication,
        removePublicationJournal: () => {
          stagedPublication = null;
        },
      })
    ).rejects.toThrow('invalid publication branch result');
    expect(stagedPublication).not.toBeNull();
    expect(completionWritten).toBe(false);
    expect(
      run.mock.calls.filter(
        ([file, args]) =>
          file === 'gh' && args[0] === 'issue' && args[1] === 'comment'
      )
    ).toHaveLength(0);
    expect(
      run.mock.calls.filter(
        ([file, args]) => file === 'git' && args[0] === 'ls-remote'
      )
    ).toHaveLength(1);
  });

  it('retains the prior signed publication phase when replacement fails', () => {
    const initial = {
      branch: 'forest/sentry-426-receipt123',
      headOid: 'a'.repeat(40),
      prUrl: null,
      report: 'Validated report.',
      evidenceArchive: '~/.local/state/evidence/receipt123',
      reportDelivered: false,
      completionDelivered: false,
    };
    writePublicationJournal(dispatchStateDir, CLAIM._id, SECRET, initial);
    expect(
      readPublicationJournal(dispatchStateDir, CLAIM._id, SECRET)
    ).toMatchObject(initial);

    expect(() =>
      writePublicationJournal(
        dispatchStateDir,
        CLAIM._id,
        SECRET,
        {
          ...initial,
          prUrl: 'https://github.com/misty-step/linejam/pull/999',
        },
        (temporaryPath, destinationPath) => {
          expect(existsSync(temporaryPath)).toBe(true);
          expect(existsSync(destinationPath)).toBe(true);
          throw new Error('interrupted journal replacement');
        }
      )
    ).toThrow('interrupted journal replacement');
    expect(
      readPublicationJournal(dispatchStateDir, CLAIM._id, SECRET)
    ).toMatchObject(initial);
  });

  it('bounds evidence on the VM and during transfer before writing locally', async () => {
    const transferLimit = 11 * 1024 * 1024;
    const run = vi.fn(
      async (
        file: string,
        args: string[],
        options?: { binary?: boolean; maxBuffer?: number; timeoutMs?: number }
      ) => {
        const command = String(args.at(-1));
        if (command.endsWith('/report.md')) {
          return { status: 0, stdout: 'bounded report', stderr: '' };
        }
        if (command.includes('git -C /home/exedev/linejam')) {
          expect(command).toContain(
            'GIT_INDEX_FILE=/tmp/linejam-agent/patch.index'
          );
          expect(command).toContain('add -f -A -- .');
          expect(command).toContain("':(exclude).evidence'");
          return { status: 0, stdout: '', stderr: '' };
        }
        if (
          command.startsWith('python3 /tmp/linejam-agent/archive-evidence.py')
        ) {
          expect(options).toMatchObject({
            maxBuffer: 4 * 1024,
            timeoutMs: 60_000,
          });
          return {
            status: 0,
            stdout: JSON.stringify({ files: 1, bytes: 1 }),
            stderr: '',
          };
        }
        expect(command).toBe('cat /tmp/linejam-agent/evidence.tar.gz');
        expect(options).toMatchObject({
          binary: true,
          maxBuffer: transferLimit,
          timeoutMs: 60_000,
        });
        return {
          status: 0,
          stdout: Buffer.alloc(transferLimit + 1),
          stderr: '',
        };
      }
    );

    await expect(
      collectVmArtifacts({
        run,
        root: '/tmp',
        runtimeEnv: {},
        host: 'bounded-evidence.exe.xyz',
        issueNumber: 426,
        evidenceArchive: '/tmp/linejam-agent-test-evidence-426',
      })
    ).rejects.toThrow('bounded evidence transfer returned invalid bytes');
    expect(run.mock.calls.some(([file]) => file === 'scp')).toBe(false);
  });

  it('disables hooks and publishes candidate patches only as fork drafts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'linejam-publish-hook-probe-'));
    const repository = join(root, 'repository');
    const remote = join(root, 'remote.git');
    const hooks = join(root, 'hooks');
    const sentinel = join(root, 'hook-executed');
    const branch = 'forest/sentry-426-probe';
    const localEnvResult = await runCommand(
      'git',
      ['rev-parse', '--local-env-vars'],
      {
        cwd: root,
        env: {
          HOME: process.env.HOME,
          PATH: process.env.PATH,
          SYSTEMROOT: process.env.SYSTEMROOT,
        },
      }
    );
    expect(localEnvResult.status, localEnvResult.stderr).toBe(0);
    const gitLocalEnvNames = localEnvResult.stdout
      .split(/\r?\n/)
      .filter(Boolean);
    const gitEnv = { ...process.env };
    for (const name of gitLocalEnvNames) delete gitEnv[name];
    const git = async (args: string[], cwd = repository) => {
      const result = await runCommand('git', args, {
        cwd,
        env: gitEnv,
      });
      expect(result.status, result.stderr).toBe(0);
    };

    try {
      mkdirSync(repository);
      mkdirSync(hooks);
      await git(['init', '--bare', remote], root);
      await git(['init', '-b', 'master']);
      await git(['config', 'user.name', 'Hook Probe']);
      await git(['config', 'user.email', 'hook-probe@example.invalid']);
      writeFileSync(join(repository, 'README.md'), 'trusted base\n');
      await git(['add', 'README.md']);
      await git([
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'commit.gpgSign=false',
        'commit',
        '-m',
        'trusted base',
      ]);
      await git(['remote', 'add', 'origin', remote]);
      await git([
        '-c',
        'core.hooksPath=/dev/null',
        'push',
        '-u',
        'origin',
        'master',
      ]);
      await git(['checkout', '-b', branch]);
      const hook = `#!/bin/sh\ntouch ${sentinel}\nexit 97\n`;
      writeFileSync(join(hooks, 'pre-commit'), hook, { mode: 0o700 });
      writeFileSync(join(hooks, 'pre-push'), hook, { mode: 0o700 });
      await git(['config', 'core.hooksPath', hooks]);
      const configPath = join(repository, '.git', 'config');
      const configBefore = readFileSync(configPath);

      const patch =
        'diff --git a/tests/probe.test.ts b/tests/probe.test.ts\n' +
        'new file mode 100644\n' +
        '--- /dev/null\n' +
        '+++ b/tests/probe.test.ts\n' +
        '@@ -0,0 +1 @@\n' +
        "+export const isolatedPatch = 'untrusted';\n";
      let prCreated = false;
      let publishedOid = '';
      const run = vi.fn(
        async (
          file: string,
          args: string[],
          options?: {
            cwd?: string;
            env?: NodeJS.ProcessEnv;
            maxBuffer?: number;
          }
        ) => {
          for (const name of gitLocalEnvNames) {
            expect(options?.env).not.toHaveProperty(name);
          }
          if (file === 'gh' && args[0] === 'api') {
            return {
              status: 0,
              signal: null,
              stdout: JSON.stringify(
                prCreated
                  ? [
                      {
                        html_url:
                          'https://github.com/misty-step/linejam/pull/999',
                        head: {
                          ref: branch,
                          sha: publishedOid,
                          repo: { owner: { login: 'operator' } },
                        },
                      },
                    ]
                  : []
              ),
              stderr: '',
            };
          }
          if (file === 'gh' && args[0] === 'pr' && args[1] === 'create') {
            expect(args).toEqual(
              expect.arrayContaining([
                '--head',
                'operator:forest/sentry-426-probe',
                '--draft',
              ])
            );
            prCreated = true;
            return {
              status: 0,
              signal: null,
              stdout: 'https://github.com/misty-step/linejam/pull/999',
              stderr: '',
            };
          }
          if (file === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD') {
            const result = await runCommand(file, args, options);
            publishedOid = result.stdout.trim();
            return result;
          }
          if (file === 'git' && args.includes('push')) {
            expect(args).toEqual(
              expect.arrayContaining([
                'core.hooksPath=/dev/null',
                'https://github.com/operator/linejam.git',
                `HEAD:${branch}`,
              ])
            );
            return runCommand(
              'git',
              [
                '-c',
                'core.hooksPath=/dev/null',
                'push',
                remote,
                `HEAD:${branch}`,
              ],
              options
            );
          }
          return runCommand(file, args, options);
        }
      );
      await expect(
        publishPatch({
          run,
          runtimeEnv: {
            ...process.env,
            NODE_ENV: 'test',
            LINEJAM_AGENT_FORK_REPOSITORY: 'operator/linejam',
          },
          worktree: repository,
          branch,
          issueNumber: 426,
          patch,
          report: 'Hook isolation probe.',
          stateDir: join(root, 'state'),
        })
      ).resolves.toBe('https://github.com/misty-step/linejam/pull/999');
      expect(existsSync(sentinel)).toBe(false);
      expect(readFileSync(configPath)).toEqual(configBefore);
      await git(['rev-parse', '--verify', `refs/heads/${branch}`], remote);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects patch paths and file modes outside the publication policy', () => {
    expect(() =>
      validatePatchPolicy('diff --git a/convex/a.ts b/convex/a.ts\n', [
        'convex/a.ts',
        'tests/convex/a.test.ts',
      ])
    ).not.toThrow();
    expect(() =>
      validatePatchPolicy(
        'diff --git a/.github/workflows/release.yml b/.github/workflows/release.yml\n',
        ['.github/workflows/release.yml']
      )
    ).toThrow('isolated patch path is forbidden');
    expect(() =>
      validatePatchPolicy(
        'diff --git a/lib/link b/lib/link\nnew file mode 120000\n',
        ['lib/link']
      )
    ).toThrow('forbidden binary or file mode');
  });

  it('makes isolation, trust, evidence, staging, and no-publication explicit', () => {
    const prompt = buildAgentPrompt({
      claim: CLAIM,
      issueNumber: 426,
      issueUrl: 'https://github.com/misty-step/linejam/issues/426',
      remoteRepository: '/home/exedev/linejam',
    });
    expect(prompt).toContain('inside this disposable exe.dev VM');
    expect(prompt).toContain('Do not fetch the GitHub issue body or comments');
    expect(prompt).toContain('This VM has no GitHub, Sentry, production');
    expect(prompt).toContain('Capture and inspect a compact evidence packet');
    expect(prompt).toContain('Stage every intended repository change');
    expect(prompt).toContain('Leave the changes uncommitted');
    expect(prompt).toContain('Do not push, open a pull request');
  });

  it('rejects malformed claims and invalid dispatcher configuration', async () => {
    for (const value of [undefined, false, [], 'claim']) {
      expect(() => parseAgentClaim(value)).toThrow(
        'claim response must be an object or null'
      );
    }
    for (const field of [
      '_id',
      'dedupKey',
      'projectId',
      'sentryIssueId',
      'sentryEventId',
      'environment',
      'release',
      'operation',
      'level',
      'leaseId',
    ]) {
      expect(() => parseAgentClaim({ ...CLAIM, [field]: '' })).toThrow(
        `claim.${field} must be a non-empty string`
      );
    }
    expect(() => parseAgentClaim({ ...CLAIM, agentAttempts: 0 })).toThrow(
      'claim.agentAttempts must be a positive integer'
    );
    expect(() => parseAgentClaim({ ...CLAIM, agentLeaseExpiresAt: 0 })).toThrow(
      'claim.agentLeaseExpiresAt must be a positive integer'
    );

    await expect(
      dispatchSentryAgent({ env: { SENTRY_AGENT_LOOP_SECRET: SECRET } })
    ).rejects.toThrow('LINEJAM_SENTRY_AGENT_ENDPOINT is required');
    await expect(
      dispatchSentryAgent({
        env: {
          LINEJAM_SENTRY_AGENT_ENDPOINT: 'https://linejam.example',
          SENTRY_AGENT_LOOP_SECRET: 'short',
        },
      })
    ).rejects.toThrow('must contain at least 32 characters');
    await expect(
      dispatchSentryAgent({
        env: {
          ...env(),
          LINEJAM_SENTRY_AGENT_TIMEOUT_MS: 'zero',
        },
      })
    ).rejects.toThrow(
      'LINEJAM_SENTRY_AGENT_TIMEOUT_MS must be a positive integer'
    );
    await expect(
      dispatchSentryAgent({
        env: {
          ...env(),
          LINEJAM_SENTRY_AGENT_TIMEOUT_MS: '2700001',
        },
      })
    ).rejects.toThrow(
      'LINEJAM_SENTRY_AGENT_TIMEOUT_MS must not exceed 2700000'
    );
    expect(parseAgentTimeoutMs(undefined)).toBe(2_700_000);
  });

  it('handles idle, mismatched, failed, and malformed claim responses', async () => {
    await expect(
      dispatchSentryAgent({
        env: { ...env(), LINEJAM_SENTRY_AGENT_TIMEOUT_MS: '' },
        fetchImpl: vi.fn(async () => response(null)),
        now: () => 1_000,
      })
    ).resolves.toEqual({ status: 'idle' });

    await expect(
      dispatchSentryAgent({
        env: env(),
        fetchImpl: vi.fn(async () => response(CLAIM)),
        now: () => 1_000,
      })
    ).rejects.toThrow('claim lease ID did not match the request');

    await expect(
      dispatchSentryAgent({
        env: env(),
        fetchImpl: vi.fn(async () =>
          Promise.resolve(new Response('provider secret', { status: 503 }))
        ),
        now: () => 1_000,
      })
    ).rejects.toThrow('agent claim returned HTTP 503');

    await expect(
      dispatchSentryAgent({
        env: env(),
        fetchImpl: vi.fn(async () => new Response('not-json')),
        now: () => 1_000,
      })
    ).rejects.toThrow('agent claim returned invalid JSON');
  });

  it('sanitizes repository-local Git variables and exercises command boundaries', async () => {
    expect(
      sanitizeGitEnvironment({
        NODE_ENV: 'test',
        PATH: '/bin',
        GIT_DIR: '/private/repository',
        GIT_INDEX_FILE: '/private/index',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'credential.helper',
        GIT_CONFIG_VALUE_0: 'secret',
      } as NodeJS.ProcessEnv)
    ).toEqual({ NODE_ENV: 'test', PATH: '/bin' });

    const workspace = mkdtempSync(join(tmpdir(), 'linejam-run-command-'));
    const logPath = join(workspace, 'logs', 'command.log');
    try {
      await expect(
        runCommand(process.execPath, ['-e', "process.stdout.write('logged')"], {
          logPath,
          timeoutMs: 1_000,
        })
      ).resolves.toMatchObject({ status: 0, stderr: '' });
      expect(readFileSync(logPath, 'utf8')).toBe('logged');

      await expect(
        runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], {
          logPath,
          timeoutMs: 5,
        })
      ).resolves.toMatchObject({ status: 124, stderr: 'agent timed out' });

      await expect(
        runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], {
          timeoutMs: 5,
        })
      ).resolves.toMatchObject({ status: 124, stderr: 'command timed out' });

      await expect(
        runCommand(process.execPath, ['-e', "process.stdout.write('bytes')"], {
          binary: true,
        })
      ).resolves.toMatchObject({
        status: 0,
        stdout: Buffer.from('bytes'),
      });
      expect(() => runCommand('/definitely/missing-command', [])).toThrow();
      await expect(
        runCommand('/definitely/missing-command', [], { logPath })
      ).rejects.toThrow();
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('rejects every changed-file and patch-format policy escape', () => {
    const allowedPatch = 'diff --git a/lib/a.ts b/lib/a.ts\n';
    for (const paths of [
      [],
      Array.from({ length: 26 }, (_, index) => `lib/${index}.ts`),
      ['lib/a.ts', 'lib/a.ts'],
    ]) {
      expect(() => validatePatchPolicy(allowedPatch, paths)).toThrow(
        'invalid changed-file count'
      );
    }
    for (const patch of [
      'GIT binary patch',
      'similarity index 100%',
      'rename from lib/a.ts',
      'old mode 100644',
      'new file mode 100755',
      'deleted file mode 120000',
      'index abcdef..123456 160000',
    ]) {
      expect(() => validatePatchPolicy(patch, ['lib/a.ts'])).toThrow(
        'forbidden binary or file mode'
      );
    }
    for (const path of [
      '/lib/a.ts',
      'lib/../a.ts',
      'lib/.private.ts',
      'unknown/a.ts',
    ]) {
      expect(() => validatePatchPolicy(allowedPatch, [path])).toThrow(
        'isolated patch path is forbidden'
      );
    }
    expect(() =>
      validatePatchPolicy(allowedPatch, ['lib/no-extension'])
    ).toThrow('isolated patch file type is forbidden');
    expect(() => validatePatchPolicy(allowedPatch, ['lib/a.TS'])).not.toThrow();
  });

  it('covers bounded artifact collection failures and a valid packet', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'linejam-artifact-cases-'));
    const makeRun = (
      failure:
        | 'report-command'
        | 'report-empty'
        | 'patch-command'
        | 'archive-bounds'
        | 'pull-command'
        | 'extract-command'
        | 'packet-empty'
        | null,
      evidenceArchive: string
    ) =>
      vi.fn(async (_file: string, args: string[]) => {
        const command = String(args.at(-1));
        if (command.endsWith('/report.md')) {
          return failure === 'report-command'
            ? { status: 1, stdout: '', stderr: 'report failed' }
            : {
                status: 0,
                stdout: failure === 'report-empty' ? '' : 'bounded report',
                stderr: '',
              };
        }
        if (command.includes('git -C /home/exedev/linejam')) {
          return failure === 'patch-command'
            ? { status: 1, stdout: '', stderr: 'patch failed' }
            : {
                status: 0,
                stdout: 'diff --git a/lib/a.ts b/lib/a.ts\n',
                stderr: '',
              };
        }
        if (command.includes('archive-evidence.py')) {
          return {
            status: 0,
            stdout: JSON.stringify(
              failure === 'archive-bounds'
                ? { files: 0, bytes: -1 }
                : { files: 1, bytes: 1 }
            ),
            stderr: '',
          };
        }
        if (command.startsWith('cat /tmp/linejam-agent/evidence.tar.gz')) {
          return failure === 'pull-command'
            ? { status: 1, stdout: Buffer.alloc(0), stderr: 'pull failed' }
            : { status: 0, stdout: Buffer.from('archive'), stderr: '' };
        }
        if (failure !== 'packet-empty') {
          mkdirSync(evidenceArchive, { recursive: true });
          writeFileSync(join(evidenceArchive, 'proof.txt'), 'proof');
        }
        return failure === 'extract-command'
          ? { status: 1, stdout: '', stderr: 'extract failed' }
          : { status: 0, stdout: '', stderr: '' };
      });

    try {
      for (const failure of [
        'report-command',
        'report-empty',
        'patch-command',
        'archive-bounds',
        'pull-command',
        'extract-command',
        'packet-empty',
      ] as const) {
        const evidenceArchive = join(workspace, failure);
        await expect(
          collectVmArtifacts({
            run: makeRun(failure, evidenceArchive),
            root: workspace,
            runtimeEnv: {},
            host: 'artifact-cases.exe.xyz',
            issueNumber: 426,
            evidenceArchive,
          })
        ).rejects.toThrow();
      }

      const evidenceArchive = join(workspace, 'valid');
      await expect(
        collectVmArtifacts({
          run: makeRun(null, evidenceArchive),
          root: workspace,
          runtimeEnv: {},
          host: 'artifact-cases.exe.xyz',
          issueNumber: 426,
          evidenceArchive,
        })
      ).resolves.toMatchObject({
        report: 'bounded report',
        patch: expect.stringContaining('diff --git'),
      });
      await expect(
        collectVmArtifacts({
          run: makeRun(null, evidenceArchive),
          root: workspace,
          runtimeEnv: {},
          host: 'artifact-cases.exe.xyz',
          issueNumber: 426,
          evidenceArchive,
        })
      ).rejects.toThrow('evidence archive destination already exists');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
  it('normalizes sparse Sentry metadata and handles invalid or completed issues', async () => {
    const makeRun = (labels: Array<{ name: string }>) =>
      vi.fn(async (file: string, args: string[]) => {
        if (file === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return {
            status: 0,
            stdout: JSON.stringify({
              number: 426,
              state: 'OPEN',
              url: 'https://github.com/misty-step/linejam/issues/426',
              labels,
            }),
            stderr: '',
          };
        }
        if (file === 'sentry') {
          return {
            status: 0,
            stdout: JSON.stringify({ id: CLAIM.sentryIssueId }),
            stderr: '',
          };
        }
        if (file === 'ssh' && args[0] === 'exe.dev' && args[1] === 'new') {
          const vmName = args[args.indexOf('--name') + 1];
          return {
            status: 0,
            stdout: JSON.stringify({
              vm_name: vmName,
              ssh_dest: `${vmName}.exe.xyz`,
            }),
            stderr: '',
          };
        }
        return { status: 0, stdout: '', stderr: '' };
      });
    const requiredLabels = [
      { name: 'source/sentry' },
      { name: 'source/agent' },
    ];

    const invalidRequests: Array<{
      url: string;
      body: Record<string, unknown>;
    }> = [];
    await expect(
      dispatchSentryAgent({
        env: env(),
        fetchImpl: endpointMock(invalidRequests),
        run: makeRun([]),
        now: () => 1_000,
      })
    ).resolves.toMatchObject({ status: 'issue_invalid' });

    const removePublicationJournal = vi.fn();
    const recoveredRequests: Array<{
      url: string;
      body: Record<string, unknown>;
    }> = [];
    await expect(
      dispatchSentryAgent({
        env: env(),
        fetchImpl: endpointMock(recoveredRequests),
        run: makeRun(requiredLabels),
        now: () => 1_000,
        hasCompletionJournal: () => true,
        removePublicationJournal,
      })
    ).resolves.toMatchObject({ status: 'recovered' });
    expect(removePublicationJournal).toHaveBeenCalledOnce();

    const completedRequests: Array<{
      url: string;
      body: Record<string, unknown>;
    }> = [];
    await expect(
      dispatchSentryAgent({
        env: env(),
        fetchImpl: endpointMock(completedRequests),
        run: makeRun(requiredLabels),
        now: () => 1_000,
        startAuthGateway: async () => ({
          port: 48_766,
          stop: async () => undefined,
        }),
        collectVmArtifacts: async () => ({
          report: 'Sparse metadata remained privacy-safe.',
          patch: '',
        }),
        hasCompletionJournal: () => false,
        writeCompletionJournal: vi.fn(),
      })
    ).resolves.toMatchObject({ status: 'completed' });
  });

  it('fails closed at every patch publication boundary', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'linejam-publish-errors-'));
    const patch =
      'diff --git a/lib/a.ts b/lib/a.ts\n' +
      '--- a/lib/a.ts\n' +
      '+++ b/lib/a.ts\n' +
      '@@ -1 +1 @@\n' +
      '-old\n' +
      '+new\n';
    const options = {
      runtimeEnv: {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        LINEJAM_AGENT_FORK_REPOSITORY: 'operator/linejam',
      },
      worktree: workspace,
      branch: 'forest/sentry-426-errors',
      issueNumber: 426,
      patch,
      report: 'Publication boundary test.',
      stateDir: workspace,
    };
    const headOid = 'a'.repeat(40);
    const publicationMatch = {
      html_url: 'https://github.com/misty-step/linejam/pull/999',
      head: {
        ref: 'forest/sentry-426-errors',
        sha: headOid,
        repo: { owner: { login: 'operator' } },
      },
    };
    const successfulRun = vi.fn(async (file: string, args: string[]) => {
      if (file === 'git' && args[0] === 'apply' && args[1] === '--numstat') {
        return { status: 0, stdout: '1\t1\tlib/a.ts\0', stderr: '' };
      }
      if (file === 'git' && args[0] === 'rev-parse') {
        return { status: 0, stdout: headOid, stderr: '' };
      }
      if (file === 'gh' && args[0] === 'api') {
        return {
          status: 0,
          stdout: JSON.stringify([publicationMatch]),
          stderr: '',
        };
      }
      if (file === 'gh' && args[0] === 'pr' && args[1] === 'create') {
        return {
          status: 0,
          stdout: publicationMatch.html_url,
          stderr: '',
        };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    try {
      await expect(
        publishPatch({ ...options, run: successfulRun, patch: ' ' })
      ).resolves.toBeNull();
      for (const forkRepository of ['', 'misty-step/linejam', 'not a/repo']) {
        await expect(
          publishPatch({
            ...options,
            run: successfulRun,
            runtimeEnv: {
              ...options.runtimeEnv,
              LINEJAM_AGENT_FORK_REPOSITORY: forkRepository,
            },
          })
        ).rejects.toThrow();
      }
      await expect(
        publishPatch({
          ...options,
          run: successfulRun,
          patch: `diff --git a/lib/a.ts b/lib/a.ts\n${'x'.repeat(
            2 * 1024 * 1024
          )}`,
        })
      ).rejects.toThrow('bounded patch limit');

      await expect(
        publishPatch({
          ...options,
          run: vi.fn(async () => ({
            status: 0,
            stdout: 'malformed',
            stderr: '',
          })),
        })
      ).rejects.toThrow('malformed numstat output');

      for (const failAt of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        let call = 0;
        let prCreated = false;
        const run = vi.fn(async (file: string, args: string[]) => {
          const current = call++;
          if (current === failAt) {
            return {
              status: 9,
              stdout: '',
              stderr: `${file} boundary failed`,
            };
          }
          if (
            file === 'git' &&
            args[0] === 'apply' &&
            args[1] === '--numstat'
          ) {
            return { status: 0, stdout: '1\t1\tlib/a.ts\0', stderr: '' };
          }
          if (file === 'git' && args[0] === 'rev-parse') {
            return { status: 0, stdout: headOid, stderr: '' };
          }
          if (file === 'gh' && args[0] === 'api') {
            return {
              status: 0,
              stdout: JSON.stringify(prCreated ? [publicationMatch] : []),
              stderr: '',
            };
          }
          if (file === 'gh' && args[0] === 'pr' && args[1] === 'create') {
            prCreated = true;
            return {
              status: 0,
              stdout: publicationMatch.html_url,
              stderr: '',
            };
          }
          return { status: 0, stdout: '', stderr: '' };
        });
        await expect(publishPatch({ ...options, run })).rejects.toThrow(
          'failed with exit 9'
        );
      }

      await expect(
        publishPatch({
          ...options,
          run: vi.fn(async (file: string, args: string[]) => {
            if (
              file === 'git' &&
              args[0] === 'apply' &&
              args[1] === '--numstat'
            ) {
              return { status: 0, stdout: '1\t1\tlib/a.ts\0', stderr: '' };
            }
            if (file === 'git' && args[0] === 'rev-parse') {
              return { status: 0, stdout: headOid, stderr: '' };
            }
            if (file === 'gh' && args[0] === 'api') {
              return { status: 0, stdout: '[]', stderr: '' };
            }
            return {
              status: 0,
              stdout: file === 'gh' ? 'https://example.test/pull/1' : '',
              stderr: '',
            };
          }),
        })
      ).rejects.toThrow('invalid pull request URL');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('starts and stops the local auth gateway and fails closed on early exit', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'linejam-auth-gateway-'));
    const bin = join(workspace, 'bin');
    const omp = join(bin, 'omp');
    mkdirSync(bin);
    writeFileSync(
      omp,
      `#!/bin/sh
if [ "$FAIL_GATEWAY" = "1" ]; then
  exit 7
fi
port="\${3##*:}"
exec ${process.execPath} -e "let served = 0; require('node:http').createServer((request, response) => { served += 1; if (served > 1) { response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); } response.end(request.method + ' ' + request.url); }).listen(Number(process.argv[1]), '127.0.0.1')" "$port"
`
    );
    chmodSync(omp, 0o700);
    const runtimeEnv = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
    };
    try {
      const gateway = await startAuthGateway({
        runtimeEnv,
      });
      expect(gateway.port).toBe(48_766);
      await expect(
        fetch('http://127.0.0.1:48766/v1/chat/completions', {
          method: 'POST',
          headers: { Accept: '' },
        }).then((response) => response.text())
      ).resolves.toBe('POST /v1/chat/completions');
      const allowed = await fetch(
        'http://127.0.0.1:48766/v1/chat/completions',
        {
          method: 'POST',
          body: '{}',
        }
      );
      expect(await allowed.text()).toBe('POST /v1/chat/completions');
      expect(allowed.headers.get('content-type')).toBe('application/json');
      expect(allowed.headers.get('cache-control')).toBe('no-store');
      for (const [path, method] of [
        ['/v1/usage', 'GET'],
        ['/v1/credentials/check', 'GET'],
        ['/v1/usage', 'POST'],
        ['/v1/chat/completions?metadata=1', 'POST'],
      ]) {
        const response = await fetch(`http://127.0.0.1:48766${path}`, {
          method,
        });
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'not_found' });
      }
      await gateway.stop();

      await expect(
        startAuthGateway({
          runtimeEnv: { ...runtimeEnv, FAIL_GATEWAY: '1' },
        })
      ).rejects.toThrow('gateway process exited with 7');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
