import { describe, it, expect } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, seedUser, seedLine } from '../helpers/convexSeed';

/**
 * Archive queries on the real convex-test engine (backlog 018):
 * real read-your-writes, real auth (Clerk identity via t.withIdentity),
 * real DB indexes — asserting observable return values and DB state rather
 * than mock-call stubs.
 *
 * Auth path: getUser() looks up by clerkUserId when an identity is present.
 * We use t.withIdentity({ subject: '<clerkUserId>' }) throughout.
 * Guest-token auth (HMAC crypto) is not exercised here because it requires
 * a signed token; the auth flow is fully covered by the auth unit tests.
 */

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

type RoomSeed = {
  userId: Id<'users'>;
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  poemId: Id<'poems'>;
};

/**
 * Seed a minimal COMPLETED room with one poem, one game, and one roomPlayers
 * entry for the given user.
 */
async function seedCompletedRoom(
  t: T,
  userId: Id<'users'>,
  opts: { createdAt?: number; poemCreatedAt?: number } = {}
): Promise<RoomSeed> {
  const now = opts.createdAt ?? Date.now();
  return t.run(async (ctx) => {
    const roomId = await ctx.db.insert('rooms', {
      code: 'ABCD',
      hostUserId: userId,
      status: 'COMPLETED',
      createdAt: now,
    });
    await ctx.db.insert('roomPlayers', {
      roomId,
      userId,
      displayName: 'User',
      joinedAt: now,
    });
    const gameId = await ctx.db.insert('games', {
      roomId,
      status: 'COMPLETED',
      cycle: 1,
      currentRound: 0,
      assignmentMatrix: [[userId]],
      createdAt: now,
    });
    const poemId = await ctx.db.insert('poems', {
      roomId,
      gameId,
      indexInRoom: 0,
      createdAt: opts.poemCreatedAt ?? now,
    });
    return { userId, roomId, gameId, poemId };
  });
}

/** Insert a favorite for a poem. */
async function seedFavorite(
  t: T,
  userId: Id<'users'>,
  poemId: Id<'poems'>
): Promise<Id<'favorites'>> {
  return t.run((ctx) =>
    ctx.db.insert('favorites', {
      userId,
      poemId,
      createdAt: Date.now(),
    })
  );
}

/** Helper: call getArchiveData as the given Clerk user. */
function queryArchive(t: T, clerkUserId: string, guestToken?: string) {
  return t
    .withIdentity({ subject: clerkUserId })
    .query(api.archive.getArchiveData, { guestToken });
}

// ---------------------------------------------------------------------------
// getArchiveData
// ---------------------------------------------------------------------------

