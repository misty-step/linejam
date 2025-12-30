import { QueryCtx, MutationCtx } from '../_generated/server';
import { Doc, Id } from '../_generated/dataModel';

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
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .order('desc')
    .filter((q) => q.eq(q.field('status'), 'COMPLETED'))
    .first();
}

/**
 * Derive room status from game state.
 * - If there's an IN_PROGRESS game → 'IN_PROGRESS'
 * - If there are COMPLETED games but no IN_PROGRESS → 'COMPLETED' (reveal phase)
 * - Otherwise → 'LOBBY'
 */
export async function deriveRoomStatus(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<'rooms'>
): Promise<'LOBBY' | 'IN_PROGRESS' | 'COMPLETED'> {
  const activeGame = await getActiveGame(ctx, roomId);
  if (activeGame) return 'IN_PROGRESS';

  const completedGame = await getCompletedGame(ctx, roomId);
  if (completedGame) return 'COMPLETED';

  return 'LOBBY';
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
