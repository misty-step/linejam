import { mutation, type MutationCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { ConvexError, v } from 'convex/values';

type UserDoc = Doc<'users'>;
type UserInsert = Omit<UserDoc, '_id' | '_creationTime'>;

export const ensureUserHelper = async (
  ctx: MutationCtx,
  args: {
    clerkUserId?: string;
    guestId?: string;
    displayName: string;
  }
): Promise<UserDoc> => {
  const displayName = normalizeDisplayName(args.displayName);
  const clerkId = args.clerkUserId?.trim();
  const guestId = args.guestId?.trim();

  if (!clerkId && !guestId) {
    throw new ConvexError('Missing user identifier');
  }

  if (clerkId) {
    const clerkUser = await findByClerkId(ctx.db, clerkId);
    if (clerkUser) {
      return clerkUser;
    }

    return insertUser(ctx.db, {
      clerkUserId: clerkId,
      displayName,
    });
  }

  const guestUser = await findByGuestId(ctx.db, guestId!);
  if (guestUser) {
    return guestUser;
  }

  return insertUser(ctx.db, {
    guestId: guestId!,
    displayName,
  });
};

export const ensureUser = mutation({
  args: {
    clerkUserId: v.optional(v.string()),
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

const findByClerkId = async (
  db: MutationCtx['db'],
  clerkUserId: string
): Promise<UserDoc | null> => {
  return db
    .query('users')
    .withIndex('by_clerk', (q) => q.eq('clerkUserId', clerkUserId))
    .first();
};

const findByGuestId = async (
  db: MutationCtx['db'],
  guestId: string
): Promise<UserDoc | null> => {
  return db
    .query('users')
    .withIndex('by_guest', (q) => q.eq('guestId', guestId))
    .first();
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
