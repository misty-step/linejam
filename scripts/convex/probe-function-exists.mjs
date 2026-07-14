#!/usr/bin/env node

/**
 * Non-interactive Convex deployment probe for agent lanes.
 *
 * A one-shot, read-only check of whether a specific function (for example a
 * migration export) exists on the configured deployment uses `convex
 * function-spec`: metadata-only, value-free, and bounded. An explicitly
 * authorized shared-dev code sync uses `pnpm convex:sync:shared-dev`; this
 * probe never pushes code or starts a watcher.
 *
 * The catch (linejam-908): an isolated/sandboxed worktree that lacks
 * `~/.convex/config.json` fails with
 *   "MissingAccessToken: An access token is required for this command.
 *    Authenticate with `npx convex dev`"
 * even with valid CONVEX_DEPLOYMENT/NEXT_PUBLIC_CONVEX_URL selectors,
 * because the CLI's auth lives in that global file, not the env.
 *
 * The Convex CLI also accepts CONVEX_OVERRIDE_ACCESS_TOKEN, which
 * authenticates the exact same way without that file
 * (node_modules/convex/dist/cli.bundle.cjs). An operator who authorizes an
 * isolated worktree to run probes injects that token through the credential
 * plane (see docs/ops/observability-ci.md); this script is what the lane runs
 * once it is present. `convex-test` remains the right tool for
 * verifying migration *logic* with no deployment at all -- this is only
 * for confirming a function landed on a real dev deployment.
 */

import { spawnSync } from 'node:child_process';

const CONVEX_EXECUTABLE = ['pnpm', ['exec', 'convex', 'function-spec']];

/** @typedef {Record<string, string | undefined>} EnvShape */
/** @typedef {(command: string, args: string[], options: { env: EnvShape, encoding: 'utf8' }) => { status: number | null, stdout: string, stderr: string }} Runner */

/**
 * @param {string} functionSpecJson
 * @returns {Set<string>}
 */
export function parseFunctionIdentifiers(functionSpecJson) {
  const parsed = JSON.parse(functionSpecJson);
  const functions = Array.isArray(parsed.functions) ? parsed.functions : [];
  return new Set(functions.map((fn) => fn.identifier));
}

/**
 * @param {EnvShape} [env]
 * @param {Runner} [runner]
 * @returns {string}
 */
export function runFunctionSpec(env = process.env, runner = spawnSync) {
  const [command, args] = CONVEX_EXECUTABLE;
  const result = runner(command, args, { env, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `convex function-spec failed (status ${result.status}): ${
        result.stderr || result.stdout
      }`
    );
  }
  return result.stdout;
}

/**
 * @param {string} functionIdentifier
 * @param {EnvShape} [env]
 * @param {Runner} [runner]
 * @returns {boolean}
 */
export function probeFunctionExists(
  functionIdentifier,
  env = process.env,
  runner = spawnSync
) {
  const identifiers = parseFunctionIdentifiers(runFunctionSpec(env, runner));
  return identifiers.has(functionIdentifier);
}

function main() {
  const functionIdentifier = process.argv[2];
  if (!functionIdentifier) {
    console.error(
      'Usage: node scripts/convex/probe-function-exists.mjs <module.js:functionName>'
    );
    process.exit(2);
    return;
  }

  try {
    const exists = probeFunctionExists(functionIdentifier);
    console.log(
      exists ? `FOUND: ${functionIdentifier}` : `MISSING: ${functionIdentifier}`
    );
    process.exit(exists ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
