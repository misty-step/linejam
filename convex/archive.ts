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
  },
  handler: async (ctx, { guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) {
      return { poems: [] as ArchivePoem[], stats: null };
    }

    // Step 1: Find all lines written by user
    const userLines = await ctx.db
      .query('lines')
      .withIndex('by_author', (q) => q.eq('authorUserId', user._id))
      .collect();

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

    // Step 2: Get unique poem IDs and fetch poems + favorites in parallel
    const poemIds = [...new Set(userLines.map((l) => l.poemId))];

    const [poemsRaw, favorites] = await Promise.all([
      Promise.all(poemIds.map((id) => ctx.db.get(id))),
      ctx.db
        .query('favorites')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect(),
    ]);

    // Filter out null poems and create lookup
    const poems = poemsRaw.filter(
      (p): p is NonNullable<typeof p> => p !== null
    );
    const favoriteMap = new Map(favorites.map((f) => [f.poemId, f.createdAt]));

    // Step 3: Fetch all lines for all poems in parallel
    const allPoemLines = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
          .collect()
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
      const lines = allPoemLines[poemIndex].sort(
        (a, b) => a.indexInPoem - b.indexInPoem
      );
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

    // Sort by creation date descending (most recent first)
    enrichedPoems.sort((a, b) => b.createdAt - a.createdAt);

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

    const stats: ArchiveStats = {
      totalPoems: enrichedPoems.length,
      totalFavorites: enrichedPoems.filter((p) => p.isFavorited).length,
      uniqueCollaborators: allCollaboratorIds.size,
      totalLinesWritten: userLines.length,
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
    // Get recent poems from rooms that are completed
    const rooms = await ctx.db
      .query('rooms')
      .filter((q) => q.eq(q.field('status'), 'COMPLETED'))
      .order('desc')
      .take(20);

    if (rooms.length === 0) {
      return [];
    }

    // Batch fetch all poems for these rooms in a single query
    const roomIdSet = new Set(rooms.map((r) => r._id));
    const allRoomPoems = await ctx.db
      .query('poems')
      .filter((q) =>
        q.or(...rooms.map((room) => q.eq(q.field('roomId'), room._id)))
      )
      .collect();

    // Group poems by room and take up to 2 per room
    const poemsByRoom = new Map<Id<'rooms'>, typeof allRoomPoems>();
    for (const poem of allRoomPoems) {
      if (!roomIdSet.has(poem.roomId)) continue;
      const existing = poemsByRoom.get(poem.roomId) || [];
      if (existing.length < 2) {
        poemsByRoom.set(poem.roomId, [...existing, poem]);
      }
    }
    const poems = [...poemsByRoom.values()].flat().slice(0, limit * 2);

    if (poems.length === 0) {
      return [];
    }

    // Batch fetch all lines for all poems in a single query
    const poemIdSet = new Set(poems.map((p) => p._id));
    const allLines = await ctx.db
      .query('lines')
      .filter((q) =>
        q.or(...poems.map((poem) => q.eq(q.field('poemId'), poem._id)))
      )
      .collect();

    // Group lines by poemId for O(1) lookup
    const linesByPoemId = new Map<Id<'poems'>, typeof allLines>();
    for (const line of allLines) {
      if (!poemIdSet.has(line.poemId)) continue;
      const existing = linesByPoemId.get(line.poemId) || [];
      linesByPoemId.set(line.poemId, [...existing, line]);
    }

    // Build poemsWithLines without additional database calls
    const poemsWithLines = poems.map((poem) => {
      const lines = (linesByPoemId.get(poem._id) || []).sort(
        (a, b) => a.indexInPoem - b.indexInPoem
      );
      const uniqueAuthors = new Set(lines.map((l) => l.authorUserId));

      return {
        _id: poem._id,
        lines: lines.slice(0, 5).map((l) => l.text), // First 5 lines for preview
        poetCount: uniqueAuthors.size,
        createdAt: poem.createdAt,
      };
    });

    // Filter to only poems with at least 3 lines (looks better in showcase)
    const qualityPoems = poemsWithLines.filter((p) => p.lines.length >= 3);

    return qualityPoems.slice(0, limit);
  },
});
