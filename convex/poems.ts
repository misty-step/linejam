import { v } from 'convex/values';
import { query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { getUser, checkGameParticipation } from './lib/auth';
import { getRoomByCode, getCompletedGame, getGamePlayers } from './lib/room';
import {
  isPublicPoemShareEnabled,
  isPublicSessionRecapEnabled,
} from './lib/sharing';
import { buildPoemAuthorKeys } from './lib/poemAuthorKey';
import { hashRoomId } from '../lib/roomIdHash';
import { isRevealReady } from './lib/sessionLifecycle';
import { getDefaultAvatarId } from '../lib/avatars';

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

async function getCompletePoemLines(
  ctx: QueryCtx,
  poem: Pick<Doc<'poems'>, '_id'>,
  game: Doc<'games'> | null
): Promise<Doc<'lines'>[] | null> {
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

    // Active and abandoned games keep every partial line private.
    const currentGame = await getCompletedGame(ctx, room._id);
    if (!currentGame) return [];
    if (!(await checkGameParticipation(ctx, currentGame, user._id))) return [];

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', currentGame._id))
      .collect();

    const firstLines = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) => q.eq('poemId', poem._id))
          .order('asc')
          .first()
      )
    );
    return poems.map((poem, index) => ({
      ...poem,
      preview: firstLines[index]?.text ?? '...',
    }));
  },
});

export const getPoemDetail = query({
  args: {
    poemId: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { poemId: inputId, guestToken }) => {
    const poemId = ctx.db.normalizeId('poems', inputId);
    if (!poemId) return null;
    const user = await getUser(ctx, guestToken);
    if (!user) return null;

    const poem = await ctx.db.get(poemId);
    if (!poem) return null;

    const game = await ctx.db.get(poem.gameId);
    if (!(await checkGameParticipation(ctx, game, user._id))) return null;

    const lines = await getCompletePoemLines(ctx, poem, game);
    if (!lines) return null;

    const uniqueAuthorIds = [...new Set(lines.map((l) => l.authorUserId))];
    const legacyAuthorIds = [
      ...new Set(
        lines
          .filter((line) => !line.authorDisplayName)
          .map((line) => line.authorUserId)
      ),
    ];
    const authors = await Promise.all(
      legacyAuthorIds.map((id) => ctx.db.get(id))
    );
    const authorMap = new Map(legacyAuthorIds.map((id, i) => [id, authors[i]]));

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

export const getPublicPoemPreview = query({
  args: {
    poemId: v.string(),
    shareSlug: v.optional(v.string()),
  },
  handler: async (ctx, { poemId: inputId, shareSlug }) => {
    const poemId = ctx.db.normalizeId('poems', inputId);
    if (!poemId) return null;
    const poem = await ctx.db.get(poemId);
    if (!poem) return null;
    const shareResolved = await resolvesPublicShare(ctx, poemId, shareSlug);
    if (shareSlug ? !shareResolved : !isPublicPoemShareEnabled(poem))
      return null;

    const game = await ctx.db.get(poem.gameId);
    const lines = await getCompletePoemLines(ctx, poem, game);
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
    poemId: v.string(),
    shareSlug: v.optional(v.string()),
  },
  handler: async (ctx, { poemId: inputId, shareSlug }) => {
    const poemId = ctx.db.normalizeId('poems', inputId);
    if (!poemId) return null;
    const poem = await ctx.db.get(poemId);
    if (!poem) return null;
    const shareResolved = await resolvesPublicShare(ctx, poemId, shareSlug);
    if (shareSlug ? !shareResolved : !isPublicPoemShareEnabled(poem))
      return null;

    const game = await ctx.db.get(poem.gameId);
    const lines = await getCompletePoemLines(ctx, poem, game);
    if (!lines) return null;

    const uniqueAuthorIds = [...new Set(lines.map((l) => l.authorUserId))];
    const legacyAuthorIds = [
      ...new Set(
        lines
          .filter((line) => !line.authorDisplayName)
          .map((line) => line.authorUserId)
      ),
    ];
    const authors = await Promise.all(
      legacyAuthorIds.map((id) => ctx.db.get(id))
    );
    const authorMap = new Map(legacyAuthorIds.map((id, i) => [id, authors[i]]));

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
      const game = poem ? await ctx.db.get(poem.gameId) : null;
      const lines = poem ? await getCompletePoemLines(ctx, poem, game) : null;
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
      getGamePlayers(ctx, game),
    ]);

    if (
      poems.some(
        (poem) => poem.revealedAt === undefined || poem.revealedAt === null
      )
    ) {
      return null;
    }

    const lineGroups = await Promise.all(
      poems.map((poem) => getCompletePoemLines(ctx, poem, game))
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
          const readerUser = poem.assignedReaderId
            ? authorById.get(poem.assignedReaderId)
            : undefined;
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
            readerAvatarId:
              reader?.avatarId ??
              getDefaultAvatarId(
                readerUser?.clerkUserId ||
                  readerUser?.guestId ||
                  poem.assignedReaderId ||
                  ''
              ),
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
