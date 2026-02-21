import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';

export const logShare = mutation({
  args: {
    poemId: v.id('poems'),
  },
  handler: async (ctx, { poemId }) => {
    const poem = await ctx.db.get(poemId);
    if (!poem) {
      throw new ConvexError('Poem not found');
    }

    await ctx.db.insert('shares', {
      poemId,
      createdAt: Date.now(),
    });
  },
});
