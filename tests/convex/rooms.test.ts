import { describe, it, expect } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, asUser, seedClerkUser } from '../helpers/convexSeed';
import { signGuestToken } from '../../lib/guestToken';
import {
  ABUSE_RATE_LIMITS,
  type AbuseRateLimitOperation,
  guestBucketRateLimitKey,
} from '../../convex/lib/abuseRateLimit';

/**
 * rooms mutations/queries on the real convex-test engine (backlog 018): real
 * read-your-writes + real auth (Clerk identity), asserting observable DB state
 * and return values instead of mock-call stubs.
 *
 * Covers: createRoom, joinRoom, getRoom, getRoomState, leaveLobby, closeRoom.
 */

/**
 * Seed a LOBBY room owned by `hostClerkName`, with the host already in
 * roomPlayers. Returns the roomId and the real room code.
 */
async function seedLobbyRoom(
  t: T,
  hostClerkName: string,
  hostDisplayName = 'Host'
): Promise<{ roomId: Id<'rooms'>; code: string }> {
  const result = await asUser(t, hostClerkName).mutation(api.rooms.createRoom, {
    displayName: hostDisplayName,
  });
  return { roomId: result.roomId, code: result.code };
}

/**
 * Seed a LOBBY room with an active IN_PROGRESS game attached, so that
 * join/leave/close guards fire correctly.
 */
async function seedRoomWithActiveGame(
  t: T,
  hostClerkName: string,
  guestClerkName: string
): Promise<{ roomId: Id<'rooms'>; code: string }> {
  const hostId = await seedClerkUser(t, hostClerkName, { displayName: 'Host' });
  const guestId = await seedClerkUser(t, guestClerkName, {
    displayName: 'Guest',
  });
  const roomId = await t.run((ctx) =>
    ctx.db.insert('rooms', {
      code: 'XYZW',
      hostUserId: hostId,
      status: 'IN_PROGRESS',
      createdAt: 0,
    })
  );
  await t.run((ctx) =>
    ctx.db.insert('roomPlayers', {
      roomId,
      userId: hostId,
      displayName: 'Host',
      joinedAt: 0,
    })
  );
  await t.run((ctx) =>
    ctx.db.insert('roomPlayers', {
      roomId,
      userId: guestId,
      displayName: 'Guest',
      joinedAt: 1,
    })
  );
  // Insert an IN_PROGRESS game so getActiveGame returns non-null
  await t.run((ctx) =>
    ctx.db.insert('games', {
      roomId,
      status: 'IN_PROGRESS',
      cycle: 1,
      currentRound: 0,
      assignmentMatrix: [[hostId, guestId]],
      createdAt: 0,
    })
  );
  return { roomId, code: 'XYZW' };
}

