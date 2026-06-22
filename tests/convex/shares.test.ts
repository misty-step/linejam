import { describe, it, expect } from 'vitest';
import { api } from '../../convex/_generated/api';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, asUser } from '../helpers/convexSeed';

/**
 * shares mutations on the real convex-test engine (backlog 018): real
 * read-your-writes, real auth (getUser via Clerk identity), real participation
 * checks — asserting observable DB state instead of mock-call stubs.
 */

/**
 * Seed a COMPLETED room (code ABCD) owned by a participating 'clerk_owner',
 * with one game and one poem. Tweak per case via the opts.
 */
async function seedRoom(
  t: T,
  opts: {
    revealed?: boolean;
    publicShareEnabled?: boolean;
    publicRecapEnabled?: boolean;
  } = {}
) {
  const { revealed = true, publicShareEnabled, publicRecapEnabled } = opts;
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      displayName: 'Owner',
      kind: 'human',
      clerkUserId: 'clerk_owner',
      createdAt: 0,
    });
    const roomId = await ctx.db.insert('rooms', {
      code: 'ABCD',
      hostUserId: userId,
      status: 'COMPLETED',
      createdAt: 0,
    });
    await ctx.db.insert('roomPlayers', {
      roomId,
      userId,
      displayName: 'Owner',
      joinedAt: 0,
    });
    const gameId = await ctx.db.insert('games', {
      roomId,
      status: 'COMPLETED',
      cycle: 1,
      currentRound: 0,
      assignmentMatrix: [[userId]],
      createdAt: 0,
      ...(publicRecapEnabled !== undefined ? { publicRecapEnabled } : {}),
    });
    const poemId = await ctx.db.insert('poems', {
      roomId,
      gameId,
      indexInRoom: 0,
      createdAt: 0,
      ...(revealed ? { revealedAt: 1000 } : {}),
      ...(publicShareEnabled !== undefined ? { publicShareEnabled } : {}),
    });
    return { userId, roomId, gameId, poemId };
  });
}

describe('shares', () => {
  describe('enablePublicPoemShare', () => {
    it('marks a poem public when the caller participates in its room', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);

      await asUser(t, 'owner').mutation(api.shares.enablePublicPoemShare, {
        poemId,
      });

      const poem = await t.run((ctx) => ctx.db.get(poemId));
      expect(poem?.publicShareEnabled).toBe(true);
      expect(typeof poem?.publicShareEnabledAt).toBe('number');
      expect(poem?.publicShareDisabledAt).toBeUndefined();
    });

    it('rejects poem sharing for non-participants', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);
      // A real, authenticated user who is NOT a member of the room.
      await t.run((ctx) =>
        ctx.db.insert('users', {
          displayName: 'Outsider',
          kind: 'human',
          clerkUserId: 'clerk_outsider',
          createdAt: 0,
        })
      );

      await expect(
        t
          .withIdentity({ subject: 'clerk_outsider' })
          .mutation(api.shares.enablePublicPoemShare, { poemId })
      ).rejects.toThrow('Not authorized to share this poem');

      const poem = await t.run((ctx) => ctx.db.get(poemId));
      expect(poem?.publicShareEnabled).toBeUndefined();
    });
  });

  describe('disablePublicPoemShare', () => {
    it('marks a shared poem private when the caller participates', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t, { publicShareEnabled: true });

      await asUser(t, 'owner').mutation(api.shares.disablePublicPoemShare, {
        poemId,
      });

      const poem = await t.run((ctx) => ctx.db.get(poemId));
      expect(poem?.publicShareEnabled).toBe(false);
      expect(typeof poem?.publicShareDisabledAt).toBe('number');
    });
  });

  describe('enablePublicSessionRecapShare', () => {
    it('marks a completed, fully-revealed recap public for participants', async () => {
      const t = setupConvexTest();
      const { gameId } = await seedRoom(t, { revealed: true });

      await asUser(t, 'owner').mutation(
        api.shares.enablePublicSessionRecapShare,
        {
          roomCode: 'ABCD',
        }
      );

      const game = await t.run((ctx) => ctx.db.get(gameId));
      expect(game?.publicRecapEnabled).toBe(true);
      expect(typeof game?.publicRecapEnabledAt).toBe('number');
    });

    it('rejects recap sharing before every poem is revealed', async () => {
      const t = setupConvexTest();
      const { gameId, roomId } = await seedRoom(t, { revealed: true });
      // A second poem in the same game that is NOT revealed.
      await t.run((ctx) =>
        ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: 1,
          createdAt: 0,
        })
      );

      await expect(
        asUser(t, 'owner').mutation(api.shares.enablePublicSessionRecapShare, {
          roomCode: 'ABCD',
        })
      ).rejects.toThrow('Session recap not ready');

      const game = await t.run((ctx) => ctx.db.get(gameId));
      expect(game?.publicRecapEnabled).toBeUndefined();
    });
  });

  describe('disablePublicSessionRecapShare', () => {
    it('marks a public recap private for participants', async () => {
      const t = setupConvexTest();
      const { gameId } = await seedRoom(t, {
        revealed: true,
        publicRecapEnabled: true,
      });

      await asUser(t, 'owner').mutation(
        api.shares.disablePublicSessionRecapShare,
        {
          roomCode: 'ABCD',
        }
      );

      const game = await t.run((ctx) => ctx.db.get(gameId));
      expect(game?.publicRecapEnabled).toBe(false);
      expect(typeof game?.publicRecapDisabledAt).toBe('number');
    });
  });

  describe('logShare', () => {
    it('inserts a share record when the poem exists', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);

      await t.mutation(api.shares.logShare, { poemId });

      const shares = await t.run((ctx) =>
        ctx.db
          .query('shares')
          .withIndex('by_poem', (q) => q.eq('poemId', poemId))
          .collect()
      );
      expect(shares).toHaveLength(1);
      expect(typeof shares[0].createdAt).toBe('number');
    });

    it('throws when the poem does not exist', async () => {
      const t = setupConvexTest();
      // A valid-but-dangling poem id: insert the row then delete it.
      const danglingPoemId = await t.run(async (ctx) => {
        const userId = await ctx.db.insert('users', {
          displayName: 'x',
          createdAt: 0,
        });
        const roomId = await ctx.db.insert('rooms', {
          code: 'ZZZZ',
          hostUserId: userId,
          status: 'LOBBY',
          createdAt: 0,
        });
        const gameId = await ctx.db.insert('games', {
          roomId,
          status: 'IN_PROGRESS',
          cycle: 1,
          currentRound: 0,
          assignmentMatrix: [],
          createdAt: 0,
        });
        const poemId = await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: 0,
          createdAt: 0,
        });
        await ctx.db.delete(poemId);
        return poemId;
      });

      await expect(
        t.mutation(api.shares.logShare, { poemId: danglingPoemId })
      ).rejects.toThrow('Poem not found');
    });
  });
});
