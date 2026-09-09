/** Bounded, atomic cleanup for matches whose frozen participants have left. */
import {
  sweepAbandonedMatches,
  type SweepResult,
} from '@parlor/convex/abandonment';
import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { abandonRoomMatch } from './lib/sessionLifecycle';
import { log } from './lib/errors';

export const sweepAbandonedGames = internalMutation({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { limit, cursor }): Promise<SweepResult> => {
    const result = await sweepAbandonedMatches(ctx, {
      limit,
      cursor,
      onAbandoned: (envelope) =>
        abandonRoomMatch(ctx, { envelope, closeRoom: true }),
    });
    // Continue even when this page abandoned nothing: later matches may be idle.
    if (result.hasMore && result.continueCursor !== null) {
      await ctx.scheduler.runAfter(
        0,
        internal.abandonment.sweepAbandonedGames,
        {
          limit,
          cursor: result.continueCursor,
        }
      );
    }
    if (result.abandoned > 0) {
      log.warn('Abandonment sweep closed unattended games', {
        abandoned: result.abandoned,
        scanned: result.scanned,
      });
    }
    // Propagate failures so envelope, poems, closure and scheduling roll back.
    return result;
  },
});
