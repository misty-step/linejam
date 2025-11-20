import { mutation, type MutationCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { ConvexError, v } from 'convex/values';
import { getUser } from './lib/auth';

type UserDoc = Doc<'users'>;
type UserInsert = Omit<UserDoc, '_id' | '_creationTime'>;

export const ensureUserHelper = async (
  ctx: MutationCtx,
  args: {
    guestId?: string;
    displayName: string;
  }
): Promise<UserDoc> => {
  const displayName = normalizeDisplayName(args.displayName);

  // 1. Try to find existing user
  const existingUser = await getUser(ctx, args.guestId);
  if (existingUser) {
    return existingUser;
  }

  // 2. If not found, create new user
  const identity = await ctx.auth.getUserIdentity();
  const clerkUserId = identity?.subject;
  const guestId = args.guestId?.trim();

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
    clerkUserId: v.optional(v.string()), // Deprecated in signature but kept for compatibility if needed, though unused in helper now
    guestId: v.optional(v.string()),
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
