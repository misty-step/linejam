import { createHmac } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  utimesSync,
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
  pruneAgentState,
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
const INFERENCE_TOOL_NAMES = [
  'read',
  'bash',
  'edit',
  'eval',
  'glob',
  'grep',
  'task',
  'hub',
  'todo',
  'web_search',
  'write',
] as const;

function inferencePayload(content: string) {
  return {
    model: 'openai-codex/gpt-5.6-sol',
    messages: [{ role: 'user', content }],
    stream: true,
    stream_options: { include_usage: true },
    store: false,
    tools: INFERENCE_TOOL_NAMES.map((name) => ({
      type: 'function',
      function: {
        name,
        description: `${name} tool`,
        parameters: { type: 'object', additionalProperties: false },
      },
    })),
    max_completion_tokens: 128,
  };
}

function evidencePacket(
  entries: Array<{ path: string; content: Buffer; declaredSize?: bigint }>
) {
  const chunks: Uint8Array[] = [Buffer.from('LINEJAM-EVIDENCE-V1\n')];
  for (const entry of entries) {
    const path = Buffer.from(entry.path);
    const header = Buffer.allocUnsafe(12);
    header.writeUInt32BE(path.length, 0);
    header.writeBigUInt64BE(
      entry.declaredSize ?? BigInt(entry.content.length),
      4
    );
    chunks.push(header.subarray(0, 4), path, header.subarray(4), entry.content);
  }
  chunks.push(Buffer.alloc(4));
  return Buffer.concat(chunks);
}

function isExeCommand(file: string, args: string[], command: string) {
  const hostIndex = args.indexOf('exe.dev');
  return file === 'ssh' && hostIndex >= 0 && args[hostIndex + 1] === command;
}
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

