#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const FUNCTION_NAME = 'guestSessions:checkSignedGuestSessionThrottle';
const READINESS_KEY = 'guestSession:deployment-readiness';
const THROTTLE_PROOF_CONTEXT = 'linejam:guest-session-throttle:v1:';
const FUNCTION_SPEC_TIMEOUT_MS = 30_000;
const signedThrottle = makeFunctionReference(FUNCTION_NAME);

/**
 * Prove the deployed public API contains the signed throttle and shares the
 * web deployment's secret without writing a rate-limit row. A stale deployment
 * reports a missing function; a mismatched secret fails closed.
 */
export async function probeSignedThrottleReady(convexUrl, secret, mutate) {
  if (!convexUrl) throw new Error('NEXT_PUBLIC_CONVEX_URL is required');
  if (!secret) throw new Error('GUEST_TOKEN_SECRET is required');

  const proof = createHmac('sha256', secret)
    .update(`${THROTTLE_PROOF_CONTEXT}${READINESS_KEY}`)
    .digest('base64url');

  try {
    await mutate(signedThrottle, {
      key: READINESS_KEY,
      proof,
      dryRun: true,
    });
    return true;
  } catch (error) {
    const message = extractErrorMessage(error);
    if (/Could not find public function/i.test(message)) return false;
    throw error;
  }
}

export function parseFunctionSpecDeploymentUrl(functionSpecJson) {
  const parsed = JSON.parse(functionSpecJson);
  if (!parsed || typeof parsed.url !== 'string') {
    throw new Error('Convex function-spec omitted its deployment URL.');
  }
  return new URL(parsed.url).origin;
}

export function assertSelectedDeploymentMatches(
  convexUrl,
  env = process.env,
  runner = spawnSync
) {
  if (!convexUrl) throw new Error('NEXT_PUBLIC_CONVEX_URL is required');
  const result = runner('pnpm', ['exec', 'convex', 'function-spec', '--prod'], {
    env,
    encoding: 'utf8',
    timeout: FUNCTION_SPEC_TIMEOUT_MS,
  });
  if (result.error) {
    throw new Error(
      result.error.code === 'ETIMEDOUT'
        ? 'Convex production deployment identity read timed out.'
        : 'Convex production deployment identity read failed to start.'
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `Convex production deployment identity read failed with status ${result.status ?? 'unknown'}.`
    );
  }

  const selectedUrl = parseFunctionSpecDeploymentUrl(result.stdout ?? '');
  if (selectedUrl !== new URL(convexUrl).origin) {
    throw new Error(
      'NEXT_PUBLIC_CONVEX_URL does not match the production deployment selected by CONVEX_DEPLOY_KEY.'
    );
  }
  return selectedUrl;
}

function extractErrorMessage(error) {
  if (error && typeof error === 'object' && typeof error.data === 'string') {
    return error.data;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  const secret = process.env.GUEST_TOKEN_SECRET?.trim();
  if (process.argv.includes('--assert-prod-target')) {
    assertSelectedDeploymentMatches(convexUrl, process.env);
  }
  const client = convexUrl ? new ConvexHttpClient(convexUrl) : null;
  const ready = await probeSignedThrottleReady(
    convexUrl,
    secret,
    client ? client.mutation.bind(client) : async () => undefined
  );

  if (!ready) {
    console.error(`MISSING: ${FUNCTION_NAME}`);
    process.exitCode = 1;
    return;
  }

  console.log(`READY: ${FUNCTION_NAME}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
