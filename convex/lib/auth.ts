import { ConvexError } from 'convex/values';
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
      logError('Invalid guest token', e instanceof Error ? e : String(e), {
        hasToken: !!guestToken,
      });
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
    throw new ConvexError('Unauthorized: User not found');
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

/**
 * Artifact access follows the selected game's frozen roster, not room membership.
 * Retained profiles keep participants' archives readable after departure or closure.
 */
export async function checkGameParticipation(
  ctx: QueryCtx | MutationCtx,
  game: Doc<'games'> | null,
  userId: Id<'users'>
): Promise<boolean> {
  if (!game) return false;
  const matchId = game.matchId;
  if (!matchId) return checkParticipation(ctx, game.roomId, userId);

  const profile = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room_user', (q) =>
      q.eq('roomId', game.roomId).eq('userId', userId)
    )
    .first();
  const playerId = profile?.playerId;
  if (!playerId) return false;

  const participant = await ctx.db
    .query('matchParticipants')
    .withIndex('by_match_player', (q) =>
      q.eq('matchId', matchId).eq('playerId', playerId)
    )
    .unique();
  return participant !== null;
}
