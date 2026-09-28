/** @vitest-environment node */
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import {
  countConsecutiveFailures,
  fetchPriorRunConclusions,
} from '@/scripts/ops/count-consecutive-prod-smoke-failures.mjs';

const CURRENT = {
  id: 500,
  created_at: '2026-09-28T12:00:00Z',
  head_branch: 'master',
  status: 'in_progress',
};
const API_PATH = '/repos/misty-step/linejam';

type RunOverrides = {
  run_started_at?: string;
  head_branch?: string;
  status?: string;
  conclusion?: string | null;
  jobs_url?: string;
};

function run(
  id: number,
  createdAt = '2026-09-28T11:00:00Z',
  overrides: RunOverrides = {}
) {
  return {
    id,
    created_at: createdAt,
    run_started_at: createdAt,
    head_branch: 'master',
    status: 'completed',
    conclusion: 'success',
    ...overrides,
  };
}

function playerJob(stepConclusion: string | null, jobConclusion = 'success') {
  return {
    name: 'Production Smoke',
    status: 'completed',
    conclusion: jobConclusion,
    steps: [
      {
        name: 'Run production smoke',
        status: 'completed',
        conclusion: stepConclusion,
      },
    ],
  };
}

function githubHistory(
  runs: Array<{ id: number }>,
  jobsByRun: Record<number, object[]>,
  totalCount = runs.length,
  currentRun: {
    id: number;
    created_at: string;
    head_branch: string;
    status: string;
    run_started_at?: string;
  } = CURRENT
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://api.github.com') {
      throw new Error(`Bearer token sent to untrusted origin: ${url.origin}`);
    }
    if (url.pathname === `${API_PATH}/actions/runs/${CURRENT.id}`) {
      return Response.json(currentRun);
    }
    if (url.pathname === `${API_PATH}/actions/workflows/prod-smoke.yml/runs`) {
      return Response.json({ workflow_runs: runs, total_count: totalCount });
    }
    const match = url.pathname.match(
      /^\/repos\/misty-step\/linejam\/actions\/runs\/(\d+)\/jobs$/
    );
    if (match) {
      const jobs = jobsByRun[Number(match[1])] ?? [];
      return Response.json({ jobs, total_count: jobs.length });
    }
    throw new Error(`Unexpected GitHub API request: ${url.pathname}`);
  });
}

async function failureStreak(fetchImpl: typeof fetch) {
  const prior = await fetchPriorRunConclusions({
    owner: 'misty-step',
    repo: 'linejam',
    excludeRunId: CURRENT.id,
    token: 'synthetic-token',
    fetchImpl,
  });
  return countConsecutiveFailures('failure', prior);
}

