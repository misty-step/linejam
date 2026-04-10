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

const asGameId = (value: string) => value as unknown as Id<'games'>;
const asPoemId = (value: string) => value as unknown as Id<'poems'>;
const asRoomId = (value: string) => value as unknown as Id<'rooms'>;
const asUserId = (value: string) => value as unknown as Id<'users'>;

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
          asUserId('user1'),
          asUserId('user2'),
        ]),
      },
      poems: [
        { _id: asPoemId('poem1'), indexInRoom: 0 },
        { _id: asPoemId('poem2'), indexInRoom: 1 },
      ],
      playerUsers: [
        { _id: asUserId('user1'), kind: 'human' },
        { _id: asUserId('user2'), kind: 'human' },
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
          poemId: asPoemId('poem1'),
          patch: {
            completedAt: 1234,
            assignedReaderId: asUserId('user2'),
          },
        },
        {
          poemId: asPoemId('poem2'),
          patch: {
            completedAt: 1234,
            assignedReaderId: asUserId('user1'),
          },
        },
      ])
    );
  });

  it('advances the round once every poem has a line', async () => {
    mockDb.collect.mockResolvedValue([
      { _id: asPoemId('poem1'), indexInRoom: 0 },
      { _id: asPoemId('poem2'), indexInRoom: 1 },
    ]);
    mockDb.first
      .mockResolvedValueOnce({ _id: 'line1' })
      .mockResolvedValueOnce({ _id: 'line2' });
    mockDb.get.mockResolvedValue({
      _id: asGameId('game1'),
      status: 'IN_PROGRESS',
      currentRound: 0,
      assignmentMatrix: [[asUserId('user1'), asUserId('user2')]],
    });

    const result = await applyLineLifecycleTransition(mockCtx, {
      game: {
        _id: asGameId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 0,
        assignmentMatrix: [[asUserId('user1'), asUserId('user2')]],
      },
      roomId: asRoomId('room1'),
      lineIndex: 0,
    });

    expect(result).toEqual({ status: 'advanced', nextRound: 1 });
    expect(mockDb.patch).toHaveBeenCalledWith(asGameId('game1'), {
      currentRound: 1,
    });
    expect(mockCtx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      expect.anything(),
      {
        roomId: asRoomId('room1'),
        gameId: asGameId('game1'),
        round: 1,
      }
    );
  });

  it('treats final-round completion re-entry as stale once the game is completed', async () => {
    const assignmentMatrix: Id<'users'>[][] = Array.from({ length: 9 }, () => [
      asUserId('user1'),
      asUserId('user2'),
    ]);

    mockDb.collect.mockResolvedValue([
      { _id: asPoemId('poem1'), indexInRoom: 0 },
      { _id: asPoemId('poem2'), indexInRoom: 1 },
    ]);
    mockDb.first
      .mockResolvedValueOnce({ _id: 'line1' })
      .mockResolvedValueOnce({ _id: 'line2' });
    mockDb.get.mockResolvedValue({
      _id: asGameId('game1'),
      status: 'COMPLETED',
      currentRound: 8,
      assignmentMatrix,
    });

    const result = await applyLineLifecycleTransition(mockCtx, {
      game: {
        _id: asGameId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 8,
        assignmentMatrix,
      },
      roomId: asRoomId('room1'),
      lineIndex: 8,
    });

    expect(result).toEqual({ status: 'stale' });
    expect(mockDb.patch).not.toHaveBeenCalled();
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });
});
