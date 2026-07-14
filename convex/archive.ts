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
    authorStableId: string;
    authorName: string;
    isBot: boolean;
  }>;
  poetCount: number;
  lineCount: number;
  isFavorited: boolean;
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
const PUBLIC_POEMS_PER_ROOM = 2;
const RECENT_PUBLIC_ROOM_WINDOW_FACTOR = 4;
const MAX_RECENT_PUBLIC_ROOM_WINDOW = 40;

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
    const authorLineWindow = poemLimit * MAX_LINES_PER_POEM;

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

    // Step 2: Get unique poem IDs from the bounded line window.
    const poemIds: Id<'poems'>[] = [];
    const seenPoemIds = new Set<Id<'poems'>>();
    for (const line of userLines) {
      if (seenPoemIds.has(line.poemId)) continue;
      seenPoemIds.add(line.poemId);
      poemIds.push(line.poemId);
      if (poemIds.length >= poemLimit) break;
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

    // Filter out null poems and create lookup
    const poems = poemsRaw.filter(
      (p): p is NonNullable<typeof p> => p !== null
    );
    poems.sort((a, b) => b.createdAt - a.createdAt);
    const favoriteMap = new Map(
      favoriteRows
        .filter((f): f is NonNullable<typeof f> => f !== null)
        .map((f) => [f.poemId, f.createdAt])
    );

    // Step 3: Fetch bounded poem lines in parallel. Classic poems have 9 lines.
    const allPoemLines = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) => q.eq('poemId', poem._id))
          .order('asc')
          .take(MAX_LINES_PER_POEM)
      )
    );

    // Step 4: Collect all unique author IDs across all poems
    const allAuthorIds = new Set<Id<'users'>>();
    for (const lines of allPoemLines) {
      for (const line of lines) {
        allAuthorIds.add(line.authorUserId);
      }
    }

    // Step 5: Batch fetch all authors
    const authorIds = [...allAuthorIds];
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorMap = new Map(
      authorIds.map((id, i) => [
        id,
        {
          name: authors[i]?.displayName || 'Unknown',
          isBot: authors[i]?.kind === 'AI',
          // Stable ID for color assignment
          stableId: authors[i]?.clerkUserId || authors[i]?.guestId || id,
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
            authorStableId: author?.stableId || line.authorUserId,
            authorName: line.authorDisplayName || author?.name || 'Unknown',
            isBot: author?.isBot || false,
          };
        }),
        poetCount: uniqueAuthors.size,
        lineCount: lines.length,
        isFavorited: favoritedAt !== null,
        favoritedAt,
        createdAt: poem.createdAt,
        roomDate: roomMap.get(poem.roomId) || poem.createdAt,
        coAuthors,
      };
    });

    // Step 8: Calculate stats
    const allCollaboratorIds = new Set<string>();
    for (const poem of enrichedPoems) {
      for (const line of poem.lines) {
        if (
          line.authorStableId !== user.clerkUserId &&
          line.authorStableId !== user.guestId
        ) {
          allCollaboratorIds.add(line.authorStableId);
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
    const roomWindow = Math.min(
      MAX_RECENT_PUBLIC_ROOM_WINDOW,
      Math.max(poemLimit * RECENT_PUBLIC_ROOM_WINDOW_FACTOR, poemLimit)
    );

    // Get a bounded, indexed window of recently created completed rooms.
    const rooms = await ctx.db
      .query('rooms')
      .withIndex('by_status_created', (q) => q.eq('status', 'COMPLETED'))
      .order('desc')
      .take(roomWindow);

    if (rooms.length === 0) {
      return [];
    }

    const poemsByRoom = await Promise.all(
      rooms.map((room) =>
        ctx.db
          .query('poems')
          .withIndex('by_room_public_created', (q) =>
            q.eq('roomId', room._id).eq('publicShareEnabled', true)
          )
          .order('desc')
          .take(PUBLIC_POEMS_PER_ROOM)
      )
    );
    const poems = poemsByRoom
      .flat()
      .slice(0, poemLimit * PUBLIC_POEMS_PER_ROOM);

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

    // Build poemsWithLines without additional database calls
    const poemsWithLines = poems.map((poem, index) => {
      const lines = linesByPoem[index];
      const uniqueAuthors = new Set(lines.map((l) => l.authorUserId));

      return {
        _id: poem._id,
        lines: lines.slice(0, 5).map((l) => l.text), // First 5 lines for preview
        poetCount: uniqueAuthors.size,
        createdAt: poem.createdAt,
      };
    });

    // Keep only poems with at least 3 lines (looks better in showcase).
    const qualityPoems = [];
    for (const poem of poemsWithLines) {
      if (poem.lines.length < 3) continue;
      qualityPoems.push(poem);
      if (qualityPoems.length >= poemLimit) break;
    }

    return qualityPoems;
  },
});