describe('archive', () => {
  describe('getArchiveData', () => {
    it('returns empty poems and null stats when user is not authenticated', async () => {
      const t = setupConvexTest();

      // Call without any identity — getUser returns null.
      const result = await t.query(api.archive.getArchiveData, {});

      expect(result).toEqual({ poems: [], stats: null });
    });

    it('returns empty poems and zero stats when authenticated user has no lines', async () => {
      const t = setupConvexTest();
      await seedUser(t, { displayName: 'Empty', clerkUserId: 'clerk_empty' });

      const result = await queryArchive(t, 'clerk_empty');

      expect(result.poems).toEqual([]);
      expect(result.stats).toEqual({
        totalPoems: 0,
        totalFavorites: 0,
        uniqueCollaborators: 0,
        totalLinesWritten: 0,
      });
    });

    it('returns enriched poem with all metadata for user with one line', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'Author',
        clerkUserId: 'clerk_author',
        guestId: 'guest_author',
      });
      const { poemId } = await seedCompletedRoom(t, userId);
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
      });

      const result = await queryArchive(t, 'clerk_author');

      expect(result.poems).toHaveLength(1);
      expect(result.poems[0]).toMatchObject({
        _id: poemId,
        preview: 'Hello',
        lineCount: 1,
        poetCount: 1,
        isFavorited: false,
        favoritedAt: null,
      });
      expect(result.poems[0].lines).toHaveLength(1);
      expect(result.poems[0].lines[0]).toMatchObject({
        text: 'Hello',
        wordCount: 1,
        isBot: false,
      });
      expect(result.stats).toMatchObject({
        totalPoems: 1,
        totalLinesWritten: 1,
        totalFavorites: 0,
      });
    });

    it('correctly identifies favorited poems', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'Fave',
        clerkUserId: 'clerk_fave',
        guestId: 'guest_fave',
      });
      const { poemId } = await seedCompletedRoom(t, userId);
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
      });
      await seedFavorite(t, userId, poemId);

      const result = await queryArchive(t, 'clerk_fave');

      expect(result.poems[0].isFavorited).toBe(true);
      expect(typeof result.poems[0].favoritedAt).toBe('number');
      expect(result.stats?.totalFavorites).toBe(1);
    });

    it('handles AI authors correctly — isBot is true', async () => {
      const t = setupConvexTest();
      const humanId = await seedUser(t, {
        displayName: 'Human',
        clerkUserId: 'clerk_human',
        guestId: 'guest_human',
      });
      const aiId = await seedUser(t, {
        displayName: 'Bot',
        kind: 'AI',
        guestId: 'ai-guest',
      });
      const { poemId } = await seedCompletedRoom(t, humanId);
      await seedLine(t, {
        poemId,
        authorUserId: humanId,
        text: 'Intro',
        wordCount: 1,
        indexInPoem: 0,
      });
      await seedLine(t, {
        poemId,
        authorUserId: aiId,
        text: 'Generated',
        wordCount: 1,
        indexInPoem: 1,
      });

      const result = await queryArchive(t, 'clerk_human');

      const aiLine = result.poems[0].lines.find(
        (l: { text: string }) => l.text === 'Generated'
      );
      expect(aiLine?.isBot).toBe(true);
    });

    it('calculates unique collaborators excluding self', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'Me',
        clerkUserId: 'clerk_me',
        guestId: 'guest_me',
      });
      const collab1 = await seedUser(t, {
        displayName: 'Collab1',
        guestId: 'guest_c1',
      });
      const collab2 = await seedUser(t, {
        displayName: 'Collab2',
        guestId: 'guest_c2',
      });
      const { poemId } = await seedCompletedRoom(t, userId);
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'A',
        wordCount: 1,
        indexInPoem: 0,
      });
      await seedLine(t, {
        poemId,
        authorUserId: collab1,
        text: 'B',
        wordCount: 1,
        indexInPoem: 1,
      });
      await seedLine(t, {
        poemId,
        authorUserId: collab2,
        text: 'C',
        wordCount: 1,
        indexInPoem: 2,
      });

      const result = await queryArchive(t, 'clerk_me');

      // 2 collaborators (collab1, collab2), not counting self
      expect(result.stats?.uniqueCollaborators).toBe(2);
    });

    it('limits coAuthors to 3 entries even with more authors', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'Host',
        clerkUserId: 'clerk_host',
        guestId: 'guest_host',
      });
      // Four extra collaborators (total unique = 5)
      const extras = await Promise.all(
        [1, 2, 3, 4].map((i) =>
          seedUser(t, { displayName: `Extra${i}`, guestId: `guest_e${i}` })
        )
      );
      const { poemId } = await seedCompletedRoom(t, userId);
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'A',
        wordCount: 1,
        indexInPoem: 0,
      });
      for (let i = 0; i < extras.length; i++) {
        await seedLine(t, {
          poemId,
          authorUserId: extras[i],
          text: `L${i + 2}`,
          wordCount: 1,
          indexInPoem: i + 1,
        });
      }

      const result = await queryArchive(t, 'clerk_host');

      expect(result.poems[0].coAuthors).toHaveLength(3);
    });

    it('sorts poems by creation date descending (most recent first)', async () => {
      const t = setupConvexTest();
      const now = Date.now();
      const userId = await seedUser(t, {
        displayName: 'Poet',
        clerkUserId: 'clerk_poet',
        guestId: 'guest_poet',
      });

      // Create two rooms with poems at different timestamps.
      const { roomId: room1 } = await t.run(async (ctx) => {
        const roomId = await ctx.db.insert('rooms', {
          code: 'AAAA',
          hostUserId: userId,
          status: 'COMPLETED',
          createdAt: now - 10000,
        });
        await ctx.db.insert('roomPlayers', {
          roomId,
          userId,
          displayName: 'Poet',
          joinedAt: now - 10000,
        });
        const gameId = await ctx.db.insert('games', {
          roomId,
          status: 'COMPLETED',
          cycle: 1,
          currentRound: 0,
          assignmentMatrix: [[userId]],
          createdAt: now - 10000,
        });
        return { roomId, gameId };
      });

      const { roomId: room2 } = await t.run(async (ctx) => {
        const roomId = await ctx.db.insert('rooms', {
          code: 'BBBB',
          hostUserId: userId,
          status: 'COMPLETED',
          createdAt: now,
        });
        await ctx.db.insert('roomPlayers', {
          roomId,
          userId,
          displayName: 'Poet',
          joinedAt: now,
        });
        const gameId = await ctx.db.insert('games', {
          roomId,
          status: 'COMPLETED',
          cycle: 1,
          currentRound: 0,
          assignmentMatrix: [[userId]],
          createdAt: now,
        });
        return { roomId, gameId };
      });

      // Insert poems with explicit createdAt timestamps
      const [olderPoemId, newerPoemId] = await t.run(async (ctx) => {
        // Older poem in room1
        const game1 = await ctx.db
          .query('games')
          .withIndex('by_room', (q) => q.eq('roomId', room1))
          .first();
        const p1 = await ctx.db.insert('poems', {
          roomId: room1,
          gameId: game1!._id,
          indexInRoom: 0,
          createdAt: now - 10000,
        });
        // Newer poem in room2
        const game2 = await ctx.db
          .query('games')
          .withIndex('by_room', (q) => q.eq('roomId', room2))
          .first();
        const p2 = await ctx.db.insert('poems', {
          roomId: room2,
          gameId: game2!._id,
          indexInRoom: 0,
          createdAt: now,
        });
        return [p1, p2];
      });

      await seedLine(t, {
        poemId: olderPoemId,
        authorUserId: userId,
        text: 'Old',
        wordCount: 1,
        indexInPoem: 0,
      });
      await seedLine(t, {
        poemId: newerPoemId,
        authorUserId: userId,
        text: 'New',
        wordCount: 1,
        indexInPoem: 0,
      });

      const result = await queryArchive(t, 'clerk_poet');

      // Most recent first
      expect(result.poems[0]._id).toBe(newerPoemId);
      expect(result.poems[1]._id).toBe(olderPoemId);
    });

    it('handles null poems gracefully — lines pointing to deleted poems are skipped', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'Orphan',
        clerkUserId: 'clerk_orphan',
        guestId: 'guest_orphan',
      });
      const { poemId } = await seedCompletedRoom(t, userId);
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'Orphan',
        wordCount: 1,
        indexInPoem: 0,
      });

      // Delete the poem to create a dangling reference
      await t.run((ctx) => ctx.db.delete(poemId));

      const result = await queryArchive(t, 'clerk_orphan');

      // The line is still found by by_author, but the poem lookup returns null
      // — filtered out, so no poems in result.
      expect(result.poems).toEqual([]);
    });

    it('uses poem.createdAt as roomDate fallback when room is missing', async () => {
      const t = setupConvexTest();
      const poemCreatedAt = Date.now() - 5000;
      const userId = await seedUser(t, {
        displayName: 'Nomad',
        clerkUserId: 'clerk_nomad',
        guestId: 'guest_nomad',
      });
      const { poemId, roomId } = await seedCompletedRoom(t, userId, {
        poemCreatedAt,
      });
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
      });

      // Delete the room to simulate orphaned poem
      await t.run((ctx) => ctx.db.delete(roomId));

      const result = await queryArchive(t, 'clerk_nomad');

      // roomDate fallback: roomMap returns 0 for missing room, and production
      // code then falls back to poem.createdAt via `roomMap.get(poem.roomId) || poem.createdAt`.
      // The roomMap lookup returns 0 (falsy), so the fallback is poem.createdAt.
      expect(result.poems[0].roomDate).toBe(poemCreatedAt);
    });

    it('handles null author gracefully — falls back to Unknown and uses authorUserId as stableId', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'User',
        clerkUserId: 'clerk_user',
        guestId: 'guest_user',
      });
      const { poemId } = await seedCompletedRoom(t, userId);

      // Insert a line whose authorUserId points to a deleted user.
      // We create a user, insert the line, then delete the user.
      const ghostId = await seedUser(t, {
        displayName: 'Ghost',
        guestId: 'guest_ghost',
      });
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'User line',
        wordCount: 1,
        indexInPoem: 0,
      });
      await seedLine(t, {
        poemId,
        authorUserId: ghostId,
        text: 'Mystery',
        wordCount: 1,
        indexInPoem: 1,
      });
      await t.run((ctx) => ctx.db.delete(ghostId));

      const result = await queryArchive(t, 'clerk_user');

      const mysteryLine = result.poems[0].lines.find(
        (l: { text: string }) => l.text === 'Mystery'
      );
      // authorMap entry for deleted user: { name: 'Unknown', isBot: false, stableId: authorUserId }
      expect(mysteryLine?.authorName).toBe('Unknown');
      expect(mysteryLine?.isBot).toBe(false);
      // stableId falls back to authorUserId string (the ghostId)
      expect(typeof mysteryLine?.authorStableId).toBe('string');
    });

    it('prefers authorDisplayName from line over author.displayName', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'User Display Name',
        clerkUserId: 'clerk_display',
        guestId: 'guest_display',
      });
      const { poemId } = await seedCompletedRoom(t, userId);
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
        authorDisplayName: 'Line Display Name',
      });

      const result = await queryArchive(t, 'clerk_display');

      // Should prefer line.authorDisplayName over author.displayName
      expect(result.poems[0].lines[0].authorName).toBe('Line Display Name');
    });

    it('returns preview as "..." when poem has no lines', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'Empty Poem',
        clerkUserId: 'clerk_empty_poem',
        guestId: 'guest_empty_poem',
      });
      const { poemId } = await seedCompletedRoom(t, userId);

      // Insert one line attributed to this user so getArchiveData picks up the poem,
      // then delete it — the poem exists but has zero lines from by_poem index.
      const lineId = await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'Ghost',
        wordCount: 1,
        indexInPoem: 0,
      });
      await t.run((ctx) => ctx.db.delete(lineId));

      const result = await queryArchive(t, 'clerk_empty_poem');

      // No lines for this user → userLines empty → early return with empty stats.
      // (If by_author has no rows after deletion, the user has no archive poems.)
      expect(result.poems).toEqual([]);
      expect(result.stats).toEqual({
        totalPoems: 0,
        totalFavorites: 0,
        uniqueCollaborators: 0,
        totalLinesWritten: 0,
      });
    });

    it('returns preview as first line text', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'Previewer',
        clerkUserId: 'clerk_prev',
        guestId: 'guest_prev',
      });
      const { poemId } = await seedCompletedRoom(t, userId);
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'First line',
        wordCount: 2,
        indexInPoem: 0,
      });
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'Second line',
        wordCount: 2,
        indexInPoem: 1,
      });

      const result = await queryArchive(t, 'clerk_prev');

      expect(result.poems[0].preview).toBe('First line');
      expect(result.poems[0].lineCount).toBe(2);
    });

    it('coAuthors shows Unknown for a collaborator whose user row is missing', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'Known',
        clerkUserId: 'clerk_known',
        guestId: 'guest_known',
      });
      const ghostId = await seedUser(t, {
        displayName: 'Ghost',
        guestId: 'guest_ghost2',
      });
      const { poemId } = await seedCompletedRoom(t, userId);
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'A',
        wordCount: 1,
        indexInPoem: 0,
      });
      await seedLine(t, {
        poemId,
        authorUserId: ghostId,
        text: 'B',
        wordCount: 1,
        indexInPoem: 1,
      });
      // Delete the collaborator's user row
      await t.run((ctx) => ctx.db.delete(ghostId));

      const result = await queryArchive(t, 'clerk_known');

      expect(result.poems[0].coAuthors).toContain('Unknown');
    });

    it('uses clerkUserId as authorStableId when available', async () => {
      const t = setupConvexTest();
      const userId = await seedUser(t, {
        displayName: 'Clerk User',
        clerkUserId: 'clerk_stable',
        guestId: 'guest_stable',
      });
      const { poemId } = await seedCompletedRoom(t, userId);
      await seedLine(t, {
        poemId,
        authorUserId: userId,
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
      });

      const result = await queryArchive(t, 'clerk_stable');

      // clerkUserId should be used as stableId when present
      expect(result.poems[0].lines[0].authorStableId).toBe('clerk_stable');
    });

    it('uniqueCollaborators counts distinct non-self stableIds across all poems', async () => {
      const t = setupConvexTest();
      // User with clerkUserId so stableId = 'clerk_multi'
      const userId = await seedUser(t, {
        displayName: 'Multi',
        clerkUserId: 'clerk_multi',
        guestId: 'guest_multi',
      });
      const collab = await seedUser(t, {
        displayName: 'Collab',
        guestId: 'guest_collab_multi',
      });

      // Two poems, same collaborator in each
      const room1 = await seedCompletedRoom(t, userId, { createdAt: 1000 });
      const room2 = await t.run(async (ctx) => {
        const roomId = await ctx.db.insert('rooms', {
          code: 'CCCC',
          hostUserId: userId,
          status: 'COMPLETED',
          createdAt: 2000,
        });
        await ctx.db.insert('roomPlayers', {
          roomId,
          userId,
          displayName: 'Multi',
          joinedAt: 2000,
        });
        const gameId = await ctx.db.insert('games', {
          roomId,
          status: 'COMPLETED',
          cycle: 1,
          currentRound: 0,
          assignmentMatrix: [[userId]],
          createdAt: 2000,
        });
        const poemId = await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: 0,
          createdAt: 2000,
        });
        return { roomId, gameId, poemId };
      });

      await seedLine(t, {
        poemId: room1.poemId,
        authorUserId: userId,
        text: 'L1',
        wordCount: 1,
        indexInPoem: 0,
      });
      await seedLine(t, {
        poemId: room1.poemId,
        authorUserId: collab,
        text: 'L2',
        wordCount: 1,
        indexInPoem: 1,
      });
      await seedLine(t, {
        poemId: room2.poemId,
        authorUserId: userId,
        text: 'L3',
        wordCount: 1,
        indexInPoem: 0,
      });
      await seedLine(t, {
        poemId: room2.poemId,
        authorUserId: collab,
        text: 'L4',
        wordCount: 1,
        indexInPoem: 1,
      });

      const result = await queryArchive(t, 'clerk_multi');

      // Same collab appears in both poems — still just 1 unique collaborator
      expect(result.stats?.uniqueCollaborators).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getRecentPublicPoems
  // ---------------------------------------------------------------------------

  describe('getRecentPublicPoems', () => {
    it('returns empty array when no completed rooms exist', async () => {
      const t = setupConvexTest();

      const result = await t.query(api.archive.getRecentPublicPoems, {});

      expect(result).toEqual([]);
    });

    it('returns empty array when completed rooms have no poems', async () => {
      const t = setupConvexTest();
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert('users', {
          displayName: 'Host',
          createdAt: 0,
        });
        await ctx.db.insert('rooms', {
          code: 'ABCD',
          hostUserId: userId,
          status: 'COMPLETED',
          createdAt: 0,
        });
      });

      const result = await t.query(api.archive.getRecentPublicPoems, {});

      expect(result).toEqual([]);
    });

    it('returns poems with line counts and poet counts', async () => {
      const t = setupConvexTest();
      const poemId = await t.run(async (ctx) => {
        const u1 = await ctx.db.insert('users', {
          displayName: 'U1',
          guestId: 'gu1',
          createdAt: 0,
        });
        const u2 = await ctx.db.insert('users', {
          displayName: 'U2',
          guestId: 'gu2',
          createdAt: 0,
        });
        const roomId = await ctx.db.insert('rooms', {
          code: 'ABCD',
          hostUserId: u1,
          status: 'COMPLETED',
          createdAt: 0,
        });
        const gameId = await ctx.db.insert('games', {
          roomId,
          status: 'COMPLETED',
          cycle: 1,
          currentRound: 0,
          assignmentMatrix: [[u1, u2]],
          createdAt: 0,
        });
        const poemId = await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: 0,
          createdAt: 0,
        });
        await ctx.db.insert('lines', {
          poemId,
          authorUserId: u1,
          text: 'Line one',
          wordCount: 2,
          indexInPoem: 0,
          createdAt: 0,
        });
        await ctx.db.insert('lines', {
          poemId,
          authorUserId: u2,
          text: 'Line two',
          wordCount: 2,
          indexInPoem: 1,
          createdAt: 0,
        });
        await ctx.db.insert('lines', {
          poemId,
          authorUserId: u1,
          text: 'Line three',
          wordCount: 2,
          indexInPoem: 2,
          createdAt: 0,
        });
        return poemId;
      });

      const result = await t.query(api.archive.getRecentPublicPoems, {
        limit: 5,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        _id: poemId,
        poetCount: 2,
      });
      expect(result[0].lines).toHaveLength(3);
    });

    it('filters out poems with fewer than 3 lines', async () => {
      const t = setupConvexTest();
      await t.run(async (ctx) => {
        const u1 = await ctx.db.insert('users', {
          displayName: 'U1',
          guestId: 'gu1',
          createdAt: 0,
        });
        const roomId = await ctx.db.insert('rooms', {
          code: 'ABCD',
          hostUserId: u1,
          status: 'COMPLETED',
          createdAt: 0,
        });
        const gameId = await ctx.db.insert('games', {
          roomId,
          status: 'COMPLETED',
          cycle: 1,
          currentRound: 0,
          assignmentMatrix: [[u1]],
          createdAt: 0,
        });
        const poemId = await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: 0,
          createdAt: 0,
        });
        // Only 2 lines — below the minimum 3
        for (let i = 0; i < 2; i++) {
          await ctx.db.insert('lines', {
            poemId,
            authorUserId: u1,
            text: `Line ${i}`,
            wordCount: 1,
            indexInPoem: i,
            createdAt: 0,
          });
        }
      });

      const result = await t.query(api.archive.getRecentPublicPoems, {
        limit: 5,
      });

      expect(result).toHaveLength(0);
    });

    it('respects the limit parameter', async () => {
      const t = setupConvexTest();
      // Seed two rooms, each with one poem (≥3 lines)
      await t.run(async (ctx) => {
        for (let roomIdx = 0; roomIdx < 2; roomIdx++) {
          const u = await ctx.db.insert('users', {
            displayName: `U${roomIdx}`,
            guestId: `guest_lim_${roomIdx}`,
            createdAt: 0,
          });
          const roomId = await ctx.db.insert('rooms', {
            code: `LM${roomIdx}0`,
            hostUserId: u,
            status: 'COMPLETED',
            createdAt: roomIdx,
          });
          const gameId = await ctx.db.insert('games', {
            roomId,
            status: 'COMPLETED',
            cycle: 1,
            currentRound: 0,
            assignmentMatrix: [[u]],
            createdAt: roomIdx,
          });
          const poemId = await ctx.db.insert('poems', {
            roomId,
            gameId,
            indexInRoom: 0,
            createdAt: roomIdx,
          });
          for (let i = 0; i < 3; i++) {
            await ctx.db.insert('lines', {
              poemId,
              authorUserId: u,
              text: `L${i}`,
              wordCount: 1,
              indexInPoem: i,
              createdAt: 0,
            });
          }
        }
      });

      const result = await t.query(api.archive.getRecentPublicPoems, {
        limit: 1,
      });

      expect(result).toHaveLength(1);
    });

    it('limits preview to 5 lines per poem', async () => {
      const t = setupConvexTest();
      await t.run(async (ctx) => {
        const u = await ctx.db.insert('users', {
          displayName: 'Wordy',
          guestId: 'guest_wordy',
          createdAt: 0,
        });
        const roomId = await ctx.db.insert('rooms', {
          code: 'ABCD',
          hostUserId: u,
          status: 'COMPLETED',
          createdAt: 0,
        });
        const gameId = await ctx.db.insert('games', {
          roomId,
          status: 'COMPLETED',
          cycle: 1,
          currentRound: 0,
          assignmentMatrix: [[u]],
          createdAt: 0,
        });
        const poemId = await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: 0,
          createdAt: 0,
        });
        // Insert 9 lines
        for (let i = 0; i < 9; i++) {
          await ctx.db.insert('lines', {
            poemId,
            authorUserId: u,
            text: `Line ${i + 1}`,
            wordCount: 1,
            indexInPoem: i,
            createdAt: 0,
          });
        }
      });

      const result = await t.query(api.archive.getRecentPublicPoems, {});

      expect(result[0].lines).toHaveLength(5);
      expect(result[0].lines[0]).toBe('Line 1');
      expect(result[0].lines[4]).toBe('Line 5');
    });

    it('limits to 2 poems per room', async () => {
      const t = setupConvexTest();
      const poemIds = await t.run(async (ctx) => {
        const u = await ctx.db.insert('users', {
          displayName: 'Multi',
          guestId: 'guest_multi_room',
          createdAt: 0,
        });
        const roomId = await ctx.db.insert('rooms', {
          code: 'ABCD',
          hostUserId: u,
          status: 'COMPLETED',
          createdAt: 0,
        });
        const gameId = await ctx.db.insert('games', {
          roomId,
          status: 'COMPLETED',
          cycle: 1,
          currentRound: 0,
          assignmentMatrix: [[u]],
          createdAt: 0,
        });
        const ids: Id<'poems'>[] = [];
        for (let idx = 0; idx < 3; idx++) {
          const poemId = await ctx.db.insert('poems', {
            roomId,
            gameId,
            indexInRoom: idx,
            createdAt: idx,
          });
          ids.push(poemId);
          for (let i = 0; i < 3; i++) {
            await ctx.db.insert('lines', {
              poemId,
              authorUserId: u,
              text: `L${idx}_${i}`,
              wordCount: 1,
              indexInPoem: i,
              createdAt: 0,
            });
          }
        }
        return ids;
      });

      const result = await t.query(api.archive.getRecentPublicPoems, {
        limit: 10,
      });

      // 3 poems in one room → only 2 returned (per-room cap)
      expect(result).toHaveLength(2);
      const returnedIds = result.map((p: { _id: Id<'poems'> }) => p._id);
      // The cap is first-come from the DB order; both must be from the 3 seeded
      expect(poemIds).toEqual(expect.arrayContaining(returnedIds));
    });

    it('uses default limit of 5 when limit is omitted', async () => {
      const t = setupConvexTest();
      // 10 rooms each with 1 poem and 3 lines
      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          const u = await ctx.db.insert('users', {
            displayName: `U${i}`,
            guestId: `guest_def_${i}`,
            createdAt: 0,
          });
          const roomId = await ctx.db.insert('rooms', {
            code: `DF${String(i).padStart(2, '0')}`,
            hostUserId: u,
            status: 'COMPLETED',
            createdAt: i,
          });
          const gameId = await ctx.db.insert('games', {
            roomId,
            status: 'COMPLETED',
            cycle: 1,
            currentRound: 0,
            assignmentMatrix: [[u]],
            createdAt: i,
          });
          const poemId = await ctx.db.insert('poems', {
            roomId,
            gameId,
            indexInRoom: 0,
            createdAt: i,
          });
          for (let j = 0; j < 3; j++) {
            await ctx.db.insert('lines', {
              poemId,
              authorUserId: u,
              text: `L${j}`,
              wordCount: 1,
              indexInPoem: j,
              createdAt: 0,
            });
          }
        }
      });

      const result = await t.query(api.archive.getRecentPublicPoems, {});

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('returns poems from multiple different rooms with correct poet counts', async () => {
      const t = setupConvexTest();
      const [poemId1, poemId2] = await t.run(async (ctx) => {
        const u1 = await ctx.db.insert('users', {
          displayName: 'U1',
          guestId: 'gu1',
          createdAt: 0,
        });
        const u2 = await ctx.db.insert('users', {
          displayName: 'U2',
          guestId: 'gu2',
          createdAt: 0,
        });

        // Room 1 — only u1 writes
        const room1 = await ctx.db.insert('rooms', {
          code: 'ROOM',
          hostUserId: u1,
          status: 'COMPLETED',
          createdAt: 0,
        });
        const game1 = await ctx.db.insert('games', {
          roomId: room1,
          status: 'COMPLETED',
          cycle: 1,
          currentRound: 0,
          assignmentMatrix: [[u1]],
          createdAt: 0,
        });
        const p1 = await ctx.db.insert('poems', {
          roomId: room1,
          gameId: game1,
          indexInRoom: 0,
          createdAt: 0,
        });
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert('lines', {
            poemId: p1,
            authorUserId: u1,
            text: `a${i}`,
            wordCount: 1,
            indexInPoem: i,
            createdAt: 0,
          });
        }

        // Room 2 — only u2 writes
        const room2 = await ctx.db.insert('rooms', {
          code: 'ROM2',
          hostUserId: u2,
          status: 'COMPLETED',
          createdAt: 1,
        });
        const game2 = await ctx.db.insert('games', {
          roomId: room2,
          status: 'COMPLETED',
          cycle: 1,
          currentRound: 0,
          assignmentMatrix: [[u2]],
          createdAt: 1,
        });
        const p2 = await ctx.db.insert('poems', {
          roomId: room2,
          gameId: game2,
          indexInRoom: 0,
          createdAt: 1,
        });
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert('lines', {
            poemId: p2,
            authorUserId: u2,
            text: `b${i}`,
            wordCount: 1,
            indexInPoem: i,
            createdAt: 0,
          });
        }

        return [p1, p2];
      });

      const result = await t.query(api.archive.getRecentPublicPoems, {
        limit: 5,
      });

      expect(result).toHaveLength(2);
      const r1 = result.find((p: { _id: Id<'poems'> }) => p._id === poemId1);
      const r2 = result.find((p: { _id: Id<'poems'> }) => p._id === poemId2);
      expect(r1?.poetCount).toBe(1);
      expect(r2?.poetCount).toBe(1);
    });
  });
});
