import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import {
  ABANDONMENT_THRESHOLD_MS,
  WORD_COUNTS,
} from '../../convex/lib/gameRules';
import { RETENTION_DURATIONS_MS } from '../../convex/lib/retentionPolicy';
import { setupConvexTest } from '../helpers/convexTest';

type T = ReturnType<typeof setupConvexTest>;

async function seedGame(
  t: T,
  options: { fresh?: boolean; withLine?: boolean } = {}
): Promise<{
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  poemIds: Id<'poems'>[];
}> {
  const now = Date.now();
  return t.run(async (ctx) => {
    const userIds = await Promise.all(
      ['Host', 'Guest'].map((displayName) =>
        ctx.db.insert('users', {
          displayName,
          kind: 'human',
          createdAt: now,
        })
      )
    );
    const roomId = await ctx.db.insert('rooms', {
      code: 'ABCD',
      hostUserId: userIds[0],
      status: 'IN_PROGRESS',
      createdAt: now,
      retentionState: 'active',
    });
    await Promise.all(
      userIds.map((userId, seatIndex) =>
        ctx.db.insert('roomPlayers', {
          roomId,
          userId,
          displayName: seatIndex === 0 ? 'Host' : 'Guest',
          seatIndex,
          joinedAt: now,
          lastSeenAt: options.fresh ? now : now - ABANDONMENT_THRESHOLD_MS - 1,
        })
      )
    );
    const assignmentMatrix = Array.from(
      { length: WORD_COUNTS.length },
      (_, r) =>
        userIds.map((_, poemIndex) => userIds[(poemIndex + r) % userIds.length])
    );
    const gameId = await ctx.db.insert('games', {
      roomId,
      status: 'IN_PROGRESS',
      cycle: 1,
      currentRound: 0,
      roundStartedAt: now - ABANDONMENT_THRESHOLD_MS - 1,
      assignmentMatrix,
      createdAt: now - ABANDONMENT_THRESHOLD_MS - 1,
      retentionState: 'active',
    });
    await ctx.db.patch(roomId, { currentGameId: gameId });
    const poemIds = await Promise.all(
      userIds.map((_, indexInRoom) =>
        ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom,
          createdAt: now,
          retentionState: 'active',
        })
      )
    );
    if (options.withLine) {
      await ctx.db.insert('lines', {
        poemId: poemIds[0],
        indexInPoem: 0,
        text: 'still',
        wordCount: 1,
        authorUserId: userIds[0],
        authorDisplayName: 'Host',
        createdAt: now,
      });
    }
    return { roomId, gameId, poemIds };
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('abandonment', () => {
  it('closes an unattended game as ABANDONED without inserting or revealing lines', async () => {
    const t = setupConvexTest();
    const { roomId, gameId, poemIds } = await seedGame(t, { withLine: true });

    const result = await t.mutation(internal.abandonment.finishAbandonedGame, {
      gameId,
    });
    expect(result).toEqual({ abandoned: true });

    const state = await t.run(async (ctx) => ({
      game: await ctx.db.get(gameId),
      room: await ctx.db.get(roomId),
      poems: await Promise.all(poemIds.map((poemId) => ctx.db.get(poemId))),
      lines: await ctx.db.query('lines').collect(),
      players: await ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .collect(),
    }));

    expect(state.game?.status).toBe('ABANDONED');
    expect(state.game?.completionKind).toBe('abandoned');
    expect(state.game?.retentionEligibleAt).toBe(
      state.game!.completedAt! + RETENTION_DURATIONS_MS.abandoned
    );
    expect(state.room?.status).toBe('COMPLETED');
    expect(state.room?.currentGameId).toBeUndefined();
    expect(state.players).toHaveLength(0);
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0].text).toBe('still');
    expect(state.poems.every((poem) => poem?.completedAt === undefined)).toBe(
      true
    );
    expect(
      state.poems.every((poem) => poem?.assignedReaderId === undefined)
    ).toBe(true);
  });

  it('does nothing while any participant has a fresh heartbeat', async () => {
    const t = setupConvexTest();
    const { gameId } = await seedGame(t, { fresh: true });
    expect(
      await t.mutation(internal.abandonment.finishAbandonedGame, { gameId })
    ).toEqual({ abandoned: false });
    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('IN_PROGRESS');
  });

  it('uses the bounded indexed sweep and scheduled worker to abandon stale games', async () => {
    const t = setupConvexTest();
    const { gameId } = await seedGame(t);
    expect(
      await t.mutation(internal.abandonment.sweepAbandonedGames, { limit: 1 })
    ).toEqual({ scheduled: 1, scanned: 1 });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('ABANDONED');
    expect(await t.run((ctx) => ctx.db.query('lines').collect())).toHaveLength(
      0
    );
  });
});
