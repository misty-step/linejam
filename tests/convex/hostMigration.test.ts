import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, seedClerkUser, asUser } from '../helpers/convexSeed';
import { selectNextHostId } from '../../convex/lib/room';
import {
  HOST_MIGRATION_STALE_MS,
  WORD_COUNTS,
} from '../../convex/lib/gameRules';

/**
 * A present participant's heartbeat promotes them when the current host is
 * stale, preserving access to host-only lifecycle actions.
 */

/** A lastSeenAt comfortably past the host-migration staleness threshold. */
const staleStamp = () => Date.now() - HOST_MIGRATION_STALE_MS - 5_000;

type SeatPlayer = {
  name: string;
  seatIndex: number;
  lastSeenAt?: number;
};

/** Seed an IN_PROGRESS classic game with explicit seats and presence. */
async function seedGame(
  t: T,
  players: SeatPlayer[]
): Promise<{
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  userIds: Id<'users'>[];
}> {
  const userIds: Id<'users'>[] = [];
  for (const player of players) {
    userIds.push(await seedClerkUser(t, player.name));
  }

  const roomId = await t.run((ctx) =>
    ctx.db.insert('rooms', {
      code: 'ABCD',
      hostUserId: userIds[0],
      status: 'IN_PROGRESS',
      createdAt: 0,
    })
  );

  await Promise.all(
    players.map((p, i) =>
      t.run((ctx) =>
        ctx.db.insert('roomPlayers', {
          roomId,
          userId: userIds[i],
          displayName: p.name,
          seatIndex: p.seatIndex,
          joinedAt: i,
          lastSeenAt: p.lastSeenAt,
        })
      )
    )
  );

  const n = userIds.length;
  const matrix: Id<'users'>[][] = [];
  for (let r = 0; r < WORD_COUNTS.length; r++) {
    matrix.push(
      Array.from({ length: n }, (_, poem) => userIds[(poem + r) % n])
    );
  }

  const roundStartedAt = Date.now();
  const gameId = await t.run((ctx) =>
    ctx.db.insert('games', {
      roomId,
      status: 'IN_PROGRESS',
      cycle: 1,
      currentRound: 0,
      roundStartedAt,
      assignmentMatrix: matrix,
      createdAt: 0,
    })
  );
  await Promise.all(
    userIds.map((_, i) =>
      t.run((ctx) =>
        ctx.db.insert('poems', { roomId, gameId, indexInRoom: i, createdAt: 0 })
      )
    )
  );

  return { roomId, gameId, userIds };
}

/** Seed a LOBBY room (no game yet) with explicit presence per player. */
async function seedLobby(
  t: T,
  players: { name: string; seatIndex?: number; lastSeenAt?: number }[]
): Promise<{ roomId: Id<'rooms'>; userIds: Id<'users'>[] }> {
  const userIds: Id<'users'>[] = [];
  for (const p of players) userIds.push(await seedClerkUser(t, p.name));
  const roomId = await t.run((ctx) =>
    ctx.db.insert('rooms', {
      code: 'ABCD',
      hostUserId: userIds[0],
      status: 'LOBBY',
      createdAt: 0,
    })
  );
  await Promise.all(
    players.map((p, i) =>
      t.run((ctx) =>
        ctx.db.insert('roomPlayers', {
          roomId,
          userId: userIds[i],
          displayName: p.name,
          seatIndex: p.seatIndex,
          joinedAt: i,
          lastSeenAt: p.lastSeenAt,
        })
      )
    )
  );
  return { roomId, userIds };
}

const hostOf = (t: T, roomId: Id<'rooms'>) =>
  t.run((ctx) => ctx.db.get(roomId).then((r) => r?.hostUserId));

describe('selectNextHostId (deterministic next-host rule)', () => {
  const now = 10_000_000;
  const fresh = now - 1_000;
  const stale = now - HOST_MIGRATION_STALE_MS - 1_000;
  const uid = (n: number) => `user_${n}` as Id<'users'>;

  it('picks the present human with the lowest seatIndex', () => {
    expect(
      selectNextHostId(
        [
          { userId: uid(1), seatIndex: 2, lastSeenAt: fresh },
          { userId: uid(2), seatIndex: 0, lastSeenAt: fresh },
          { userId: uid(3), seatIndex: 1, lastSeenAt: fresh },
        ],
        now,
        HOST_MIGRATION_STALE_MS
      )
    ).toBe(uid(2));
  });

  it('skips stale humans even at a lower seat', () => {
    expect(
      selectNextHostId(
        [
          { userId: uid(1), seatIndex: 0, lastSeenAt: stale }, // away
          { userId: uid(2), seatIndex: 1, lastSeenAt: fresh },
        ],
        now,
        HOST_MIGRATION_STALE_MS
      )
    ).toBe(uid(2));
  });

  it('returns null when no human is present', () => {
    expect(
      selectNextHostId(
        [{ userId: uid(1), seatIndex: 0, lastSeenAt: stale }],
        now,
        HOST_MIGRATION_STALE_MS
      )
    ).toBeNull();
  });

  it('sorts undefined seatIndex last', () => {
    expect(
      selectNextHostId(
        [
          { userId: uid(1), seatIndex: undefined, lastSeenAt: fresh },
          { userId: uid(2), seatIndex: 5, lastSeenAt: fresh },
        ],
        now,
        HOST_MIGRATION_STALE_MS
      )
    ).toBe(uid(2));
  });
});

