import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import { createMockCtx, createMockDb } from '../helpers/mockConvexDb';

vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
  internalMutation: (args: unknown) => args,
  internalAction: (args: unknown) => args,
  internalQuery: (args: unknown) => args,
}));

vi.mock('../../convex/lib/ai/personas', () => ({
  pickRandomPersona: vi.fn(),
  getPersona: vi.fn(),
}));

vi.mock('../../convex/lib/ai/llm', () => ({
  generateLine: vi.fn(),
  getFallbackLine: (wordCount: number) =>
    Array.from({ length: wordCount }, (_, index) => `fallback${index}`).join(
      ' '
    ),
}));

vi.mock('../../convex/lib/env', () => ({
  getConvexRuntimeConfig: () => ({ openRouterApiKey: null }),
}));

vi.mock('../../convex/lib/errors', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { commitAiLine } from '../../convex/ai';

const asId = <T extends 'games' | 'poems' | 'rooms' | 'users'>(value: string) =>
  value as unknown as Id<T>;

const commitAiLineHandler = (
  commitAiLine as unknown as {
    handler: (ctx: unknown, args: unknown) => Promise<void>;
  }
).handler;

describe('ai lifecycle', () => {
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

  it('does not double-advance when a concurrent mutation already moved the round', async () => {
    mockDb.get
      .mockResolvedValueOnce({ _id: asId('room1') })
      .mockResolvedValueOnce({
        _id: asId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 0,
        assignmentMatrix: [[asId('ai1'), asId('user2')]],
      })
      .mockResolvedValueOnce({
        _id: asId('poem1'),
        indexInRoom: 0,
      })
      .mockResolvedValueOnce({
        _id: asId('ai1'),
        displayName: 'Robot',
      })
      .mockResolvedValueOnce({
        _id: asId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 1,
        assignmentMatrix: [[asId('ai1'), asId('user2')]],
      });
    mockDb.first
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: 'line1' })
      .mockResolvedValueOnce({ _id: 'line2' });
    mockDb.collect.mockResolvedValue([
      { _id: asId('poem1'), indexInRoom: 0 },
      { _id: asId('poem2'), indexInRoom: 1 },
    ]);

    await commitAiLineHandler(mockCtx, {
      poemId: asId('poem1'),
      lineIndex: 0,
      text: 'hello',
      aiUserId: asId('ai1'),
      roomId: asId('room1'),
      gameId: asId('game1'),
    });

    expect(mockDb.insert).toHaveBeenCalledWith(
      'lines',
      expect.objectContaining({
        text: 'hello',
        authorUserId: asId('ai1'),
      })
    );
    expect(mockDb.patch).not.toHaveBeenCalledWith(asId('game1'), {
      currentRound: 1,
    });
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it('marks the game and room completed on the final round', async () => {
    const assignmentMatrix = Array.from({ length: 9 }, () => [
      asId('ai1'),
      asId('user2'),
    ]);

    mockDb.get
      .mockResolvedValueOnce({ _id: asId('room1') })
      .mockResolvedValueOnce({
        _id: asId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 8,
        assignmentMatrix,
      })
      .mockResolvedValueOnce({
        _id: asId('poem1'),
        indexInRoom: 0,
      })
      .mockResolvedValueOnce({
        _id: asId('ai1'),
        displayName: 'Robot',
      })
      .mockResolvedValueOnce({
        _id: asId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 8,
        assignmentMatrix,
      })
      .mockResolvedValueOnce({
        _id: asId('ai1'),
        kind: 'AI',
      })
      .mockResolvedValueOnce({
        _id: asId('user2'),
        kind: 'human',
      });
    mockDb.first
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: 'line1' })
      .mockResolvedValueOnce({ _id: 'line2' });
    mockDb.collect
      .mockResolvedValueOnce([
        { _id: asId('poem1'), indexInRoom: 0 },
        { _id: asId('poem2'), indexInRoom: 1 },
      ])
      .mockResolvedValueOnce([
        { userId: asId('ai1') },
        { userId: asId('user2') },
      ]);

    await commitAiLineHandler(mockCtx, {
      poemId: asId('poem1'),
      lineIndex: 8,
      text: 'finale',
      aiUserId: asId('ai1'),
      roomId: asId('room1'),
      gameId: asId('game1'),
    });

    expect(mockDb.insert).toHaveBeenCalledWith(
      'lines',
      expect.objectContaining({
        text: 'finale',
        wordCount: 1,
      })
    );
    expect(mockDb.patch).toHaveBeenCalledWith(
      asId('game1'),
      expect.objectContaining({
        status: 'COMPLETED',
      })
    );
    expect(mockDb.patch).toHaveBeenCalledWith(
      asId('room1'),
      expect.objectContaining({
        status: 'COMPLETED',
      })
    );
    expect(mockDb.patch).toHaveBeenCalledWith(
      asId('poem1'),
      expect.objectContaining({
        completedAt: expect.any(Number),
        assignedReaderId: asId('user2'),
      })
    );
    expect(mockDb.patch).toHaveBeenCalledWith(
      asId('poem2'),
      expect.objectContaining({
        completedAt: expect.any(Number),
        assignedReaderId: asId('user2'),
      })
    );
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it('treats duplicate submissions as a no-op', async () => {
    mockDb.get
      .mockResolvedValueOnce({ _id: asId('room1') })
      .mockResolvedValueOnce({
        _id: asId('game1'),
        status: 'IN_PROGRESS',
        currentRound: 0,
        assignmentMatrix: [[asId('ai1'), asId('user2')]],
      })
      .mockResolvedValueOnce({
        _id: asId('poem1'),
        indexInRoom: 0,
      });
    mockDb.first.mockResolvedValueOnce({ _id: 'existing-line' });

    await commitAiLineHandler(mockCtx, {
      poemId: asId('poem1'),
      lineIndex: 0,
      text: 'hello',
      aiUserId: asId('ai1'),
      roomId: asId('room1'),
      gameId: asId('game1'),
    });

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.patch).not.toHaveBeenCalled();
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });
});
