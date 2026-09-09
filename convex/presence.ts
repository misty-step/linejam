import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { getUser } from './lib/auth';
import { getRoomByCode } from './lib/room';
import { findRoomActor, recordRoomActivity } from './lib/parlor';

/**
 * Client heartbeat: stamps canonical Parlor membership presence and heals a
 * stale host. Historical/closed rooms are ignored. Throttled client-side to
 * PRESENCE_HEARTBEAT_MS.
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
    if (!room?.hostPlayerId || room.closedAt !== undefined) return;

    const actor = await findRoomActor(ctx, user, room._id);
    if (!actor) return;
    await recordRoomActivity(ctx, room, actor);
  },
});
