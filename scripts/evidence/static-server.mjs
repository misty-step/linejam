#!/usr/bin/env node

/**
 * Static theme evidence server.
 *
 * `pnpm start:next` serves the production build for host/theme screenshots
 * that do not exercise the guest/game flow. The shared-development Convex
 * guest throttle can differ from local state and fail static rendering.
 * `LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE` is the existing, tested escape hatch
 * for this intentionally isolated evidence surface.
 */

import { spawn } from 'node:child_process';
import process from 'node:process';

const DEFAULT_PORT = '3340';

/**
 * Pure so it's testable without spawning a server: given a base env, returns
 * the env to launch `next start` with for static evidence capture.
 */
export function buildStaticEvidenceEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  env.PORT = env.PORT || DEFAULT_PORT;
  env.LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE = '1';
  delete env.LINEJAM_SENTRY_ENABLED;
  delete env.NEXT_PUBLIC_SENTRY_DSN;
  delete env.NEXT_PUBLIC_SENTRY_ENABLED;
  return env;
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function main() {
  const env = buildStaticEvidenceEnv(process.env);
  console.log(
    `[static-server] starting on port ${env.PORT} with Convex throttle bypass (static theme evidence mode)`
  );
  const child = spawn(pnpmCommand(), ['start:next'], {
    env,
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
