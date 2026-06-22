import { describe, it, expect } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';

/**
 * rooms mutations/queries on the real convex-test engine (backlog 018): real
 * read-your-writes + real auth (Clerk identity), asserting observable DB state
 * and return values instead of mock-call stubs.
 *
 * Covers: createRoom, joinRoom, getRoom, getRoomState, leaveLobby, closeRoom,
 * selectGameMode.
 */

type T = ReturnType<typeof setupConvexTest>;

/** Seed a Clerk user row directly and return its _id. */
async function seedUser(
  t: T,
  clerkName: string,
  displayName = clerkName
): Promise<Id<'users'>> {
  return t.run((ctx) =>
    ctx.db.insert('users', {
      displayName,
      kind: 'human',
      clerkUserId: `clerk_${clerkName}`,
      createdAt: 0,
    })
  );
}

/** Run a mutation/query as a named Clerk user. */
const as = (t: T, clerkName: string) =>
  t.withIdentity({ subject: `clerk_${clerkName}` });

/**
 * Seed a LOBBY room owned by `hostClerkName`, with the host already in
 * roomPlayers. Returns the roomId and the real room code.
 */
async function seedLobbyRoom(
  t: T,
  hostClerkName: string,
  hostDisplayName = 'Host'
): Promise<{ roomId: Id<'rooms'>; code: string }> {
  const result = await as(t, hostClerkName).mutation(api.rooms.createRoom, {
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
  const hostId = await seedUser(t, hostClerkName, 'Host');
  const guestId = await seedUser(t, guestClerkName, 'Guest');
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
      mode: 'classic',
      currentRound: 0,
      assignmentMatrix: [[hostId, guestId]],
      createdAt: 0,
    })
  );
  return { roomId, code: 'XYZW' };
}

// ─────────────────────────────────────────────────────────────────────────────
// createRoom
// ─────────────────────────────────────────────────────────────────────────────

