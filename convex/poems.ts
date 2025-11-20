import { v } from 'convex/values';
import { query } from './_generated/server';
import { getUser } from './lib/auth';

export const getPoemsForRoom = query({
  args: {
    roomCode: v.string(),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestId }) => {
    const user = await getUser(ctx, guestId);
    if (!user) return [];

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', roomCode.toUpperCase()))
      .first();
    if (!room) return [];

    // Check participation
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room_user', (q) =>
        q.eq('roomId', room._id).eq('userId', user._id)
      )
      .first();
    if (!player) return [];

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    // Enhance with first line preview?
    // For now just return poems, frontend can fetch details or we can enhance here.
    // Let's fetch the first line for preview.
    const results = [];
    for (const poem of poems) {
      const firstLine = await ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poem._id).eq('indexInPoem', 0)
        )
        .first();
      results.push({
        ...poem,
        preview: firstLine?.text || '...',
      });
    }
    return results;
  },
});

export const getPoemDetail = query({
  args: {
    poemId: v.id('poems'),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestId }) => {
    const user = await getUser(ctx, guestId);
    if (!user) return null;

    const poem = await ctx.db.get(poemId);
    if (!poem) return null;

    // Check participation
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room_user', (q) =>
        q.eq('roomId', poem.roomId).eq('userId', user._id)
      )
      .first();
    if (!player) return null;

    const lines = await ctx.db
      .query('lines')
      .withIndex('by_poem', (q) => q.eq('poemId', poemId))
      .collect();

    // Sort lines
    lines.sort((a, b) => a.indexInPoem - b.indexInPoem);

    // Get authors
    const linesWithAuthors = [];
    for (const line of lines) {
      const author = await ctx.db.get(line.authorUserId);
      linesWithAuthors.push({
        ...line,
        authorName: author?.displayName || 'Unknown',
      });
    }

    return {
      poem,
      lines: linesWithAuthors,
    };
  },
});

export const getMyPoems = query({
  args: {
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { guestId }) => {
    const user = await getUser(ctx, guestId);
    if (!user) return [];

    // Find all lines written by user
    const lines = await ctx.db
      .query('lines')
      .withIndex('by_author', (q) => q.eq('authorUserId', user._id))
      .collect();

    // Get unique poem IDs
    const poemIds = Array.from(new Set(lines.map((l) => l.poemId)));

    const poems = [];
    for (const id of poemIds) {
      const poem = await ctx.db.get(id);
      if (poem) {
        const room = await ctx.db.get(poem.roomId);
        // Get first line for preview
        const firstLine = await ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) =>
            q.eq('poemId', poem._id).eq('indexInPoem', 0)
          )
          .first();

        poems.push({
          ...poem,
          roomDate: room?.createdAt,
          preview: firstLine?.text || '...',
        });
      }
    }

    // Sort by date desc
    poems.sort((a, b) => b.createdAt - a.createdAt);
    return poems;
  },
});
