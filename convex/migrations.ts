import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';
import { verifyGuestToken } from './lib/guestToken';
import { ensureUserHelper } from './users';

export const migrateGuestToUser = mutation({
  args: {
    guestToken: v.string(),
  },
  handler: async (ctx, { guestToken }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkUserId = identity?.subject;
    if (!clerkUserId) {
      throw new ConvexError('Not authenticated');
    }

    let guestId: string;
    try {
      guestId = await verifyGuestToken(guestToken);
    } catch {
      throw new ConvexError('Invalid guest token');
    }

    const guestUser = await ctx.db
      .query('users')
      .withIndex('by_guest', (q) => q.eq('guestId', guestId))
      .first();

    const existingMigration = await ctx.db
      .query('migrations')
      .withIndex('by_clerk', (q) => q.eq('clerkUserId', clerkUserId))
      .first();

    if (existingMigration) {
      return { alreadyMigrated: true };
    }

    if (!guestUser) {
      throw new ConvexError('Guest user not found');
    }

    const authUser = await ensureUserHelper(ctx, {
      displayName: guestUser.displayName,
    });

    if (authUser._id === guestUser._id) {
      return { alreadyMigrated: true };
    }

    const lines = await ctx.db
      .query('lines')
      .withIndex('by_author', (q) => q.eq('authorUserId', guestUser._id))
      .collect();

    for (const line of lines) {
      await ctx.db.patch(line._id, { authorUserId: authUser._id });
    }

    const favorites = await ctx.db
      .query('favorites')
      .withIndex('by_user', (q) => q.eq('userId', guestUser._id))
      .collect();

    for (const favorite of favorites) {
      await ctx.db.patch(favorite._id, { userId: authUser._id });
    }

    const roomPlayers = await ctx.db
      .query('roomPlayers')
      .withIndex('by_user', (q) => q.eq('userId', guestUser._id))
      .collect();

    for (const player of roomPlayers) {
      await ctx.db.patch(player._id, { userId: authUser._id });
    }

    await ctx.db.delete(guestUser._id);

    await ctx.db.insert('migrations', {
      guestUserId: guestUser._id,
      clerkUserId,
      migratedAt: Date.now(),
    });

    return {
      success: true,
      linesTransferred: lines.length,
      favoritesTransferred: favorites.length,
      roomsTransferred: roomPlayers.length,
    };
  },
});
