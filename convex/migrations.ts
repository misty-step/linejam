import { mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * One-off maintenance helpers. Keep public for `npx convex run` convenience,
 * but guard with an env flag so production runs must opt-in explicitly.
 */

const migrationsEnabled =
  process.env.ALLOW_CONVEX_MIGRATIONS === 'true' ||
  process.env.NODE_ENV !== 'production';

export const backfillMissingGameCycles = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { dryRun = false }) => {
    if (!migrationsEnabled) {
      throw new Error('Migrations disabled; set ALLOW_CONVEX_MIGRATIONS=true');
    }

    // Type says `cycle` exists, but we need to tolerate historical bad rows.
    const games = (await ctx.db.query('games').collect()) as Array<
      { cycle?: number } & { _id: string; roomId: string }
    >;

    let patched = 0;

    for (const game of games) {
      if (game.cycle === undefined || game.cycle === null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const room = (await ctx.db.get(game.roomId as any)) as any;
        const cycle =
          typeof room?.currentCycle === 'number' ? room.currentCycle : 1;

        if (!dryRun) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await ctx.db.patch(game._id as any, { cycle });
        }
        patched += 1;
      }
    }

    return { patched, dryRun };
  },
});

/**
 * Backfill authorDisplayName on lines that don't have it.
 * This captures the author's display name at the time they wrote the line,
 * supporting "pen name per round" functionality.
 */
export const backfillAuthorDisplayNames = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { dryRun = false, batchSize = 100 }) => {
    if (!migrationsEnabled) {
      throw new Error('Migrations disabled; set ALLOW_CONVEX_MIGRATIONS=true');
    }

    // Get a batch of lines missing authorDisplayName (avoid loading all into memory)
    const linesToUpdate = await ctx.db
      .query('lines')
      .filter((q) => q.eq(q.field('authorDisplayName'), undefined))
      .take(batchSize);

    // Batch fetch unique authors for this batch
    const uniqueAuthorIds = [
      ...new Set(linesToUpdate.map((l) => l.authorUserId)),
    ];
    const authors = await Promise.all(
      uniqueAuthorIds.map((id) => ctx.db.get(id))
    );
    const authorMap = new Map(
      uniqueAuthorIds.map((id, i) => [id, authors[i]?.displayName || 'Unknown'])
    );

    let patched = 0;
    for (const line of linesToUpdate) {
      const displayName = authorMap.get(line.authorUserId) || 'Unknown';

      if (!dryRun) {
        await ctx.db.patch(line._id, { authorDisplayName: displayName });
      }
      patched += 1;
    }

    // Run repeatedly until patched returns 0
    return { patched, dryRun };
  },
});
