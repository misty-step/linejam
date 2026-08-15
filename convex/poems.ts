import { v } from 'convex/values';
import { query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { getUser, checkParticipation } from './lib/auth';
import { getRoomByCode, getCompletedGame } from './lib/room';
import {
  isPublicPoemShareEnabled,
  isPublicSessionRecapEnabled,
} from './lib/sharing';
import { buildPoemAuthorKeys } from './lib/poemAuthorKey';
import { hashRoomId } from '../lib/roomIdHash';
import { isRevealReady } from './lib/sessionLifecycle';

const DEFAULT_MY_POEMS_LIMIT = 24;
const MAX_MY_POEMS_LIMIT = 48;
const MAX_LINES_PER_POEM = 9;
const MY_POEMS_CANDIDATE_FACTOR = 4;

async function resolvesPublicShare(
  ctx: QueryCtx,
  poemId: Id<'poems'>,
  shareSlug: string | undefined
) {
  if (!shareSlug) return false;
  const [poem, share] = await Promise.all([
    ctx.db.get(poemId),
    ctx.db
      .query('shares')
      .withIndex('by_slug', (q) => q.eq('slug', shareSlug))
      .first(),
  ]);
  return (
    poem?.publicShareEnabled === true &&
    share?.poemId === poemId &&
    share?.state === 'active'
  );
}

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

async function getCompletePoemLines(
  ctx: QueryCtx,
  poem: Pick<Doc<'poems'>, '_id' | 'gameId'>
): Promise<Doc<'lines'>[] | null> {
  const game = await ctx.db.get(poem.gameId);
  if (!isRevealReady(game)) return null;
  return ctx.db
    .query('lines')
    .withIndex('by_poem_index', (q) => q.eq('poemId', poem._id))
    .order('asc')
    .collect();
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

    // Active and abandoned games keep every partial line private.
    const currentGame = await getCompletedGame(ctx, room._id);
    if (!currentGame) return [];

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', currentGame._id))
      .collect();

    const lineGroups = await Promise.all(
      poems.map((poem) => getCompletePoemLines(ctx, poem))
    );
    return poems.flatMap((poem, index) => {
      const lines = lineGroups[index];
      return lines ? [{ ...poem, preview: lines[0].text }] : [];
    });
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

    const lines = await getCompletePoemLines(ctx, poem);
    if (!lines) return null;

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
      };
    });

    return {
      poem: {
        _id: poem._id,
        indexInRoom: poem.indexInRoom,
        createdAt: poem.createdAt,
        publicShareEnabled: poem.publicShareEnabled === true,
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
    // Scan beyond the output limit so recent abandoned sessions cannot hide
    // older completed poems. The factor caps query cost under pathological use.
    const authorLineWindow =
      poemLimit * MAX_LINES_PER_POEM * MY_POEMS_CANDIDATE_FACTOR;

    // Find a bounded window of latest lines written by user.
    const lines = await ctx.db
      .query('lines')
      .withIndex('by_author_created', (q) => q.eq('authorUserId', user._id))
      .order('desc')
      .take(authorLineWindow);

    // Gather a bounded superset; completion is checked before the requested
    // output limit is applied.
    const poemIds: Id<'poems'>[] = [];
    const seenPoemIds = new Set<Id<'poems'>>();
    const candidateLimit = poemLimit * MY_POEMS_CANDIDATE_FACTOR;
    for (const line of lines) {
      if (seenPoemIds.has(line.poemId)) continue;
      seenPoemIds.add(line.poemId);
      poemIds.push(line.poemId);
      if (poemIds.length >= candidateLimit) break;
    }
    if (poemIds.length === 0) return [];

    const poemsRaw = await Promise.all(poemIds.map((id) => ctx.db.get(id)));
    const candidates = poemsRaw.filter(
      (poem): poem is NonNullable<typeof poem> => poem !== null
    );
    const lineGroups = await Promise.all(
      candidates.map((poem) => getCompletePoemLines(ctx, poem))
    );
    const completeEntries = candidates
      .map((poem, index) => ({ poem, lines: lineGroups[index] }))
      .filter(
        (
          entry
        ): entry is {
          poem: (typeof candidates)[number];
          lines: Doc<'lines'>[];
        } => entry.lines !== null
      );
    const uniqueRoomIds = [
      ...new Set(completeEntries.map(({ poem }) => poem.roomId)),
    ];
    const rooms = await Promise.all(
      uniqueRoomIds.map((roomId) => ctx.db.get(roomId))
    );
    const roomMap = new Map(
      uniqueRoomIds.map((roomId, index) => [roomId, rooms[index]])
    );

    return completeEntries
      .map(({ poem, lines: poemLines }) => ({
        ...poem,
        roomDate: roomMap.get(poem.roomId)?.createdAt,
        preview:
          poemLines.find((line) => line.indexInPoem === 0)?.text ?? '...',
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, poemLimit);
  },
});

export const getPublicPoemPreview = query({
  args: {
    poemId: v.id('poems'),
    shareSlug: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, shareSlug }) => {
    const poem = await ctx.db.get(poemId);
    if (!poem) return null;
    const shareResolved = await resolvesPublicShare(ctx, poemId, shareSlug);
    if (shareSlug ? !shareResolved : !isPublicPoemShareEnabled(poem))
      return null;

    const lines = await getCompletePoemLines(ctx, poem);
    if (!lines) return null;

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
    shareSlug: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, shareSlug }) => {
    const poem = await ctx.db.get(poemId);
    if (!poem) return null;
    const shareResolved = await resolvesPublicShare(ctx, poemId, shareSlug);
    if (shareSlug ? !shareResolved : !isPublicPoemShareEnabled(poem))
      return null;

    const lines = await getCompletePoemLines(ctx, poem);
    if (!lines) return null;

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
        };
      }),
    };
  },
});

export const getPublicPoemShareStatus = query({
  args: { shareSlug: v.string() },
  handler: async (ctx, { shareSlug }) => {
    const share = await ctx.db
      .query('shares')
      .withIndex('by_slug', (q) => q.eq('slug', shareSlug))
      .first();
    if (!share) return { state: 'missing' as const };
    if (share.state === 'active') {
      const poem = await ctx.db.get(share.poemId);
      const lines = poem ? await getCompletePoemLines(ctx, poem) : null;
      return poem?.publicShareEnabled === true && lines !== null
        ? { state: 'active' as const }
        : { state: 'expired' as const };
    }
    if (share.state === 'pending' && (share.expiresAt ?? 0) > Date.now()) {
      return { state: 'pending' as const, expiresAt: share.expiresAt };
    }
    return { state: 'expired' as const, expiresAt: share.expiresAt };
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
      poems.map((poem) => getCompletePoemLines(ctx, poem))
    );
    if (lineGroups.some((lines) => lines === null)) return null;

    const authorIds = [
      ...new Set(
        lineGroups
          .flatMap((lines) => lines ?? [])
          .map((line) => line.authorUserId)
          .filter((id): id is Id<'users'> => id !== undefined && id !== null)
      ),
    ];
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorById = new Map(authorIds.map((id, i) => [id, authors[i]]));

    return {
      roomCode: room.code,
      roomIdHash: hashRoomId(room._id),
      cycle: game.cycle,
      completedAt: game.completedAt,
      poemCount: poems.length,
      playerCount: players.length,
      poems: poems
        .map((poem, poemIndex) => {
          const lines = lineGroups[poemIndex]!;
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
              };
            }),
          };
        })
        .sort((a, b) => a.indexInRoom - b.indexInRoom),
    };
  },
});
