/** Bounded, atomic cleanup for matches whose frozen participants have left. */
import {
  sweepAbandonedMatches,
  type SweepResult,
} from '@parlor/convex/abandonment';
import { ConvexError, v } from 'convex/values';
import { internalAction, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { abandonRoomMatch } from './lib/sessionLifecycle';
import { log } from './lib/errors';
import { sendAbandonmentCheckIn } from './lib/sentry';

/** One action owns completion across every atomic, bounded mutation page. */
export const runAbandonmentSweep = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<SweepResult> => {
    const checkInId = crypto.randomUUID().replaceAll('-', '');
    const startedAt = Date.now();
    await sendAbandonmentCheckIn(checkInId, 'in_progress', 0);
    let scanned = 0;
    let abandoned = 0;
    let cursor: string | undefined;
    try {
      for (;;) {
        const page: SweepResult = await ctx.runMutation(
          internal.abandonment.sweepAbandonedGames,
          { limit, cursor }
        );
        scanned += page.scanned;
        abandoned += page.abandoned;
        if (!page.hasMore) break;
        if (page.continueCursor === null) {
          throw new ConvexError('Abandonment continuation is missing');
        }
        cursor = page.continueCursor;
      }
    } catch (error) {
      await sendAbandonmentCheckIn(
        checkInId,
        'error',
        (Date.now() - startedAt) / 1_000
      );
      throw error;
    }
    await sendAbandonmentCheckIn(
      checkInId,
      'ok',
      (Date.now() - startedAt) / 1_000
    );
    return { scanned, abandoned, hasMore: false, continueCursor: null };
  },
});

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

    if (result.abandoned > 0) {
      log.warn('Abandonment sweep closed unattended games', {
        abandoned: result.abandoned,
        scanned: result.scanned,
      });
    }
    // Propagate failures so envelope, poems and closure roll back together.
    return result;
  },
});
