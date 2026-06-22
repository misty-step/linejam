import { describe, it, expect } from 'vitest';
import { api } from '../../convex/_generated/api';
import { setupConvexTest } from '../helpers/convexTest';
import { signGuestToken } from '../../lib/guestToken';
import { type T, asUser, seedUser } from '../helpers/convexSeed';

/**
 * migrateGuestToUser on the real convex-test engine (backlog 018): real
 * read-your-writes, real auth (Clerk identity via t.withIdentity), and real
 * HMAC guest-token verification — asserting observable DB state instead of
 * mock-call stubs.
 *
 * Guest tokens are signed with lib/guestToken.signGuestToken, which uses the
 * same DEV_FALLBACK_SECRET as convex/lib/guestToken.verifyGuestToken, so they
 * round-trip without any env var.
 */

/** Seed a guest user and return { guestUserId, guestToken }. */
async function seedGuestUser(
  t: T,
  guestId: string,
  displayName = 'Guest'
): Promise<{
  guestUserId: import('../../convex/_generated/dataModel').Id<'users'>;
  guestToken: string;
}> {
  const guestToken = await signGuestToken(guestId);
  const guestUserId = await seedUser(t, { displayName, guestId });
  return { guestUserId, guestToken };
}

describe('migrateGuestToUser', () => {
  it('throws Not authenticated when no Clerk identity is present', async () => {
    const t = setupConvexTest();
    const guestToken = await signGuestToken('guest-unauthed');

    await expect(
      t.mutation(api.migrations.migrateGuestToUser, { guestToken })
    ).rejects.toThrow('Not authenticated');
  });

  it('throws Invalid guest token when the token is malformed', async () => {
    const t = setupConvexTest();

    await expect(
      asUser(t, 'alice').mutation(api.migrations.migrateGuestToUser, {
        guestToken: 'not-a-valid-token',
      })
    ).rejects.toThrow('Invalid guest token');
  });

  it('returns alreadyMigrated when a migrations row already exists for the clerk user', async () => {
    const t = setupConvexTest();
    const { guestUserId, guestToken } = await seedGuestUser(t, 'guest-dup');
    // Pre-insert a migrations row so the handler short-circuits.
    await t.run((ctx) =>
      ctx.db.insert('migrations', {
        guestUserId,
        clerkUserId: 'clerk_alice',
        migratedAt: 1000,
      })
    );

    const result = await asUser(t, 'alice').mutation(
      api.migrations.migrateGuestToUser,
      { guestToken }
    );

    expect(result).toEqual({ alreadyMigrated: true });
    // Migrations row count unchanged (still exactly one).
    const rows = await t.run((ctx) =>
      ctx.db
        .query('migrations')
        .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_alice'))
        .collect()
    );
    expect(rows).toHaveLength(1);
  });

  it('throws Guest user not found when no user record exists for the guestId', async () => {
    const t = setupConvexTest();
    // Token is valid but there is no matching guest user row in the DB.
    const guestToken = await signGuestToken('guest-missing');

    await expect(
      asUser(t, 'bob').mutation(api.migrations.migrateGuestToUser, {
        guestToken,
      })
    ).rejects.toThrow('Guest user not found');
  });

  it('returns alreadyMigrated when the Clerk user record IS the guest record (same _id)', async () => {
    const t = setupConvexTest();
    // Create a user that already has the Clerk subject stamped — no guest record.
    await seedUser(t, { displayName: 'Carol', clerkUserId: 'clerk_carol' });
    // We need a guestId token that resolves to the same user. Since ensureUserHelper
    // will find the user by Clerk identity and return the same _id, both branches
    // collapse to alreadyMigrated. But we still need a guest user row for the first
    // lookup (by_guest index). Instead, create a guest row that resolves to the
    // clerk user indirectly by having the same _id is impossible — test the
    // structurally identical path: same _id means guestUser IS the auth user.
    //
    // The actual code path `authUser._id === guestUser._id` triggers when
    // ensureUserHelper returns the guest user itself (no Clerk row exists yet, so
    // getUser via Clerk identity returns null, then a new Clerk user is inserted —
    // this cannot produce the same _id). The safest coverage is via a guest row
    // whose clerkUserId is also set — i.e., a hybrid row — because getUser will
    // find it via the Clerk index and ensureUserHelper returns it, which IS the
    // guest row.
    const guestId = 'guest-hybrid';
    const guestToken = await signGuestToken(guestId);
    // Insert a user that has BOTH clerkUserId AND guestId — a previously migrated
    // hybrid. getUser will find it via by_clerk; ensureUserHelper returns it.
    // The migration then sees authUser._id === guestUser._id.
    await seedUser(t, {
      displayName: 'Hybrid',
      guestId,
      clerkUserId: 'clerk_hybrid',
    });

    const result = await asUser(t, 'hybrid').mutation(
      api.migrations.migrateGuestToUser,
      { guestToken }
    );

    expect(result).toEqual({ alreadyMigrated: true });
  });

  it('migrates guest user: patches lines, favorites, and roomPlayers to the clerk user', async () => {
    const t = setupConvexTest();
    const { guestUserId, guestToken } = await seedGuestUser(
      t,
      'guest-migrate',
      'Migrating Guest'
    );

    // Seed a room with the guest as a player.
    const { roomId, poemId } = await t.run(async (ctx) => {
      const hostId = await ctx.db.insert('users', {
        displayName: 'Host',
        kind: 'human',
        createdAt: 0,
      });
      const rId = await ctx.db.insert('rooms', {
        code: 'MGRM',
        hostUserId: hostId,
        status: 'COMPLETED',
        createdAt: 0,
      });
      const gameId = await ctx.db.insert('games', {
        roomId: rId,
        status: 'COMPLETED',
        cycle: 1,
        currentRound: 0,
        assignmentMatrix: [],
        createdAt: 0,
      });
      const pId = await ctx.db.insert('poems', {
        roomId: rId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
      });
      return { roomId: rId, poemId: pId };
    });

    // Insert a line, a favorite, and a roomPlayer owned by the guest.
    const { lineId, favoriteId, roomPlayerId } = await t.run(async (ctx) => {
      const lId = await ctx.db.insert('lines', {
        poemId,
        indexInPoem: 0,
        text: 'hello world',
        wordCount: 2,
        authorUserId: guestUserId,
        createdAt: 0,
      });
      const fId = await ctx.db.insert('favorites', {
        userId: guestUserId,
        poemId,
        createdAt: 0,
      });
      const rpId = await ctx.db.insert('roomPlayers', {
        roomId,
        userId: guestUserId,
        displayName: 'Migrating Guest',
        joinedAt: 0,
      });
      return { lineId: lId, favoriteId: fId, roomPlayerId: rpId };
    });

    const result = await asUser(t, 'dave').mutation(
      api.migrations.migrateGuestToUser,
      { guestToken }
    );

    // Return value reports transfer counts.
    expect(result).toMatchObject({
      success: true,
      linesTransferred: 1,
      favoritesTransferred: 1,
      roomsTransferred: 1,
    });

    // Re-read DB state and verify the Clerk user owns the assets.
    await t.run(async (ctx) => {
      const clerkUser = await ctx.db
        .query('users')
        .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_dave'))
        .first();
      expect(clerkUser).not.toBeNull();
      const clerkId = clerkUser!._id;

      // Guest user row is deleted.
      const deletedGuest = await ctx.db.get(guestUserId);
      expect(deletedGuest).toBeNull();

      // Line re-assigned.
      const line = await ctx.db.get(lineId);
      expect(line?.authorUserId).toBe(clerkId);

      // Favorite re-assigned.
      const fav = await ctx.db.get(favoriteId);
      expect(fav?.userId).toBe(clerkId);

      // RoomPlayer re-assigned.
      const rp = await ctx.db.get(roomPlayerId);
      expect(rp?.userId).toBe(clerkId);

      // Migrations row recorded.
      const migration = await ctx.db
        .query('migrations')
        .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_dave'))
        .first();
      expect(migration).not.toBeNull();
      expect(migration?.guestUserId).toBe(guestUserId);
      expect(typeof migration?.migratedAt).toBe('number');
    });
  });

  it('migration is idempotent: re-running returns alreadyMigrated and does not double-insert rows', async () => {
    const t = setupConvexTest();
    const { guestToken } = await seedGuestUser(t, 'guest-idem', 'Idem Guest');

    // First run succeeds.
    const first = await asUser(t, 'eve').mutation(
      api.migrations.migrateGuestToUser,
      { guestToken }
    );
    expect(first).toMatchObject({ success: true });

    // Second run short-circuits.
    const second = await asUser(t, 'eve').mutation(
      api.migrations.migrateGuestToUser,
      { guestToken }
    );
    expect(second).toEqual({ alreadyMigrated: true });

    // Still exactly one migrations row.
    const rows = await t.run((ctx) =>
      ctx.db
        .query('migrations')
        .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_eve'))
        .collect()
    );
    expect(rows).toHaveLength(1);
  });

  it('migrates with zero associated assets (empty lines/favorites/roomPlayers)', async () => {
    const t = setupConvexTest();
    const { guestToken } = await seedGuestUser(t, 'guest-empty', 'Empty Guest');

    const result = await asUser(t, 'frank').mutation(
      api.migrations.migrateGuestToUser,
      { guestToken }
    );

    expect(result).toMatchObject({
      success: true,
      linesTransferred: 0,
      favoritesTransferred: 0,
      roomsTransferred: 0,
    });

    // Guest user deleted, Clerk user created, migrations row recorded.
    await t.run(async (ctx) => {
      const clerkUser = await ctx.db
        .query('users')
        .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_frank'))
        .first();
      expect(clerkUser).not.toBeNull();

      const migration = await ctx.db
        .query('migrations')
        .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_frank'))
        .first();
      expect(migration).not.toBeNull();
    });
  });
});
