/**
 * Archive Query Module
 *
 * Deep module (Ousterhout): Complex data fetching with simple interface.
 * Returns enriched poem data for the archive page in a single query,
 * eliminating N+1 problems and providing all visualization data upfront.
 */

import { v } from 'convex/values';
import { query } from './_generated/server';
import { getUser } from './lib/auth';
import { Id } from './_generated/dataModel';
import { buildPoemAuthorKeys } from './lib/poemAuthorKey';

/**
 * Enriched poem data for archive display.
 * Contains everything needed for rich visualization without additional queries.
 */
export interface ArchivePoem {
  _id: Id<'poems'>;
  preview: string;
  lines: Array<{
    text: string;
    wordCount: number;
    authorKey: string;
    authorName: string;
  }>;
  poetCount: number;
  lineCount: number;
  isFavorited: boolean;
  publicShareEnabled: boolean;
  favoritedAt: number | null;
  createdAt: number;
  roomDate: number;
  coAuthors: string[];
}

/**
 * Archive statistics for header display.
 */
export interface ArchiveStats {
  totalPoems: number;
  totalFavorites: number;
  uniqueCollaborators: number;
  totalLinesWritten: number;
}

const DEFAULT_ARCHIVE_LIMIT = 24;
const MAX_ARCHIVE_LIMIT = 48;
const DEFAULT_RECENT_PUBLIC_LIMIT = 5;
const MAX_RECENT_PUBLIC_LIMIT = 10;
const MAX_LINES_PER_POEM = 9;
const ARCHIVE_CANDIDATE_FACTOR = 4;
const PUBLIC_POEMS_PER_ROOM = 2;
const RECENT_PUBLIC_CANDIDATE_FACTOR = 4;
const MAX_RECENT_PUBLIC_CANDIDATE_WINDOW = 40;

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

/**
 * Get all poems for the user's archive with enriched metadata.
 *
 * This is the primary query for the archive page. It returns:
 * - All poems the user participated in
 * - Full line data for shape visualization
 * - Author information for color dots
 * - Favorite status integrated (no separate query needed)
 * - Co-author names for social context
 *
 * Optimized with parallel fetching to minimize latency.
 */
export const getArchiveData = query({
  args: {
    guestToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { guestToken, limit }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) {
      return { poems: [] as ArchivePoem[], stats: null };
    }

    const poemLimit = boundedLimit(
      limit,
      DEFAULT_ARCHIVE_LIMIT,
      MAX_ARCHIVE_LIMIT
    );
    // Scan beyond the output limit so recent abandoned sessions cannot hide
    // older completed poems. The factor caps query cost under pathological use.
    const authorLineWindow =
      poemLimit * MAX_LINES_PER_POEM * ARCHIVE_CANDIDATE_FACTOR;

    // Step 1: Find a bounded window of latest lines written by user.
    const userLines = await ctx.db
      .query('lines')
      .withIndex('by_author_created', (q) => q.eq('authorUserId', user._id))
      .order('desc')
      .take(authorLineWindow);

    // No poems yet
    if (userLines.length === 0) {
      return {
        poems: [] as ArchivePoem[],
        stats: {
          totalPoems: 0,
          totalFavorites: 0,
          uniqueCollaborators: 0,
          totalLinesWritten: 0,
        },
      };
    }

    // Step 2: Gather a bounded superset; eligibility is checked before the
    // requested output limit is applied.
    const poemIds: Id<'poems'>[] = [];
    const seenPoemIds = new Set<Id<'poems'>>();
    const candidateLimit = poemLimit * ARCHIVE_CANDIDATE_FACTOR;
    for (const line of userLines) {
      if (seenPoemIds.has(line.poemId)) continue;
      seenPoemIds.add(line.poemId);
      poemIds.push(line.poemId);
      if (poemIds.length >= candidateLimit) break;
    }

    const [poemsRaw, favoriteRows] = await Promise.all([
      Promise.all(poemIds.map((id) => ctx.db.get(id))),
      Promise.all(
        poemIds.map((poemId) =>
          ctx.db
            .query('favorites')
            .withIndex('by_user_poem', (q) =>
              q.eq('userId', user._id).eq('poemId', poemId)
            )
            .first()
        )
      ),
    ]);
    const poemGames = await Promise.all(
      poemsRaw.map((poem) => (poem ? ctx.db.get(poem.gameId) : null))
    );

    // Partial and abandoned games never enter the archive or consume its limit.
    const candidatePoems = poemsRaw
      .filter(
        (poem, index): poem is NonNullable<typeof poem> =>
          poem !== null && poemGames[index]?.status === 'COMPLETED'
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, poemLimit);
    const favoriteMap = new Map(
      favoriteRows
        .filter((f): f is NonNullable<typeof f> => f !== null)
        .map((f) => [f.poemId, f.createdAt])
    );

    const allPoemLines = await Promise.all(
      candidatePoems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) => q.eq('poemId', poem._id))
          .order('asc')
          .take(MAX_LINES_PER_POEM)
      )
    );
    const poems = candidatePoems;

    // Step 4: Collect author IDs and captured bylines. A deleted legacy author
    // must remain honestly named after its user row is removed.
    const allAuthorIds = new Set<Id<'users'>>();
    const capturedAuthorNames = new Map<Id<'users'>, string>();
    for (const lines of allPoemLines) {
      for (const line of lines) {
        allAuthorIds.add(line.authorUserId);
        const capturedName = line.authorDisplayName?.trim();
        if (capturedName && !capturedAuthorNames.has(line.authorUserId)) {
          capturedAuthorNames.set(line.authorUserId, capturedName);
        }
      }
    }

    // Step 5: Batch fetch all authors
    const authorIds = [...allAuthorIds];
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorMap = new Map(
      authorIds.map((id, i) => [
        id,
        {
          name:
            authors[i]?.displayName || capturedAuthorNames.get(id) || 'Unknown',
        },
      ])
    );

    // Step 6: Fetch room dates in parallel
    const uniqueRoomIds = [...new Set(poems.map((p) => p.roomId))];
    const rooms = await Promise.all(uniqueRoomIds.map((id) => ctx.db.get(id)));
    const roomMap = new Map(
      uniqueRoomIds.map((id, i) => [id, rooms[i]?.createdAt || 0])
    );

    // Step 7: Build enriched poem objects
    const enrichedPoems: ArchivePoem[] = poems.map((poem, poemIndex) => {
      const lines = allPoemLines[poemIndex];
      const uniqueAuthors = new Set(lines.map((l) => l.authorUserId));
      const favoritedAt = favoriteMap.get(poem._id) || null;
      const authorKeys = buildPoemAuthorKeys(poem._id, [...uniqueAuthors]);

      // Get co-author names (excluding current user)
      const coAuthors = [...uniqueAuthors]
        .filter((id) => id !== user._id)
        .map((id) => authorMap.get(id)?.name || 'Unknown')
        .slice(0, 3); // Limit to 3 for display

      return {
        _id: poem._id,
        preview: lines[0]?.text || '...',
        lines: lines.map((line) => {
          const author = authorMap.get(line.authorUserId);
          return {
            text: line.text,
            wordCount: line.wordCount,
            authorKey: authorKeys.get(line.authorUserId)!,
            authorName: line.authorDisplayName || author?.name || 'Unknown',
          };
        }),
        poetCount: uniqueAuthors.size,
        lineCount: lines.length,
        isFavorited: favoritedAt !== null,
        publicShareEnabled: poem.publicShareEnabled === true,
        favoritedAt,
        createdAt: poem.createdAt,
        roomDate: roomMap.get(poem.roomId) || poem.createdAt,
        coAuthors,
      };
    });

    // Step 8: Calculate stats
    const allCollaboratorIds = new Set<Id<'users'>>();
    for (const lines of allPoemLines) {
      for (const line of lines) {
        if (line.authorUserId !== user._id) {
          allCollaboratorIds.add(line.authorUserId);
        }
      }
    }

    const returnedPoemIds = new Set(enrichedPoems.map((poem) => poem._id));
    const returnedUserLineCount = userLines.filter((line) =>
      returnedPoemIds.has(line.poemId)
    ).length;

    const stats: ArchiveStats = {
      totalPoems: enrichedPoems.length,
      totalFavorites: enrichedPoems.filter((p) => p.isFavorited).length,
      uniqueCollaborators: allCollaboratorIds.size,
      totalLinesWritten: returnedUserLineCount,
    };

    return { poems: enrichedPoems, stats };
  },
});

