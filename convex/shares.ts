import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { checkParticipation, getUser } from './lib/auth';
import { getCompletedGame, getRoomByCode } from './lib/room';
import { retentionEligibleAt } from './lib/retentionPolicy';

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

  return { game, room, poems };
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

    await Promise.all([
      ctx.db.patch(poemId, {
        publicShareEnabled: true,
        publicShareEnabledAt: poem.publicShareEnabledAt ?? now,
        publicShareDisabledAt: undefined,
        retentionState: 'protected',
        retentionEligibleAt: undefined,
      }),
      ctx.db.patch(poem.roomId, {
        retentionState: 'protected',
        retentionEligibleAt: undefined,
      }),
    ]);
  },
});

export const disablePublicPoemShare = mutation({
  args: {
    poemId: v.id('poems'),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestToken }) => {
    const poem = await requirePoemParticipant(ctx, poemId, guestToken);
    const [favorite, game] = await Promise.all([
      ctx.db
        .query('favorites')
        .withIndex('by_poem', (q) => q.eq('poemId', poemId))
        .first(),
      ctx.db.get(poem.gameId),
    ]);
    const now = Date.now();
    const remainsProtected =
      favorite !== null || game?.publicRecapEnabled === true;

    await ctx.db.patch(poemId, {
      publicShareEnabled: false,
      publicShareDisabledAt: now,
      retentionState: remainsProtected ? 'protected' : 'pending',
      retentionEligibleAt: remainsProtected
        ? undefined
        : retentionEligibleAt(now, 'protectionRemoved'),
    });

    const [otherPublicPoem, publicRecap] = await Promise.all([
      ctx.db
        .query('poems')
        .withIndex('by_room_public_created', (q) =>
          q.eq('roomId', poem.roomId).eq('publicShareEnabled', true)
        )
        .first(),
      ctx.db
        .query('games')
        .withIndex('by_room_public', (q) =>
          q.eq('roomId', poem.roomId).eq('publicRecapEnabled', true)
        )
        .first(),
    ]);
    if (!otherPublicPoem && !publicRecap) {
      await ctx.db.patch(poem.roomId, {
        retentionState: 'pending',
        retentionEligibleAt: retentionEligibleAt(now, 'protectionRemoved'),
      });
    }
  },
});

export const enablePublicSessionRecapShare = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const { game, room, poems } = await requireCompletedSessionParticipant(
      ctx,
      roomCode,
      guestToken
    );
    const now = Date.now();

    await Promise.all([
      ctx.db.patch(game._id, {
        publicRecapEnabled: true,
        publicRecapEnabledAt: game.publicRecapEnabledAt ?? now,
        publicRecapDisabledAt: undefined,
        retentionState: 'protected',
        retentionEligibleAt: undefined,
      }),
      ctx.db.patch(room._id, {
        retentionState: 'protected',
        retentionEligibleAt: undefined,
      }),
      ...poems.map((poem) =>
        ctx.db.patch(poem._id, {
          retentionState: 'protected',
          retentionEligibleAt: undefined,
        })
      ),
    ]);
  },
});

export const disablePublicSessionRecapShare = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const { game, room, poems } = await requireCompletedSessionParticipant(
      ctx,
      roomCode,
      guestToken
    );
    const now = Date.now();
    const deadline = retentionEligibleAt(now, 'protectionRemoved');
    const favorites = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('favorites')
          .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
          .first()
      )
    );

    await Promise.all([
      ctx.db.patch(game._id, {
        publicRecapEnabled: false,
        publicRecapDisabledAt: now,
        retentionState: 'pending',
        retentionEligibleAt: deadline,
      }),
      ctx.db.patch(room._id, {
        retentionState: 'pending',
        retentionEligibleAt: deadline,
      }),
      ...poems.map((poem, index) => {
        const remainsProtected =
          poem.publicShareEnabled === true || favorites[index] !== null;
        return ctx.db.patch(poem._id, {
          retentionState: remainsProtected ? 'protected' : 'pending',
          retentionEligibleAt: remainsProtected ? undefined : deadline,
        });
      }),
    ]);
  },
});
