import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';

/**
 * Room lifecycle on the real convex-test engine (backlog 018): real
 * read-your-writes + real auth (Clerk identity), asserting observable DB state
 * and return values instead of mock-call stubs.
 *
 * Covers: createRoom, joinRoom, startGame, startNewCycle, getRoomState.
 * Guard paths (throw cases) exercise the real mutation logic — not mocked handlers.
 */

type T = ReturnType<typeof setupConvexTest>;

/** Seed a Clerk user row and return its _id. */
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

/** Convenience: run as the named Clerk subject. */
const as = (t: T, clerkName: string) =>
  t.withIdentity({ subject: `clerk_${clerkName}` });

/**
 * Seed a COMPLETED room owned by 'clerk_host' with two participants and a
 * completed game, ready for startNewCycle.
 */
async function seedCompletedRoom(
  t: T,
  {
    hostClerkName = 'host',
    guestClerkName = 'guest',
  }: { hostClerkName?: string; guestClerkName?: string } = {}
): Promise<{
  hostId: Id<'users'>;
  guestId: Id<'users'>;
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
}> {
  return t.run(async (ctx) => {
    const hostId = await ctx.db.insert('users', {
      displayName: 'Host',
      kind: 'human',
      clerkUserId: `clerk_${hostClerkName}`,
      createdAt: 0,
    });
    const guestId = await ctx.db.insert('users', {
      displayName: 'Guest',
      kind: 'human',
      clerkUserId: `clerk_${guestClerkName}`,
      createdAt: 0,
    });
    const roomId = await ctx.db.insert('rooms', {
      code: 'ABCD',
      hostUserId: hostId,
      status: 'COMPLETED',
      createdAt: 0,
    });
    await ctx.db.insert('roomPlayers', {
      roomId,
      userId: hostId,
      displayName: 'Host',
      joinedAt: 0,
    });
    await ctx.db.insert('roomPlayers', {
      roomId,
      userId: guestId,
      displayName: 'Guest',
      joinedAt: 1,
    });
    const gameId = await ctx.db.insert('games', {
      roomId,
      status: 'COMPLETED',
      cycle: 1,
      mode: 'classic',
      currentRound: 8,
      assignmentMatrix: [[hostId, guestId]],
      createdAt: 0,
    });
    return { hostId, guestId, roomId, gameId };
  });
}

