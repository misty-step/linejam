import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation } from './_generated/server';
import { verifyGuestToken } from './lib/guestToken';
import { ensureUserHelper } from './users';

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const removeGameModePatch = { mode: undefined } as never;
const removeSelectedModePatch = { selectedMode: undefined } as never;

export const dropLegacyModeColumns = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [games, rooms] = await Promise.all([
      ctx.db.query('games').collect(),
      ctx.db.query('rooms').collect(),
    ]);

    const gamesWithMode = games.filter((game) => hasOwn(game, 'mode'));
    const roomsWithSelectedMode = rooms.filter((room) =>
      hasOwn(room, 'selectedMode')
    );

    await Promise.all([
      ...gamesWithMode.map((game) =>
        ctx.db.patch(game._id, removeGameModePatch)
      ),
      ...roomsWithSelectedMode.map((room) =>
        ctx.db.patch(room._id, removeSelectedModePatch)
      ),
    ]);

    return {
      gamesScanned: games.length,
      gamesCleared: gamesWithMode.length,
      roomsScanned: rooms.length,
      roomsCleared: roomsWithSelectedMode.length,
    };
  },
});

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

    await Promise.all(
      lines.map((line) =>
        ctx.db.patch(line._id, { authorUserId: authUser._id })
      )
    );

    const favorites = await ctx.db
      .query('favorites')
      .withIndex('by_user', (q) => q.eq('userId', guestUser._id))
      .collect();

    await Promise.all(
      favorites.map((favorite) =>
        ctx.db.patch(favorite._id, { userId: authUser._id })
      )
    );

    const roomPlayers = await ctx.db
      .query('roomPlayers')
      .withIndex('by_user', (q) => q.eq('userId', guestUser._id))
      .collect();

    await Promise.all(
      roomPlayers.map((player) =>
        ctx.db.patch(player._id, { userId: authUser._id })
      )
    );

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