describe('createRoom', () => {
  it('creates room with valid host: LOBBY status, 4-letter code, host in roomPlayers', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'alice', 'Alice');

    const result = await as(t, 'alice').mutation(api.rooms.createRoom, {
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
    const userId = await seedUser(t, 'bob', 'Bob');

    const { roomId } = await as(t, 'bob').mutation(api.rooms.createRoom, {
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
    await seedUser(t, 'carol', 'Carol');

    const result = await as(t, 'carol').mutation(api.rooms.createRoom, {
      displayName: 'Carol',
    });

    expect(result).toMatchObject({
      code: expect.stringMatching(/^[A-Z]{4}$/),
      roomId: expect.any(String),
    });
  });

  it('generates unique codes across multiple rooms', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'dave', 'Dave');

    const r1 = await as(t, 'dave').mutation(api.rooms.createRoom, {
      displayName: 'Dave',
    });
    const r2 = await as(t, 'dave').mutation(api.rooms.createRoom, {
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
    await seedUser(t, 'eve', 'Eve');

    // First three succeed
    for (let i = 0; i < 3; i++) {
      await as(t, 'eve').mutation(api.rooms.createRoom, {
        displayName: 'Eve',
      });
    }

    // Fourth should be rate-limited
    await expect(
      as(t, 'eve').mutation(api.rooms.createRoom, { displayName: 'Eve' })
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// joinRoom
// ─────────────────────────────────────────────────────────────────────────────

describe('joinRoom', () => {
  it('joins room when LOBBY status and adds player to roomPlayers', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'host', 'Host');
    const guestId = await seedUser(t, 'guest', 'Guest');

    const { code, roomId } = await seedLobbyRoom(t, 'host');

    const result = await as(t, 'guest').mutation(api.rooms.joinRoom, {
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
    await seedUser(t, 'host2', 'Host2');
    await seedUser(t, 'joiner2', 'Joiner2');

    const { code, roomId } = await seedLobbyRoom(t, 'host2');

    await as(t, 'joiner2').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Joiner2',
    });
    await as(t, 'joiner2').mutation(api.rooms.joinRoom, {
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
    await seedUser(t, 'nobody', 'Nobody');

    await expect(
      as(t, 'nobody').mutation(api.rooms.joinRoom, {
        code: 'ZZZZ',
        displayName: 'Nobody',
      })
    ).rejects.toThrow('Room not found');
  });

  it('throws when a game is in progress', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'late', 'Late');
    const { code } = await seedRoomWithActiveGame(t, 'hosta', 'guesta');

    await expect(
      as(t, 'late').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Late',
      })
    ).rejects.toThrow('Cannot join a room with a game in progress');
  });

  it('throws when room is at capacity (8 players)', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'overflow', 'Overflow');

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
    await seedUser(t, 'ninth', 'Ninth');
    await expect(
      as(t, 'ninth').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Ninth',
      })
    ).rejects.toThrow('Room is full');
  });

  it('enforces rate limit: 11th join within window fails', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'spammer', 'Spammer');

    // Create 10 different rooms (we need distinct rooms to join)
    // Actually the rate limit is per user, per key joinRoom:<userId>
    // We'll use 10 different host/rooms to verify the real rate limiter fires
    for (let i = 0; i < 10; i++) {
      await seedUser(t, `rhost${i}`, `RHost${i}`);
      const { code } = await seedLobbyRoom(t, `rhost${i}`);
      await as(t, 'spammer').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Spammer',
      });
    }

    // 11th join — now rate limited
    await seedUser(t, 'rhost10', 'RHost10');
    const { code: code11 } = await seedLobbyRoom(t, 'rhost10');
    await expect(
      as(t, 'spammer').mutation(api.rooms.joinRoom, {
        code: code11,
        displayName: 'Spammer',
      })
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRoom
// ─────────────────────────────────────────────────────────────────────────────

describe('getRoom', () => {
  it('returns room data (with live status) for a participant', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'hostg', 'HostG');

    const { code, roomId } = await seedLobbyRoom(t, 'hostg');

    const result = await as(t, 'hostg').query(api.rooms.getRoom, { code });

    expect(result?._id).toBe(roomId);
    expect(result?.status).toBe('LOBBY');
    expect(result?.code).toBe(code);
  });

  it('returns null when not authenticated (no identity, no guestToken)', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'hostg2', 'HostG2');
    const { code } = await seedLobbyRoom(t, 'hostg2');

    const result = await t.query(api.rooms.getRoom, { code });
    expect(result).toBeNull();
  });

  it('returns null when room not found', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'hostg3', 'HostG3');

    const result = await as(t, 'hostg3').query(api.rooms.getRoom, {
      code: 'ZZZZ',
    });
    expect(result).toBeNull();
  });

  it('returns limited data for non-participant in a LOBBY room that is not full', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'hosta2', 'HostA2');
    await seedUser(t, 'outsider', 'Outsider');

    const { code } = await seedLobbyRoom(t, 'hosta2');

    // outsider is authenticated but not a roomPlayer
    const result = await as(t, 'outsider').query(api.rooms.getRoom, { code });

    // Only code + status, not the full room doc
    expect(result).toEqual({ code: code, status: 'LOBBY' });
    // Confirm the full _id is NOT on the wire
    expect((result as Record<string, unknown>)?._id).toBeUndefined();
  });

  it('returns null for non-participant when a game is in progress', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'latecomer', 'Latecomer');
    const { code } = await seedRoomWithActiveGame(t, 'hostb', 'guestb');

    const result = await as(t, 'latecomer').query(api.rooms.getRoom, {
      code,
    });
    expect(result).toBeNull();
  });

  it('returns null for non-participant when room is full (8 players)', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'hostfull', 'HostFull');
    await seedUser(t, 'viewer', 'Viewer');

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

    const result = await as(t, 'viewer').query(api.rooms.getRoom, { code });
    expect(result).toBeNull();
  });

  it('normalizes code to uppercase before lookup', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'hostc', 'HostC');

    const { code, roomId } = await seedLobbyRoom(t, 'hostc');
    const lower = code.toLowerCase();

    // Query with lowercase — should still find the room
    const result = await as(t, 'hostc').query(api.rooms.getRoom, {
      code: lower,
    });
    expect(result?._id).toBe(roomId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRoomState
// ─────────────────────────────────────────────────────────────────────────────

describe('getRoomState', () => {
  it('returns room, players, and isHost=true for the host', async () => {
    const t = setupConvexTest();
    const hostId = await seedUser(t, 'shost', 'SHost');

    const { code, roomId } = await seedLobbyRoom(t, 'shost', 'SHost');

    const result = await as(t, 'shost').query(api.rooms.getRoomState, { code });

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
    await seedUser(t, 'roomhost', 'RoomHost');
    await seedUser(t, 'roomguest', 'RoomGuest');

    const { code } = await seedLobbyRoom(t, 'roomhost');
    await as(t, 'roomguest').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'RoomGuest',
    });

    const result = await as(t, 'roomguest').query(api.rooms.getRoomState, {
      code,
    });
    expect(result?.isHost).toBe(false);
  });

  it('includes all players in the players array', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'h', 'H');
    await seedUser(t, 'p1', 'P1');
    await seedUser(t, 'p2', 'P2');

    const { code } = await seedLobbyRoom(t, 'h', 'H');
    await as(t, 'p1').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'P1',
    });
    await as(t, 'p2').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'P2',
    });

    const result = await as(t, 'h').query(api.rooms.getRoomState, { code });
    expect(result?.players).toHaveLength(3);
    const names = result?.players.map((p) => p.displayName);
    expect(names).toContain('H');
    expect(names).toContain('P1');
    expect(names).toContain('P2');
  });

  it('returns null when room not found', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'rsnf', 'RsNF');

    const result = await as(t, 'rsnf').query(api.rooms.getRoomState, {
      code: 'ZZZZ',
    });
    expect(result).toBeNull();
  });

  it('returns null when not authenticated', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'rshost', 'RSHost');
    const { code } = await seedLobbyRoom(t, 'rshost');

    const result = await t.query(api.rooms.getRoomState, { code });
    expect(result).toBeNull();
  });

  it('returns null when authenticated user is not a participant', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'rshost2', 'RSHost2');
    await seedUser(t, 'rsnone', 'RSNone');

    const { code } = await seedLobbyRoom(t, 'rshost2');

    // rsnone is authenticated but never joined the room
    const result = await as(t, 'rsnone').query(api.rooms.getRoomState, {
      code,
    });
    expect(result).toBeNull();
  });

  it('does not expose lastSeenAt on any player', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'hearthost', 'HeartHost');
    const { code, roomId } = await seedLobbyRoom(t, 'hearthost');

    // Stamp a lastSeenAt on the player row (simulating a heartbeat)
    await t.run(async (ctx) => {
      const rp = await ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .first();
      if (rp) await ctx.db.patch(rp._id, { lastSeenAt: Date.now() });
    });

    const result = await as(t, 'hearthost').query(api.rooms.getRoomState, {
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
    await seedUser(t, 'leavehost', 'LeaveHost');
    const guestId = await seedUser(t, 'leaveguest', 'LeaveGuest');

    const { code, roomId } = await seedLobbyRoom(t, 'leavehost');
    await as(t, 'leaveguest').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'LeaveGuest',
    });

    await as(t, 'leaveguest').mutation(api.rooms.leaveLobby, {
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
    const hostId = await seedUser(t, 'lhost', 'LHost');

    const { code, roomId } = await seedLobbyRoom(t, 'lhost', 'LHost');

    await as(t, 'lhost').mutation(api.rooms.leaveLobby, { roomCode: code });

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

    await as(t, 'lgguest').mutation(api.rooms.leaveLobby, { roomCode: code });

    const after = await t.run((ctx) => ctx.db.query('roomPlayers').collect());
    expect(after).toHaveLength(before.length);
  });

  it('does nothing when user is not authenticated', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'lhostna', 'LHostNA');
    const { code } = await seedLobbyRoom(t, 'lhostna');

    const before = await t.run((ctx) => ctx.db.query('roomPlayers').collect());

    // unauthenticated call — should be a no-op, not throw
    await t.mutation(api.rooms.leaveLobby, { roomCode: code });

    const after = await t.run((ctx) => ctx.db.query('roomPlayers').collect());
    expect(after).toHaveLength(before.length);
  });

  it('does nothing when room not found', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'lhostrnf', 'LHostRNF');

    // Should silently return (null/undefined), not throw
    await expect(
      as(t, 'lhostrnf').mutation(api.rooms.leaveLobby, { roomCode: 'ZZZZ' })
    ).resolves.toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectGameMode
