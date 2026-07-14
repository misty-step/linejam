#!/usr/bin/env node

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const FUNCTION_NAME = 'guestSessions:checkSignedGuestSessionThrottle';
const signedThrottle = makeFunctionReference(FUNCTION_NAME);

/**
 * Prove the deployed public API contains the signed throttle without writing a
 * rate-limit row. A correctly deployed function rejects the deliberately
 * forged, correctly shaped proof before persistence; a stale deployment
 * reports a missing function instead.
 */
export async function probeSignedThrottleReady(convexUrl, mutate) {
  if (!convexUrl) throw new Error('NEXT_PUBLIC_CONVEX_URL is required');

  try {
    await mutate(signedThrottle, {
      key: 'guestSession:deployment-readiness',
      proof: 'A'.repeat(43),
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    if (/Invalid guest session throttle proof/i.test(message)) return true;
    if (/Could not find public function/i.test(message)) return false;
    throw error;
  }

  throw new Error('Signed throttle unexpectedly accepted a forged proof');
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
  const client = convexUrl ? new ConvexHttpClient(convexUrl) : null;
  const ready = await probeSignedThrottleReady(
    convexUrl,
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
