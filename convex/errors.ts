/**
 * Internal actions for privacy-safe backend reporting.
 *
 * Mutation callers may schedule reports only on paths that return and commit.
 */

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { sendBackendSentryEvent } from './lib/sentry';

/**
 * A mutation must finish scheduling before it returns so both the report and
 * the product outcome commit in the same successful transaction.
 */
export async function returnAfterBackendReportScheduled<T>(
  scheduling: Promise<unknown>,
  outcome: T
): Promise<T> {
  await scheduling;
  return outcome;
}

const backendOperationValidator = v.union(
  v.literal('sweepAbandonedGames'),
  v.literal('finishAbandonedGame')
);

const backendFailureCodeValidator = v.literal('unexpected_error');

/**
 * Report an abandonment backend failure to Sentry using only a closed
 * classification and bounded numeric context.
 *
 * Mutation callers may schedule this action only on paths that return and
 * commit. A mutation that throws rolls back its scheduled work, so rollback-
 * thrown mutation failures remain unsupported by this source transport and
 * belong on the external Convex log-stream bridge.
 */
export const reportBackendFailure = internalAction({
  args: {
    operation: backendOperationValidator,
    failureCode: backendFailureCodeValidator,
    scheduled: v.optional(v.number()),
    scanned: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    await sendBackendSentryEvent(args);
  },
});
