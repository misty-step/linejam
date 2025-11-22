import { mutation, type MutationCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { ConvexError, v } from 'convex/values';
import { getUser } from './lib/auth';
import { verifyGuestToken } from './lib/guestToken';

type UserDoc = Doc<'users'>;
type UserInsert = Omit<UserDoc, '_id' | '_creationTime'>;

const resolveGuestId = async (args: {
  guestToken?: string;
  guestId?: string;
}): Promise<string | null> => {
  if (args.guestToken) {
    try {
      return await verifyGuestToken(args.guestToken);
    } catch {
      throw new ConvexError('Invalid guest token');
    }
  }

  if (args.guestId) {
    // Legacy fallback for older clients that still send a raw guestId.
    // Keep this path temporary; prefer signed guestToken for integrity.
    return args.guestId;
  }

  return null;
};

export const ensureUserHelper = async (
  ctx: MutationCtx,
  args: {
    guestToken?: string;
    guestId?: string; // Legacy: scheduled for removal once all clients send tokens
    displayName: string;
  }
): Promise<UserDoc> => {
  const displayName = normalizeDisplayName(args.displayName);

  // 1. Try to find existing user (Clerk or guest token)
  const existingUser = await getUser(ctx, args.guestToken);
  if (existingUser) {
    return existingUser;
  }

  // 2. If not found, create new user
  const identity = await ctx.auth.getUserIdentity();
  const clerkUserId = identity?.subject;

  const guestId = await resolveGuestId(args);

  // Legacy guestId path: avoid duplicating users from repeated requests
  if (!clerkUserId && guestId) {
    const legacyGuest = await ctx.db
      .query('users')
      .withIndex('by_guest', (q) => q.eq('guestId', guestId))
      .first();

    if (legacyGuest) return legacyGuest;
  }

  if (!clerkUserId && !guestId) {
    throw new ConvexError('Missing user identifier');
  }

  if (clerkUserId) {
    return insertUser(ctx.db, {
      clerkUserId,
      displayName,
    });
  }

  return insertUser(ctx.db, {
    guestId: guestId!,
    displayName,
  });
};

export const ensureUser = mutation({
  args: {
    clerkUserId: v.optional(v.string()), // Deprecated
    guestToken: v.optional(v.string()),
    guestId: v.optional(v.string()), // Legacy fallback
    displayName: v.string(),
  },
  handler: async (ctx, args): Promise<UserDoc> => {
    return ensureUserHelper(ctx, args);
  },
});

const normalizeDisplayName = (raw: string): string => {
  const normalized = raw.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new ConvexError('Display name is required');
  }

  return normalized;
};

const insertUser = async (
  db: MutationCtx['db'],
  values: Pick<UserInsert, 'displayName'> &
    (Pick<UserInsert, 'clerkUserId'> | Pick<UserInsert, 'guestId'>)
): Promise<UserDoc> => {
  const userId = await db.insert('users', {
    ...values,
    createdAt: Date.now(),
  });

  const createdUser = await db.get(userId);
  if (!createdUser) {
    throw new ConvexError('Failed to load user');
  }

  return createdUser;
};
