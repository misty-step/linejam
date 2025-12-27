import { QueryCtx, MutationCtx } from '../_generated/server';
import { Doc } from '../_generated/dataModel';

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
