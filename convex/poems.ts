import { v } from 'convex/values';
import { query } from './_generated/server';
import { getUser, checkParticipation } from './lib/auth';
import { getRoomByCode } from './lib/room';

export const getPoemsForRoom = query({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return [];

    const room = await getRoomByCode(ctx, roomCode);
    if (!room) return [];

    if (!(await checkParticipation(ctx, room._id, user._id))) return [];

    // If the room has a current game, only return poems from that game
    // This ensures RevealList shows only the current cycle's poems
    let poems;
    if (room.currentGameId) {
      poems = await ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', room.currentGameId!))
        .collect();
    } else {
      // Fallback (e.g. if in lobby between games? or historic behavior)
      poems = await ctx.db
        .query('poems')
        .withIndex('by_room', (q) => q.eq('roomId', room._id))
        .collect();
    }

    // Parallelize first line fetches
    const firstLines = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) =>
            q.eq('poemId', poem._id).eq('indexInPoem', 0)
          )
          .first()
      )
    );

    return poems.map((poem, i) => ({
      ...poem,
      preview: firstLines[i]?.text || '...',
    }));
  },
});

export const getPoemDetail = query({
  args: {
    poemId: v.id('poems'),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return null;

    const poem = await ctx.db.get(poemId);
    if (!poem) return null;

    if (!(await checkParticipation(ctx, poem.roomId, user._id))) return null;

    const lines = await ctx.db
      .query('lines')
      .withIndex('by_poem', (q) => q.eq('poemId', poemId))
      .collect();

    // Sort lines
    lines.sort((a, b) => a.indexInPoem - b.indexInPoem);

    // Batch fetch all unique authors in parallel
    const uniqueAuthorIds = [...new Set(lines.map((l) => l.authorUserId))];
    const authors = await Promise.all(
      uniqueAuthorIds.map((id) => ctx.db.get(id))
    );
    const authorMap = new Map(
      uniqueAuthorIds.map((id, i) => [id, authors[i]?.displayName || 'Unknown'])
    );

    const linesWithAuthors = lines.map((line) => ({
      ...line,
      // Prefer captured pen name, fall back to current user name for legacy data
      authorName:
        line.authorDisplayName || authorMap.get(line.authorUserId) || 'Unknown',
    }));

    return {
      poem,
      lines: linesWithAuthors,
    };
  },
});

export const getMyPoems = query({
  args: {
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return [];

    // Find all lines written by user
    const lines = await ctx.db
      .query('lines')
      .withIndex('by_author', (q) => q.eq('authorUserId', user._id))
      .collect();

    // Get unique poem IDs
    const poemIds = [...new Set(lines.map((l) => l.poemId))];
    if (poemIds.length === 0) return [];

    // Batch fetch all poems in parallel
    const poemsRaw = await Promise.all(poemIds.map((id) => ctx.db.get(id)));
    const poems = poemsRaw.filter(
      (p): p is NonNullable<typeof p> => p !== null
    );

    // Batch fetch all rooms and first lines in parallel
    const uniqueRoomIds = [...new Set(poems.map((p) => p.roomId))];
    const [rooms, firstLines] = await Promise.all([
      Promise.all(uniqueRoomIds.map((id) => ctx.db.get(id))),
      Promise.all(
        poems.map((poem) =>
          ctx.db
            .query('lines')
            .withIndex('by_poem_index', (q) =>
              q.eq('poemId', poem._id).eq('indexInPoem', 0)
            )
            .first()
        )
      ),
    ]);

    // Create lookup maps
    const roomMap = new Map(uniqueRoomIds.map((id, i) => [id, rooms[i]]));
    const firstLineMap = new Map(
      poems.map((p, i) => [p._id, firstLines[i]?.text || '...'])
    );

    const result = poems.map((poem) => ({
      ...poem,
      roomDate: roomMap.get(poem.roomId)?.createdAt,
      preview: firstLineMap.get(poem._id) || '...',
    }));

    // Sort by date desc
    result.sort((a, b) => b.createdAt - a.createdAt);
    return result;
  },
});

export const getPublicPoemPreview = query({
  args: {
    poemId: v.id('poems'),
  },
  handler: async (ctx, { poemId }) => {
    const poem = await ctx.db.get(poemId);
    if (!poem) return null;

    const lines = await ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) => q.eq('poemId', poemId))
      .order('asc')
      .collect();

    // Count unique poets
    const uniqueAuthorIds = new Set(lines.map((l) => l.authorUserId));

    return {
      lines: lines.slice(0, 3).map((l) => l.text),
      poetCount: uniqueAuthorIds.size,
      poemNumber: poem.indexInRoom + 1,
    };
  },
});

export const getPublicPoemFull = query({
  args: {
    poemId: v.id('poems'),
  },
  handler: async (ctx, { poemId }) => {
    const poem = await ctx.db.get(poemId);
    if (!poem) return null;

    const lines = await ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) => q.eq('poemId', poemId))
      .order('asc')
      .collect();

    // Batch fetch all unique authors in parallel
    const uniqueAuthorIds = [...new Set(lines.map((l) => l.authorUserId))];
    const authors = await Promise.all(
      uniqueAuthorIds.map((id) => ctx.db.get(id))
    );
    const authorMap = new Map(
      uniqueAuthorIds.map((id, i) => [id, authors[i]?.displayName || 'Unknown'])
    );

    return {
      poem,
      lines: lines.map((line) => ({
        ...line,
        // Prefer captured pen name, fall back to current user name for legacy data
        authorName:
          line.authorDisplayName ||
          authorMap.get(line.authorUserId) ||
          'Unknown',
      })),
    };
  },
});
