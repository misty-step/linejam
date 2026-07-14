#!/usr/bin/env node

import { createHmac } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const FUNCTION_NAME = 'guestSessions:checkSignedGuestSessionThrottle';
const READINESS_KEY = 'guestSession:deployment-readiness';
const THROTTLE_PROOF_CONTEXT = 'linejam:guest-session-throttle:v1:';
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