async function seedExhaustedGuestBucket(
  t: T,
  operation: AbuseRateLimitOperation,
  bucket: string
) {
  await t.run((ctx) =>
    ctx.db.insert('rateLimits', {
      key: guestBucketRateLimitKey(operation, bucket),
      hits: ABUSE_RATE_LIMITS[operation].bucketMax,
      resetTime: Date.now() + ABUSE_RATE_LIMITS[operation].windowMs,
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// createRoom
// ─────────────────────────────────────────────────────────────────────────────

describe('createRoom', () => {
  it('creates room with valid host: LOBBY status, 4-letter code, host in roomPlayers', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'alice', { displayName: 'Alice' });

    const result = await asUser(t, 'alice').mutation(api.rooms.createRoom, {
      displayName: 'Alice',
    });

    expect(result.roomId).toMatch(/^[a-z0-9]+$/); // convex Id
    expect(result.code).toMatch(/^[A-Z]{4}$/);

    // Room row in DB
    const room = await t.run((ctx) => ctx.db.get(result.roomId));
    expect(room?.status).toBe('LOBBY');
    expect(room?.code).toBe(result.code);

    // Host is in roomPlayers with correct displayName
    const players = await t.run((ctx) =>
      ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', result.roomId))
        .collect()
    );
    expect(players).toHaveLength(1);
    expect(players[0].displayName).toBe('Alice');
  });

  it('assigns host as first player in roomPlayers', async () => {
    const t = setupConvexTest();
    const userId = await seedClerkUser(t, 'bob', { displayName: 'Bob' });

    const { roomId } = await asUser(t, 'bob').mutation(api.rooms.createRoom, {
      displayName: 'Bob',
    });

    const players = await t.run((ctx) =>
      ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .collect()
    );
    expect(players).toHaveLength(1);
    expect(players[0].userId).toBe(userId);
  });

  it('returns room ID and code on success', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'carol', { displayName: 'Carol' });

    const result = await asUser(t, 'carol').mutation(api.rooms.createRoom, {
      displayName: 'Carol',
    });

    expect(result).toMatchObject({
      code: expect.stringMatching(/^[A-Z]{4}$/),
      roomId: expect.any(String),
    });
  });

  it('generates unique codes across multiple rooms', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'dave', { displayName: 'Dave' });

    const r1 = await asUser(t, 'dave').mutation(api.rooms.createRoom, {
      displayName: 'Dave',
    });
    const r2 = await asUser(t, 'dave').mutation(api.rooms.createRoom, {
      displayName: 'Dave',
    });

    expect(r1.code).not.toBe(r2.code);
  });

  it('throws when called without authentication', async () => {
    const t = setupConvexTest();

    await expect(
      t.mutation(api.rooms.createRoom, { displayName: 'Anon' })
    ).rejects.toThrow();
  });

  it('enforces rate limit: 4th createRoom within window fails', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'eve', { displayName: 'Eve' });

    // First three succeed
    for (let i = 0; i < 3; i++) {
      await asUser(t, 'eve').mutation(api.rooms.createRoom, {
        displayName: 'Eve',
      });
    }

    // Fourth should be rate-limited
    await expect(
      asUser(t, 'eve').mutation(api.rooms.createRoom, { displayName: 'Eve' })
    ).rejects.toThrow();
  });

  it('rate-limits fresh guest ids that share one signed network bucket', async () => {
    const t = setupConvexTest();
    const bucket = 'guestSession:testCreateBucket1234567890';

    for (let i = 0; i < ABUSE_RATE_LIMITS.createRoom.bucketMax; i++) {
      const guestToken = await signGuestToken(`guest-create-${i}`, {
        sessionId: `session-create-${i}`,
        rateLimitKey: bucket,
      });
      await t.mutation(api.rooms.createRoom, {
        displayName: `Guest ${i}`,
        guestToken,
      });
    }

    const blockedToken = await signGuestToken('guest-create-blocked', {
      sessionId: 'session-create-blocked',
      rateLimitKey: bucket,
    });

    await expect(
      t.mutation(api.rooms.createRoom, {
        displayName: 'Blocked',
        guestToken: blockedToken,
      })
    ).rejects.toThrow('Rate limit exceeded');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// joinRoom
// ─────────────────────────────────────────────────────────────────────────────

describe('joinRoom', () => {
  it('joins room when LOBBY status and adds player to roomPlayers', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'host', { displayName: 'Host' });
    const guestId = await seedClerkUser(t, 'guest', { displayName: 'Guest' });

    const { code, roomId } = await seedLobbyRoom(t, 'host');

    const result = await asUser(t, 'guest').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Guest',
    });

    // Returns the room document
    expect(result._id).toBe(roomId);

    // Guest is now in roomPlayers
    const players = await t.run((ctx) =>
      ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .collect()
    );
    expect(players).toHaveLength(2);
    const guestRow = players.find((p) => p.userId === guestId);
    expect(guestRow).toBeDefined();
    expect(guestRow?.displayName).toBe('Guest');
  });

  it('is idempotent: joining twice does not create a duplicate row', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'host2', { displayName: 'Host2' });
    await seedClerkUser(t, 'joiner2', { displayName: 'Joiner2' });

    const { code, roomId } = await seedLobbyRoom(t, 'host2');

    await asUser(t, 'joiner2').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Joiner2',
    });
    await asUser(t, 'joiner2').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Joiner2',
    });

    const players = await t.run((ctx) =>
      ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .collect()
    );
    expect(players).toHaveLength(2); // host + joiner, no duplicate
  });

  it('throws when room code is invalid', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'nobody', { displayName: 'Nobody' });

    await expect(
      asUser(t, 'nobody').mutation(api.rooms.joinRoom, {
        code: 'ZZZZ',
        displayName: 'Nobody',
      })
    ).rejects.toThrow('Room not found');
  });

  it('throws when a game is in progress', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'late', { displayName: 'Late' });
    const { code } = await seedRoomWithActiveGame(t, 'hosta', 'guesta');

    await expect(
      asUser(t, 'late').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Late',
      })
    ).rejects.toThrow('Cannot join a room with a game in progress');
  });

  it('throws when room is at capacity (8 players)', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'overflow', { displayName: 'Overflow' });

    // Create a lobby room and seed 7 additional players to fill to 8
    const { code, roomId } = await seedLobbyRoom(t, 'overflow');

    await t.run(async (ctx) => {
      for (let i = 0; i < 7; i++) {
        const uid = await ctx.db.insert('users', {
          displayName: `filler${i}`,
          kind: 'human',
          createdAt: 0,
        });
        await ctx.db.insert('roomPlayers', {
          roomId,
          userId: uid,
          displayName: `filler${i}`,
          joinedAt: i,
        });
      }
    });

    // 9th join attempt should fail
    await seedClerkUser(t, 'ninth', { displayName: 'Ninth' });
    await expect(
      asUser(t, 'ninth').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Ninth',
      })
    ).rejects.toThrow('Room is full');
  });

  it('enforces rate limit: 11th join within window fails', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'spammer', { displayName: 'Spammer' });

    // Create 10 different rooms (we need distinct rooms to join)
    // Actually the rate limit is per user, per key joinRoom:<userId>
    // We'll use 10 different host/rooms to verify the real rate limiter fires
    for (let i = 0; i < 10; i++) {
      await seedClerkUser(t, `rhost${i}`, { displayName: `RHost${i}` });
      const { code } = await seedLobbyRoom(t, `rhost${i}`);
      await asUser(t, 'spammer').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Spammer',
      });
    }

    // 11th join — now rate limited
    await seedClerkUser(t, 'rhost10', { displayName: 'RHost10' });
    const { code: code11 } = await seedLobbyRoom(t, 'rhost10');
    await expect(
      asUser(t, 'spammer').mutation(api.rooms.joinRoom, {
        code: code11,
        displayName: 'Spammer',
      })
    ).rejects.toThrow();
  });

  it('rate-limits guest joins by signed network bucket before room lookup', async () => {
    const t = setupConvexTest();
    const bucket = 'guestSession:testJoinBucket1234567890';
    await seedExhaustedGuestBucket(t, 'joinRoom', bucket);
    const guestToken = await signGuestToken('guest-join-blocked', {
      sessionId: 'session-join-blocked',
      rateLimitKey: bucket,
    });

    await expect(
      t.mutation(api.rooms.joinRoom, {
        code: 'NOPE',
        displayName: 'Blocked Joiner',
        guestToken,
      })
    ).rejects.toThrow('Rate limit exceeded');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRoom
// ─────────────────────────────────────────────────────────────────────────────

describe('getRoom', () => {
  it('returns room data (with live status) for a participant', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'hostg', { displayName: 'HostG' });

    const { code, roomId } = await seedLobbyRoom(t, 'hostg');

    const result = await asUser(t, 'hostg').query(api.rooms.getRoom, { code });

    // Participant gets the full room document (the { code, status } branch is
    // for non-participants only).
    if (!result || !('_id' in result)) {
      throw new Error('expected the participant room view');
    }
    expect(result._id).toBe(roomId);
    expect(result.status).toBe('LOBBY');
    expect(result.code).toBe(code);
  });

  it('returns null when not authenticated (no identity, no guestToken)', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'hostg2', { displayName: 'HostG2' });
    const { code } = await seedLobbyRoom(t, 'hostg2');

    const result = await t.query(api.rooms.getRoom, { code });
    expect(result).toBeNull();
  });

  it('returns null when room not found', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'hostg3', { displayName: 'HostG3' });

    const result = await asUser(t, 'hostg3').query(api.rooms.getRoom, {
      code: 'ZZZZ',
    });
    expect(result).toBeNull();
  });

  it('returns limited data for non-participant in a LOBBY room that is not full', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'hosta2', { displayName: 'HostA2' });
    await seedClerkUser(t, 'outsider', { displayName: 'Outsider' });

    const { code } = await seedLobbyRoom(t, 'hosta2');

    // outsider is authenticated but not a roomPlayer
    const result = await asUser(t, 'outsider').query(api.rooms.getRoom, {
      code,
    });

    // Only code + status, not the full room doc
    expect(result).toEqual({ code: code, status: 'LOBBY' });
    // Confirm the full _id is NOT on the wire
    expect((result as Record<string, unknown>)?._id).toBeUndefined();
  });

  it('returns null for non-participant when a game is in progress', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'latecomer', { displayName: 'Latecomer' });
    const { code } = await seedRoomWithActiveGame(t, 'hostb', 'guestb');

    const result = await asUser(t, 'latecomer').query(api.rooms.getRoom, {
      code,
    });
    expect(result).toBeNull();
  });

  it('returns null for non-participant when room is full (8 players)', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'hostfull', { displayName: 'HostFull' });
    await seedClerkUser(t, 'viewer', { displayName: 'Viewer' });

    const { code, roomId } = await seedLobbyRoom(t, 'hostfull');

    // Pack to 8 total
    await t.run(async (ctx) => {
      for (let i = 0; i < 7; i++) {
        const uid = await ctx.db.insert('users', {
          displayName: `seat${i}`,
          kind: 'human',
          createdAt: 0,
        });
        await ctx.db.insert('roomPlayers', {
          roomId,
          userId: uid,
          displayName: `seat${i}`,
          joinedAt: i,
        });
      }
    });

    const result = await asUser(t, 'viewer').query(api.rooms.getRoom, { code });
    expect(result).toBeNull();
  });

  it('normalizes code to uppercase before lookup', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'hostc', { displayName: 'HostC' });

    const { code, roomId } = await seedLobbyRoom(t, 'hostc');
    const lower = code.toLowerCase();

    // Query with lowercase — should still find the room
    const result = await asUser(t, 'hostc').query(api.rooms.getRoom, {
      code: lower,
    });
    if (!result || !('_id' in result)) {
      throw new Error('expected the participant room view');
    }
    expect(result._id).toBe(roomId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRoomState
// ─────────────────────────────────────────────────────────────────────────────

describe('getRoomState', () => {
  it('returns room, players, and isHost=true for the host', async () => {
    const t = setupConvexTest();
    const hostId = await seedClerkUser(t, 'shost', { displayName: 'SHost' });

    const { code, roomId } = await seedLobbyRoom(t, 'shost', 'SHost');

    const result = await asUser(t, 'shost').query(api.rooms.getRoomState, {
      code,
    });

    expect(result).not.toBeNull();
    expect(result?.isHost).toBe(true);
    expect(result?.room._id).toBe(roomId);
    expect(result?.room.status).toBe('LOBBY');

    // Players array has one entry for the host
    expect(result?.players).toHaveLength(1);
    const p = result?.players[0];
    expect(p?.userId).toBe(hostId);
    expect(p?.displayName).toBe('SHost');
    // stableId should be clerkUserId (set during seedUser)
    expect(p?.stableId).toBe('clerk_shost');
    expect(p?.isBot).toBe(false);
    // lastSeenAt must NOT appear on the wire
    expect(p).not.toHaveProperty('lastSeenAt');
    // isAway: no heartbeat → stale
    expect(p?.isAway).toBe(true);
  });

  it('returns isHost=false for a non-host participant', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'roomhost', { displayName: 'RoomHost' });
    await seedClerkUser(t, 'roomguest', { displayName: 'RoomGuest' });

    const { code } = await seedLobbyRoom(t, 'roomhost');
    await asUser(t, 'roomguest').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'RoomGuest',
    });

    const result = await asUser(t, 'roomguest').query(api.rooms.getRoomState, {
      code,
    });
    expect(result?.isHost).toBe(false);
  });

  it('includes all players in the players array', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'h', { displayName: 'H' });
    await seedClerkUser(t, 'p1', { displayName: 'P1' });
    await seedClerkUser(t, 'p2', { displayName: 'P2' });

    const { code } = await seedLobbyRoom(t, 'h', 'H');
    await asUser(t, 'p1').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'P1',
    });
    await asUser(t, 'p2').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'P2',
    });

    const result = await asUser(t, 'h').query(api.rooms.getRoomState, { code });
    expect(result?.players).toHaveLength(3);
    const names = result?.players.map((p) => p.displayName);
    expect(names).toContain('H');
    expect(names).toContain('P1');
    expect(names).toContain('P2');
  });

  it('returns null when room not found', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'rsnf', { displayName: 'RsNF' });

    const result = await asUser(t, 'rsnf').query(api.rooms.getRoomState, {
      code: 'ZZZZ',
    });
    expect(result).toBeNull();
  });

  it('returns null when not authenticated', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'rshost', { displayName: 'RSHost' });
    const { code } = await seedLobbyRoom(t, 'rshost');

    const result = await t.query(api.rooms.getRoomState, { code });
    expect(result).toBeNull();
  });

  it('returns null when authenticated user is not a participant', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'rshost2', { displayName: 'RSHost2' });
    await seedClerkUser(t, 'rsnone', { displayName: 'RSNone' });

    const { code } = await seedLobbyRoom(t, 'rshost2');

    // rsnone is authenticated but never joined the room
    const result = await asUser(t, 'rsnone').query(api.rooms.getRoomState, {
      code,
    });
    expect(result).toBeNull();
  });

  it('does not expose lastSeenAt on any player', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'hearthost', { displayName: 'HeartHost' });
    const { code, roomId } = await seedLobbyRoom(t, 'hearthost');

    // Stamp a lastSeenAt on the player row (simulating a heartbeat)
    await t.run(async (ctx) => {
      const rp = await ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .first();
      if (rp) await ctx.db.patch(rp._id, { lastSeenAt: Date.now() });
    });

    const result = await asUser(t, 'hearthost').query(api.rooms.getRoomState, {
      code,
    });
    for (const player of result?.players ?? []) {
      expect(player).not.toHaveProperty('lastSeenAt');
    }
    // With a fresh heartbeat, isAway should be false
    expect(result?.players[0].isAway).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// leaveLobby
