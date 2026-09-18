import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, seedClerkUser, asUser } from '../helpers/convexSeed';
import { selectNextHostId } from '../../convex/lib/room';
import { HOST_MIGRATION_STALE_MS } from '../../convex/lib/gameRules';

const staleStamp = () => Date.now() - HOST_MIGRATION_STALE_MS - 5_000;

async function seedLivePair(
  t: T,
  hostName: string,
  guestName: string,
  startGame: boolean
): Promise<{
  code: string;
  roomId: Id<'rooms'>;
  gameId: Id<'games'> | null;
  hostId: Id<'users'>;
  guestId: Id<'users'>;
}> {
  await seedClerkUser(t, hostName);
  await seedClerkUser(t, guestName);
  const created = await asUser(t, hostName).mutation(api.rooms.createRoom, {
    displayName: hostName,
  });
  const joined = await asUser(t, guestName).mutation(api.rooms.joinRoom, {
    code: created.code,
    displayName: guestName,
  });
  if (joined.ok === false) throw new Error(joined.message);
  if (startGame) {
    await asUser(t, hostName).mutation(api.game.startGame, {
      code: created.code,
    });
  }
  const ids = await t.run(async (ctx) => {
    const host = await ctx.db
      .query('users')
      .withIndex('by_clerk', (q) => q.eq('clerkUserId', `clerk_${hostName}`))
      .unique();
    const guest = await ctx.db
      .query('users')
      .withIndex('by_clerk', (q) => q.eq('clerkUserId', `clerk_${guestName}`))
      .unique();
    const game = startGame
      ? await ctx.db
          .query('games')
          .withIndex('by_room_status', (q) =>
            q.eq('roomId', created.roomId).eq('status', 'IN_PROGRESS')
          )
          .unique()
      : null;
    return {
      hostId: host!._id,
      guestId: guest!._id,
      gameId: game?._id ?? null,
    };
  });
  return { code: created.code, roomId: created.roomId, ...ids };
}

async function ageHost(t: T, roomId: Id<'rooms'>, lastSeenAt: number) {
  await t.run(async (ctx) => {
    const room = await ctx.db.get(roomId);
    const hostPlayerId = room?.hostPlayerId;
    if (!hostPlayerId) throw new Error('live host missing');
    const member = await ctx.db
      .query('roomMembers')
      .withIndex('by_room_player', (q) =>
        q.eq('roomId', roomId).eq('playerId', hostPlayerId)
      )
      .unique();
    if (!member) throw new Error('host member missing');
    await ctx.db.patch(member._id, { lastSeenAt });
  });
}

const hostOf = (t: T, roomId: Id<'rooms'>) =>
  t.run((ctx) => ctx.db.get(roomId).then((room) => room?.hostUserId));

describe('selectNextHostId (reveal fallback ranking)', () => {
  const now = 10_000_000;
  const fresh = now - 1_000;
  const stale = now - HOST_MIGRATION_STALE_MS - 1_000;
  // SAFETY: Branded ID fixture for pure ranking of reveal fallback candidates.
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
          { userId: uid(1), seatIndex: 0, lastSeenAt: stale },
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
    const { roomId, gameId, code, hostId, guestId } = await seedLivePair(
      t,
      'host',
      'guest',
      true
    );
    await ageHost(t, roomId, staleStamp());

    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: code,
    });
    expect(await hostOf(t, roomId)).toBe(guestId);

    await expect(
      asUser(t, 'host').mutation(api.game.endGame, { roomCode: code })
    ).rejects.toThrow('Only host can end game');
    await asUser(t, 'guest').mutation(api.game.endGame, { roomCode: code });
    const game = await t.run((ctx) => ctx.db.get(gameId!));
    expect(game?.status).toBe('ABANDONED');
    expect(hostId).not.toBe(guestId);
  });

  it('does not migrate a host whose join timestamp is still fresh', async () => {
    const t = setupConvexTest();
    const { roomId, code, hostId } = await seedLivePair(
      t,
      'host',
      'guest',
      true
    );

    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: code,
    });
    expect(await hostOf(t, roomId)).toBe(hostId);
  });

  it('also heals a stale lobby host', async () => {
    const t = setupConvexTest();
    const { roomId, code, guestId } = await seedLivePair(
      t,
      'host',
      'guest',
      false
    );
    await ageHost(t, roomId, staleStamp());

    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: code,
    });
    expect(await hostOf(t, roomId)).toBe(guestId);
  });

  it('gives the migrated host close-room agency; the old host gets nothing', async () => {
    const t = setupConvexTest();
    const { roomId, gameId, code, guestId } = await seedLivePair(
      t,
      'host',
      'guest',
      true
    );
    await ageHost(t, roomId, staleStamp());
    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: code,
    });
    expect(await hostOf(t, roomId)).toBe(guestId);

    await t.run(async (ctx) => {
      await ctx.db.patch(gameId!, { status: 'COMPLETED' });
      await ctx.db.patch(roomId, { status: 'COMPLETED' });
    });

    await expect(
      asUser(t, 'host').mutation(api.rooms.closeRoom, { roomCode: code })
    ).rejects.toThrow('Only the host can close the room');
    await asUser(t, 'guest').mutation(api.rooms.closeRoom, { roomCode: code });
    expect(
      await t.run((ctx) => ctx.db.get(roomId)).then((room) => room?.status)
    ).toBe('COMPLETED');
  });

  it('does not migrate while the host is present', async () => {
    const t = setupConvexTest();
    const { roomId, code, hostId } = await seedLivePair(
      t,
      'host',
      'guest',
      true
    );
    await asUser(t, 'host').mutation(api.presence.heartbeat, {
      roomCode: code,
    });
    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: code,
    });
    expect(await hostOf(t, roomId)).toBe(hostId);
  });

  it('is idempotent when the old host returns', async () => {
    const t = setupConvexTest();
    const { roomId, code, guestId } = await seedLivePair(
      t,
      'host',
      'guest',
      true
    );
    await ageHost(t, roomId, staleStamp());
    await asUser(t, 'guest').mutation(api.presence.heartbeat, {
      roomCode: code,
    });
    expect(await hostOf(t, roomId)).toBe(guestId);
    await asUser(t, 'host').mutation(api.presence.heartbeat, {
      roomCode: code,
    });
    expect(await hostOf(t, roomId)).toBe(guestId);
  });
});
