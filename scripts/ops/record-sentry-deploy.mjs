#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const COMMIT_SHA = /^[a-f0-9]{40}$/;
const GITHUB_RUN_URL =
  /^https:\/\/github\.com\/misty-step\/linejam\/actions\/runs\/\d+$/;
const SENTRY_API = 'https://sentry.io/api/0';

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function checkedJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Sentry deploy request failed: HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new Error('Sentry deploy request returned invalid JSON');
  }
}

export async function recordSentryDeploy({
  token,
  organization,
  project,
  release,
  environment,
  runUrl,
  now = new Date(),
  fetchImpl = globalThis.fetch,
}) {
  if (organization !== 'misty-step' || project !== 'linejam') {
    throw new Error(
      'Sentry deploy target is not the canonical Linejam project'
    );
  }
  if (!COMMIT_SHA.test(release)) {
    throw new Error('NEXT_DEPLOYMENT_ID must be a lowercase 40-character SHA');
  }
  if (environment !== 'production') {
    throw new Error('Only production deploy markers are supported');
  }
  if (!GITHUB_RUN_URL.test(runUrl)) {
    throw new Error('GITHUB_RUN_URL is not a canonical Linejam Actions run');
  }
  if (!(fetchImpl instanceof Function)) throw new Error('fetch is unavailable');

  const releasePath = `organizations/${encodeURIComponent(organization)}/releases/${encodeURIComponent(release)}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const releaseRecord = await checkedJson(
    fetchImpl,
    `${SENTRY_API}/${releasePath}/`,
    { headers }
  );
  if (
    !releaseRecord ||
    releaseRecord.version !== release ||
    !Array.isArray(releaseRecord.projects) ||
    !releaseRecord.projects.some((entry) => entry.slug === project)
  ) {
    throw new Error('Sentry release does not belong to the Linejam project');
  }

  const deploys = await checkedJson(
    fetchImpl,
    `${SENTRY_API}/${releasePath}/deploys/`,
    { headers }
  );
  if (!Array.isArray(deploys)) {
    throw new Error('Sentry deploy list has an invalid shape');
  }
  const existing = deploys.find(
    (deploy) => deploy?.environment === environment
  );
  if (existing) {
    return { recorded: false, release, environment };
  }

  await checkedJson(fetchImpl, `${SENTRY_API}/${releasePath}/deploys/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      environment,
      name: 'github-actions-production-smoke',
      url: runUrl,
      dateFinished: now.toISOString(),
    }),
  });
  return { recorded: true, release, environment };
}

export async function runFromEnv(env = process.env) {
  return recordSentryDeploy({
    token: required(env, 'SENTRY_AUTH_TOKEN'),
    organization: required(env, 'SENTRY_ORG'),
    project: required(env, 'SENTRY_PROJECT'),
    release: required(env, 'NEXT_DEPLOYMENT_ID'),
    environment: required(env, 'LINEJAM_DEPLOY_ENVIRONMENT'),
    runUrl: required(env, 'GITHUB_RUN_URL'),
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFromEnv()
    .then((result) => {
      process.stdout.write(
        `${result.recorded ? 'Recorded' : 'Retained'} Sentry production deploy for ${result.release}\n`
      );
    })
    .catch((error) => {
      process.stderr.write(
        `Sentry deploy marker failed: ${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    });
}
