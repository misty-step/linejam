import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { getMatrixRound } from './assignmentMatrix';
import { assignPoemReaders } from './assignPoemReaders';

type LifecycleCtx = Pick<MutationCtx, 'db' | 'scheduler'>;
type LifecycleGame = Pick<
  Doc<'games'>,
  '_id' | 'assignmentMatrix' | 'currentRound' | 'status'
>;
type LifecyclePoem = Pick<Doc<'poems'>, '_id' | 'indexInRoom'>;
type LifecyclePlayer = Pick<Doc<'users'>, '_id' | 'kind'>;

export type SubmissionWindowResult =
  | { ok: true }
  | { ok: false; reason: 'GAME_NOT_IN_PROGRESS' | 'ROUND_NOT_STARTED' };

export type CycleResetDecision =
  | { ok: true }
  | { ok: false; reason: 'GAME_STILL_IN_PROGRESS' | 'NO_COMPLETED_GAME' };

export type RoundTransitionResult =
  | { status: 'pending' }
  | { status: 'stale' }
  | { status: 'advanced'; nextRound: number }
  | { status: 'completed'; completedAt: number };

export type CompletionPatchPlan = {
  gamePatch: {
    status: 'COMPLETED';
    completedAt: number;
  };
  roomPatch: {
    status: 'COMPLETED';
    completedAt: number;
  };
  poemPatches: Array<{
    poemId: Id<'poems'>;
    patch: {
      completedAt: number;
      assignedReaderId: Id<'users'> | undefined;
    };
  }>;
};

export function getSubmissionWindow(
  game: Pick<Doc<'games'>, 'status' | 'currentRound'>,
  lineIndex: number
): SubmissionWindowResult {
  const isFinalRound = lineIndex === 8;
  const gameInProgress = game.status === 'IN_PROGRESS';
  const gameJustCompleted = game.status === 'COMPLETED' && isFinalRound;

  if (!gameInProgress && !gameJustCompleted) {
    return { ok: false, reason: 'GAME_NOT_IN_PROGRESS' };
  }

  if (lineIndex > game.currentRound && gameInProgress) {
    return { ok: false, reason: 'ROUND_NOT_STARTED' };
  }

  return { ok: true };
}

export function isRevealReady(
  game: Pick<Doc<'games'>, 'status'> | null | undefined
): boolean {
  return game?.status === 'COMPLETED';
}

export function getCycleResetDecision(args: {
  activeGame: Pick<Doc<'games'>, 'status'> | null;
  completedGame: Pick<Doc<'games'>, 'status'> | null;
}): CycleResetDecision {
  if (args.activeGame?.status === 'IN_PROGRESS') {
    return { ok: false, reason: 'GAME_STILL_IN_PROGRESS' };
  }

  if (!isRevealReady(args.completedGame)) {
    return { ok: false, reason: 'NO_COMPLETED_GAME' };
  }

  return { ok: true };
}

export function buildCompletionPatchPlan(args: {
  game: Pick<Doc<'games'>, 'assignmentMatrix'>;
  poems: LifecyclePoem[];
  playerUsers: LifecyclePlayer[];
  completionTime: number;
}): CompletionPatchPlan {
  const readerAssignments = assignPoemReaders(
    args.poems.map((poem) => ({
      _id: poem._id,
      authorUserId: getMatrixRound(args.game.assignmentMatrix, 0)[
        poem.indexInRoom
      ],
    })),
    args.playerUsers.map((user) => ({
      userId: user._id,
      kind: user.kind === 'AI' ? 'AI' : 'human',
    }))
  );

  return {
    gamePatch: {
      status: 'COMPLETED',
      completedAt: args.completionTime,
    },
    roomPatch: {
      status: 'COMPLETED',
      completedAt: args.completionTime,
    },
    poemPatches: args.poems.map((poem) => ({
      poemId: poem._id,
      patch: {
        completedAt: args.completionTime,
        assignedReaderId: readerAssignments.get(poem._id),
      },
    })),
  };
}

async function getGamePoems(
  ctx: LifecycleCtx,
  gameId: Id<'games'>
): Promise<Doc<'poems'>[]> {
  return ctx.db
    .query('poems')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .collect();
}

async function isRoundComplete(
  ctx: LifecycleCtx,
  poems: LifecyclePoem[],
  lineIndex: number
): Promise<boolean> {
  const lineChecks = await Promise.all(
    poems.map((poem) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poem._id).eq('indexInPoem', lineIndex)
        )
        .first()
    )
  );

  return lineChecks.every((line) => line !== null);
}

export async function applyLineLifecycleTransition(
  ctx: LifecycleCtx,
  args: {
    game: LifecycleGame;
    roomId: Id<'rooms'>;
    lineIndex: number;
  }
): Promise<RoundTransitionResult> {
  const poems = await getGamePoems(ctx, args.game._id);
  const roundComplete = await isRoundComplete(ctx, poems, args.lineIndex);

  if (!roundComplete) {
    return { status: 'pending' };
  }

  const freshGame = await ctx.db.get(args.game._id);
  if (
    !freshGame ||
    freshGame.status !== 'IN_PROGRESS' ||
    freshGame.currentRound !== args.lineIndex
  ) {
    return { status: 'stale' };
  }

  if (args.lineIndex < 8) {
    const nextRound = args.lineIndex + 1;
    await ctx.db.patch(args.game._id, { currentRound: nextRound });
    await ctx.scheduler.runAfter(0, internal.ai.scheduleAiTurn, {
      roomId: args.roomId,
      gameId: args.game._id,
      round: nextRound,
    });

    return { status: 'advanced', nextRound };
  }

  const players = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
    .collect();
  const playerUsers = await Promise.all(
    players.map((player) => ctx.db.get(player.userId))
  );

  const completionTime = Date.now();
  const completionPlan = buildCompletionPatchPlan({
    game: args.game,
    poems,
    playerUsers: playerUsers.filter(
      (user): user is NonNullable<typeof user> => user !== null
    ),
    completionTime,
  });

  await ctx.db.patch(args.game._id, completionPlan.gamePatch);
  await ctx.db.patch(args.roomId, completionPlan.roomPatch);
  await Promise.all(
    completionPlan.poemPatches.map(({ poemId, patch }) =>
      ctx.db.patch(poemId, patch)
    )
  );

  return {
    status: 'completed',
    completedAt: completionTime,
  };
}
