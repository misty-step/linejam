import { QueryCtx, MutationCtx } from '../_generated/server';
import { Doc } from '../_generated/dataModel';
import { verifyGuestToken } from './guestToken';

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
      console.error('Invalid guest token:', {
        error: e,
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
    throw new Error('Unauthorized: User not found');
  }
  return user;
}
