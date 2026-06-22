import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { getUser } from './lib/auth';
import { getRoomByCode, migrateHostIfStale } from './lib/room';
import { HOST_MIGRATION_STALE_MS } from './lib/gameRules';

/**
 * Client heartbeat: stamps `lastSeenAt` on the caller's roomPlayers row.
 * Works for both Clerk and guest users. Throttled client-side to
 * PRESENCE_HEARTBEAT_MS. Usually a single patch by composite index; a non-host
 * heartbeat additionally runs the host-migration self-heal (`migrateHostIfStale`),
 * which short-circuits cheaply unless an in-progress game's host has gone stale.
 */
export const heartbeat = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return;

    const room = await getRoomByCode(ctx, roomCode);
    if (!room) return;

    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room_user', (q) =>
        q.eq('roomId', room._id).eq('userId', user._id)
      )
      .first();

    if (!player) return;

    const now = Date.now();
    await ctx.db.patch(player._id, { lastSeenAt: now });

    // Self-heal host agency: a present non-host's heartbeat promotes a present
    // participant when the host has gone stale, so host-only actions are never
    // stranded. The host's own heartbeat can't make them stale, so skip it.
    if (room.hostUserId !== user._id) {
      await migrateHostIfStale(ctx, room, now, HOST_MIGRATION_STALE_MS);
    }
  },
});