// ─────────────────────────────────────────────────────────────────────────────

describe('leaveLobby', () => {
  it('deletes roomPlayer record when a non-host leaves', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'leavehost', { displayName: 'LeaveHost' });
    const guestId = await seedClerkUser(t, 'leaveguest', {
      displayName: 'LeaveGuest',
    });

    const { code, roomId } = await seedLobbyRoom(t, 'leavehost');
    await asUser(t, 'leaveguest').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'LeaveGuest',
    });

    await asUser(t, 'leaveguest').mutation(api.rooms.leaveLobby, {
      roomCode: code,
    });

    const rows = await t.run((ctx) =>
      ctx.db
        .query('roomPlayers')
        .withIndex('by_room_user', (q) =>
          q.eq('roomId', roomId).eq('userId', guestId)
        )
        .collect()
    );
    expect(rows).toHaveLength(0);
  });

  it('does nothing when the host tries to leave (host is protected)', async () => {
    const t = setupConvexTest();
    const hostId = await seedClerkUser(t, 'lhost', { displayName: 'LHost' });

    const { code, roomId } = await seedLobbyRoom(t, 'lhost', 'LHost');

    await asUser(t, 'lhost').mutation(api.rooms.leaveLobby, { roomCode: code });

    const rows = await t.run((ctx) =>
      ctx.db
        .query('roomPlayers')
        .withIndex('by_room_user', (q) =>
          q.eq('roomId', roomId).eq('userId', hostId)
        )
        .collect()
    );
    expect(rows).toHaveLength(1); // host row still present
  });

  it('does nothing when a game is in progress', async () => {
    const t = setupConvexTest();
    const { code } = await seedRoomWithActiveGame(t, 'lghost', 'lgguest');

    // lgguest tries to leave during an active game — should be a no-op
    const before = await t.run((ctx) => ctx.db.query('roomPlayers').collect());

    await asUser(t, 'lgguest').mutation(api.rooms.leaveLobby, {
      roomCode: code,
    });

    const after = await t.run((ctx) => ctx.db.query('roomPlayers').collect());
    expect(after).toHaveLength(before.length);
  });

  it('does nothing when user is not authenticated', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'lhostna', { displayName: 'LHostNA' });
    const { code } = await seedLobbyRoom(t, 'lhostna');

    const before = await t.run((ctx) => ctx.db.query('roomPlayers').collect());

    // unauthenticated call — should be a no-op, not throw
    await t.mutation(api.rooms.leaveLobby, { roomCode: code });

    const after = await t.run((ctx) => ctx.db.query('roomPlayers').collect());
    expect(after).toHaveLength(before.length);
  });

  it('does nothing when room not found', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'lhostrnf', { displayName: 'LHostRNF' });

    // Should silently return (null/undefined), not throw
    await expect(
      asUser(t, 'lhostrnf').mutation(api.rooms.leaveLobby, { roomCode: 'ZZZZ' })
    ).resolves.toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectGameMode
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// closeRoom
// ─────────────────────────────────────────────────────────────────────────────