/**
 * Get recent public poems for showcase (auth pages, landing page).
 * No authentication required - returns anonymized preview data.
 */
export const getRecentPublicPoems = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 5 }) => {
    const poemLimit = boundedLimit(
      limit,
      DEFAULT_RECENT_PUBLIC_LIMIT,
      MAX_RECENT_PUBLIC_LIMIT
    );
    const candidateWindow = Math.min(
      MAX_RECENT_PUBLIC_CANDIDATE_WINDOW,
      Math.max(poemLimit * RECENT_PUBLIC_CANDIDATE_FACTOR, poemLimit)
    );

    // Drive the bounded window from explicitly public poems, not recent rooms:
    // a run of private sessions must not hide older shared work.
    const publicCandidates = await ctx.db
      .query('poems')
      .withIndex('by_public_created', (q) => q.eq('publicShareEnabled', true))
      .order('desc')
      .take(candidateWindow);

    if (publicCandidates.length === 0) {
      return [];
    }

    const roomIds = [...new Set(publicCandidates.map((poem) => poem.roomId))];
    const gameIds = [...new Set(publicCandidates.map((poem) => poem.gameId))];
    const [rooms, games] = await Promise.all([
      Promise.all(roomIds.map((roomId) => ctx.db.get(roomId))),
      Promise.all(gameIds.map((gameId) => ctx.db.get(gameId))),
    ]);
    const completedRoomIds = new Set(
      rooms
        .filter((room) => room?.status === 'COMPLETED')
        .map((room) => room!._id)
    );
    const completedGameIds = new Set(
      games
        .filter((game) => game?.status === 'COMPLETED')
        .map((game) => game!._id)
    );

    const poems: typeof publicCandidates = [];
    const poemsPerRoom = new Map<Id<'rooms'>, number>();
    for (const poem of publicCandidates) {
      if (
        !completedRoomIds.has(poem.roomId) ||
        !completedGameIds.has(poem.gameId)
      ) {
        continue;
      }
      const roomCount = poemsPerRoom.get(poem.roomId) ?? 0;
      if (roomCount >= PUBLIC_POEMS_PER_ROOM) continue;
      poems.push(poem);
      poemsPerRoom.set(poem.roomId, roomCount + 1);
    }

    if (poems.length === 0) {
      return [];
    }

    const linesByPoem = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) => q.eq('poemId', poem._id))
          .order('asc')
          .take(MAX_LINES_PER_POEM)
      )
    );

    const completePoems = poems
      .map((poem, index) => ({ poem, lines: linesByPoem[index] }))
      .filter(({ lines }) => lines.length >= 3)
      .map(({ poem, lines }) => ({
        _id: poem._id,
        lines: lines.slice(0, 5).map((line) => line.text),
        poetCount: new Set(lines.map((line) => line.authorUserId)).size,
        createdAt: poem.createdAt,
      }));

    return completePoems.slice(0, poemLimit);
  },
});
