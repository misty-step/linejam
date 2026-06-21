/**
 * Unit coverage for fillStaleHumanTurns ROUTING only: which poems get a ghost
 * scheduled (human-assigned, line missing) vs skipped (AI-assigned, already
 * written, wrong round, not IN_PROGRESS). It mocks the Convex server to assert
 * the scheduler dispatch. The full ghost-fill chain (generateGhostLine ->
 * commitGhostLine -> lifecycle transition -> COMPLETED) is proven end-to-end on
 * the real convex-test engine in abandonment.test.ts; backlog 018 migrates this
 * file off the mock DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createMockCtx } from '../helpers/mockConvexDb';
import type { Id } from '../../convex/_generated/dataModel';
import { internal } from '../../convex/_generated/api';

// Mock Convex server functions
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
  internalMutation: (args: unknown) => args,
}));

import { fillStaleHumanTurns } from '../../convex/game';

// Mock assignmentMatrix — use real getMatrixRound, mock the rest
vi.mock('../../convex/lib/assignmentMatrix', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../convex/lib/assignmentMatrix')>();
  return {
    ...actual,
    generateAssignmentMatrix: () => [
      [0, 1],
      [1, 0],
    ],
    secureShuffle: <T>(arr: T[]) => arr,
  };
});

const asGameId = (v: string) => v as unknown as Id<'games'>;
const asRoomId = (v: string) => v as unknown as Id<'rooms'>;
const asUserId = (v: string) => v as unknown as Id<'users'>;
const asPoemId = (v: string) => v as unknown as Id<'poems'>;

type MockDb = ReturnType<typeof createMockDb>;
type MockCtx = ReturnType<typeof createMockCtx> & {
  scheduler: { runAfter: ReturnType<typeof vi.fn> };
};

describe('fillStaleHumanTurns', () => {
  let mockDb: MockDb;
  let mockCtx: MockCtx;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCtx = {
      ...createMockCtx(mockDb),
      scheduler: { runAfter: vi.fn() },
    };
  });

  it('schedules ghost lines for missing human poems', async () => {
    const assignmentMatrix: Id<'users'>[][] = [
      [asUserId('user1'), asUserId('user2')],
    ];
    const game = {
      _id: asGameId('game1'),
      status: 'IN_PROGRESS' as const,
      currentRound: 0,
      mode: 'classic',
      assignmentMatrix,
    };

    mockDb.get
      .mockResolvedValueOnce(game) // game lookup
      .mockResolvedValueOnce({ _id: asUserId('user1'), kind: 'human' }) // poem0's author
      .mockResolvedValueOnce({ _id: asUserId('user2'), kind: 'human' }); // poem1's author

    mockDb.collect.mockResolvedValueOnce([
      { _id: asPoemId('poem1'), indexInRoom: 0 },
      { _id: asPoemId('poem2'), indexInRoom: 1 },
    ]);

    // Both poems missing lines → both are stale human poems
    mockDb.first.mockResolvedValue(null);

    // @ts-expect-error — calling handler directly for test
    await fillStaleHumanTurns.handler(mockCtx, {
      roomId: asRoomId('room1'),
      gameId: asGameId('game1'),
      round: 0,
    });

    expect(mockCtx.scheduler.runAfter).toHaveBeenCalledTimes(2);
    expect(mockCtx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      internal.ai.generateGhostLine,
      expect.objectContaining({
        roomId: asRoomId('room1'),
        gameId: asGameId('game1'),
        round: 0,
      })
    );
  });

  it('is a no-op when all lines already exist', async () => {
    const assignmentMatrix: Id<'users'>[][] = [
      [asUserId('user1'), asUserId('user2')],
    ];
    const game = {
      _id: asGameId('game1'),
      status: 'IN_PROGRESS' as const,
      currentRound: 0,
      mode: 'classic',
      assignmentMatrix,
    };

    mockDb.get
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce({ _id: asUserId('user1'), kind: 'human' })
      .mockResolvedValueOnce({ _id: asUserId('user2'), kind: 'human' });

    mockDb.collect.mockResolvedValueOnce([
      { _id: asPoemId('poem1'), indexInRoom: 0 },
      { _id: asPoemId('poem2'), indexInRoom: 1 },
    ]);

    // Both poems have lines
    mockDb.first.mockResolvedValue({ _id: 'line1' });

    // @ts-expect-error — calling handler directly for test
    await fillStaleHumanTurns.handler(mockCtx, {
      roomId: asRoomId('room1'),
      gameId: asGameId('game1'),
      round: 0,
    });

    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it('skips AI-assigned poems', async () => {
    const assignmentMatrix: Id<'users'>[][] = [
      [asUserId('user1'), asUserId('ai1')],
    ];
    const game = {
      _id: asGameId('game1'),
      status: 'IN_PROGRESS' as const,
      currentRound: 0,
      mode: 'classic',
      assignmentMatrix,
    };

    mockDb.get
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce({ _id: asUserId('user1'), kind: 'human' }) // poem0 author = human
      .mockResolvedValueOnce({ _id: asUserId('ai1'), kind: 'AI' }); // poem1 author = AI

    mockDb.collect.mockResolvedValueOnce([
      { _id: asPoemId('poem1'), indexInRoom: 0 },
      { _id: asPoemId('poem2'), indexInRoom: 1 },
    ]);

    // Both poems missing lines, but poem1 belongs to AI
    mockDb.first.mockResolvedValue(null);

    // @ts-expect-error — calling handler directly for test
    await fillStaleHumanTurns.handler(mockCtx, {
      roomId: asRoomId('room1'),
      gameId: asGameId('game1'),
      round: 0,
    });

    // Only one ghost line scheduled — for the human poem
    expect(mockCtx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    expect(mockCtx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      internal.ai.generateGhostLine,
      expect.objectContaining({
        poemId: asPoemId('poem1'),
        forUserId: asUserId('user1'),
      })
    );
  });

  it('is a no-op when the game is completed', async () => {
    const game = {
      _id: asGameId('game1'),
      status: 'COMPLETED' as const,
      currentRound: 0,
      mode: 'classic',
      assignmentMatrix: [[asUserId('user1')]],
    };

    mockDb.get.mockResolvedValueOnce(game);

    // @ts-expect-error — calling handler directly for test
    await fillStaleHumanTurns.handler(mockCtx, {
      roomId: asRoomId('room1'),
      gameId: asGameId('game1'),
      round: 0,
    });

    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it('is a no-op when the round has advanced', async () => {
    const game = {
      _id: asGameId('game1'),
      status: 'IN_PROGRESS' as const,
      currentRound: 2,
      mode: 'classic',
      assignmentMatrix: [[asUserId('user1')]],
    };

    mockDb.get.mockResolvedValueOnce(game);

    // @ts-expect-error — calling handler directly for test
    await fillStaleHumanTurns.handler(mockCtx, {
      roomId: asRoomId('room1'),
      gameId: asGameId('game1'),
      round: 1, // stale round
    });

    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });
});
