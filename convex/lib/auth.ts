import { QueryCtx, MutationCtx } from '../_generated/server';
import { Doc, Id } from '../_generated/dataModel';
import { verifyGuestToken } from './guestToken';
import { logError } from './errors';

/**
 * Retrieves the user based on the current auth context (Clerk) or provided guest token.
 * Returns null if no user is found or not authenticated.
 */
export async function getUser(
  ctx: QueryCtx | MutationCtx,
  guestToken?: string
): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity();
  const clerkUserId = identity?.subject;

  if (clerkUserId) {
    return await ctx.db
      .query('users')
      .withIndex('by_clerk', (q) => q.eq('clerkUserId', clerkUserId))
      .first();
  }

  if (guestToken) {
    try {
      const guestId = await verifyGuestToken(guestToken);
      return await ctx.db
        .query('users')
        .withIndex('by_guest', (q) => q.eq('guestId', guestId))
        .first();
    } catch (e) {
      logError('Invalid guest token', e, { hasToken: !!guestToken });
      return null;
    }
  }

  return null;
}

/**
 * Retrieves the user based on the current auth context or provided guest token.
 * Throws an error if the user is not found or not authenticated.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  guestToken?: string
): Promise<Doc<'users'>> {
  const user = await getUser(ctx, guestToken);
  if (!user) {
    throw new Error('Unauthorized: User not found');
  }
  return user;
}

/**
 * Checks if a user is a participant in a room.
 * Returns true if the user has a roomPlayers record for the room, false otherwise.
 */
export async function checkParticipation(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<'rooms'>,
  userId: Id<'users'>
): Promise<boolean> {
  const player = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room_user', (q) =>
      q.eq('roomId', roomId).eq('userId', userId)
    )
    .first();
  return !!player;
}
