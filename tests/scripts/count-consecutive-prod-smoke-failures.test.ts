/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import {
  countConsecutiveFailures,
  fetchPriorRunConclusions,
} from '@/scripts/ops/count-consecutive-prod-smoke-failures.mjs';

describe('countConsecutiveFailures', () => {
  it('returns 0 when the current run succeeded, regardless of history', () => {
    expect(countConsecutiveFailures('success', ['failure', 'failure'])).toBe(0);
  });

  it('returns 1 for the first failure in a clean history', () => {
    expect(countConsecutiveFailures('failure', ['success', 'success'])).toBe(1);
  });

  it('counts a run back to the last success', () => {
    expect(
      countConsecutiveFailures('failure', ['failure', 'failure', 'success'])
    ).toBe(3);
  });

  it('ignores cancelled/skipped/neutral runs instead of breaking the streak', () => {
    expect(
      countConsecutiveFailures('failure', [
        'failure',
        'cancelled',
        'failure',
        'skipped',
        'success',
      ])
    ).toBe(3);
  });

  it('counts the whole history as failures when no success is found', () => {
    expect(
      countConsecutiveFailures('failure', ['failure', 'failure', 'failure'])
    ).toBe(4);
  });

  it('handles an empty history as a first-time failure', () => {
    expect(countConsecutiveFailures('failure', [])).toBe(1);
  });
});

describe('fetchPriorRunConclusions', () => {
  it('excludes the current run, sorts most-recent-first, and returns bare conclusions', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workflow_runs: [
          { id: 1, conclusion: 'success', created_at: '2026-07-01T00:00:00Z' },
          { id: 2, conclusion: 'failure', created_at: '2026-07-03T00:00:00Z' },
          { id: 3, conclusion: 'failure', created_at: '2026-07-02T00:00:00Z' },
          {
            id: 999,
            conclusion: null,
            created_at: '2026-07-04T00:00:00Z',
          },
        ],
      }),
    });

    const conclusions = await fetchPriorRunConclusions({
      owner: 'misty-step',
      repo: 'linejam',
      excludeRunId: 999,
      token: 'test-token',
      fetchImpl,
    });

    expect(conclusions).toEqual(['failure', 'failure', 'success']);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(
        '/repos/misty-step/linejam/actions/workflows/prod-smoke.yml/runs'
      ),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });

  it('throws with the HTTP status when the GitHub API call fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403 });

    await expect(
      fetchPriorRunConclusions({
        owner: 'misty-step',
        repo: 'linejam',
        excludeRunId: 1,
        token: 'test-token',
        fetchImpl,
      })
    ).rejects.toThrow('HTTP 403');
  });
});
