import { QueryCtx, MutationCtx } from '../_generated/server';
import { Doc, Id } from '../_generated/dataModel';

type RoomStatus = Doc<'rooms'>['status'];
type RoomActivityInput = Pick<Doc<'rooms'>, '_id' | 'status'>;

/**
 * Look up a room by its code (case-insensitive).
 * Returns null if not found.
 */
export async function getRoomByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<Doc<'rooms'> | null> {
  return await ctx.db
    .query('rooms')
    .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
    .first();
}

/**
 * Get the active (IN_PROGRESS) game for a room.
 * Returns null if no active game (room is in lobby or between games).
 *
 * This is the authoritative source for "which game is active" -
 * avoids race conditions from mutable currentGameId pointer.
 */
export async function getActiveGame(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<'rooms'>
): Promise<Doc<'games'> | null> {
  return await ctx.db
    .query('games')
    .withIndex('by_room_status', (q) =>
      q.eq('roomId', roomId).eq('status', 'IN_PROGRESS')
    )
    .first();
}

/**
 * Get the most recently completed game for a room.
 * Used for reveal phase after game completion.
 */
export async function getCompletedGame(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<'rooms'>
): Promise<Doc<'games'> | null> {
  return await ctx.db
    .query('games')
    .withIndex('by_room_status', (q) =>
      q.eq('roomId', roomId).eq('status', 'COMPLETED')
    )
    .order('desc')
    .first();
}

function deriveIdleRoomStatus(room: Pick<Doc<'rooms'>, 'status'>): RoomStatus {
  return room.status === 'COMPLETED' ? 'COMPLETED' : 'LOBBY';
}

/**
 * Resolve the authoritative room activity view.
 * The room document owns idle state (`LOBBY` vs `COMPLETED`);
 * an active game is the only source that can override it.
 */
export async function getRoomActivity(
  ctx: QueryCtx | MutationCtx,
  room: RoomActivityInput
): Promise<{ activeGame: Doc<'games'> | null; status: RoomStatus }> {
  const activeGame = await getActiveGame(ctx, room._id);
  return {
    activeGame,
    status: activeGame ? 'IN_PROGRESS' : deriveIdleRoomStatus(room),
  };
}

export async function deriveRoomStatus(
  ctx: QueryCtx | MutationCtx,
  room: RoomActivityInput
): Promise<RoomStatus> {
  const { status } = await getRoomActivity(ctx, room);
  return status;
}

/**
 * Look up a room by its code or throw if not found.
 */
export async function requireRoomByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<Doc<'rooms'>> {
  const room = await getRoomByCode(ctx, code);
  if (!room) {
    throw new Error('Room not found');
  }
  return room;
}
