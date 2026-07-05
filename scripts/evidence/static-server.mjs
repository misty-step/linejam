#!/usr/bin/env node

/**
 * Static theme evidence server.
 *
 * `pnpm start:next` serves the production build for host/theme screenshots
 * that don't exercise the guest/game flow. Run against a fresh build with
 * ordinary env, it throws two errors that are noise for that use case, not
 * real defects:
 *
 *   - `guestSessions:checkGuestSessionThrottle` missing on the active Convex
 *     deployment (the build wasn't pushed against the same deployment the
 *     guest-session route is throttling against).
 *   - `Canary capture failed: ECONNREFUSED` when an ambient `CANARY_API_KEY`
 *     leaks in from the shell (e.g. a shared dev profile pointing at a local
 *     responder on 127.0.0.1:4000) that isn't actually running.
 *
 * Both have existing, tested escape hatches (`LINEJAM_ALLOW_UNSYNCED_CONVEX_
 * THROTTLE`, and Canary reporting no-ops with no API key) -- this wraps them
 * into one documented mode instead of every agent rediscovering the fix.
 * Static screenshots never call the guest-session or error-reporting paths
 * on purpose either way; this just stops them from failing loudly if a page
 * incidentally triggers one.
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
  // Explicitly disable Canary for this mode rather than trusting an absent
  // key -- an ambient shell profile can leak CANARY_API_KEY in from other
  // repos' dev conventions.
  delete env.CANARY_API_KEY;
  delete env.NEXT_PUBLIC_CANARY_API_KEY;
  return env;
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function main() {
  const env = buildStaticEvidenceEnv(process.env);
  console.log(
    `[static-server] starting on port ${env.PORT} with Convex throttle bypass and Canary disabled (static theme evidence mode)`
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
