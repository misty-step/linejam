import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { checkParticipation, getUser } from './lib/auth';
import { getCompletedGame, getRoomByCode } from './lib/room';

async function requirePoemParticipant(
  ctx: MutationCtx,
  poemId: Id<'poems'>,
  guestToken?: string
) {
  const [user, poem] = await Promise.all([
    getUser(ctx, guestToken),
    ctx.db.get(poemId),
  ]);

  if (!poem) {
    throw new ConvexError('Poem not found');
  }

  if (!user || !(await checkParticipation(ctx, poem.roomId, user._id))) {
    throw new ConvexError('Not authorized to share this poem');
  }

  return poem;
}

async function requireCompletedSessionParticipant(
  ctx: MutationCtx,
  roomCode: string,
  guestToken?: string
) {
  const user = await getUser(ctx, guestToken);
  const room = await getRoomByCode(ctx, roomCode);

  if (!room) {
    throw new ConvexError('Room not found');
  }

  if (!user || !(await checkParticipation(ctx, room._id, user._id))) {
    throw new ConvexError('Not authorized to share this session');
  }

  const game = await getCompletedGame(ctx, room._id);
  if (!game) {
    throw new ConvexError('Session recap not ready');
  }

  const poems = await ctx.db
    .query('poems')
    .withIndex('by_game', (q) => q.eq('gameId', game._id))
    .collect();

  if (
    poems.some(
      (poem) => poem.revealedAt === undefined || poem.revealedAt === null
    )
  ) {
    throw new ConvexError('Session recap not ready');
  }

  return game;
}

export const enablePublicPoemShare = mutation({
  args: {
    poemId: v.id('poems'),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestToken }) => {
    const poem = await requirePoemParticipant(ctx, poemId, guestToken);
    if (poem.revealedAt === undefined || poem.revealedAt === null) {
      throw new ConvexError('Poem is not ready to share');
    }
    const now = Date.now();

    await ctx.db.patch(poemId, {
      publicShareEnabled: true,
      publicShareEnabledAt: poem.publicShareEnabledAt ?? now,
      publicShareDisabledAt: undefined,
    });
  },
});

export const disablePublicPoemShare = mutation({
  args: {
    poemId: v.id('poems'),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestToken }) => {
    await requirePoemParticipant(ctx, poemId, guestToken);

    await ctx.db.patch(poemId, {
      publicShareEnabled: false,
      publicShareDisabledAt: Date.now(),
    });
  },
});

export const enablePublicSessionRecapShare = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const game = await requireCompletedSessionParticipant(
      ctx,
      roomCode,
      guestToken
    );
    const now = Date.now();

    await ctx.db.patch(game._id, {
      publicRecapEnabled: true,
      publicRecapEnabledAt: game.publicRecapEnabledAt ?? now,
      publicRecapDisabledAt: undefined,
    });
  },
});

export const disablePublicSessionRecapShare = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const game = await requireCompletedSessionParticipant(
      ctx,
      roomCode,
      guestToken
    );

    await ctx.db.patch(game._id, {
      publicRecapEnabled: false,
      publicRecapDisabledAt: Date.now(),
    });
  },
});
