import { describe, expect, it } from 'vitest';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  applyLineLifecycleTransition,
  getCycleResetDecision,
  getSubmissionWindow,
  isRevealReady,
} from '../../../convex/lib/sessionLifecycle';
import { RETENTION_DURATIONS_MS } from '../../../convex/lib/retentionPolicy';
import { WORD_COUNTS } from '../../../convex/lib/gameRules';
import { setupConvexTest } from '../../helpers/convexTest';

const matrixOf = (rounds: number): Id<'users'>[][] =>
  Array.from({ length: rounds }, () => []);

describe('session lifecycle decisions', () => {
  it('accepts late final submissions only for reveal-ready completion', () => {
    expect(
      getSubmissionWindow(
        {
          status: 'COMPLETED',
          currentRound: 8,
          assignmentMatrix: matrixOf(9),
        },
        8
      )
    ).toEqual({ ok: true });
    expect(
      getSubmissionWindow(
        {
          status: 'ABANDONED',
          currentRound: 3,
          assignmentMatrix: matrixOf(9),
        },
        3
      )
    ).toEqual({ ok: false, reason: 'GAME_NOT_IN_PROGRESS' });
  });

  it('rejects future and out-of-range rounds', () => {
    expect(
      getSubmissionWindow(
        {
          status: 'IN_PROGRESS',
          currentRound: 2,
          assignmentMatrix: matrixOf(9),
        },
        3
      )
    ).toEqual({ ok: false, reason: 'ROUND_NOT_STARTED' });
    expect(
      getSubmissionWindow(
        {
          status: 'IN_PROGRESS',
          currentRound: 2,
          assignmentMatrix: matrixOf(9),
        },
        9
      )
    ).toEqual({ ok: false, reason: 'INVALID_ROUND' });
  });

  it('requires a genuinely completed game for reveal and restart', () => {
    expect(isRevealReady({ status: 'COMPLETED' })).toBe(true);
    expect(
      isRevealReady({
        status: 'COMPLETED',
        completionKind: 'abandoned',
      })
    ).toBe(false);
    expect(isRevealReady({ status: 'ABANDONED' })).toBe(false);
    expect(
      getCycleResetDecision({
        activeGame: null,
        completedGame: { status: 'COMPLETED' },
      })
    ).toEqual({ ok: true });
    expect(
      getCycleResetDecision({
        activeGame: null,
        completedGame: { status: 'ABANDONED' },
      })
    ).toEqual({ ok: false, reason: 'NO_COMPLETED_GAME' });
  });
});

describe('applyLineLifecycleTransition', () => {
  it('waits for every assigned human and inserts no automatic line', async () => {
    const t = setupConvexTest();
    const seeded = await t.run(async (ctx) => {
      const users = await Promise.all(
        ['Alice', 'Bob'].map((displayName) =>
          ctx.db.insert('users', {
            displayName,
            kind: 'human',
            createdAt: 1,
          })
        )
      );
      const roomId = await ctx.db.insert('rooms', {
        code: 'WAIT',
        hostUserId: users[0],
        status: 'IN_PROGRESS',
        createdAt: 1,
      });
      const assignmentMatrix = Array.from(
        { length: WORD_COUNTS.length },
        (_, round) => [users[round % 2], users[(round + 1) % 2]]
      );
      const gameId = await ctx.db.insert('games', {
        roomId,
        status: 'IN_PROGRESS',
        cycle: 1,
        currentRound: 0,
        assignmentMatrix,
        createdAt: 1,
      });
      const poems = await Promise.all(
        [0, 1].map((indexInRoom) =>
          ctx.db.insert('poems', {
            roomId,
            gameId,
            indexInRoom,
            createdAt: 1,
          })
        )
      );
      await ctx.db.insert('lines', {
        poemId: poems[0],
        indexInPoem: 0,
        text: 'one',
        wordCount: 1,
        authorUserId: users[0],
        createdAt: 1,
      });
      return { roomId, gameId };
    });
    const game = await t.run((ctx) => ctx.db.get(seeded.gameId));
    await t.run((ctx) =>
      applyLineLifecycleTransition(ctx, {
        game: game!,
        roomId: seeded.roomId,
        lineIndex: 0,
      })
    );

    const [after, lines] = await t.run(async (ctx) => [
      await ctx.db.get(seeded.gameId),
      await ctx.db.query('lines').collect(),
    ]);
    expect(after?.currentRound).toBe(0);
    expect(after?.status).toBe('IN_PROGRESS');
    expect(lines).toHaveLength(1);
  });

  it('completes exactly nine human-authored rounds with deterministic readers', async () => {
    const t = setupConvexTest();
    const seeded = await t.run(async (ctx) => {
      const users = await Promise.all(
        ['Alice', 'Bob'].map((displayName) =>
          ctx.db.insert('users', {
            displayName,
            kind: 'human',
            createdAt: 1,
          })
        )
      );
      const roomId = await ctx.db.insert('rooms', {
        code: 'DONE',
        hostUserId: users[0],
        status: 'IN_PROGRESS',
        createdAt: 1,
      });
      await Promise.all(
        users.map((userId, seatIndex) =>
          ctx.db.insert('roomPlayers', {
            roomId,
            userId,
            displayName: seatIndex === 0 ? 'Alice' : 'Bob',
            seatIndex,
            joinedAt: 1,
          })
        )
      );
      const assignmentMatrix = Array.from(
        { length: WORD_COUNTS.length },
        (_, round) => [users[round % 2], users[(round + 1) % 2]]
      );
      const gameId = await ctx.db.insert('games', {
        roomId,
        status: 'IN_PROGRESS',
        cycle: 1,
        currentRound: WORD_COUNTS.length - 1,
        assignmentMatrix,
        createdAt: 1,
      });
      const poems = await Promise.all(
        [0, 1].map((indexInRoom) =>
          ctx.db.insert('poems', {
            roomId,
            gameId,
            indexInRoom,
            createdAt: 1,
          })
        )
      );
      for (let round = 0; round < WORD_COUNTS.length; round++) {
        const wordCount = WORD_COUNTS[round];
        for (let poemIndex = 0; poemIndex < poems.length; poemIndex++) {
          await ctx.db.insert('lines', {
            poemId: poems[poemIndex],
            indexInPoem: round,
            text: Array.from({ length: wordCount }, () => 'word').join(' '),
            wordCount,
            authorUserId: assignmentMatrix[round][poemIndex],
            createdAt: round + 1,
          });
        }
      }
      return { roomId, gameId, poems, users };
    });

    const game = await t.run((ctx) => ctx.db.get(seeded.gameId));
    await t.run((ctx) =>
      applyLineLifecycleTransition(ctx, {
        game: game!,
        roomId: seeded.roomId,
        lineIndex: WORD_COUNTS.length - 1,
      })
    );

    const [after, poems] = await t.run(async (ctx) => [
      await ctx.db.get(seeded.gameId),
      await Promise.all(seeded.poems.map((poemId) => ctx.db.get(poemId))),
    ]);
    expect(after?.status).toBe('COMPLETED');
    expect(after).not.toHaveProperty('completionKind');
    expect(after?.retentionEligibleAt).toBe(
      after!.completedAt! + RETENTION_DURATIONS_MS.privateCompleted
    );
    expect(poems[0]?.assignedReaderId).toBe(seeded.users[1]);
    expect(poems[1]?.assignedReaderId).toBe(seeded.users[0]);
    expect(poems.every((poem) => poem?.completedAt !== undefined)).toBe(true);
  });
});