describe('production smoke player-health streak', () => {
  it('recovers on a passing browser run and escalates the second consecutive failure', () => {
    expect(countConsecutiveFailures('success', ['failure', 'failure'])).toBe(0);
    expect(countConsecutiveFailures('failure', ['success', 'failure'])).toBe(1);
    expect(countConsecutiveFailures('failure', ['failure', 'success'])).toBe(2);
  });

  it('ignores attempted runs without a browser pass/fail, but rejects unknown evidence', () => {
    expect(
      countConsecutiveFailures('failure', [
        'cancelled',
        'failure',
        'skipped',
        'neutral',
        'success',
      ])
    ).toBe(2);
    expect(countConsecutiveFailures('failure', [])).toBe(1);
    // SAFETY: Deliberately violate the input type to verify missing API evidence is rejected.
    expect(() => countConsecutiveFailures('failure', [null as never])).toThrow(
      'Unusable production smoke step conclusion'
    );
  });

  it.each<[string, object[]]>([
    [
      'legacy marker failed in the player job',
      [playerJob('success', 'failure')],
    ],
    [
      'split reporting job failed after the player job passed',
      [
        {
          name: 'Sentry player-health reporting',
          status: 'completed',
          conclusion: 'failure',
        },
        playerJob('success'),
      ],
    ],
  ])('does not page on a first player failure when %s', async (_case, jobs) => {
    const fetchImpl = githubHistory(
      [
        run(490, '2026-09-28T11:00:00Z', {
          conclusion: 'failure',
          jobs_url: 'https://attacker.example/steal-token',
        }),
        run(480, '2026-09-28T10:00:00Z', { conclusion: 'failure' }),
      ],
      { 490: jobs, 480: [playerJob('failure', 'failure')] }
    );

    expect(await failureStreak(fetchImpl)).toBe(1);
    expect(
      fetchImpl.mock.calls.every(
        ([input]) => new URL(String(input)).origin === 'https://api.github.com'
      )
    ).toBe(true);
  });

  it('escalates a second actual browser failure despite a successful aggregate run', async () => {
    const fetchImpl = githubHistory([run(490)], {
      490: [playerJob('failure', 'success')],
    });
    expect(await failureStreak(fetchImpl)).toBe(2);
  });

  it('uses only completed master runs earlier than the current attempt', async () => {
    const fetchImpl = githubHistory(
      [
        run(520, '2026-09-28T13:00:00Z', { conclusion: 'failure' }),
        run(510, CURRENT.created_at, { conclusion: 'failure' }),
        run(485, '2026-09-28T10:30:00Z', {
          run_started_at: '2026-09-28T13:00:00Z',
          conclusion: 'failure',
        }),
        run(500, CURRENT.created_at, { conclusion: 'failure' }),
        run(480, '2026-09-28T11:00:00Z', {
          head_branch: 'feature/manual-smoke',
          conclusion: 'failure',
        }),
        run(470, '2026-09-28T11:30:00Z', {
          status: 'in_progress',
          conclusion: null,
        }),
        run(490, CURRENT.created_at),
        run(460, '2026-09-28T10:00:00Z', { conclusion: 'failure' }),
      ],
      {
        520: [playerJob('failure')],
        510: [playerJob('failure')],
        485: [playerJob('failure')],
        500: [playerJob('failure')],
        480: [playerJob('failure')],
        470: [playerJob('failure')],
        490: [playerJob('success')],
        460: [playerJob('failure')],
      }
    );

    expect(await failureStreak(fetchImpl)).toBe(1);
  });

  it('includes a healthy run between the original run and its current rerun', async () => {
    const fetchImpl = githubHistory(
      [
        run(505, '2026-09-28T14:00:00Z', { conclusion: 'failure' }),
        run(490, '2026-09-28T11:00:00Z', { conclusion: 'failure' }),
      ],
      {
        505: [playerJob('success', 'failure')],
        490: [playerJob('failure')],
      },
      2,
      { ...CURRENT, run_started_at: '2026-09-28T15:00:00Z' }
    );

    expect(await failureStreak(fetchImpl)).toBe(1);
  });

  it('uses the latest job attempt rather than an earlier failed retry', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === `${API_PATH}/actions/runs/${CURRENT.id}`) {
        return Response.json(CURRENT);
      }
      if (url.pathname.endsWith('/runs')) {
        return Response.json({ workflow_runs: [run(490)] });
      }
      return Response.json({
        jobs: [
          url.searchParams.get('filter') === 'latest'
            ? playerJob('success')
            : playerJob('failure', 'failure'),
        ],
      });
    });

    expect(await failureStreak(fetchImpl)).toBe(1);
  });

  it.each<[string, object[]]>([
    ['no player job', []],
    ['no browser step', [{ ...playerJob('failure'), steps: [] }]],
    [
      'incomplete browser step',
      [
        {
          ...playerJob(null),
          steps: [
            {
              name: 'Run production smoke',
              status: 'in_progress',
              conclusion: null,
            },
          ],
        },
      ],
    ],
    ['unknown browser outcome', [playerJob('mystery')]],
  ])(
    'does not silently interpret %s as player success',
    async (_case, jobs) => {
      const fetchImpl = githubHistory([run(490)], { 490: jobs });
      await expect(failureStreak(fetchImpl)).rejects.toThrow();
    }
  );

  it('fails toward escalation when the bounded history contains no usable player signal', async () => {
    const runs = Array.from({ length: 10 }, (_, index) =>
      run(
        490 - index,
        `2026-09-28T${String(11 - index).padStart(2, '0')}:00:00Z`
      )
    );
    const jobs = Object.fromEntries(
      runs.map(({ id }) => [id, [playerJob('skipped')]])
    );
    const fetchImpl = githubHistory(runs, jobs, 11);

    await expect(failureStreak(fetchImpl)).rejects.toThrow(
      'history limit reached without player evidence'
    );
    expect(fetchImpl).toHaveBeenCalledTimes(12);
  });

  it('prints the escalation threshold when the GitHub history API rejects a failing run', () => {
    const preload = `data:text/javascript,${encodeURIComponent(
      "globalThis.fetch = async () => new Response('', { status: 403 })"
    )}`;
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        preload,
        'scripts/ops/count-consecutive-prod-smoke-failures.mjs',
        'failure',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_OPTIONS: '',
          GITHUB_REPOSITORY: 'misty-step/linejam',
          GITHUB_RUN_ID: String(CURRENT.id),
          GITHUB_TOKEN: 'fixture',
        },
      }
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe('2\n');
    expect(result.stderr).toContain('HTTP 403');
  });
});