// ─────────────────────────────────────────────────────────────────────────────

describe('selectGameMode', () => {
  it('lets the host pick a mode in the lobby: DB row reflects selection', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'modehost', 'ModeHost');

    const { code, roomId } = await seedLobbyRoom(t, 'modehost');

    await as(t, 'modehost').mutation(api.rooms.selectGameMode, {
      roomCode: code,
      mode: 'rhyme',
    });

    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(room?.selectedMode).toBe('rhyme');
  });

  it('rejects mode change by a non-host participant', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'modehosta', 'ModeHostA');
    await seedUser(t, 'modeguest', 'ModeGuest');

    const { code } = await seedLobbyRoom(t, 'modehosta');
    await as(t, 'modeguest').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'ModeGuest',
    });

    await expect(
      as(t, 'modeguest').mutation(api.rooms.selectGameMode, {
        roomCode: code,
        mode: 'quick',
      })
    ).rejects.toThrow('Only host can pick the game mode');
  });

  it('rejects mode change while a game is in progress', async () => {
    const t = setupConvexTest();
    const { code } = await seedRoomWithActiveGame(t, 'modehostb', 'modeguestb');

    await expect(
      as(t, 'modehostb').mutation(api.rooms.selectGameMode, {
        roomCode: code,
        mode: 'quick',
      })
    ).rejects.toThrow('Cannot change mode while a game is in progress');
  });

  it('rejects mode change when user is not authenticated', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'modehostc', 'ModeHostC');
    const { code } = await seedLobbyRoom(t, 'modehostc');

    await expect(
      t.mutation(api.rooms.selectGameMode, {
        roomCode: code,
        mode: 'quick',
      })
    ).rejects.toThrow('User not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// closeRoom
// ─────────────────────────────────────────────────────────────────────────────

describe('closeRoom', () => {
  it('marks room as COMPLETED and removes all players when host closes', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'closehost', 'CloseHost');
    await seedUser(t, 'closeguest', 'CloseGuest');

    const { code, roomId } = await seedLobbyRoom(t, 'closehost', 'CloseHost');
    await as(t, 'closeguest').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'CloseGuest',
    });

    await as(t, 'closehost').mutation(api.rooms.closeRoom, { roomCode: code });

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
    await seedUser(t, 'nchosta', 'NCHostA');
    await seedUser(t, 'ncguest', 'NCGuest');

    const { code } = await seedLobbyRoom(t, 'nchosta');
    await as(t, 'ncguest').mutation(api.rooms.joinRoom, {
      code,
      displayName: 'NCGuest',
    });

    await expect(
      as(t, 'ncguest').mutation(api.rooms.closeRoom, { roomCode: code })
    ).rejects.toThrow('Only the host can close the room');
  });

  it('throws when a game is in progress', async () => {
    const t = setupConvexTest();
    const { code } = await seedRoomWithActiveGame(t, 'crhost', 'crguest');

    await expect(
      as(t, 'crhost').mutation(api.rooms.closeRoom, { roomCode: code })
    ).rejects.toThrow('Cannot close room while game is in progress');
  });

  it('throws when caller is not authenticated', async () => {
    const t = setupConvexTest();
    await seedUser(t, 'crhostna', 'CRHostNA');
    const { code } = await seedLobbyRoom(t, 'crhostna');

    await expect(
      t.mutation(api.rooms.closeRoom, { roomCode: code })
    ).rejects.toThrow('Not authenticated');
  });
});
