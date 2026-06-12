import { beforeEach, describe, expect, it, vi } from 'vitest';
import { internal } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  applyLineLifecycleTransition,
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

  it('rejects invalid round indexes before checking game state', () => {
    expect(
      getSubmissionWindow(
        {
          status: 'IN_PROGRESS',
          currentRound: 2,
        },
        -1
      )
    ).toEqual({ ok: false, reason: 'INVALID_ROUND' });
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

  it('returns pending when the round is not complete yet', async () => {
    mockDb.collect.mockResolvedValue([
      { _id: asPoemId('poem1'), indexInRoom: 0 },
      { _id: asPoemId('poem2'), indexInRoom: 1 },
    ]);
    mockDb.first
      .mockResolvedValueOnce({ _id: 'line1' })
      .mockResolvedValueOnce(null);

    await applyLineLifecycleTransition(mockCtx, {
      game: {
        _id: asGameId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 0,
        assignmentMatrix: [[asUserId('user1'), asUserId('user2')]],
      },
      roomId: asRoomId('room1'),
      lineIndex: 0,
    });

    expect(mockDb.patch).not.toHaveBeenCalled();
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
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

    await applyLineLifecycleTransition(mockCtx, {
      game: {
        _id: asGameId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 0,
        assignmentMatrix: [[asUserId('user1'), asUserId('user2')]],
      },
      roomId: asRoomId('room1'),
      lineIndex: 0,
    });

    expect(mockDb.patch).toHaveBeenCalledWith(asGameId('game1'), {
      currentRound: 1,
    });
    expect(mockCtx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      internal.ai.scheduleAiTurn,
      {
        roomId: asRoomId('room1'),
        gameId: asGameId('game1'),
        round: 1,
      }
    );
  });

  it('scopes the submission window to the game mode', () => {
    // Quick jam ends at round index 4; classic would still be mid-game there.
    expect(
      getSubmissionWindow(
        { status: 'COMPLETED', currentRound: 4, mode: 'quick' },
        4
      )
    ).toEqual({ ok: true });

    expect(
      getSubmissionWindow(
        { status: 'IN_PROGRESS', currentRound: 4, mode: 'quick' },
        5
      )
    ).toEqual({ ok: false, reason: 'INVALID_ROUND' });

    expect(
      getSubmissionWindow(
        { status: 'COMPLETED', currentRound: 4, mode: 'classic' },
        4
      )
    ).toEqual({ ok: false, reason: 'GAME_NOT_IN_PROGRESS' });
  });

  it('completes a quick-jam game at its five-round boundary', async () => {
    const assignmentMatrix: Id<'users'>[][] = Array.from({ length: 5 }, () => [
      asUserId('user1'),
      asUserId('user2'),
    ]);

    mockDb.collect
      .mockResolvedValueOnce([
        { _id: asPoemId('poem1'), indexInRoom: 0 },
        { _id: asPoemId('poem2'), indexInRoom: 1 },
      ])
      .mockResolvedValueOnce([
        { userId: asUserId('user1') },
        { userId: asUserId('user2') },
      ]);
    mockDb.first
      .mockResolvedValueOnce({ _id: 'line1' })
      .mockResolvedValueOnce({ _id: 'line2' });
    mockDb.get
      .mockResolvedValueOnce({
        _id: asGameId('game1'),
        status: 'IN_PROGRESS',
        mode: 'quick',
        currentRound: 4,
        assignmentMatrix,
      })
      .mockResolvedValueOnce({ _id: asUserId('user1'), kind: 'human' })
      .mockResolvedValueOnce({ _id: asUserId('user2'), kind: 'human' });

    await applyLineLifecycleTransition(mockCtx, {
      game: {
        _id: asGameId('game1'),
        status: 'IN_PROGRESS',
        mode: 'quick',
        currentRound: 4,
        assignmentMatrix,
      },
      roomId: asRoomId('room1'),
      lineIndex: 4,
    });

    expect(mockDb.patch).toHaveBeenCalledWith(
      asGameId('game1'),
      expect.objectContaining({ status: 'COMPLETED' })
    );
    expect(mockDb.patch).toHaveBeenCalledWith(
      asRoomId('room1'),
      expect.objectContaining({ status: 'COMPLETED' })
    );
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
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

    await applyLineLifecycleTransition(mockCtx, {
      game: {
        _id: asGameId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 8,
        assignmentMatrix,
      },
      roomId: asRoomId('room1'),
      lineIndex: 8,
    });

    expect(mockDb.patch).not.toHaveBeenCalled();
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });
});
