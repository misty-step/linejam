#!/usr/bin/env node
/**
 * linejam-909: `pnpm doctor` -- the verified-live check onboarding ends at.
 *
 * scripts/setup.sh installs dependencies and writes a placeholder
 * .env.local, then prints "setup complete" -- but a workspace with
 * placeholder secrets and no running app is not "complete" in any sense
 * that matters. Doctor fails loudly instead of letting an installed-but-dead
 * workspace pass as done (application-floor item 9).
 *
 * Exits 0 only if every check passes. `warn` checks (Canary reachability,
 * app health when no server is running) do not fail the exit code -- they
 * are advisory, matching Canary's own health/readiness split -- but a
 * missing/placeholder secret is always a hard fail.
 */
import { pathToFileURL } from 'node:url';
import { deriveClerkFrontendOrigin } from './lib/clerk-domain.mjs';

const PLACEHOLDER_CANARY_KEYS = new Set([
  'example_canary_server_key',
  'example_canary_write_key',
]);

/** @typedef {{ name: string, status: 'pass'|'warn'|'fail', message: string }} CheckResult */

/**
 * @param {Record<string, string | undefined>} env
 * @returns {CheckResult}
 */
export function checkRequiredEnv(env = process.env) {
  const missing = ['GUEST_TOKEN_SECRET'].filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    return {
      name: 'required env',
      status: 'fail',
      message: `missing: ${missing.join(', ')} -- see .env.example`,
    };
  }
  return { name: 'required env', status: 'pass', message: 'present' };
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {CheckResult}
 */
export function checkConvexConfig(env = process.env) {
  const url = env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) {
    return {
      name: 'Convex',
      status: 'fail',
      message: 'NEXT_PUBLIC_CONVEX_URL is not set',
    };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return {
      name: 'Convex',
      status: 'fail',
      message: `NEXT_PUBLIC_CONVEX_URL is not a valid URL: ${url}`,
    };
  }

  if (!parsed.hostname.endsWith('.convex.cloud')) {
    return {
      name: 'Convex',
      status: 'fail',
      message: `NEXT_PUBLIC_CONVEX_URL does not look like a Convex deployment: ${url}`,
    };
  }

  return { name: 'Convex', status: 'pass', message: parsed.hostname };
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {CheckResult}
 */
