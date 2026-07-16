import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { getUser, checkParticipation } from './lib/auth';
import { getRoomByCode, getActiveGame, getCompletedGame } from './lib/room';
import {
  isPublicPoemShareEnabled,
  isPublicSessionRecapEnabled,
} from './lib/sharing';
import { buildPoemAuthorKeys } from './lib/poemAuthorKey';

const DEFAULT_MY_POEMS_LIMIT = 24;
const MAX_MY_POEMS_LIMIT = 48;
const MAX_LINES_PER_POEM = 9;

function boundedLimit(
  value: number | undefined,
  fallback: number,
  max: number
) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  if (rounded <= 0) return fallback;
  return Math.min(rounded, max);
}

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

    // Get the current game (active or most recently completed)
    // This keeps reveal and archive views scoped to the current cycle.
    const activeGame = await getActiveGame(ctx, room._id);
    const completedGame = await getCompletedGame(ctx, room._id);
    const currentGame = activeGame || completedGame;

    // No games yet - return empty
    if (!currentGame) {
      return [];
    }

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', currentGame._id))
      .collect();

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
    const authorMap = new Map(uniqueAuthorIds.map((id, i) => [id, authors[i]]));

    const authorKeys = buildPoemAuthorKeys(poemId, uniqueAuthorIds);
    const linesWithAuthors = lines.map((line) => {
      const author = authorMap.get(line.authorUserId);
      return {
        _id: line._id,
        poemId: line.poemId,
        indexInPoem: line.indexInPoem,
        text: line.text,
        wordCount: line.wordCount,
        createdAt: line.createdAt,
        // Prefer captured pen name, fall back to current user name for legacy data
        authorName: line.authorDisplayName || author?.displayName || 'Unknown',
        authorKey: authorKeys.get(line.authorUserId)!,
        isBot: author?.kind === 'AI',
      };
    });

    return {
      poem: {
        _id: poem._id,
        indexInRoom: poem.indexInRoom,
        createdAt: poem.createdAt,
      },
      lines: linesWithAuthors,
    };
  },
});

export const getMyPoems = query({
  args: {
    guestToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { guestToken, limit }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return [];

    const poemLimit = boundedLimit(
      limit,
      DEFAULT_MY_POEMS_LIMIT,
      MAX_MY_POEMS_LIMIT
    );
    const authorLineWindow = poemLimit * MAX_LINES_PER_POEM;

    // Find a bounded window of latest lines written by user.
    const lines = await ctx.db
      .query('lines')
      .withIndex('by_author_created', (q) => q.eq('authorUserId', user._id))
      .order('desc')
      .take(authorLineWindow);

    // Get unique poem IDs
    const poemIds: Id<'poems'>[] = [];
    const seenPoemIds = new Set<Id<'poems'>>();
    for (const line of lines) {
      if (seenPoemIds.has(line.poemId)) continue;
      seenPoemIds.add(line.poemId);
      poemIds.push(line.poemId);
      if (poemIds.length >= poemLimit) break;
    }
    if (poemIds.length === 0) return [];

    // Batch fetch all poems in parallel
    const poemsRaw = await Promise.all(poemIds.map((id) => ctx.db.get(id)));
    const poems = poemsRaw.filter(
      (p): p is NonNullable<typeof p> => p !== null
    );
    poems.sort((a, b) => b.createdAt - a.createdAt);

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
    if (!isPublicPoemShareEnabled(poem)) return null;

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
    if (!isPublicPoemShareEnabled(poem)) return null;

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
    const authorMap = new Map(uniqueAuthorIds.map((id, i) => [id, authors[i]]));

    const authorKeys = buildPoemAuthorKeys(poemId, uniqueAuthorIds);

    return {
      poem: {
        _id: poem._id,
        indexInRoom: poem.indexInRoom,
        createdAt: poem.createdAt,
      },
      lines: lines.map((line) => {
        const author = authorMap.get(line.authorUserId);
        return {
          _id: line._id,
          poemId: line.poemId,
          indexInPoem: line.indexInPoem,
          text: line.text,
          wordCount: line.wordCount,
          createdAt: line.createdAt,
          // Prefer captured pen name, fall back to current user name for legacy data
          authorName:
            line.authorDisplayName || author?.displayName || 'Unknown',
          authorKey: authorKeys.get(line.authorUserId)!,
          isBot: author?.kind === 'AI',
        };
      }),
    };
  },
});

export const getPublicSessionRecap = query({
  args: {
    roomCode: v.string(),
  },
  handler: async (ctx, { roomCode }) => {
    const room = await getRoomByCode(ctx, roomCode);
    if (!room) return null;

    const game = await getCompletedGame(ctx, room._id);
    if (!game) return null;
    if (!isPublicSessionRecapEnabled(game)) return null;

    const [poems, players] = await Promise.all([
      ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', game._id))
        .collect(),
      ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', room._id))
        .collect(),
    ]);

    if (
      poems.some(
        (poem) => poem.revealedAt === undefined || poem.revealedAt === null
      )
    ) {
      return null;
    }

    const lineGroups = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
          .collect()
      )
    );

    const authorIds = [
      ...new Set(
        lineGroups
          .flat()
          .map((line) => line.authorUserId)
          .filter((id): id is Id<'users'> => id !== undefined && id !== null)
      ),
    ];
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorById = new Map(authorIds.map((id, i) => [id, authors[i]]));

    return {
      roomCode: room.code,
      cycle: game.cycle,
      completedAt: game.completedAt,
      poemCount: poems.length,
      playerCount: players.length,
      poems: poems
        .map((poem, poemIndex) => {
          const lines = [...(lineGroups[poemIndex] ?? [])].sort(
            (a, b) => a.indexInPoem - b.indexInPoem
          );
          const reader = players.find(
            (player) => player.userId === poem.assignedReaderId
          );
          const firstLine = lines[0];
          const starter = firstLine
            ? authorById.get(firstLine.authorUserId)
            : null;
          const uniqueAuthorIds = new Set(
            lines
              .map((line) => line.authorUserId)
              .filter(
                (id): id is Id<'users'> => id !== undefined && id !== null
              )
          );

          return {
            _id: poem._id,
            indexInRoom: poem.indexInRoom,
            createdAt: poem.createdAt,
            preview: lines[0]?.text ?? '',
            readerName: reader?.displayName ?? 'Unknown',
            starterName:
              firstLine?.authorDisplayName || starter?.displayName || 'Unknown',
            poetCount: uniqueAuthorIds.size,
            lines: lines.map((line) => {
              const author = authorById.get(line.authorUserId);
              return {
                text: line.text,
                authorName:
                  line.authorDisplayName || author?.displayName || 'Unknown',
                isBot: author?.kind === 'AI',
              };
            }),
          };
        })
        .sort((a, b) => a.indexInRoom - b.indexInRoom),
    };
  },
});
