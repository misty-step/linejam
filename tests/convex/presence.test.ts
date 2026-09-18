import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, asUser, seedClerkUser } from '../helpers/convexSeed';

afterEach(() => {
  vi.useRealTimers();
});

async function seedLiveRoom(t: T, clerkName: string) {
  await seedClerkUser(t, clerkName);
  return asUser(t, clerkName).mutation(api.rooms.createRoom, {
    displayName: clerkName,
  });
}

async function memberLastSeenAt(
  t: T,
  roomId: Id<'rooms'>,
  userId: Id<'users'>
): Promise<number | undefined> {
  const lastSeenAt = await t.run(async (ctx) => {
    const profile = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room_user', (q) =>
        q.eq('roomId', roomId).eq('userId', userId)
      )
      .unique();
    const playerId = profile?.playerId;
    if (!playerId) return undefined;
    const member = await ctx.db
      .query('roomMembers')
      .withIndex('by_room_player', (q) =>
        q.eq('roomId', roomId).eq('playerId', playerId)
      )
      .unique();
    return member?.lastSeenAt ?? undefined;
  });
  return lastSeenAt === null ? undefined : lastSeenAt;
}

describe('presence', () => {
  describe('heartbeat', () => {
    it('stamps canonical membership lastSeenAt', async () => {
      const t = setupConvexTest();
      const { roomId } = await seedLiveRoom(t, 'alice');
      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query('users')
          .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_alice'))
          .unique();
        return user!._id;
      });

      const before = Date.now();
      await asUser(t, 'alice').mutation(api.presence.heartbeat, {
        roomCode: (await t.run((ctx) => ctx.db.get(roomId)))!.code,
      });
      const after = Date.now();
      const lastSeenAt = await memberLastSeenAt(t, roomId, userId);
      expect(lastSeenAt).toBeGreaterThanOrEqual(before);
      expect(lastSeenAt).toBeLessThanOrEqual(after);
    });

    it('stamps lastSeenAt to a deterministic value when clock is frozen', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const t = setupConvexTest();
      const { roomId, code } = await seedLiveRoom(t, 'bob');
      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query('users')
          .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_bob'))
          .unique();
        return user!._id;
      });

      await asUser(t, 'bob').mutation(api.presence.heartbeat, {
        roomCode: code,
      });

      expect(await memberLastSeenAt(t, roomId, userId)).toBe(
        new Date('2025-01-15T12:00:00Z').getTime()
      );
    });

    it('does nothing when no identity is provided', async () => {
      const t = setupConvexTest();
      const { roomId, code } = await seedLiveRoom(t, 'carol');
      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query('users')
          .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_carol'))
          .unique();
        return user!._id;
      });

      await t.mutation(api.presence.heartbeat, { roomCode: code });
      expect(await memberLastSeenAt(t, roomId, userId)).toBeUndefined();
    });

    it('does nothing when the room code does not match any room', async () => {
      const t = setupConvexTest();
      const { roomId } = await seedLiveRoom(t, 'dan');
      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query('users')
          .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_dan'))
          .unique();
        return user!._id;
      });

      await asUser(t, 'dan').mutation(api.presence.heartbeat, {
        roomCode: 'XXXX',
      });
      expect(await memberLastSeenAt(t, roomId, userId)).toBeUndefined();
    });

    it('does nothing when the caller is not a room player', async () => {
      const t = setupConvexTest();
      const { code } = await seedLiveRoom(t, 'host');
      await seedClerkUser(t, 'eve');
      await asUser(t, 'eve').mutation(api.presence.heartbeat, {
        roomCode: code,
      });
      const evePlayers = await t.run(async (ctx) => {
        const user = await ctx.db
          .query('users')
          .withIndex('by_clerk', (q) => q.eq('clerkUserId', 'clerk_eve'))
          .unique();
        return ctx.db
          .query('roomPlayers')
          .withIndex('by_user', (q) => q.eq('userId', user!._id))
          .collect();
      });
      expect(evePlayers).toEqual([]);
    });

    it('does not restore membership when a heartbeat arrives after departure', async () => {
      const t = setupConvexTest();
      const { roomId, code } = await seedLiveRoom(t, 'host');
      const guestUserId = await seedClerkUser(t, 'departed');
      await asUser(t, 'departed').mutation(api.rooms.joinRoom, {
        code,
        displayName: 'Departed',
      });
      await asUser(t, 'departed').mutation(api.rooms.leaveLobby, {
        roomCode: code,
      });
      await asUser(t, 'departed').mutation(api.presence.heartbeat, {
        roomCode: code,
      });

      expect(await memberLastSeenAt(t, roomId, guestUserId)).toBeUndefined();
      const members = await t.run((ctx) =>
        ctx.db
          .query('roomMembers')
          .withIndex('by_room', (q) => q.eq('roomId', roomId))
          .collect()
      );
      expect(members).toHaveLength(1);
    });
  });
});