describe('closeRoom', () => {
  it('marks room as COMPLETED and removes all players when host closes', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'closehost', { displayName: 'CloseHost' });
    await seedClerkUser(t, 'closeguest', { displayName: 'CloseGuest' });

    const { code, roomId } = await seedLobbyRoom(t, 'closehost', 'CloseHost');
    await asUser(t, 'closeguest').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'CloseGuest',
    });

    await asUser(t, 'closehost').mutation(api.rooms.closeRoom, {
      roomCode: code,
    });

    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(room?.status).toBe('COMPLETED');

    const players = await t.run((ctx) =>
      ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .collect()
    );
    expect(players).toHaveLength(0);
  });

  it('throws when a non-host tries to close the room', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'nchosta', { displayName: 'NCHostA' });
    await seedClerkUser(t, 'ncguest', { displayName: 'NCGuest' });

    const { code } = await seedLobbyRoom(t, 'nchosta');
    await asUser(t, 'ncguest').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'NCGuest',
    });

    await expect(
      asUser(t, 'ncguest').mutation(api.rooms.closeRoom, { roomCode: code })
    ).rejects.toThrow('Only the host can close the room');
  });

  it('throws when a game is in progress', async () => {
    const t = setupConvexTest();
    const { code } = await seedRoomWithActiveGame(t, 'crhost', 'crguest');

    await expect(
      asUser(t, 'crhost').mutation(api.rooms.closeRoom, { roomCode: code })
    ).rejects.toThrow('Cannot close room while game is in progress');
  });

  it('throws when caller is not authenticated', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'crhostna', { displayName: 'CRHostNA' });
    const { code } = await seedLobbyRoom(t, 'crhostna');

    await expect(
      t.mutation(api.rooms.closeRoom, { roomCode: code })
    ).rejects.toThrow('Not authenticated');
  });
});
