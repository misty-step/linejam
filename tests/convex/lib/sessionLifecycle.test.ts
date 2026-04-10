import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  applyLineLifecycleTransition,
  buildCompletionPatchPlan,
  getCycleResetDecision,
  getSubmissionWindow,
  isRevealReady,
} from '../../../convex/lib/sessionLifecycle';
import { createMockCtx, createMockDb } from '../../helpers/mockConvexDb';

const asId = <T extends 'games' | 'poems' | 'rooms' | 'users'>(value: string) =>
  value as unknown as Id<T>;

describe('sessionLifecycle', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCtx = {
      ...createMockCtx(mockDb),
      scheduler: { runAfter: vi.fn() },
    };
  });

  it('allows final-round late submissions after completion', () => {
    expect(
      getSubmissionWindow(
        {
          status: 'COMPLETED',
          currentRound: 8,
        },
        8
      )
    ).toEqual({ ok: true });
  });

  it('rejects future-round submissions while the game is in progress', () => {
    expect(
      getSubmissionWindow(
        {
          status: 'IN_PROGRESS',
          currentRound: 2,
        },
        3
      )
    ).toEqual({ ok: false, reason: 'ROUND_NOT_STARTED' });
  });

  it('only allows cycle reset from a completed game', () => {
    expect(
      getCycleResetDecision({
        activeGame: { status: 'IN_PROGRESS' },
        completedGame: { status: 'COMPLETED' },
      })
    ).toEqual({ ok: false, reason: 'GAME_STILL_IN_PROGRESS' });

    expect(
      getCycleResetDecision({
        activeGame: null,
        completedGame: null,
      })
    ).toEqual({ ok: false, reason: 'NO_COMPLETED_GAME' });

    expect(
      getCycleResetDecision({
        activeGame: null,
        completedGame: { status: 'COMPLETED' },
      })
    ).toEqual({ ok: true });
    expect(isRevealReady({ status: 'COMPLETED' })).toBe(true);
    expect(isRevealReady({ status: 'IN_PROGRESS' })).toBe(false);
  });

  it('builds the terminal completion patch plan with assigned readers', () => {
    const plan = buildCompletionPatchPlan({
      game: {
        assignmentMatrix: Array.from({ length: 9 }, () => [
          asId('user1'),
          asId('user2'),
        ]),
      },
      poems: [
        { _id: asId('poem1'), indexInRoom: 0 },
        { _id: asId('poem2'), indexInRoom: 1 },
      ],
      playerUsers: [
        { _id: asId('user1'), kind: 'human' },
        { _id: asId('user2'), kind: 'human' },
      ],
      completionTime: 1234,
    });

    expect(plan.gamePatch).toEqual({
      status: 'COMPLETED',
      completedAt: 1234,
    });
    expect(plan.roomPatch).toEqual({
      status: 'COMPLETED',
      completedAt: 1234,
    });
    expect(plan.poemPatches).toEqual(
      expect.arrayContaining([
        {
          poemId: asId('poem1'),
          patch: {
            completedAt: 1234,
            assignedReaderId: asId('user2'),
          },
        },
        {
          poemId: asId('poem2'),
          patch: {
            completedAt: 1234,
            assignedReaderId: asId('user1'),
          },
        },
      ])
    );
  });

  it('advances the round once every poem has a line', async () => {
    mockDb.collect.mockResolvedValue([
      { _id: asId('poem1'), indexInRoom: 0 },
      { _id: asId('poem2'), indexInRoom: 1 },
    ]);
    mockDb.first
      .mockResolvedValueOnce({ _id: 'line1' })
      .mockResolvedValueOnce({ _id: 'line2' });
    mockDb.get.mockResolvedValue({
      _id: asId('game1'),
      status: 'IN_PROGRESS',
      currentRound: 0,
      assignmentMatrix: [[asId('user1'), asId('user2')]],
    });

    const result = await applyLineLifecycleTransition(mockCtx, {
      game: {
        _id: asId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 0,
        assignmentMatrix: [[asId('user1'), asId('user2')]],
      },
      roomId: asId('room1'),
      lineIndex: 0,
    });

    expect(result).toEqual({ status: 'advanced', nextRound: 1 });
    expect(mockDb.patch).toHaveBeenCalledWith(asId('game1'), {
      currentRound: 1,
    });
    expect(mockCtx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      expect.anything(),
      {
        roomId: asId('room1'),
        gameId: asId('game1'),
        round: 1,
      }
    );
  });
});
