import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getUser, checkParticipation } from './lib/auth';
import { getRoomByCode, getCompletedGame } from './lib/room';
import { retentionEligibleAt } from './lib/retentionPolicy';

export const toggleFavorite = mutation({
  args: {
    poemId: v.id('poems'),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new ConvexError('User not found');

    const [existing, poem] = await Promise.all([
      ctx.db
        .query('favorites')
        .withIndex('by_user_poem', (q) =>
          q.eq('userId', user._id).eq('poemId', poemId)
        )
        .first(),
      ctx.db.get(poemId),
    ]);

    if (existing) {
      await ctx.db.delete(existing._id);
      if (!poem) return;

      const [remainingFavorite, game] = await Promise.all([
        ctx.db
          .query('favorites')
          .withIndex('by_poem', (q) => q.eq('poemId', poemId))
          .first(),
        ctx.db.get(poem.gameId),
      ]);
      const remainsProtected =
        remainingFavorite !== null ||
        poem.publicShareEnabled === true ||
        game?.publicRecapEnabled === true;
      const now = Date.now();
      await ctx.db.patch(poemId, {
        retentionState: remainsProtected ? 'protected' : 'pending',
        retentionEligibleAt: remainsProtected
          ? undefined
          : retentionEligibleAt(now, 'protectionRemoved'),
      });
    } else {
      if (!poem) throw new ConvexError('Poem not found');
      await ctx.db.insert('favorites', {
        userId: user._id,
        poemId,
        createdAt: Date.now(),
      });
      await ctx.db.patch(poemId, {
        retentionState: 'protected',
        retentionEligibleAt: undefined,
      });
    }
  },
});

export const getMyFavorites = query({
  args: {
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return [];

    const favorites = await ctx.db
      .query('favorites')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    // Batch 1: fetch all poems in parallel
    const poemResults = await Promise.all(
      favorites.map((fav) => ctx.db.get(fav.poemId))
    );

    // Filter nulls, keep fav metadata aligned
    const validEntries = favorites
      .map((fav, i) => ({ fav, poem: poemResults[i] }))
      .filter(
        (
          entry
        ): entry is {
          fav: (typeof favorites)[0];
          poem: NonNullable<(typeof poemResults)[0]>;
        } => entry.poem !== null
      );

    // Batch 2: fetch first lines in parallel
    const firstLines = await Promise.all(
      validEntries.map(({ poem }) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) =>
            q.eq('poemId', poem._id).eq('indexInPoem', 0)
          )
          .first()
      )
    );

    return validEntries.map(({ fav, poem }, i) => ({
      ...poem,
      preview: firstLines[i]?.text || '...',
      favoritedAt: fav.createdAt,
    }));
  },
});

/**
 * Live favorite tallies for the poems of a room's most recent game, used to
 * crown the "room favorite" in the recap. Returns per-poem counts plus the
 * current leader (or null when no hearts have been given). Participant-gated;
 * never exposes counts to non-players.
 */
export const getSessionFavorites = query({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return null;

    const room = await getRoomByCode(ctx, roomCode);
    if (!room) return null;

    const isParticipant = await checkParticipation(ctx, room._id, user._id);
    if (!isParticipant) return null;

    const game = await getCompletedGame(ctx, room._id);
    if (!game) return null;

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', game._id))
      .collect();

    const favoriteRows = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('favorites')
          .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
          .collect()
      )
    );

    const counts = poems.map((poem, i) => ({
      poemId: poem._id,
      indexInRoom: poem.indexInRoom,
      count: favoriteRows[i].length,
    }));

    const totalHearts = counts.reduce((sum, c) => sum + c.count, 0);

    // Leader: highest count, ties broken by poem order for stability.
    const leader =
      totalHearts > 0
        ? counts.reduce((best, c) => (c.count > best.count ? c : best))
        : null;

    return {
      counts,
      totalHearts,
      leaderPoemId: leader ? leader.poemId : null,
      leaderCount: leader ? leader.count : 0,
    };
  },
});

export const isFavorited = query({
  args: {
    poemId: v.id('poems'),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return false;

    const existing = await ctx.db
      .query('favorites')
      .withIndex('by_user_poem', (q) =>
        q.eq('userId', user._id).eq('poemId', poemId)
      )
      .first();

    return !!existing;
  },
});