describe('room lifecycle', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // createRoom
  // ──────────────────────────────────────────────────────────────────────────
  describe('createRoom', () => {
    it('creates a room with LOBBY status and the caller as host', async () => {
      const t = setupConvexTest();
      await seedUser(t, 'alice');

      const result = await as(t, 'alice').mutation(api.rooms.createRoom, {
        displayName: 'Alice',
      });

      expect(typeof result.code).toBe('string');
      expect(result.code).toHaveLength(4);
      expect(typeof result.roomId).toBe('string');

      const room = await t.run((ctx) => ctx.db.get(result.roomId));
      expect(room?.status).toBe('LOBBY');
      expect(room?.code).toBe(result.code);

      // Creator is in roomPlayers
      const players = await t.run((ctx) =>
        ctx.db
          .query('roomPlayers')
          .withIndex('by_room', (q) => q.eq('roomId', result.roomId))
          .collect()
      );
      expect(players).toHaveLength(1);
      expect(players[0].displayName).toBe('Alice');
    });

    it('throws when no identity is provided', async () => {
      const t = setupConvexTest();

      await expect(
        t.mutation(api.rooms.createRoom, { displayName: 'Anon' })
      ).rejects.toThrow();
    });

    it('generates unique codes across multiple rooms', async () => {
      const t = setupConvexTest();
      await seedUser(t, 'bob');

      const r1 = await as(t, 'bob').mutation(api.rooms.createRoom, {
        displayName: 'Bob',
      });
      const r2 = await as(t, 'bob').mutation(api.rooms.createRoom, {
        displayName: 'Bob',
      });

      expect(r1.code).not.toBe(r2.code);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // joinRoom
  // ──────────────────────────────────────────────────────────────────────────
  describe('joinRoom', () => {
    it('adds the caller as a roomPlayers row in an existing LOBBY room', async () => {
      const t = setupConvexTest();
      await seedUser(t, 'host');
      await seedUser(t, 'joiner');

      const { code, roomId } = await as(t, 'host').mutation(
        api.rooms.createRoom,
        { displayName: 'Host' }
      );

      await as(t, 'joiner').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Joiner',
      });

      const players = await t.run((ctx) =>
        ctx.db
          .query('roomPlayers')
          .withIndex('by_room', (q) => q.eq('roomId', roomId))
          .collect()
      );
      expect(players).toHaveLength(2);
      const names = players.map((p) => p.displayName);
      expect(names).toContain('Joiner');
    });

    it('is idempotent when the same user joins twice', async () => {
      const t = setupConvexTest();
      await seedUser(t, 'host2');
      await seedUser(t, 'joiner2');

      const { code, roomId } = await as(t, 'host2').mutation(
        api.rooms.createRoom,
        { displayName: 'Host2' }
      );

      await as(t, 'joiner2').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Joiner2',
      });
      // Second join should not duplicate the row
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
      expect(players).toHaveLength(2);
    });

    it('throws when the room does not exist', async () => {
      const t = setupConvexTest();
      await seedUser(t, 'nobody');

      await expect(
        as(t, 'nobody').mutation(api.rooms.joinRoom, {
          code: 'ZZZZ',
          displayName: 'Nobody',
        })
      ).rejects.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // startGame
  // ──────────────────────────────────────────────────────────────────────────
  describe('startGame', () => {
    it('transitions a LOBBY room to IN_PROGRESS with poems and assignment matrix', async () => {
      const t = setupConvexTest();
      await seedUser(t, 'host3');
      await seedUser(t, 'player3');

      const { code, roomId } = await as(t, 'host3').mutation(
        api.rooms.createRoom,
        { displayName: 'Host3' }
      );
      await as(t, 'player3').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Player3',
      });

      await as(t, 'host3').mutation(api.game.startGame, { code });

      const room = await t.run((ctx) => ctx.db.get(roomId));
      expect(room?.status).toBe('IN_PROGRESS');
      expect(room?.currentGameId).toBeDefined();

      const gameId = room!.currentGameId!;
      const game = await t.run((ctx) => ctx.db.get(gameId));
      expect(game?.status).toBe('IN_PROGRESS');
      expect(game?.currentRound).toBe(0);
      expect(Array.isArray(game?.assignmentMatrix)).toBe(true);
      // 2 players → 2 poems
      const poems = await t.run((ctx) =>
        ctx.db
          .query('poems')
          .withIndex('by_game', (q) => q.eq('gameId', gameId))
          .collect()
      );
      expect(poems).toHaveLength(2);
    });

    it('throws when there is only one player', async () => {
      const t = setupConvexTest();
      await seedUser(t, 'solo');

      const { code } = await as(t, 'solo').mutation(api.rooms.createRoom, {
        displayName: 'Solo',
      });

      await expect(
        as(t, 'solo').mutation(api.game.startGame, { code })
      ).rejects.toThrow('Need at least 2 players');
    });

    it('throws when a non-host tries to start the first game', async () => {
      const t = setupConvexTest();
      await seedUser(t, 'host4');
      await seedUser(t, 'guest4');

      const { code } = await as(t, 'host4').mutation(api.rooms.createRoom, {
        displayName: 'Host4',
      });
      await as(t, 'guest4').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Guest4',
      });

      await expect(
        as(t, 'guest4').mutation(api.game.startGame, { code })
      ).rejects.toThrow('Only host can start game');
    });

    it('throws when a game is already in progress', async () => {
      const t = setupConvexTest();
      await seedUser(t, 'host5');
      await seedUser(t, 'player5');

      const { code } = await as(t, 'host5').mutation(api.rooms.createRoom, {
        displayName: 'Host5',
      });
      await as(t, 'player5').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Player5',
      });

      await as(t, 'host5').mutation(api.game.startGame, { code });

      await expect(
        as(t, 'host5').mutation(api.game.startGame, { code })
      ).rejects.toThrow('Game already in progress');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // startNewCycle
  // ──────────────────────────────────────────────────────────────────────────
  describe('startNewCycle', () => {
    it('resets a COMPLETED room to LOBBY and clears currentGameId', async () => {
      const t = setupConvexTest();
      const { roomId } = await seedCompletedRoom(t);

      await as(t, 'host').mutation(api.game.startNewCycle, {
        roomCode: 'ABCD',
      });

      const room = await t.run((ctx) => ctx.db.get(roomId));
      expect(room?.status).toBe('LOBBY');
      expect(room?.currentGameId).toBeUndefined();
    });

    it('allows any participant (not just host) to start a new cycle', async () => {
      const t = setupConvexTest();
      const { roomId } = await seedCompletedRoom(t);

      // guest (not host) fires startNewCycle
      await as(t, 'guest').mutation(api.game.startNewCycle, {
        roomCode: 'ABCD',
      });

      const room = await t.run((ctx) => ctx.db.get(roomId));
      expect(room?.status).toBe('LOBBY');
    });

    it('getRoomState reflects LOBBY status after startNewCycle', async () => {
      const t = setupConvexTest();
      await seedCompletedRoom(t);

      await as(t, 'host').mutation(api.game.startNewCycle, {
        roomCode: 'ABCD',
      });

      const state = await as(t, 'host').query(api.rooms.getRoomState, {
        code: 'ABCD',
      });
      expect(state?.room.status).toBe('LOBBY');
    });

    it('throws when no completed game exists', async () => {
      const t = setupConvexTest();
      // Fresh LOBBY room with no completed game
      await seedUser(t, 'host6');
      await seedUser(t, 'player6');
      const { code } = await as(t, 'host6').mutation(api.rooms.createRoom, {
        displayName: 'Host6',
      });
      await as(t, 'player6').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Player6',
      });

      await expect(
        as(t, 'host6').mutation(api.game.startNewCycle, {
          roomCode: code,
        })
      ).rejects.toThrow('No completed game to continue from');
    });

    it('throws when a game is still in progress', async () => {
      const t = setupConvexTest();
      await seedUser(t, 'host7');
      await seedUser(t, 'player7');

      const { code } = await as(t, 'host7').mutation(api.rooms.createRoom, {
        displayName: 'Host7',
      });
      await as(t, 'player7').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Player7',
      });
      await as(t, 'host7').mutation(api.game.startGame, { code });

      await expect(
        as(t, 'host7').mutation(api.game.startNewCycle, {
          roomCode: code,
        })
      ).rejects.toThrow('Game still in progress');
    });

    it('throws when the caller is not a participant', async () => {
      const t = setupConvexTest();
      await seedCompletedRoom(t);
      // outsider has a user row but no roomPlayers entry
      await seedUser(t, 'outsider');

      await expect(
        as(t, 'outsider').mutation(api.game.startNewCycle, {
          roomCode: 'ABCD',
        })
      ).rejects.toThrow('Only players in this room can start a new cycle');
    });

    it('throws when the caller is unauthenticated', async () => {
      const t = setupConvexTest();
      await seedCompletedRoom(t);

      await expect(
        t.mutation(api.game.startNewCycle, { roomCode: 'ABCD' })
      ).rejects.toThrow('User not found');
    });
  });
});