function githubControlResponse(file: string, args: string[]) {
  if (file !== 'gh' || args[0] !== 'api') return null;
  if (args[1] === 'user') {
    return {
      status: 0,
      stdout: JSON.stringify({ login: 'linejam-agent-owner' }),
      stderr: '',
    };
  }
  if (args.some((arg) => arg.endsWith('/comments'))) {
    return { status: 0, stdout: JSON.stringify([[]]), stderr: '' };
  }
  return null;
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function endpointMock(
  requests: Array<{ url: string; body: Record<string, unknown> }>,
  claim = CLAIM
) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ url, body });
    if (body.action === 'claim') {
      return response({ ...claim, leaseId: body.leaseId });
    }
    if (body.action === 'authorize') {
      return new Response(null, { status: 204 });
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

type DispatchOptions = Record<string, unknown> & {
  run?: typeof runCommand;
};

function dispatchSentryAgent(options: DispatchOptions = {}) {
  const suppliedRun = options.run;
  const run =
    suppliedRun === undefined
      ? undefined
      : async (
          file: string,
          args: string[],
          runOptions?: Parameters<typeof runCommand>[2]
        ) =>
          githubControlResponse(file, args) ??
          suppliedRun(file, args, runOptions);
  return dispatchSentryAgentImpl({
    ...options,
    run,
    stateDir: dispatchStateDir,
  });
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

  it('prunes private incident artifacts after 30 days', () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'linejam-state-retention-'));
    const currentTime = Date.now();
    const expiredTime = currentTime - 31 * 24 * 60 * 60 * 1_000;
    const expiredEvidence = join(stateDir, 'evidence', 'expired');
    const freshPacket = join(stateDir, 'packets', 'fresh.json');
    const expiredLog = join(stateDir, 'expired.log');
    mkdirSync(expiredEvidence, { recursive: true });
    mkdirSync(join(stateDir, 'packets'), { recursive: true });
    writeFileSync(join(expiredEvidence, 'report.md'), 'expired');
    writeFileSync(freshPacket, 'fresh');
    writeFileSync(expiredLog, 'expired');
    utimesSync(expiredEvidence, expiredTime / 1_000, expiredTime / 1_000);
    utimesSync(expiredLog, expiredTime / 1_000, expiredTime / 1_000);

    pruneAgentState(stateDir, currentTime);

    expect(existsSync(expiredEvidence)).toBe(false);
    expect(existsSync(expiredLog)).toBe(false);
    expect(existsSync(freshPacket)).toBe(true);
    rmSync(stateDir, { recursive: true, force: true });
  });

  it('closes a receipt without starting a VM when the issue is closed', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchImpl = endpointMock(requests);
    const run = vi.fn(async (file: string, args: string[]) => {
      if (file === 'gh') {
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
      }
      if (isExeCommand(file, args, 'ls')) {
        return { status: 0, stdout: JSON.stringify({ vms: [] }), stderr: '' };
      }
      if (file === 'git' && args[0] === 'worktree' && args[1] === 'list') {
        return { status: 0, stdout: '', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: 'not found' };
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
    expect(
      run.mock.calls.some(([file, args]) => isExeCommand(file, args, 'new'))
    ).toBe(false);
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
    const fetchImpl = endpointMock(requests, { ...CLAIM, agentAttempts: 2 });
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
        if (isExeCommand(file, args, 'new')) {
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
    expect(collectVmArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceArchive: expect.stringMatching(
          /\/evidence\/426-[0-9a-f]{8}-attempt-2$/
        ),
      })
    );
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
      '/usr/local/bin/linejam-omp'
    );
    expect(isolatedCall?.[2]?.env).not.toHaveProperty(
      'SENTRY_AGENT_LOOP_SECRET'
    );
    const remoteCalls = run.mock.calls.filter(([file]) =>
      ['ssh', 'scp'].includes(file)
    );
    for (const [, args] of remoteCalls) {
      expect(args).toEqual(
        expect.arrayContaining([
          '-F',
          '/dev/null',
          '-i',
          expect.stringMatching(/\/\.ssh\/exe_dev$/),
          'User=exedev',
          'IdentitiesOnly=yes',
          'ForwardAgent=no',
          'SendEnv=-*',
          'PermitLocalCommand=no',
        ])
      );
    }
    expect(isolatedCall?.[1]).not.toContain('ClearAllForwardings=yes');
    expect(
      remoteCalls
        .filter((call) => call !== isolatedCall)
        .every(([, args]) => args.includes('ClearAllForwardings=yes'))
    ).toBe(true);
    const networkIsolationCall = run.mock.calls.find(
      ([file, args]) =>
        file === 'ssh' &&
        args.some((arg) => arg.includes('iptables -P OUTPUT DROP'))
    );
    expect(networkIsolationCall).toBeDefined();
    expect(networkIsolationCall?.[1].at(-1)).toContain(
      'iptables -P INPUT DROP'
    );
    expect(networkIsolationCall?.[1].at(-1)).toContain(
      '! sudo -n -u linejam-agent -- sudo -n true'
    );
    expect(run.mock.calls.indexOf(networkIsolationCall!)).toBeLessThan(
      run.mock.calls.indexOf(isolatedCall!)
    );
    expect(String(isolatedCall?.[1].at(-1))).toContain(
      'sudo -n -u linejam-agent -- env'
    );
    expect(String(isolatedCall?.[1].at(-1))).toContain(
      '--cwd /home/linejam-agent/linejam'
    );
    expect(stopGateway).toHaveBeenCalledOnce();
    expect(
      run.mock.calls.some(([file, args]) => isExeCommand(file, args, 'rm'))
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
    expect(commentBodies[0]).not.toMatch(/\bAttempt \d+\b/);
    expect(commentBodies[1]).toContain(
      'No publishable source patch was justified'
    );
    expect(commentBodies[1]).not.toContain('## Finding');
    expect(commentBodies[2]).toMatch(
      /<!-- linejam-agent-publication:v1:receipt123:completed:[0-9a-f]{64} -->/
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
        if (isExeCommand(file, args, 'new')) {
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
          expect(options?.timeoutMs).toBe(18 * 60 * 1_000);
          elapsedMs = 38 * 60 * 1_000 - 1_000;
          return { status: 124, stdout: '', stderr: 'agent timed out' };
        }
        return { status: 0, stdout: '', stderr: '' };
      }
    );
    const stopGateway = vi.fn(async () => undefined);

    const result = await dispatchSentryAgent({
      env: { ...env(), LINEJAM_SENTRY_AGENT_TIMEOUT_MS: '2100000' },
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
    const vmRemoveCall = run.mock.calls.find(([file, args]) =>
      isExeCommand(file, args, 'rm')
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
        if (isExeCommand(file, args, 'new')) {
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
        if (isExeCommand(file, args, 'rm')) {
          if (!vmPresent) {
            return { status: 1, stdout: '', stderr: 'not found' };
          }
          vmPresent = false;
          return { status: 0, stdout: '', stderr: '' };
        }
        if (isExeCommand(file, args, 'ls')) {
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
      ).toHaveLength(2);
      expect(
        run.mock.calls.filter(([file, args]) => isExeCommand(file, args, 'rm'))
      ).toHaveLength(failureAt.startsWith('vm-') ? 2 : 1);
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
    const publicationMarker = `<!-- linejam-agent-publication:v1:receipt123:pull-request:${createHmac(
      'sha256',
      SECRET
    )
      .update('publication:v1\nreceipt123\npull-request')
      .digest('hex')} -->`;
    const publicationBody = `${publicationMarker}\nAutomated candidate patch from a credential-free disposable exe.dev VM. This draft is untrusted until reviewed. It has no merge or deployment authority.\n`;
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
          'state=open',
          '-f',
          'head=operator:forest/sentry-426-receipt123',
          '-f',
          'per_page=10',
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
                    state: 'open',
                    draft: true,
                    title: 'fix(sentry): investigate incident #426',
                    body: publicationBody,
                    user: { login: 'linejam-agent-owner' },
                    base: {
                      ref: 'master',
                      repo: { full_name: 'misty-step/linejam' },
                    },
                    head: {
                      ref: 'forest/sentry-426-receipt123',
                      sha: headOid,
                      repo: {
                        full_name: 'operator/linejam',
                        owner: { login: 'operator' },
                      },
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
      if (isExeCommand(file, args, 'new')) {
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
    const commitArgs = run.mock.calls.find(
      ([file, args]) => file === 'git' && args.includes('commit')
    )?.[1];
    expect(commitArgs).toEqual(
      expect.arrayContaining([
        'user.name=Linejam Sentry Agent',
        'user.email=sentry-agent@linejam.app',
      ])
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
      run.mock.calls.filter(([file, args]) => isExeCommand(file, args, 'new'))
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
        expect(command).toContain('sudo -n -u linejam-agent --');
        if (command.endsWith('/report.md')) {
          return { status: 0, stdout: 'bounded report', stderr: '' };
        }
        if (command.includes('git -C /home/linejam-agent/linejam')) {
          expect(command).toContain(
            'GIT_INDEX_FILE=/tmp/linejam-agent/patch.index'
          );
          expect(command).toContain('add -f -A -- .');
          expect(command).toContain("':(exclude).evidence'");
          return { status: 0, stdout: '', stderr: '' };
        }
        if (
          command.includes('python3 /usr/local/bin/linejam-archive-evidence')
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
        expect(command).toBe(
          'sudo -n -u linejam-agent -- cat /tmp/linejam-agent/evidence.packet'
        );
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

  it('rejects an oversized declared evidence member without allocating it', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'linejam-evidence-bomb-'));
    const packet = join(workspace, 'bomb.packet');
    const evidenceArchive = join(workspace, 'evidence');
    try {
      const packetBytes = evidencePacket([
        {
          path: 'proof.txt',
          content: Buffer.alloc(0),
          declaredSize: BigInt(10 * 1024 * 1024 + 1),
        },
      ]);
      writeFileSync(packet, packetBytes);
      const run = vi.fn(
        async (
          file: string,
          args: string[],
          options?: Parameters<typeof runCommand>[2]
        ) => {
          const command = String(args.at(-1));
          if (command.endsWith('/report.md')) {
            return { status: 0, stdout: 'bounded report', stderr: '' };
          }
          if (command.includes('git -C /home/linejam-agent/linejam')) {
            return { status: 0, stdout: '', stderr: '' };
          }
          if (command.includes('linejam-archive-evidence')) {
            return {
              status: 0,
              stdout: JSON.stringify({ files: 1, bytes: 1 }),
              stderr: '',
            };
          }
          if (command.endsWith('/evidence.packet')) {
            return { status: 0, stdout: packetBytes, stderr: '' };
          }
          return runCommand(file, args, options);
        }
      );

      await expect(
        collectVmArtifacts({
          run,
          root: workspace,
          runtimeEnv: process.env,
          host: 'metadata-bomb.exe.xyz',
          issueNumber: 426,
          evidenceArchive,
        })
      ).rejects.toThrow('python3');
      expect(existsSync(evidenceArchive)).toBe(false);
      expect(existsSync(`${evidenceArchive}.packet`)).toBe(false);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
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
      const publicationMarker = '<!-- authenticated-publication-marker -->';
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
          if (file === 'gh' && args[0] === 'api' && args[1] === 'user') {
            return {
              status: 0,
              signal: null,
              stdout: JSON.stringify({ login: 'linejam-agent-owner' }),
              stderr: '',
            };
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
                        state: 'open',
                        draft: true,
                        title: 'fix(sentry): investigate incident #426',
                        body: `${publicationMarker}\nAutomated candidate patch from a credential-free disposable exe.dev VM. This draft is untrusted until reviewed. It has no merge or deployment authority.\n`,
                        user: { login: 'linejam-agent-owner' },
                        base: {
                          ref: 'master',
                          repo: { full_name: 'misty-step/linejam' },
                        },
                        head: {
                          ref: branch,
                          sha: publishedOid,
                          repo: {
                            full_name: 'operator/linejam',
                            owner: { login: 'operator' },
                          },
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
          marker: publicationMarker,
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
          LINEJAM_SENTRY_AGENT_TIMEOUT_MS: '2100001',
        },
      })
    ).rejects.toThrow(
      'LINEJAM_SENTRY_AGENT_TIMEOUT_MS must not exceed 2100000'
    );
    expect(parseAgentTimeoutMs(undefined)).toBe(2_100_000);
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
  it('aborts a pending backend body when shutdown starts', async () => {
    const shutdown = new AbortController();
    const fetchImpl = vi.fn(
      async (_url: string, init?: { signal?: AbortSignal }) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener(
                'abort',
                () => controller.error(new Error('shutdown body aborted')),
                { once: true }
              );
            },
            pull() {
              shutdown.abort();
            },
          })
        )
    );

    await expect(
      dispatchSentryAgent({
        env: env(),
        fetchImpl,
        now: () => 1_000,
        shutdownSignal: shutdown.signal,
      })
    ).rejects.toThrow('agent claim returned invalid JSON');
    expect(shutdown.signal.aborted).toBe(true);
  });

  it('sanitizes repository-local Git variables and exercises command boundaries', async () => {
    await expect(
      sanitizeGitEnvironment({
        NODE_ENV: 'test',
        PATH: '/bin',
        GIT_DIR: '/private/repository',
        GIT_INDEX_FILE: '/private/index',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'credential.helper',
        GIT_CONFIG_VALUE_0: 'secret',
        GIT_AUTHOR_NAME: 'Phaedrus Raznikov',
        GIT_AUTHOR_EMAIL: 'private@example.com',
        GIT_COMMITTER_NAME: 'Phaedrus Raznikov',
        GIT_COMMITTER_EMAIL: 'private@example.com',
        EMAIL: 'private@example.com',
      } as NodeJS.ProcessEnv)
    ).resolves.toEqual({ NODE_ENV: 'test', PATH: '/bin' });

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

      const boundedLogPath = join(workspace, 'logs', 'bounded.log');
      await expect(
        runCommand(
          process.execPath,
          ['-e', "process.stdout.write('x'.repeat(1024))"],
          { logPath: boundedLogPath, maxBuffer: 128 }
        )
      ).rejects.toThrow('log exceeded the 128 byte limit');
      expect(readFileSync(boundedLogPath).length).toBeLessThanOrEqual(128);

      const treeLogPath = join(workspace, 'logs', 'tree.log');
      const startedAt = Date.now();
      await expect(
        runCommand(
          process.execPath,
          [
            '-e',
            "const { spawn } = require('node:child_process'); const child = spawn(process.execPath, ['-e', \"process.on('SIGTERM', () => {}); setTimeout(() => process.exit(3), 9000)\"], { stdio: 'inherit' }); console.log(child.pid); setTimeout(() => process.exit(2), 9000)",
          ],
          { logPath: treeLogPath, timeoutMs: 500 }
        )
      ).resolves.toMatchObject({ status: 124, signal: 'SIGTERM' });
      expect(Date.now() - startedAt).toBeLessThan(7_500);
      const grandchildPid = Number(readFileSync(treeLogPath, 'utf8').trim());
      expect(Number.isSafeInteger(grandchildPid)).toBe(true);
      await vi.waitFor(
        () => expect(() => process.kill(grandchildPid, 0)).toThrow(),
        { timeout: 1_000 }
      );

      await expect(
        runCommand(process.execPath, ['-e', "process.stdout.write('bytes')"], {
          binary: true,
        })
      ).resolves.toMatchObject({
        status: 0,
        stdout: Buffer.from('bytes'),
      });
      await expect(
        runCommand('/definitely/missing-command', [])
      ).rejects.toThrow();
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
      'config/a.ts',
      'convex/http.ts',
      'convex/schema.ts',
      'convex/sentryGithub.ts',
      'scripts/ops/sentry-agent-loop.mjs',
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
        if (command.includes('git -C /home/linejam-agent/linejam')) {
          return failure === 'patch-command'
            ? { status: 1, stdout: '', stderr: 'patch failed' }
            : {
                status: 0,
                stdout: 'diff --git a/lib/a.ts b/lib/a.ts\n',
                stderr: '',
              };
        }
        if (command.includes('linejam-archive-evidence')) {
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
        if (command.includes('cat /tmp/linejam-agent/evidence.packet')) {
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
        if (isExeCommand(file, args, 'new')) {
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
      marker: '<!-- authenticated-publication-marker -->',
      stateDir: workspace,
    };
    const headOid = 'a'.repeat(40);
    const publicationMatch = {
      html_url: 'https://github.com/misty-step/linejam/pull/999',
      state: 'open',
      draft: true,
      title: 'fix(sentry): investigate incident #426',
      body: `${options.marker}\nAutomated candidate patch from a credential-free disposable exe.dev VM. This draft is untrusted until reviewed. It has no merge or deployment authority.\n`,
      user: { login: 'linejam-agent-owner' },
      base: {
        ref: 'master',
        repo: { full_name: 'misty-step/linejam' },
      },
      head: {
        ref: 'forest/sentry-426-errors',
        sha: headOid,
        repo: {
          full_name: 'operator/linejam',
          owner: { login: 'operator' },
        },
      },
    };
    const successfulRun = vi.fn(async (file: string, args: string[]) => {
      if (file === 'git' && args[0] === 'apply' && args[1] === '--numstat') {
        return { status: 0, stdout: '1\t1\tlib/a.ts\0', stderr: '' };
      }
      if (file === 'git' && args[0] === 'rev-parse') {
        return { status: 0, stdout: headOid, stderr: '' };
      }
      if (file === 'gh' && args[0] === 'api' && args[1] === 'user') {
        return {
          status: 0,
          stdout: JSON.stringify({ login: 'linejam-agent-owner' }),
          stderr: '',
        };
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
          if (file === 'gh' && args[0] === 'api' && args[1] === 'user') {
            return {
              status: 0,
              stdout: JSON.stringify({ login: 'linejam-agent-owner' }),
              stderr: '',
            };
          }
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
            if (file === 'gh' && args[0] === 'api' && args[1] === 'user') {
              return {
                status: 0,
                stdout: JSON.stringify({ login: 'linejam-agent-owner' }),
                stderr: '',
              };
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
exec ${process.execPath} -e "require('node:http').createServer((request, response) => { let body = ''; request.on('data', (chunk) => { body += chunk; }); request.once('end', () => { response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); if (body.includes('abort-response')) { const socket = response.socket; response.flushHeaders(); response.write('partial'); setTimeout(() => socket.destroy(), 10); return; } if (body.includes('oversized-response')) { response.end('x'.repeat(9 * 1024 * 1024)); return; } response.end(request.method + ' ' + request.url); }); }).listen(Number(process.argv[1]), '127.0.0.1')" "$port"
`
    );
    chmodSync(omp, 0o700);
    const runtimeEnv = {
      ...process.env,
      LINEJAM_OMP_BINARY: omp,
      PATH: '/usr/bin:/bin',
    };
    let gateway: Awaited<ReturnType<typeof startAuthGateway>> | undefined;
    try {
      gateway = await startAuthGateway({
        runtimeEnv,
      });
      expect(gateway.port).toBe(48_766);
      const missingJson = await fetch(
        'http://127.0.0.1:48766/v1/chat/completions',
        { method: 'POST' }
      );
      expect(missingJson.status).toBe(413);
      expect(await missingJson.json()).toEqual({ error: 'invalid_request' });
      const allowed = await fetch(
        'http://127.0.0.1:48766/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inferencePayload('bounded request')),
        }
      );
      expect(await allowed.text()).toBe('POST /v1/chat/completions');
      expect(allowed.headers.get('content-type')).toBe('application/json');
      expect(allowed.headers.get('cache-control')).toBe('no-store');
      const gatewayRequest = (content: string) =>
        fetch('http://127.0.0.1:48766/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inferencePayload(content)),
        }).then((response) => response.text());
      await expect(gatewayRequest('abort-response')).rejects.toThrow();
      await expect(gatewayRequest('oversized-response')).rejects.toThrow();
      await expect(gatewayRequest('still-available')).resolves.toBe(
        'POST /v1/chat/completions'
      );
      for (const payload of [
        {
          ...inferencePayload('wrong model'),
          model: 'attacker-controlled-model',
        },
        { ...inferencePayload('empty messages'), messages: [] },
        { ...inferencePayload('provider fetch'), web_search_options: {} },
        {
          ...inferencePayload('provider response extension'),
          response_format: { type: 'json_object' },
        },
        {
          ...inferencePayload('multimodal provider fetch'),
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: 'https://attacker.invalid/probe' },
                },
              ],
            },
          ],
        },
      ]) {
        const rejected = await fetch(
          'http://127.0.0.1:48766/v1/chat/completions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        expect(rejected.status).toBe(400);
        expect(await rejected.json()).toEqual({
          error: 'request_policy_violation',
        });
      }
      const oversized = await fetch(
        'http://127.0.0.1:48766/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...inferencePayload('oversized'),
            messages: [{ role: 'user', content: 'x'.repeat(1024 * 1024) }],
          }),
        }
      );
      expect(oversized.status).toBe(413);
      expect(await oversized.json()).toEqual({ error: 'invalid_request' });
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
      gateway = undefined;

      await expect(
        startAuthGateway({
          runtimeEnv: {
            ...runtimeEnv,
            LINEJAM_OMP_BINARY: join(workspace, 'missing-omp'),
          },
        })
      ).rejects.toThrow('gateway process failed to start');

      await expect(
        startAuthGateway({
          runtimeEnv: { ...runtimeEnv, FAIL_GATEWAY: '1' },
        })
      ).rejects.toThrow('gateway process exited with 7');
    } finally {
      await gateway?.stop();
      rmSync(workspace, { recursive: true, force: true });
    }
  });
  it('keeps raw launcher failures in a private local diagnostic', async () => {
    const home = mkdtempSync(join(tmpdir(), 'linejam-launcher-failure-'));
    try {
      const result = await runCommand(
        process.execPath,
        [join(process.cwd(), 'scripts/ops/sentry-agent-loop.mjs')],
        {
          cwd: process.cwd(),
          env: {
            HOME: home,
            NODE_ENV: 'test',
            PATH: process.env.PATH,
          },
        }
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toBe(
        'Linejam Sentry agent loop failed closed; private diagnostics recorded locally.\n'
      );
      expect(result.stdout).not.toContain('LINEJAM_SENTRY_AGENT_ENDPOINT');
      expect(
        readFileSync(
          join(
            home,
            '.local',
            'state',
            'linejam-sentry-agent',
            'last-failure.log'
          ),
          'utf8'
        )
      ).toContain('LINEJAM_SENTRY_AGENT_ENDPOINT is required');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
