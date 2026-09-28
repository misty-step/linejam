#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const WORKFLOW_FILE = 'prod-smoke.yml';
const PLAYER_JOB = 'Production Smoke';
const PLAYER_STEP = 'Run production smoke';
const HISTORY_LIMIT = 10;
const INCONCLUSIVE_CONCLUSIONS = new Set([
  'cancelled',
  'skipped',
  'neutral',
  'stale',
  'action_required',
  'timed_out',
]);

/**
 * Count the consecutive browser-smoke failure streak ending at this run.
 *
 * `priorConclusions` contains the earlier completed player steps, ordered
 * most-recent-first. Cancelled, skipped, and other inconclusive steps carry
 * no player-health signal and do not break or extend the streak.
 *
 * @param {'success' | 'failure'} currentOutcome
 * @param {Array<string>} priorConclusions
 * @returns {number}
 */
export function countConsecutiveFailures(currentOutcome, priorConclusions) {
  if (currentOutcome !== 'failure') return 0;

  let streak = 1;
  for (const conclusion of priorConclusions) {
    if (conclusion === 'failure') {
      streak += 1;
    } else if (conclusion === 'success') {
      break;
    } else if (!INCONCLUSIVE_CONCLUSIONS.has(conclusion)) {
      throw new Error('Unusable production smoke step conclusion');
    }
  }
  return streak;
}

function runId(value) {
  const encoded = String(value);
  const id = Number(encoded);
  if (!/^[1-9]\d*$/.test(encoded) || !Number.isSafeInteger(id)) {
    throw new Error('Invalid GitHub run ID');
  }
  return id;
}

function timestamp(value) {
  const time = Date.parse(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) ||
    !Number.isFinite(time)
  ) {
    throw new Error('Missing or invalid production smoke run timestamp');
  }
  return time;
}

/**
 * Read completed master runs of the player workflow, not their aggregate
 * conclusions: legacy Sentry bookkeeping and newer reporting jobs can fail
 * even when the browser smoke passed.
 *
 * @param {{
 *   owner: string,
 *   repo: string,
 *   excludeRunId: string | number,
 *   token: string,
 *   fetchImpl?: typeof fetch,
 * }} params
 * @returns {Promise<Array<string>>}
 */
export async function fetchPriorRunConclusions({
  owner,
  repo,
  excludeRunId,
  token,
  fetchImpl = globalThis.fetch,
}) {
  const currentId = runId(excludeRunId);
  const apiRoot = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  async function get(path) {
    const response = await fetchImpl(`${apiRoot}${path}`, {
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to read production smoke history: HTTP ${response.status}`
      );
    }
    return response.json();
  }

  // The reporting job runs while its own workflow is still in progress.
  // Compare attempt start times, including reruns, rather than relying on
  // the completed-runs list to include the current run or exclude newer ones.
  const current = await get(`/actions/runs/${currentId}`);
  if (runId(current?.id) !== currentId) {
    throw new Error('GitHub returned the wrong production smoke run');
  }
  const currentTime = timestamp(current.run_started_at ?? current.created_at);
  const history = await get(
    `/actions/workflows/${WORKFLOW_FILE}/runs?branch=master&per_page=${HISTORY_LIMIT}`
  );
  if (
    !Array.isArray(history?.workflow_runs) ||
    history.workflow_runs.length > HISTORY_LIMIT
  ) {
    throw new Error('Unusable production smoke run history');
  }
  if (
    history.total_count !== undefined &&
    (!Number.isInteger(history.total_count) ||
      history.total_count < history.workflow_runs.length)
  ) {
    throw new Error('Unusable production smoke history count');
  }

  const prior = [];
  for (const run of history.workflow_runs) {
    if (run?.head_branch !== 'master') continue;
    const id = runId(run.id);
    if (id === currentId || run.status !== 'completed') continue;
    const started = timestamp(run.run_started_at ?? run.created_at);
    if (started > currentTime || (started === currentTime && id > currentId)) {
      continue;
    }
    prior.push({ id, started });
  }
  prior.sort((a, b) => b.started - a.started || (a.id < b.id ? 1 : -1));

  const conclusions = [];
  for (const { id } of prior) {
    // Always derive the endpoint from the trusted GitHub origin; the run's
    // jobs_url is untrusted data and must not receive our bearer token.
    const jobsBody = await get(
      `/actions/runs/${id}/jobs?filter=latest&per_page=100`
    );
    if (
      !Array.isArray(jobsBody?.jobs) ||
      jobsBody.jobs.length >= 100 ||
      (jobsBody.total_count !== undefined &&
        (!Number.isInteger(jobsBody.total_count) ||
          jobsBody.total_count !== jobsBody.jobs.length))
    ) {
      throw new Error(`Unusable production smoke jobs for run ${id}`);
    }
    const playerJobs = jobsBody.jobs.filter((job) => job?.name === PLAYER_JOB);
    if (playerJobs.length !== 1 || playerJobs[0].status !== 'completed') {
      throw new Error(`Missing completed production smoke job for run ${id}`);
    }
    const steps = playerJobs[0].steps;
    const playerSteps = Array.isArray(steps)
      ? steps.filter((step) => step?.name === PLAYER_STEP)
      : [];
    if (playerSteps.length !== 1 || playerSteps[0].status !== 'completed') {
      throw new Error(`Missing completed browser smoke step for run ${id}`);
    }
    const conclusion = playerSteps[0].conclusion;
    if (
      conclusion !== 'success' &&
      conclusion !== 'failure' &&
      !INCONCLUSIVE_CONCLUSIONS.has(conclusion)
    ) {
      throw new Error(`Unusable browser smoke step conclusion for run ${id}`);
    }
    conclusions.push(conclusion);
    if (conclusion === 'success') break;
  }
  const moreRuns =
    history.total_count === undefined
      ? history.workflow_runs.length === HISTORY_LIMIT
      : history.total_count > history.workflow_runs.length;
  if (
    moreRuns &&
    conclusions.every(
      (conclusion) => conclusion !== 'success' && conclusion !== 'failure'
    )
  ) {
    throw new Error(
      'Production smoke history limit reached without player evidence'
    );
  }
  return conclusions;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const currentOutcome = process.argv[2];
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');

  if (currentOutcome !== 'failure') {
    console.log(0);
  } else {
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
        // Unknown history can conceal a second player failure: escalate rather
        // than silently marking this as a first-time blip.
        console.log(2);
      });
  }
}
