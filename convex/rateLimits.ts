import { v } from 'convex/values';
import { internalMutation } from './_generated/server';

const DEFAULT_CLEANUP_LIMIT = 500;
const MAX_CLEANUP_LIMIT = 1000;

export const cleanupExpiredRateLimits = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { now = Date.now(), limit }) => {
    const cleanupLimit = normalizeCleanupLimit(limit);
    const expiredRows = await ctx.db
      .query('rateLimits')
      .withIndex('by_reset_time', (q) => q.lte('resetTime', now))
      .take(cleanupLimit);

    await Promise.all(expiredRows.map((row) => ctx.db.delete(row._id)));

    return {
      deleted: expiredRows.length,
      hasMore: expiredRows.length === cleanupLimit,
    };
  },
});

function normalizeCleanupLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_CLEANUP_LIMIT;
  }

  return Math.max(1, Math.min(Math.floor(limit), MAX_CLEANUP_LIMIT));
}
