import { v } from 'convex/values';
import { mutation, query, QueryCtx, MutationCtx } from './_generated/server';

// Helper to get user (duplicated from game.ts, maybe should be shared but simple enough)
async function getUser(ctx: QueryCtx | MutationCtx, guestId?: string) {
  const identity = await ctx.auth.getUserIdentity();
  const clerkUserId = identity?.subject;

  if (clerkUserId) {
    return await ctx.db
      .query('users')
      .withIndex('by_clerk', (q) => q.eq('clerkUserId', clerkUserId))
      .first();
  }

  if (guestId) {
    return await ctx.db
      .query('users')
      .withIndex('by_guest', (q) => q.eq('guestId', guestId))
      .first();
  }

  return null;
}

export const toggleFavorite = mutation({
  args: {
    poemId: v.id('poems'),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestId }) => {
    const user = await getUser(ctx, guestId);
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

export const getFavoritesForUser = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    const favorites = await ctx.db
      .query('favorites')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const poems = [];
    for (const fav of favorites) {
      const poem = await ctx.db.get(fav.poemId);
      if (poem) {
        const firstLine = await ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) =>
            q.eq('poemId', poem._id).eq('indexInPoem', 0)
          )
          .first();
        poems.push({
          ...poem,
          preview: firstLine?.text || '...',
          favoritedAt: fav.createdAt,
        });
      }
    }

    return poems;
  },
});

export const getMyFavorites = query({
  args: {
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { guestId }) => {
    const user = await getUser(ctx, guestId);
    if (!user) return [];

    const favorites = await ctx.db
      .query('favorites')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const poems = [];
    for (const fav of favorites) {
      const poem = await ctx.db.get(fav.poemId);
      if (poem) {
        const firstLine = await ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) =>
            q.eq('poemId', poem._id).eq('indexInPoem', 0)
          )
          .first();
        poems.push({
          ...poem,
          preview: firstLine?.text || '...',
          favoritedAt: fav.createdAt,
        });
      }
    }

    return poems;
  },
});

export const isFavorited = query({
  args: {
    poemId: v.id('poems'),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestId }) => {
    const user = await getUser(ctx, guestId);
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
