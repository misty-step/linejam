/**
 * Backend error reporting to Canary.
 *
 * Provides a single internalAction that sends errors to Canary. For mutations,
 * schedule it via ctx.scheduler.runAfter(0, ...). For actions, call via
 * ctx.runAction(...).
 */

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import {
  buildBackendCanaryPayload,
  isBackendCanaryEnabled,
  sendBackendCanaryCheckIn,
  sendBackendCanaryPayload,
} from './lib/canary';

/**
 * Report a backend error to Canary. The action is fire-and-forget — callers
 * schedule it and move on so error reporting never blocks recovery.
 */
export const reportBackendErrorToCanary = internalAction({
  args: {
    errorName: v.string(),
    errorMessage: v.string(),
    errorStack: v.optional(v.string()),
    operation: v.optional(v.string()),
    roomId: v.optional(v.string()),
    gameId: v.optional(v.string()),
    poemId: v.optional(v.string()),
    round: v.optional(v.number()),
  },
  handler: async (
    _ctx,
    {
      errorName: _errorName,
      errorMessage,
      errorStack: _errorStack,
      operation,
      roomId,
      gameId,
      poemId,
      round,
    }
  ) => {
    void _errorName;
    void _errorStack;
    if (!isBackendCanaryEnabled()) return;

    const context: Record<string, unknown> = {};
    if (operation) context.operation = operation;
    if (roomId) context.roomId = roomId;
    if (gameId) context.gameId = gameId;
    if (poemId) context.poemId = poemId;
    if (round !== undefined) context.round = round;

    await sendBackendCanaryPayload(
      buildBackendCanaryPayload(new Error(errorMessage), context)
    );
  },
});

const fallbackReasonValidator = v.union(
  v.literal('budget_exhaustion'),
  v.literal('provider_error'),
  v.literal('invalid_output'),
  v.literal('missing_configuration')
);

/** Report one aggregate, privacy-safe fallback-rate monitor update. */
export const reportAiFallbackRateToCanary = internalAction({
  args: {
    status: v.union(v.literal('alive'), v.literal('ok'), v.literal('error')),
    summary: v.string(),
    totalGenerations: v.number(),
    fallbackGenerations: v.number(),
    fallbackRatePercent: v.number(),
    fallbackReason: v.optional(fallbackReasonValidator),
    thresholdPercent: v.number(),
  },
  handler: async (_ctx, args) => {
    if (!isBackendCanaryEnabled()) return;

    await sendBackendCanaryCheckIn({
      status: args.status,
      summary: args.summary,
      context: {
        totalGenerations: args.totalGenerations,
        fallbackGenerations: args.fallbackGenerations,
        fallbackRatePercent: args.fallbackRatePercent,
        ...(args.fallbackReason ? { fallbackReason: args.fallbackReason } : {}),
        thresholdPercent: args.thresholdPercent,
      },
    });
  },
});
