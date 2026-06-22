import { describe, it, expect } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, asUser, seedClerkUser } from '../helpers/convexSeed';

/**
 * favorites queries/mutations on the real convex-test engine (backlog 018):
 * real read-your-writes + real auth (Clerk identity), asserting observable DB
 * state and return values instead of mock-call stubs.
 */

async function seedRoomGamePoems(
  t: T,
  opts: {
    hostUserId: Id<'users'>;
    poemCount?: number;
    status?: 'COMPLETED' | 'IN_PROGRESS';
  }
): Promise<{
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  poemIds: Id<'poems'>[];
}> {
  const { hostUserId, poemCount = 2, status = 'COMPLETED' } = opts;
  return t.run(async (ctx) => {
    const roomId = await ctx.db.insert('rooms', {
      code: 'ABCD',
      hostUserId,
      status,
      createdAt: 0,
    });
    const gameId = await ctx.db.insert('games', {
      roomId,
      status,
      cycle: 1,
      currentRound: 0,
      assignmentMatrix: [],
      createdAt: 0,
    });
    const poemIds: Id<'poems'>[] = [];
    for (let i = 0; i < poemCount; i++) {
      poemIds.push(
        await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: i,
          createdAt: 0,
        })
      );
    }
    return { roomId, gameId, poemIds };
  });
}

function userFavorites(t: T, userId: Id<'users'>) {
  return t.run((ctx) =>
    ctx.db
      .query('favorites')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
  );
}