describe('host migration via heartbeat (real engine)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('promotes a present participant when the host is stale, restoring agency', async () => {
    const t = setupConvexTest();
    const { roomId, gameId, userIds } = await seedGame(t, [
      { name: 'host', seatIndex: 0, lastSeenAt: staleStamp() },
      { name: 'guest', seatIndex: 1, lastSeenAt: Date.now() },
    ]);

    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: 'ABCD',
    });
    expect(await hostOf(t, roomId)).toBe(userIds[1]);

    await expect(
      asUser(t, 'host').mutation(api.game.endGame, { roomCode: 'ABCD' })
    ).rejects.toThrow('Only host can end game');
    await asUser(t, 'guest').mutation(api.game.endGame, {
      roomCode: 'ABCD',
    });
    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('ABANDONED');
  });

  it('does not migrate a host who has never heartbeat (fresh room, not yet stale)', async () => {
    const t = setupConvexTest();
    // The host just created the room and has not heartbeat yet (undefined
    // lastSeenAt). A guest joining and heartbeating first must NOT steal host.
    const { roomId, userIds } = await seedGame(t, [
      { name: 'host', seatIndex: 0, lastSeenAt: undefined },
      { name: 'guest', seatIndex: 1, lastSeenAt: Date.now() },
    ]);

    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: 'ABCD',
    });

    expect(await hostOf(t, roomId)).toBe(userIds[0]); // host kept
  });

  it('does not migrate in a lobby (no active game) when the host steps away', async () => {
    const t = setupConvexTest();
    // Host heartbeat once then went stale while the lobby gathered; a guest
    // waits and heartbeats. With no game in progress there is no agency to
    // strand, so a guest must not be able to seize the room before kickoff.
    const { roomId, userIds } = await seedLobby(t, [
      { name: 'host', seatIndex: 0, lastSeenAt: staleStamp() },
      { name: 'guest', seatIndex: 1, lastSeenAt: Date.now() },
    ]);

    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: 'ABCD',
    });

    expect(await hostOf(t, roomId)).toBe(userIds[0]); // host keeps the room
  });

  it('gives the migrated host close-room agency once the game ends; the old host gets nothing', async () => {
    const t = setupConvexTest();
    const { roomId, gameId, userIds } = await seedGame(t, [
      { name: 'host', seatIndex: 0, lastSeenAt: staleStamp() },
      { name: 'guest', seatIndex: 1, lastSeenAt: Date.now() },
    ]);

    // Mid-game: the present guest's heartbeat promotes them to host.
    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: 'ABCD',
    });
    expect(await hostOf(t, roomId)).toBe(userIds[1]);

    // The game ends; the room returns to a (rematch) lobby, host still the guest.
    await t.run(async (ctx) => {
      await ctx.db.patch(gameId, { status: 'COMPLETED' });
      await ctx.db.patch(roomId, { status: 'COMPLETED' });
    });

    // The departed old host has no host power…
    await expect(
      asUser(t, 'host').mutation(api.rooms.closeRoom, { roomCode: 'ABCD' })
    ).rejects.toThrow('Only the host can close the room');

    // …and the new host can close the room.
    await asUser(t, 'guest').mutation(api.rooms.closeRoom, {
      roomCode: 'ABCD',
    });
    expect(
      await t.run((ctx) => ctx.db.get(roomId)).then((r) => r?.status)
    ).toBe('COMPLETED');
  });

  it('does not migrate while the host is present', async () => {
    const t = setupConvexTest();
    const { roomId, userIds } = await seedGame(t, [
      { name: 'host', seatIndex: 0, lastSeenAt: Date.now() }, // present
      { name: 'guest', seatIndex: 1, lastSeenAt: Date.now() },
    ]);

    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: 'ABCD',
    });

    expect(await hostOf(t, roomId)).toBe(userIds[0]); // unchanged
  });

  it('is idempotent and does not thrash when the old host returns', async () => {
    const t = setupConvexTest();
    const { roomId, userIds } = await seedGame(t, [
      { name: 'host', seatIndex: 0, lastSeenAt: staleStamp() },
      { name: 'guest', seatIndex: 1, lastSeenAt: Date.now() },
    ]);

    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: 'ABCD',
    });
    expect(await hostOf(t, roomId)).toBe(userIds[1]);

    // The old host returns mid-game and heartbeats — they regain nothing; the
    // present guest stays host (migration only fires when the host is stale).
    await asUser(t, 'host').mutation(api.presence.heartbeat, {
      roomCode: 'ABCD',
    });
    expect(await hostOf(t, roomId)).toBe(userIds[1]);
  });
});
