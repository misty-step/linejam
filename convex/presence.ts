import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { getUser } from './lib/auth';
import { getRoomByCode } from './lib/room';

/**
 * Client heartbeat: stamps `lastSeenAt` on the caller's roomPlayers row.
 * Works for both Clerk and guest users. Throttled client-side to
 * PRESENCE_HEARTBEAT_MS; this mutation is cheap (single patch by composite index).
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

    await ctx.db.patch(player._id, { lastSeenAt: Date.now() });
  },
});
