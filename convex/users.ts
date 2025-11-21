import { mutation, type MutationCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { ConvexError, v } from 'convex/values';
import { getUser } from './lib/auth';
import { verifyGuestToken } from './lib/guestToken';

type UserDoc = Doc<'users'>;
type UserInsert = Omit<UserDoc, '_id' | '_creationTime'>;

export const ensureUserHelper = async (
  ctx: MutationCtx,
  args: {
    guestToken?: string;
    displayName: string;
  }
): Promise<UserDoc> => {
  const displayName = normalizeDisplayName(args.displayName);

  // 1. Try to find existing user
  const existingUser = await getUser(ctx, args.guestToken);
  if (existingUser) {
    return existingUser;
  }

  // 2. If not found, create new user
  const identity = await ctx.auth.getUserIdentity();
  const clerkUserId = identity?.subject;

  let guestId: string | undefined;
  if (args.guestToken) {
    try {
      guestId = await verifyGuestToken(args.guestToken);
    } catch {
      throw new ConvexError('Invalid guest token');
    }
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
