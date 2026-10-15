#!/usr/bin/env node
// Production readiness after a Cloudflare deploy. A new Worker version takes
// seconds to reach every edge, so right after `wrangler deploy` an edge can
// still serve the previous source. Not-yet-propagated is a wait state: only a
// bounded wait that never sees the exact source with Convex connected and
// guest-secret parity fails, and the failure reports what production served.
import { fileURLToPath } from 'node:url';

export const PRODUCTION_ORIGIN = 'https://linejam.mistystep.io';

export async function waitForProduction({
  expectedSha,
  origin = PRODUCTION_ORIGIN,
  attempts = 24,
  intervalMs = 5000,
  fetchHealth = (url) =>
    fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' }),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  let observed = 'no response';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchHealth(`${origin}/api/health`);
      const health = await response.json();
      observed = JSON.stringify({
        http: response.status,
        status: health.status,
        deployment: health.deployment?.id,
        convex: health.convex,
        guestTokenParity: health.env?.guestTokenParity,
      });
      if (
        response.ok &&
        health.status === 'ok' &&
        health.deployment?.id === expectedSha &&
        health.convex === 'connected' &&
        health.env?.guestTokenParity === true
      ) {
        return attempt;
      }
    } catch (error) {
      observed = String(error);
    }
    if (attempt < attempts) await sleep(intervalMs);
  }
  throw new Error(
    `Production readiness failed: ${origin} served ${observed} after ${attempts} attempts.`
  );
}

async function main() {
  const expectedSha = process.env.EXPECTED_SHA ?? '';
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
    throw new Error('EXPECTED_SHA must be the full deployed commit SHA.');
  }
  const attempt = await waitForProduction({ expectedSha });
  console.log(
    `Verified ${PRODUCTION_ORIGIN} on attempt ${attempt}: source, Convex connection and guest-secret parity.`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(String(error));
    process.exit(1);
  });
}