export function checkClerkConfig(env = process.env) {
  const publishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = env.CLERK_SECRET_KEY?.trim();

  if (!publishableKey || !secretKey) {
    const missing = [
      !publishableKey && 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      !secretKey && 'CLERK_SECRET_KEY',
    ].filter(Boolean);
    return {
      name: 'Clerk',
      status: 'fail',
      message: `missing: ${missing.join(', ')}`,
    };
  }

  const origin = deriveClerkFrontendOrigin(publishableKey);
  if (!origin) {
    return {
      name: 'Clerk',
      status: 'fail',
      message:
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY does not decode to a Frontend API host',
    };
  }

  return { name: 'Clerk', status: 'pass', message: origin };
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {CheckResult}
 */
export function checkCanaryConfig(env = process.env) {
  const apiKey = env.NEXT_PUBLIC_CANARY_API_KEY?.trim();
  const endpoint = env.NEXT_PUBLIC_CANARY_ENDPOINT?.trim();

  if (!apiKey || !endpoint) {
    const missing = [
      !apiKey && 'NEXT_PUBLIC_CANARY_API_KEY',
      !endpoint && 'NEXT_PUBLIC_CANARY_ENDPOINT',
    ].filter(Boolean);
    return {
      name: 'Canary',
      status: 'fail',
      message: `missing: ${missing.join(', ')}`,
    };
  }

  if (PLACEHOLDER_CANARY_KEYS.has(apiKey)) {
    return {
      name: 'Canary',
      status: 'fail',
      message:
        'NEXT_PUBLIC_CANARY_API_KEY is still the placeholder from .env.example',
    };
  }

  return { name: 'Canary', status: 'pass', message: endpoint };
}

/**
 * @param {{ url?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [params]
 * @returns {Promise<CheckResult>}
 */
export async function checkCanaryReachable({
  url,
  fetchImpl = globalThis.fetch,
  timeoutMs = 3_000,
} = {}) {
  if (!url) {
    return {
      name: 'Canary reachability',
      status: 'skip',
      message: 'no endpoint configured',
    };
  }

  try {
    const response = await fetchImpl(
      `${url.replace(/\/$/, '')}/api/v1/status`,
      {
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
    if (!response.ok) {
      return {
        name: 'Canary reachability',
        status: 'warn',
        message: `HTTP ${response.status} from ${url}`,
      };
    }
    return {
      name: 'Canary reachability',
      status: 'pass',
      message: 'reachable',
    };
  } catch (error) {
    return {
      name: 'Canary reachability',
      status: 'warn',
      message: `unreachable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * @param {{ url?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [params]
 * @returns {Promise<CheckResult>}
 */
export async function checkAppHealth({
  // `pnpm dev` serves Next.js on :3000 (README). Port 3333 is deliberately
  // reserved for Playwright E2E (playwright.config.ts) to avoid clashing
  // with a running dev server -- doctor must point at dev's actual port,
  // not E2E's, or "start it with `pnpm dev` and re-run doctor" always
  // produces a false "no app running" warning (found live via a
  // fresh-context critic: curled both ports against a real `next dev`).
  url = 'http://localhost:3000/api/health',
  fetchImpl = globalThis.fetch,
  timeoutMs = 3_000,
} = {}) {
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return {
        name: 'app health',
        status: 'fail',
        message: `HTTP ${response.status} from ${url} -- the app is running but unhealthy`,
      };
    }
    const body = await response.json();
    if (body.status !== 'ok') {
      return {
        name: 'app health',
        status: 'fail',
        message: `body status "${body.status}" from ${url}`,
      };
    }
    return { name: 'app health', status: 'pass', message: `ok (${url})` };
  } catch (error) {
    const isConnRefused =
      error instanceof Error &&
      /ECONNREFUSED|fetch failed/i.test(error.message);
    return {
      name: 'app health',
      status: 'warn',
      message: isConnRefused
        ? `no app running at ${url} -- start it with \`pnpm dev\` and re-run \`pnpm doctor\` to verify live`
        : `${url}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * @param {{ env?: Record<string, string | undefined>, healthUrl?: string, fetchImpl?: typeof fetch }} [params]
 * @returns {Promise<CheckResult[]>}
 */
export async function runDoctor({
  env = process.env,
  healthUrl = process.env.LINEJAM_DOCTOR_HEALTH_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const canaryConfig = checkCanaryConfig(env);
  const results = [
    checkRequiredEnv(env),
    checkConvexConfig(env),
    checkClerkConfig(env),
    canaryConfig,
  ];

  if (canaryConfig.status === 'pass') {
    results.push(
      await checkCanaryReachable({
        url: env.NEXT_PUBLIC_CANARY_ENDPOINT?.trim(),
        fetchImpl,
      })
    );
  }

  results.push(await checkAppHealth({ url: healthUrl, fetchImpl }));

  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = await runDoctor();

  const icon = { pass: '✔', warn: '⚠', fail: '✖', skip: '·' };
  for (const result of results) {
    console.log(`${icon[result.status]} ${result.name}: ${result.message}`);
  }

  const failed = results.filter((r) => r.status === 'fail');
  if (failed.length > 0) {
    console.error(
      `\ndoctor found ${failed.length} failing check(s). Fix them before continuing -- see .env.example and README.md.`
    );
    process.exit(1);
  }

  const warned = results.filter((r) => r.status === 'warn');
  if (warned.length > 0) {
    console.log(
      `\ndoctor passed with ${warned.length} warning(s) -- not fatal, but worth a look.`
    );
  } else {
    console.log('\ndoctor: all checks green.');
  }
}
