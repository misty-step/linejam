import { internalMutationGeneric, makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import { sweepAbandonedMatches, type SweepResult } from "./abandonment.js";

type SweepArgs = { limit?: number; cursor?: string };

// This path belongs only to this reference application. Games register their
// own mutation and pass that generated internal reference to their scheduler.
export const sweepAbandonedRef = makeFunctionReference<"mutation", SweepArgs, SweepResult>(
  "maintenance:sweepAbandoned",
);

export const sweepAbandoned = internalMutationGeneric({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    scanned: v.number(),
    abandoned: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args): Promise<SweepResult> => {
    const result = await sweepAbandonedMatches(ctx, args);
    if (result.hasMore && result.continueCursor !== null) {
      await ctx.scheduler.runAfter(0, sweepAbandonedRef, {
        ...(args.limit === undefined ? {} : { limit: args.limit }),
        cursor: result.continueCursor,
      });
    }
    return result;
  },
});
