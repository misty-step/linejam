import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getUser } from './lib/auth';
import { getRoomByCode } from './lib/room';
import { PRESENCE_AWAY_MS } from './lib/gameRules';

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

/**
 * Returns presence status for all players in a room: `{ userId, isAway }`.
 * A player is "away" when `lastSeenAt` is missing or older than PRESENCE_AWAY_MS.
 */
export const getRoomPresence = query({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return null;

    const room = await getRoomByCode(ctx, roomCode);
    if (!room) return null;

    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    const now = Date.now();
    return players.map((p) => ({
      userId: p.userId,
      isAway:
        p.lastSeenAt === undefined || now - p.lastSeenAt > PRESENCE_AWAY_MS,
    }));
  },
});
