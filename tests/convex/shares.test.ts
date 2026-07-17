import { describe, it, expect } from 'vitest';
import { makeFunctionReference } from 'convex/server';
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
  describe('disablePublicPoemShare', () => {
    it('marks a shared poem private when the caller participates', async () => {
      const t = setupConvexTest();
      const { poemId, roomId } = await seedRoom(t, {
        publicShareEnabled: true,
      });

      await asUser(t, 'owner').mutation(api.shares.disablePublicPoemShare, {
        poemId,
      });

      const poem = await t.run((ctx) => ctx.db.get(poemId));
      const room = await t.run((ctx) => ctx.db.get(roomId));
      expect(poem?.publicShareEnabled).toBe(false);
      expect(typeof poem?.publicShareDisabledAt).toBe('number');
      expect(poem?.retentionState).toBe('pending');
      expect(poem?.retentionEligibleAt).toBeGreaterThan(
        poem?.publicShareDisabledAt ?? 0
      );
      expect(room?.retentionState).toBe('pending');
    });

    it('is idempotent when the poem is already private', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);

      const result = await asUser(t, 'owner').mutation(
        api.shares.disablePublicPoemShare,
        { poemId }
      );

      expect(result).toMatchObject({
        publicShareEnabled: false,
        changed: false,
      });
      const poem = await t.run((ctx) => ctx.db.get(poemId));
      expect(poem?.publicShareAttempt).toBeUndefined();
    });

    it('clears an in-flight share attempt without changing a private poem', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);
      const pending = await asUser(t, 'owner').mutation(
        api.shares.preparePublicPoemShare,
        { poemId }
      );

      const result = await asUser(t, 'owner').mutation(
        api.shares.disablePublicPoemShare,
        { poemId }
      );

      expect(result).toMatchObject({
        publicShareEnabled: false,
        changed: false,
      });
      const state = await t.run(async (ctx) => ({
        poem: await ctx.db.get(poemId),
        share: await ctx.db
          .query('shares')
          .withIndex('by_slug', (q) => q.eq('slug', pending.slug))
          .first(),
      }));
      expect(state.poem?.publicShareAttempt).toBeUndefined();
      expect(state.share?.state).toBe('pending');
    });

    it('keeps retention protected when a favorite still references the poem', async () => {
      const t = setupConvexTest();
      const { poemId, userId } = await seedRoom(t, {
        publicShareEnabled: true,
      });
      await t.run((ctx) =>
        ctx.db.insert('favorites', {
          userId,
          poemId,
          createdAt: 0,
        })
      );

      await asUser(t, 'owner').mutation(api.shares.disablePublicPoemShare, {
        poemId,
      });

      const poem = await t.run((ctx) => ctx.db.get(poemId));
      expect(poem?.retentionState).toBe('protected');
      expect(poem?.retentionEligibleAt).toBeUndefined();
    });
  });

  describe('enablePublicSessionRecapShare', () => {
    it('marks a completed, fully-revealed recap public for participants', async () => {
      const t = setupConvexTest();
      const { gameId, roomId, poemId } = await seedRoom(t, { revealed: true });

      await asUser(t, 'owner').mutation(
        api.shares.enablePublicSessionRecapShare,
        {
          roomCode: 'ABCD',
        }
      );

      const game = await t.run((ctx) => ctx.db.get(gameId));
      const room = await t.run((ctx) => ctx.db.get(roomId));
      const poem = await t.run((ctx) => ctx.db.get(poemId));
      expect(game?.publicRecapEnabled).toBe(true);
      expect(typeof game?.publicRecapEnabledAt).toBe('number');
      expect(game?.retentionState).toBe('protected');
      expect(room?.retentionState).toBe('protected');
      expect(poem?.retentionState).toBe('protected');
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
      const { gameId, roomId, poemId } = await seedRoom(t, {
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
      const room = await t.run((ctx) => ctx.db.get(roomId));
      const poem = await t.run((ctx) => ctx.db.get(poemId));
      expect(game?.publicRecapEnabled).toBe(false);
      expect(typeof game?.publicRecapDisabledAt).toBe('number');
      expect(game?.retentionState).toBe('pending');
      expect(room?.retentionState).toBe('pending');
      expect(poem?.retentionState).toBe('pending');
    });
  });

  describe('inert native-share publication', () => {
    it('keeps a prepared slug private until activation', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);
      const pending = await asUser(t, 'owner').mutation(
        api.shares.preparePublicPoemShare,
        { poemId }
      );

      expect(
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: pending.slug,
        })
      ).toBeNull();
      expect(
        await t.query(api.poems.getPublicPoemShareStatus, {
          shareSlug: pending.slug,
        })
      ).toMatchObject({ state: 'pending' });

      await asUser(t, 'owner').mutation(api.shares.activatePublicPoemShare, {
        poemId,
        slug: pending.slug,
        nonce: pending.nonce,
      });
      expect(
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: pending.slug,
        })
      ).not.toBeNull();
      await asUser(t, 'owner').mutation(api.shares.disablePublicPoemShare, {
        poemId,
      });
      expect(
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: pending.slug,
        })
      ).toBeNull();
      expect(await t.query(api.poems.getPublicPoemFull, { poemId })).toBeNull();
      expect(
        await t.query(api.poems.getPublicPoemShareStatus, {
          shareSlug: pending.slug,
        })
      ).toMatchObject({ state: 'expired' });
    });

    it('returns missing for an unknown share slug', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t, { publicShareEnabled: true });
      expect(
        await t.query(api.poems.getPublicPoemShareStatus, {
          shareSlug: 'unknown-slug',
        })
      ).toEqual({ state: 'missing' });
      expect(
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: 'unknown-slug',
        })
      ).toBeNull();
    });

    it('does not let an inactive slug inherit another public generation', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t, { publicShareEnabled: true });
      const pending = await asUser(t, 'owner').mutation(
        api.shares.preparePublicPoemShare,
        { poemId }
      );

      expect(
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: pending.slug,
        })
      ).toBeNull();
      expect(
        await t.query(api.poems.getPublicPoemPreview, {
          poemId,
          shareSlug: pending.slug,
        })
      ).toBeNull();
    });

    it('only activates the winning generation in a double-share race', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);
      const owner = asUser(t, 'owner');
      const first = await owner.mutation(api.shares.preparePublicPoemShare, {
        poemId,
      });
      const second = await owner.mutation(api.shares.preparePublicPoemShare, {
        poemId,
      });

      const staleActivation = await owner.mutation(
        api.shares.activatePublicPoemShare,
        { poemId, slug: first.slug, nonce: first.nonce }
      );
      expect(staleActivation).toMatchObject({
        publicShareEnabled: false,
        changed: false,
      });
      expect(
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: first.slug,
        })
      ).toBeNull();

      await owner.mutation(api.shares.activatePublicPoemShare, {
        poemId,
        slug: second.slug,
        nonce: second.nonce,
      });
      expect(
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: second.slug,
        })
      ).not.toBeNull();
      expect(
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: first.slug,
        })
      ).toBeNull();
    });

    it('rejects activation with a stale nonce without mutating the pending share', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);
      const pending = await asUser(t, 'owner').mutation(
        api.shares.preparePublicPoemShare,
        { poemId }
      );

      const result = await asUser(t, 'owner').mutation(
        api.shares.activatePublicPoemShare,
        { poemId, slug: pending.slug, nonce: 'wrong-nonce' }
      );

      expect(result).toMatchObject({
        publicShareEnabled: false,
        changed: false,
      });
      const state = await t.run(async (ctx) => ({
        poem: await ctx.db.get(poemId),
        share: await ctx.db
          .query('shares')
          .withIndex('by_slug', (q) => q.eq('slug', pending.slug))
          .first(),
      }));
      expect(state.poem?.publicShareAttempt).toBe(pending.nonce);
      expect(state.share?.state).toBe('pending');
    });

    it('expires a pending share before activation and clears its attempt', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);
      const pending = await asUser(t, 'owner').mutation(
        api.shares.preparePublicPoemShare,
        { poemId }
      );
      await t.run(async (ctx) => {
        const share = await ctx.db
          .query('shares')
          .withIndex('by_slug', (q) => q.eq('slug', pending.slug))
          .first();
        if (!share) throw new Error('prepared share missing');
        await ctx.db.patch(share._id, { expiresAt: Date.now() - 1 });
      });

      const result = await asUser(t, 'owner').mutation(
        api.shares.activatePublicPoemShare,
        { poemId, slug: pending.slug, nonce: pending.nonce }
      );

      expect(result).toMatchObject({
        publicShareEnabled: false,
        changed: false,
      });
      const state = await t.run(async (ctx) => ({
        poem: await ctx.db.get(poemId),
        share: await ctx.db
          .query('shares')
          .withIndex('by_slug', (q) => q.eq('slug', pending.slug))
          .first(),
      }));
      expect(state.poem?.publicShareAttempt).toBeUndefined();
      expect(state.share?.state).toBe('cancelled');
      expect(
        await t.query(api.poems.getPublicPoemShareStatus, {
          shareSlug: pending.slug,
        })
      ).toMatchObject({ state: 'expired' });
    });

    it('treats reactivation of an active share as an idempotent no-op', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);
      const owner = asUser(t, 'owner');
      const pending = await owner.mutation(api.shares.preparePublicPoemShare, {
        poemId,
      });

      const first = await owner.mutation(api.shares.activatePublicPoemShare, {
        poemId,
        slug: pending.slug,
        nonce: pending.nonce,
      });
      const second = await owner.mutation(api.shares.activatePublicPoemShare, {
        poemId,
        slug: pending.slug,
        nonce: pending.nonce,
      });

      expect(first).toMatchObject({ publicShareEnabled: true, changed: true });
      expect(second).toMatchObject({
        publicShareEnabled: true,
        changed: false,
      });
    });

    it('rejects activation after cancellation', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);
      const pending = await asUser(t, 'owner').mutation(
        api.shares.preparePublicPoemShare,
        { poemId }
      );
      await asUser(t, 'owner').mutation(api.shares.cancelPublicPoemShare, {
        poemId,
        slug: pending.slug,
        nonce: pending.nonce,
      });
      await asUser(t, 'owner').mutation(api.shares.activatePublicPoemShare, {
        poemId,
        slug: pending.slug,
        nonce: pending.nonce,
      });
      expect(
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: pending.slug,
        })
      ).toBeNull();
    });

    it('stale cancellation cannot revoke a newer activated generation', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);
      const owner = asUser(t, 'owner');
      const first = await owner.mutation(api.shares.preparePublicPoemShare, {
        poemId,
      });
      const second = await owner.mutation(api.shares.preparePublicPoemShare, {
        poemId,
      });
      await owner.mutation(api.shares.activatePublicPoemShare, {
        poemId,
        slug: second.slug,
        nonce: second.nonce,
      });
      await owner.mutation(api.shares.cancelPublicPoemShare, {
        poemId,
        slug: first.slug,
        nonce: first.nonce,
      });
      expect(
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: second.slug,
        })
      ).not.toBeNull();
    });
  });

  describe('durable share analytics', () => {
    it('does not expose the retired unauthenticated row-creating mutation', async () => {
      const t = setupConvexTest();
      const { poemId } = await seedRoom(t);
      const retiredLogShare = makeFunctionReference<
        'mutation',
        { poemId: typeof poemId }
      >('shares:logShare');

      await expect(t.mutation(retiredLogShare, { poemId })).rejects.toThrow(
        /no such export/
      );

      const shares = await t.run((ctx) => ctx.db.query('shares').collect());
      expect(shares).toEqual([]);
    });
  });
});
