import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getUser } from './lib/auth';

export const toggleFavorite = mutation({
  args: {
    poemId: v.id('poems'),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new Error('User not found');

    const existing = await ctx.db
      .query('favorites')
      .withIndex('by_user_poem', (q) =>
        q.eq('userId', user._id).eq('poemId', poemId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert('favorites', {
        userId: user._id,
        poemId,
        createdAt: Date.now(),
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