describe('favorites', () => {
  describe('toggleFavorite', () => {
    it('creates a favorite on first toggle, owned by the authenticated user', async () => {
      const t = setupConvexTest();
      const userId = await seedClerkUser(t, 'user1');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: userId,
        poemCount: 1,
      });

      await asUser(t, 'user1').mutation(api.favorites.toggleFavorite, {
        poemId: poemIds[0],
      });

      const favs = await userFavorites(t, userId);
      expect(favs).toHaveLength(1);
      expect(favs[0].poemId).toBe(poemIds[0]);
      expect(favs[0].userId).toBe(userId);
    });

    it('removes the favorite on the second toggle', async () => {
      const t = setupConvexTest();
      const userId = await seedClerkUser(t, 'user1');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: userId,
        poemCount: 1,
      });
      const as = asUser(t, 'user1');

      await as.mutation(api.favorites.toggleFavorite, { poemId: poemIds[0] });
      await as.mutation(api.favorites.toggleFavorite, { poemId: poemIds[0] });

      expect(await userFavorites(t, userId)).toHaveLength(0);
    });

    it('re-creates the favorite on a third toggle (on/off/on)', async () => {
      const t = setupConvexTest();
      const userId = await seedClerkUser(t, 'user1');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: userId,
        poemCount: 1,
      });
      const as = asUser(t, 'user1');

      await as.mutation(api.favorites.toggleFavorite, { poemId: poemIds[0] });
      await as.mutation(api.favorites.toggleFavorite, { poemId: poemIds[0] });
      await as.mutation(api.favorites.toggleFavorite, { poemId: poemIds[0] });

      expect(await userFavorites(t, userId)).toHaveLength(1);
    });

    it('throws when no user is authenticated', async () => {
      const t = setupConvexTest();
      const hostId = await seedClerkUser(t, 'host');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: hostId,
        poemCount: 1,
      });

      await expect(
        t.mutation(api.favorites.toggleFavorite, { poemId: poemIds[0] })
      ).rejects.toThrow('User not found');
    });
  });

  describe('getMyFavorites', () => {
    it('returns [] when no user is authenticated', async () => {
      const t = setupConvexTest();
      expect(await t.query(api.favorites.getMyFavorites, {})).toEqual([]);
    });

    it('returns [] when the user has no favorites', async () => {
      const t = setupConvexTest();
      await seedClerkUser(t, 'user1');
      expect(
        await asUser(t, 'user1').query(api.favorites.getMyFavorites, {})
      ).toEqual([]);
    });

    it('returns the user favorites with first-line preview and favoritedAt', async () => {
      const t = setupConvexTest();
      const userId = await seedClerkUser(t, 'user1');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: userId,
        poemCount: 2,
      });
      await t.run(async (ctx) => {
        await ctx.db.insert('favorites', {
          userId,
          poemId: poemIds[0],
          createdAt: 1000,
        });
        await ctx.db.insert('favorites', {
          userId,
          poemId: poemIds[1],
          createdAt: 2000,
        });
        await ctx.db.insert('lines', {
          poemId: poemIds[0],
          indexInPoem: 0,
          text: 'first one',
          wordCount: 2,
          authorUserId: userId,
          createdAt: 0,
        });
        await ctx.db.insert('lines', {
          poemId: poemIds[1],
          indexInPoem: 0,
          text: 'first two',
          wordCount: 2,
          authorUserId: userId,
          createdAt: 0,
        });
      });

      const result = await asUser(t, 'user1').query(
        api.favorites.getMyFavorites,
        {}
      );
      expect(result).toHaveLength(2);
      const byId = Object.fromEntries(result.map((r) => [r._id, r]));
      expect(byId[poemIds[0]]).toMatchObject({
        preview: 'first one',
        favoritedAt: 1000,
      });
      expect(byId[poemIds[1]]).toMatchObject({
        preview: 'first two',
        favoritedAt: 2000,
      });
    });

    it('drops favorites whose poem was deleted', async () => {
      const t = setupConvexTest();
      const userId = await seedClerkUser(t, 'user1');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: userId,
        poemCount: 2,
      });
      await t.run(async (ctx) => {
        await ctx.db.insert('favorites', {
          userId,
          poemId: poemIds[0],
          createdAt: 1000,
        });
        await ctx.db.insert('favorites', {
          userId,
          poemId: poemIds[1],
          createdAt: 2000,
        });
        await ctx.db.delete(poemIds[1]);
      });

      const result = await asUser(t, 'user1').query(
        api.favorites.getMyFavorites,
        {}
      );
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe(poemIds[0]);
    });

    it('falls back to "..." preview when the poem has no first line', async () => {
      const t = setupConvexTest();
      const userId = await seedClerkUser(t, 'user1');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: userId,
        poemCount: 1,
      });
      await t.run((ctx) =>
        ctx.db.insert('favorites', {
          userId,
          poemId: poemIds[0],
          createdAt: 1000,
        })
      );

      const result = await asUser(t, 'user1').query(
        api.favorites.getMyFavorites,
        {}
      );
      expect(result[0].preview).toBe('...');
    });

    it('returns only the calling user favorites', async () => {
      const t = setupConvexTest();
      const user1 = await seedClerkUser(t, 'user1');
      const user2 = await seedClerkUser(t, 'user2');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: user1,
        poemCount: 2,
      });
      await t.run(async (ctx) => {
        await ctx.db.insert('favorites', {
          userId: user1,
          poemId: poemIds[0],
          createdAt: 1000,
        });
        await ctx.db.insert('favorites', {
          userId: user2,
          poemId: poemIds[1],
          createdAt: 2000,
        });
      });

      const result = await asUser(t, 'user1').query(
        api.favorites.getMyFavorites,
        {}
      );
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe(poemIds[0]);
    });
  });

  describe('isFavorited', () => {
    it('returns true when the poem is favorited by the user', async () => {
      const t = setupConvexTest();
      const userId = await seedClerkUser(t, 'user1');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: userId,
        poemCount: 1,
      });
      await t.run((ctx) =>
        ctx.db.insert('favorites', { userId, poemId: poemIds[0], createdAt: 0 })
      );

      expect(
        await asUser(t, 'user1').query(api.favorites.isFavorited, {
          poemId: poemIds[0],
        })
      ).toBe(true);
    });

    it('returns false when the poem is not favorited', async () => {
      const t = setupConvexTest();
      const userId = await seedClerkUser(t, 'user1');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: userId,
        poemCount: 1,
      });

      expect(
        await asUser(t, 'user1').query(api.favorites.isFavorited, {
          poemId: poemIds[0],
        })
      ).toBe(false);
    });

    it('returns false when no user is authenticated', async () => {
      const t = setupConvexTest();
      const hostId = await seedClerkUser(t, 'host');
      const { poemIds } = await seedRoomGamePoems(t, {
        hostUserId: hostId,
        poemCount: 1,
      });

      expect(
        await t.query(api.favorites.isFavorited, { poemId: poemIds[0] })
      ).toBe(false);
    });
  });

  describe('getSessionFavorites', () => {
    it('returns null for non-participants', async () => {
      const t = setupConvexTest();
      const hostId = await seedClerkUser(t, 'host');
      await seedClerkUser(t, 'stranger');
      await seedRoomGamePoems(t, { hostUserId: hostId, poemCount: 2 });

      expect(
        await asUser(t, 'stranger').query(api.favorites.getSessionFavorites, {
          roomCode: 'ABCD',
        })
      ).toBeNull();
    });

    it('crowns the most-hearted poem among participants', async () => {
      const t = setupConvexTest();
      const userId = await seedClerkUser(t, 'user1');
      const { roomId, poemIds } = await seedRoomGamePoems(t, {
        hostUserId: userId,
        poemCount: 2,
      });
      await t.run(async (ctx) => {
        await ctx.db.insert('roomPlayers', {
          roomId,
          userId,
          displayName: 'user1',
          joinedAt: 0,
        });
        // poem0: 1 heart; poem1: 3 hearts.
        await ctx.db.insert('favorites', {
          userId,
          poemId: poemIds[0],
          createdAt: 0,
        });
        for (let i = 0; i < 3; i++) {
          const fan = await ctx.db.insert('users', {
            displayName: `fan${i}`,
            kind: 'human',
            createdAt: 0,
          });
          await ctx.db.insert('favorites', {
            userId: fan,
            poemId: poemIds[1],
            createdAt: 0,
          });
        }
      });

      const result = await asUser(t, 'user1').query(
        api.favorites.getSessionFavorites,
        { roomCode: 'ABCD' }
      );
      expect(result).toMatchObject({
        totalHearts: 4,
        leaderPoemId: poemIds[1],
        leaderCount: 3,
      });
      expect(result?.counts).toEqual([
        { poemId: poemIds[0], indexInRoom: 0, count: 1 },
        { poemId: poemIds[1], indexInRoom: 1, count: 3 },
      ]);
    });

    it('has no leader when no hearts were given', async () => {
      const t = setupConvexTest();
      const userId = await seedClerkUser(t, 'user1');
      const { roomId } = await seedRoomGamePoems(t, {
        hostUserId: userId,
        poemCount: 2,
      });
      await t.run((ctx) =>
        ctx.db.insert('roomPlayers', {
          roomId,
          userId,
          displayName: 'user1',
          joinedAt: 0,
        })
      );

      const result = await asUser(t, 'user1').query(
        api.favorites.getSessionFavorites,
        { roomCode: 'ABCD' }
      );
      expect(result).toMatchObject({
        totalHearts: 0,
        leaderPoemId: null,
        leaderCount: 0,
      });
    });
  });
});
