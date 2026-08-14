/**
 * Internal actions for privacy-safe backend reporting.
 *
 * Mutation callers may schedule reports only on paths that return and commit.
 * Action callers may report synchronously while preserving the original error.
 */

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import {
  sendAiFallbackSentryCheckIn,
  sendAiFallbackSentryFailureEvent,
  sendBackendSentryEvent,
} from './lib/sentry';

/**
 * Wait for best-effort action reporting, then preserve the exact product
 * failure regardless of the reporting outcome.
 */
export async function rethrowAfterBackendReport(
  reporting: Promise<unknown>,
  originalFailure: unknown
): Promise<never> {
  await reporting.catch(() => undefined);
  throw originalFailure;
}

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
  v.literal('finishAbandonedGame'),
  v.literal('aiGenerationBudgetThreshold'),
  v.literal('generateLineForRound'),
  v.literal('generateGhostLine')
);

const backendFailureCodeValidator = v.union(
  v.literal('unexpected_error'),
  v.literal('budget_threshold_reached')
);

/**
 * Report a backend failure to each comparison sink independently using only a
 * closed classification and bounded numeric context.
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
    filled: v.optional(v.number()),
    observed: v.optional(v.number()),
    threshold: v.optional(v.number()),
    round: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    await sendBackendSentryEvent(args);
  },
});

const fallbackFailureCodeValidator = v.union(
  v.literal('budget_exhaustion'),
  v.literal('provider_error'),
  v.literal('invalid_output'),
  v.literal('missing_configuration')
);

/** Report one aggregate fallback-rate update to each comparison sink. */
export const reportAiFallbackRate = internalAction({
  args: {
    operation: v.literal('aiFallbackRate'),
    status: v.union(v.literal('alive'), v.literal('ok'), v.literal('error')),
    failureCode: v.optional(fallbackFailureCodeValidator),
    totalGenerations: v.number(),
    fallbackGenerations: v.number(),
    fallbackRatePercent: v.number(),
    thresholdPercent: v.number(),
  },
  handler: async (_ctx, args) => {
    await Promise.allSettled([
      sendAiFallbackSentryCheckIn(args),
      sendAiFallbackSentryFailureEvent(args),
    ]);
  },
});
