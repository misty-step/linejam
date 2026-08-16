#!/usr/bin/env node
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const COMMIT_SHA = /^[a-f0-9]{40}$/;
const DEFAULT_TIMEOUT_MS = 10_000;

function parseList(value) {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * @param {string} value
 * @param {{
 *   allowedOrigins?: string[],
 *   allowedHosts?: string[],
 *   allowedHostPattern?: string
 * }} [options]
 */
export function validateSmokeBaseUrl(
  value,
  { allowedOrigins = [], allowedHosts = [], allowedHostPattern } = {}
) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('PLAYWRIGHT_BASE_URL must be a valid HTTPS URL');
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    throw new Error(
      'PLAYWRIGHT_BASE_URL must be an HTTPS origin without credentials or a port'
    );
  }

  const matchesOrigin = allowedOrigins.includes(parsed.origin);
  const matchesHost = allowedHosts.includes(parsed.hostname);
  const matchesPattern =
    allowedHostPattern &&
    new RegExp(allowedHostPattern, 'i').test(parsed.hostname);
  if (!matchesOrigin && !matchesHost && !matchesPattern) {
    throw new Error(
      `Refusing to read a release from untrusted origin ${parsed.origin}`
    );
  }

  return parsed;
}

/**
 * @param {{
 *   baseUrl: string,
 *   allowedOrigins?: string[],
 *   allowedHosts?: string[],
 *   allowedHostPattern?: string,
 *   fetchImpl?: typeof globalThis.fetch,
 *   timeoutMs?: number
 * }} options
 */
export async function resolveSentryRelease({
  baseUrl,
  allowedOrigins,
  allowedHosts,
  allowedHostPattern,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!fetchImpl || !(fetchImpl instanceof Function)) {
    throw new Error('fetch is not available in this Node runtime');
  }

  const parsed = validateSmokeBaseUrl(baseUrl, {
    allowedOrigins,
    allowedHosts,
    allowedHostPattern,
  });
  const healthUrl = new URL('/api/health', parsed.origin);
  const response = await fetchImpl(healthUrl, {
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(
      `Release receipt failed: HTTP ${response.status} from ${healthUrl}`
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Release receipt was not JSON: ${healthUrl}`);
  }

  const release = body?.deployment?.id;
  if (
    Object.prototype.toString.call(release) !== '[object String]' ||
    !COMMIT_SHA.test(release)
  ) {
    throw new Error(
      `Release receipt has no 40-character deployment commit: ${healthUrl}`
    );
  }
  return release;
}

export async function resolveSentryReleaseFromEnvironment(env = process.env) {
  const release = await resolveSentryRelease({
    baseUrl: env.PLAYWRIGHT_BASE_URL,
    allowedOrigins: parseList(env.LINEJAM_ALLOWED_SMOKE_ORIGINS),
    allowedHosts: parseList(env.LINEJAM_ALLOWED_SMOKE_HOSTS),
    allowedHostPattern: env.LINEJAM_ALLOWED_SMOKE_HOST_PATTERN?.trim(),
  });
  const githubEnv = env.GITHUB_ENV?.trim();
  if (!githubEnv) {
    throw new Error(
      'GITHUB_ENV is required to export the deployed Sentry release'
    );
  }
  await appendFile(githubEnv, `NEXT_DEPLOYMENT_ID=${release}\n`, 'utf8');
  return release;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  resolveSentryReleaseFromEnvironment()
    .then((release) => {
      console.log(`Resolved deployed Sentry release ${release}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
