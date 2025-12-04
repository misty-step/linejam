import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const logShare = mutation({
  args: {
    poemId: v.id('poems'),
  },
  handler: async (ctx, { poemId }) => {
    const poem = await ctx.db.get(poemId);
    if (!poem) {
      // Silent fail if poem doesn't exist
      return;
    }

    await ctx.db.insert('shares', {
      poemId,
      createdAt: Date.now(),
    });
  },
});
