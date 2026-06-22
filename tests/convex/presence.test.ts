import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from '../../convex/_generated/api';
import { setupConvexTest } from '../helpers/convexTest';

/**
 * presence heartbeat on the real convex-test engine (backlog 018): real
 * read-your-writes + real auth (Clerk identity), asserting observable DB
 * state instead of mock-call stubs.
 */

type T = ReturnType<typeof setupConvexTest>;

/**
 * Seed a user with a given Clerk subject name and insert them as a room player
 * in a room with code 'ABCD'. Returns the seeded IDs so callers can assert
 * against the real DB state.
 */
async function seedUserAndRoomPlayer(t: T, clerkName: string) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      displayName: clerkName,
      kind: 'human',
      clerkUserId: `clerk_${clerkName}`,
      createdAt: 0,
    });
    const hostUserId = userId; // same user hosts the room
    const roomId = await ctx.db.insert('rooms', {
      code: 'ABCD',
      hostUserId,
      status: 'IN_PROGRESS',
      createdAt: 0,
    });
    const roomPlayerId = await ctx.db.insert('roomPlayers', {
      roomId,
      userId,
      displayName: clerkName,
      joinedAt: 0,
      // lastSeenAt intentionally absent — heartbeat should stamp it
    });
    return { userId, roomId, roomPlayerId };
  });
}

/** Convenience: run as the named Clerk user. */
const asUser = (t: T, name: string) =>
  t.withIdentity({ subject: `clerk_${name}` });

afterEach(() => {
  vi.useRealTimers();
});

describe('presence', () => {
  describe('heartbeat', () => {
    it('stamps a fresh lastSeenAt on the caller roomPlayers row', async () => {
      const t = setupConvexTest();
      const { roomPlayerId } = await seedUserAndRoomPlayer(t, 'alice');

      const before = Date.now();
      await asUser(t, 'alice').mutation(api.presence.heartbeat, {
        roomCode: 'ABCD',
      });
      const after = Date.now();

      const player = await t.run((ctx) => ctx.db.get(roomPlayerId));
      expect(typeof player?.lastSeenAt).toBe('number');
      expect(player!.lastSeenAt!).toBeGreaterThanOrEqual(before);
      expect(player!.lastSeenAt!).toBeLessThanOrEqual(after);
    });

    it('stamps lastSeenAt to a deterministic value when clock is frozen', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const t = setupConvexTest();
      const { roomPlayerId } = await seedUserAndRoomPlayer(t, 'bob');

      await asUser(t, 'bob').mutation(api.presence.heartbeat, {
        roomCode: 'ABCD',
      });

      const player = await t.run((ctx) => ctx.db.get(roomPlayerId));
      expect(player?.lastSeenAt).toBe(
        new Date('2025-01-15T12:00:00Z').getTime()
      );
    });

    it('does nothing when no identity is provided and no guest token is given', async () => {
      const t = setupConvexTest();
      // Seed a room so the code is valid — the early-exit must be the user
      // not found, not the room not found.
      const { roomPlayerId } = await seedUserAndRoomPlayer(t, 'carol');

      // No .withIdentity → getUser returns null → early return.
      await t.mutation(api.presence.heartbeat, { roomCode: 'ABCD' });

      const player = await t.run((ctx) => ctx.db.get(roomPlayerId));
      expect(player?.lastSeenAt).toBeUndefined();
    });

    it('does nothing when the room code does not match any room', async () => {
      const t = setupConvexTest();
      // Seed a user in 'ABCD' but call with an unknown code.
      const { roomPlayerId } = await seedUserAndRoomPlayer(t, 'dan');

      await asUser(t, 'dan').mutation(api.presence.heartbeat, {
        roomCode: 'XXXX',
      });

      const player = await t.run((ctx) => ctx.db.get(roomPlayerId));
      expect(player?.lastSeenAt).toBeUndefined();
    });

    it('does nothing when the caller is not a room player in that room', async () => {
      const t = setupConvexTest();
      // Seed a room, but seed the Clerk user WITHOUT inserting a roomPlayers row.
      const roomId = await t.run(async (ctx) => {
        const hostId = await ctx.db.insert('users', {
          displayName: 'host',
          kind: 'human',
          clerkUserId: 'clerk_host',
          createdAt: 0,
        });
        const rid = await ctx.db.insert('rooms', {
          code: 'ABCD',
          hostUserId: hostId,
          status: 'IN_PROGRESS',
          createdAt: 0,
        });
        return rid;
      });

      // eve has a Clerk identity and a user row, but is NOT in roomPlayers.
      await t.run((ctx) =>
        ctx.db.insert('users', {
          displayName: 'eve',
          kind: 'human',
          clerkUserId: 'clerk_eve',
          createdAt: 0,
        })
      );

      // Should return silently without patching anything.
      await asUser(t, 'eve').mutation(api.presence.heartbeat, {
        roomCode: 'ABCD',
      });

      // No roomPlayers row for eve — confirm none was created.
      const evePlayers = await t.run((ctx) =>
        ctx.db
          .query('roomPlayers')
          .withIndex('by_room', (q) => q.eq('roomId', roomId))
          .collect()
      );
      // Only the host row exists (if any), none for eve, and no lastSeenAt on any.
      const eveRow = evePlayers.find((p) => p.displayName === 'eve');
      expect(eveRow).toBeUndefined();
    });
  });
});
