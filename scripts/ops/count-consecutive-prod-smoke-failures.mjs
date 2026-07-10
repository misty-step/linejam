#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const WORKFLOW_FILE = 'prod-smoke.yml';

/**
 * Count the consecutive failure streak ending at the current run.
 *
 * `priorConclusions` is the conclusions of earlier completed runs of the
 * same workflow, ordered most-recent-first, excluding the current run.
 * Runs whose conclusion is neither `success` nor `failure` (cancelled,
 * skipped, stale, action_required, ...) are ignored — they carry no signal
 * about whether the underlying check passed — rather than breaking or
 * extending the streak.
 *
 * @param {'success' | 'failure'} currentOutcome
 * @param {Array<string | null>} priorConclusions
 * @returns {number}
 */
export function countConsecutiveFailures(currentOutcome, priorConclusions) {
  if (currentOutcome !== 'failure') return 0;

  let streak = 1;
  for (const conclusion of priorConclusions) {
    if (conclusion === 'failure') {
      streak += 1;
      continue;
    }
    if (conclusion === 'success') break;
    // else: ignore and keep looking further back
  }
  return streak;
}

/**
 * @param {{
 *   owner: string,
 *   repo: string,
 *   excludeRunId: string | number,
 *   perPage?: number,
 *   token: string,
 *   fetchImpl?: typeof fetch,
 * }} params
 * @returns {Promise<Array<string | null>>}
 */
export async function fetchPriorRunConclusions({
  owner,
  repo,
  excludeRunId,
  perPage = 10,
  token,
  fetchImpl = globalThis.fetch,
}) {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?status=completed&per_page=${perPage}`;
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to list ${WORKFLOW_FILE} runs: HTTP ${response.status}`
    );
  }

  const body = await response.json();
  return (body.workflow_runs ?? [])
    .filter((run) => String(run.id) !== String(excludeRunId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((run) => run.conclusion);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const currentOutcome = process.argv[2];
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');

  fetchPriorRunConclusions({
    owner,
    repo,
    excludeRunId: process.env.GITHUB_RUN_ID,
    token: process.env.GITHUB_TOKEN,
  })
    .then((conclusions) => {
      console.log(countConsecutiveFailures(currentOutcome, conclusions));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      // Fail OPEN toward escalation, never toward silence: the 2026-07-04
      // outage was caused by a red signal nobody saw for ~15 hours, not by
      // an over-eager page. If we cannot read history on a failing run,
      // assume the threshold is already met rather than assuming zero.
      console.log(currentOutcome === 'failure' ? 2 : 0);
    });
}
