import { describe, it, expect } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
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

type MachineCleanupPhase =
  | 'games'
  | 'lineAttribution'
  | 'roomPlayers'
  | 'readers'
  | 'humanUserFields'
  | 'aiUsers'
  | 'aiTurns'
  | 'aiRoundLocks'
  | 'aiUsage'
  | 'aiGenerationMetrics';

async function runMachineCleanupPhase(t: T, phase: MachineCleanupPhase) {
  const receipts = [];
  let cursor: string | undefined;
  for (let invocation = 0; invocation < 100; invocation++) {
    const receipt = await t.mutation(
      internal.migrations.cleanupMachineAuthorship,
      {
        phase,
        ...(cursor === undefined ? {} : { cursor }),
        ...(phase === 'aiUsers'
          ? { verifiedZeroChangePrerequisites: true as const }
          : {}),
      }
    );
    receipts.push(receipt);
    if (!receipt.remaining) return receipts;
    cursor = receipt.cursor ?? undefined;
  }
  throw new Error(`Machine cleanup phase ${phase} did not terminate`);
}

describe('cleanupMachineAuthorship', () => {
  it('rejects AI deletion without explicit zero-change prerequisite receipts', async () => {
    const t = setupConvexTest();
    const aiUserId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        displayName: 'Archived machine author',
        kind: 'AI',
        createdAt: 0,
      });
      const humanUserId = await ctx.db.insert('users', {
        displayName: 'Human',
        createdAt: 0,
      });
      const roomId = await ctx.db.insert('rooms', {
        code: 'AIGD',
        hostUserId: humanUserId,
        status: 'COMPLETED',
        createdAt: 0,
      });
      const gameId = await ctx.db.insert('games', {
        roomId,
        status: 'COMPLETED',
        cycle: 1,
        currentRound: 8,
        assignmentMatrix: [],
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
        indexInPoem: 0,
        text: 'uncaptured machine line',
        wordCount: 3,
        authorUserId: userId,
        createdAt: 0,
      });
      return userId;
    });

    await expect(
      t.mutation(internal.migrations.cleanupMachineAuthorship, {
        phase: 'aiUsers',
      })
    ).rejects.toThrow(
      'AI user cleanup requires verified zero-change prerequisite receipts'
    );
    expect(await t.run((ctx) => ctx.db.get(aiUserId))).not.toBeNull();
  });

  it('converts terminal state in bounded batches and is idempotent', async () => {
    const t = setupConvexTest();
    await t.run(async (ctx) => {
      const hostUserId = await ctx.db.insert('users', {
        displayName: 'Host',
        createdAt: 0,
      });
      const roomId = await ctx.db.insert('rooms', {
        code: 'MCLN',
        hostUserId,
        status: 'COMPLETED',
        createdAt: 0,
      });
      for (let index = 0; index < 65; index++) {
        await ctx.db.insert('games', {
          roomId,
          status: 'COMPLETED',
          completionKind: index === 0 ? 'abandoned' : 'normal',
          cycle: index + 1,
          currentRound: 8,
          assignmentMatrix: [],
          createdAt: index,
        });
      }
    });

    const receipts = await runMachineCleanupPhase(t, 'games');
    expect(receipts).toHaveLength(2);
    expect(receipts[0]).toMatchObject({
      phase: 'games',
      scanned: 64,
      changed: 64,
      remaining: true,
    });
    expect(receipts[1]).toMatchObject({
      scanned: 1,
      changed: 1,
      remaining: false,
      cursor: null,
    });

    const games = await t.run((ctx) => ctx.db.query('games').collect());
    expect(games.find((game) => game.createdAt === 0)?.status).toBe(
      'ABANDONED'
    );
    expect(games.every((game) => game.completionKind === undefined)).toBe(true);
    expect(
      games
        .filter((game) => game.createdAt > 0)
        .every((game) => game.status === 'COMPLETED')
    ).toBe(true);

    const postcondition = await runMachineCleanupPhase(t, 'games');
    expect(
      postcondition.reduce((sum, receipt) => sum + receipt.changed, 0)
    ).toBe(0);
  });

  it('revokes publication and protection when reclassifying legacy abandonment', async () => {
    const t = setupConvexTest();
    const seeded = await t.run(async (ctx) => {
      const hostUserId = await ctx.db.insert('users', {
        displayName: 'Host',
        createdAt: 0,
      });
      const roomId = await ctx.db.insert('rooms', {
        code: 'AIPR',
        hostUserId,
        status: 'COMPLETED',
        completedAt: 200,
        retentionState: 'protected',
        createdAt: 0,
      });
      await ctx.db.insert('roomPlayers', {
        roomId,
        userId: hostUserId,
        displayName: 'Host',
        joinedAt: 0,
      });
      const gameId = await ctx.db.insert('games', {
        roomId,
        status: 'COMPLETED',
        completionKind: 'abandoned',
        cycle: 1,
        currentRound: 4,
        assignmentMatrix: [],
        completedAt: 200,
        publicRecapEnabled: true,
        publicRecapEnabledAt: 200,
        retentionState: 'protected',
        createdAt: 0,
      });
      await ctx.db.patch(roomId, { currentGameId: gameId });
      const poemId = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        publicShareEnabled: true,
        publicShareEnabledAt: 200,
        publicShareAttempt: 'legacy-attempt',
        retentionState: 'protected',
        createdAt: 0,
      });
      return { gameId, poemId, roomId };
    });

    await runMachineCleanupPhase(t, 'games');

    await t.run(async (ctx) => {
      const game = await ctx.db.get(seeded.gameId);
      const room = await ctx.db.get(seeded.roomId);
      const poem = await ctx.db.get(seeded.poemId);
      expect(game).toMatchObject({
        status: 'ABANDONED',
        retentionState: 'pending',
      });
      expect(game).not.toHaveProperty('completionKind');
      expect(game).not.toHaveProperty('publicRecapEnabled');
      expect(game).not.toHaveProperty('publicRecapEnabledAt');
      expect(game?.retentionEligibleAt).toBeGreaterThan(200);
      expect(room).not.toHaveProperty('currentGameId');
      expect(room).not.toHaveProperty('completedAt');
      expect(room).toMatchObject({
        status: 'LOBBY',
        retentionState: 'active',
      });
      expect(room).not.toHaveProperty('retentionEligibleAt');
      expect(poem).not.toHaveProperty('publicShareEnabled');
      expect(poem).not.toHaveProperty('publicShareEnabledAt');
      expect(poem).not.toHaveProperty('publicShareAttempt');
      expect(poem).toMatchObject({ retentionState: 'pending' });
      expect(poem?.retentionEligibleAt).toBe(game?.retentionEligibleAt);
    });
  });

  it('keeps a legacy-abandoned room closed when only AI memberships remain', async () => {
    const t = setupConvexTest();
    const roomId = await t.run(async (ctx) => {
      const aiUserId = await ctx.db.insert('users', {
        displayName: 'Legacy AI host',
        kind: 'AI',
        createdAt: 0,
      });
      const id = await ctx.db.insert('rooms', {
        code: 'AION',
        hostUserId: aiUserId,
        status: 'COMPLETED',
        completedAt: 200,
        createdAt: 0,
      });
      await ctx.db.insert('roomPlayers', {
        roomId: id,
        userId: aiUserId,
        displayName: 'Legacy AI host',
        joinedAt: 0,
      });
      const gameId = await ctx.db.insert('games', {
        roomId: id,
        status: 'COMPLETED',
        completionKind: 'abandoned',
        cycle: 1,
        currentRound: 4,
        assignmentMatrix: [],
        completedAt: 200,
        createdAt: 0,
      });
      await ctx.db.patch(id, { currentGameId: gameId });
      return id;
    });

    await runMachineCleanupPhase(t, 'games');
    await runMachineCleanupPhase(t, 'roomPlayers');

    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(room).not.toHaveProperty('currentGameId');
    expect(room).toMatchObject({
      status: 'COMPLETED',
      retentionState: 'pending',
    });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('roomPlayers')
          .withIndex('by_room', (q) => q.eq('roomId', roomId))
          .collect()
      )
    ).toEqual([]);
  });

  it('abandons active games whose immutable matrix contains an AI user', async () => {
    const t = setupConvexTest();
    const seeded = await t.run(async (ctx) => {
      const humanUserId = await ctx.db.insert('users', {
        displayName: 'Human',
        kind: 'human',
        createdAt: 0,
      });
      const aiUserId = await ctx.db.insert('users', {
        displayName: 'Legacy AI',
        kind: 'AI',
        createdAt: 0,
      });
      const roomId = await ctx.db.insert('rooms', {
        code: 'AIGM',
        hostUserId: humanUserId,
        status: 'IN_PROGRESS',
        createdAt: 0,
      });
      const gameId = await ctx.db.insert('games', {
        roomId,
        status: 'IN_PROGRESS',
        cycle: 1,
        currentRound: 0,
        assignmentMatrix: [[humanUserId, aiUserId]],
        createdAt: 0,
      });
      await ctx.db.patch(roomId, { currentGameId: gameId });
      const poemId = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
      });
      return { gameId, poemId, roomId };
    });

    await runMachineCleanupPhase(t, 'games');

    await t.run(async (ctx) => {
      expect(await ctx.db.get(seeded.gameId)).toMatchObject({
        status: 'ABANDONED',
        retentionState: 'pending',
      });
      expect(await ctx.db.get(seeded.gameId)).not.toHaveProperty(
        'completionKind'
      );
      expect(await ctx.db.get(seeded.roomId)).toMatchObject({
        status: 'LOBBY',
      });
      expect(await ctx.db.get(seeded.roomId)).not.toHaveProperty(
        'currentGameId'
      );
      expect(await ctx.db.get(seeded.poemId)).toMatchObject({
        retentionState: 'pending',
      });
    });
  });

  it('captures honest AI attribution before deleting AI identities', async () => {
    const t = setupConvexTest();
    const seeded = await t.run(async (ctx) => {
      const humanUserId = await ctx.db.insert('users', {
        displayName: 'Human',
        kind: 'human',
        aiPersonaId: 'stale-persona',
        createdAt: 0,
      });
      const aiUserId = await ctx.db.insert('users', {
        displayName: 'Bashō',
        kind: 'AI',
        aiPersonaId: 'bashō',
        createdAt: 0,
      });
      const roomId = await ctx.db.insert('rooms', {
        code: 'ATTR',
        hostUserId: humanUserId,
        status: 'COMPLETED',
        createdAt: 0,
      });
      const gameId = await ctx.db.insert('games', {
        roomId,
        status: 'COMPLETED',
        cycle: 1,
        currentRound: 8,
        assignmentMatrix: [],
        createdAt: 0,
      });
      const poemId = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        assignedReaderId: aiUserId,
        createdAt: 0,
      });
      const missingAttributionLineId = await ctx.db.insert('lines', {
        poemId,
        indexInPoem: 0,
        text: 'old machine line',
        wordCount: 3,
        authorUserId: aiUserId,
        createdAt: 0,
      });
      const capturedAttributionLineId = await ctx.db.insert('lines', {
        poemId,
        indexInPoem: 1,
        text: 'captured old machine line',
        wordCount: 4,
        authorUserId: aiUserId,
        authorDisplayName: 'Original bot byline',
        createdAt: 1,
      });
      await ctx.db.insert('roomPlayers', {
        roomId,
        userId: aiUserId,
        displayName: 'Bashō',
        joinedAt: 0,
      });
      return {
        humanUserId,
        aiUserId,
        poemId,
        missingAttributionLineId,
        capturedAttributionLineId,
      };
    });

    const prematureDelete = await runMachineCleanupPhase(t, 'aiUsers');
    expect(
      prematureDelete.reduce((sum, receipt) => sum + receipt.blocked, 0)
    ).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(seeded.aiUserId))).not.toBeNull();

    await runMachineCleanupPhase(t, 'lineAttribution');
    const attributionPostcondition = await runMachineCleanupPhase(
      t,
      'lineAttribution'
    );
    expect(
      attributionPostcondition.reduce(
        (sum, receipt) => sum + receipt.changed,
        0
      )
    ).toBe(0);
    await runMachineCleanupPhase(t, 'roomPlayers');
    await runMachineCleanupPhase(t, 'readers');
    await runMachineCleanupPhase(t, 'humanUserFields');
    await runMachineCleanupPhase(t, 'aiUsers');

    await t.run(async (ctx) => {
      expect(await ctx.db.get(seeded.aiUserId)).toBeNull();
      const humanUser = await ctx.db.get(seeded.humanUserId);
      expect(humanUser).toMatchObject({ displayName: 'Human' });
      expect(humanUser).not.toHaveProperty('kind');
      expect(humanUser).not.toHaveProperty('aiPersonaId');
      const poem = await ctx.db.get(seeded.poemId);
      expect(poem).not.toHaveProperty('assignedReaderId');
      expect(await ctx.db.get(seeded.missingAttributionLineId)).toMatchObject({
        authorUserId: seeded.aiUserId,
        authorDisplayName: 'Bashō (legacy machine)',
      });
      expect(await ctx.db.get(seeded.capturedAttributionLineId)).toMatchObject({
        authorDisplayName: 'Original bot byline (legacy machine)',
      });
      expect(await ctx.db.query('roomPlayers').collect()).toHaveLength(0);
    });

    for (const phase of [
      'roomPlayers',
      'readers',
      'humanUserFields',
      'aiUsers',
    ] as const) {
      const receipts = await runMachineCleanupPhase(t, phase);
      expect(receipts.reduce((sum, receipt) => sum + receipt.changed, 0)).toBe(
        0
      );
      expect(receipts.reduce((sum, receipt) => sum + receipt.blocked, 0)).toBe(
        0
      );
    }
  });

  it('empties every legacy AI table and returns zero postconditions', async () => {
    const t = setupConvexTest();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        displayName: 'Legacy AI',
        kind: 'AI',
        createdAt: 0,
      });
      const roomId = await ctx.db.insert('rooms', {
        code: 'AIZR',
        hostUserId: userId,
        status: 'COMPLETED',
        createdAt: 0,
      });
      const gameId = await ctx.db.insert('games', {
        roomId,
        status: 'COMPLETED',
        cycle: 1,
        currentRound: 8,
        assignmentMatrix: [],
        createdAt: 0,
      });
      const poemId = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
      });
      await Promise.all([
        ctx.db.insert('aiTurns', {
          roomId,
          gameId,
          poemId,
          round: 0,
          aiUserId: userId,
          day: '2026-01-01',
          status: 'authorized',
          claimedAt: 0,
          updatedAt: 0,
        }),
        ctx.db.insert('aiRoundLocks', {
          roomId,
          gameId,
          round: 0,
          owner: 'legacy',
          status: 'finished',
          claimedAt: 0,
          updatedAt: 0,
        }),
        ctx.db.insert('aiUsage', {
          day: '2026-01-01',
          generationClaims: 1,
          httpAttempts: 1,
          fallbacks: 0,
          updatedAt: 0,
        }),
        ctx.db.insert('aiGenerationMetrics', {
          bucketStart: 0,
          totalGenerations: 1,
          fallbackGenerations: 0,
          budgetExhaustion: 0,
          providerError: 0,
          invalidOutput: 0,
          missingConfiguration: 0,
          updatedAt: 0,
        }),
      ]);
    });

    for (const phase of [
      'aiTurns',
      'aiRoundLocks',
      'aiUsage',
      'aiGenerationMetrics',
    ] as const) {
      const receipts = await runMachineCleanupPhase(t, phase);
      expect(receipts.reduce((sum, receipt) => sum + receipt.changed, 0)).toBe(
        1
      );
      const zeroReceipt = await runMachineCleanupPhase(t, phase);
      expect(zeroReceipt).toEqual([
        {
          phase,
          scanned: 0,
          changed: 0,
          blocked: 0,
          remaining: false,
          cursor: null,
        },
      ]);
    }
  });
});
