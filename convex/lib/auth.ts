import { QueryCtx, MutationCtx } from '../_generated/server';
import { Doc } from '../_generated/dataModel';

/**
 * Retrieves the user based on the current auth context (Clerk) or provided guest ID.
 * Returns null if no user is found or not authenticated.
 */
export async function getUser(
  ctx: QueryCtx | MutationCtx,
  guestId?: string
): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity();
  const clerkUserId = identity?.subject;

  if (clerkUserId) {
    return await ctx.db
      .query('users')
      .withIndex('by_clerk', (q) => q.eq('clerkUserId', clerkUserId))
      .first();
  }

  if (guestId) {
    return await ctx.db
      .query('users')
      .withIndex('by_guest', (q) => q.eq('guestId', guestId))
      .first();
  }

  return null;
}

/**
 * Retrieves the user based on the current auth context or provided guest ID.
 * Throws an error if the user is not found or not authenticated.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  guestId?: string
): Promise<Doc<'users'>> {
  const user = await getUser(ctx, guestId);
  if (!user) {
    throw new Error('Unauthorized: User not found');
  }
  return user;
}
