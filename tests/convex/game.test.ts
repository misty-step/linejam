import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Convex server functions
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
}));

import {
  startNewCycle,
  startGame,
  getCurrentAssignment,
  submitLine,
  getRevealPhaseState,
  revealPoem,
  getRoundProgress,
} from '../../convex/game';

// Mock dependencies
const mockGetUser = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock('../../convex/lib/assignmentMatrix', () => ({
  generateAssignmentMatrix: () => [
    [0, 1],
    [1, 0],
  ], // Mock matrix
}));

// Mock word count to avoid import issues or complex logic
vi.mock('../../convex/lib/wordCount', () => ({
  countWords: (text: string) => text.split(' ').length,
}));

describe('game', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(() => mockDb),
      withIndex: vi.fn(() => mockDb),
      first: vi.fn(),
      collect: vi.fn(),
      patch: vi.fn(),
      insert: vi.fn(),
      get: vi.fn(),
    };
    mockCtx = {
      db: mockDb,
      auth: { getUserIdentity: vi.fn() },
    };
    mockGetUser.mockReset();
  });

  describe('startNewCycle', () => {
    it('throws if user not found', async () => {
      mockGetUser.mockResolvedValue(null);
      await expect(
        // @ts-expect-error - calling handler directly for test
        startNewCycle.handler(mockCtx, {
          roomCode: 'TEST',
          guestToken: 'token',
        })
      ).rejects.toThrow('User not found');
    });

    it('throws if room not found', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.first.mockResolvedValue(null);

      await expect(
        // @ts-expect-error - calling handler directly for test
        startNewCycle.handler(mockCtx, {
          roomCode: 'TEST',
          guestToken: 'token',
        })
      ).rejects.toThrow('Room not found');
    });

    it('throws if user is not host', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user2' });
      mockDb.first.mockResolvedValue({
        _id: 'room1',
        hostUserId: 'user1',
        status: 'COMPLETED',
      });

      await expect(
        // @ts-expect-error - calling handler directly for test
        startNewCycle.handler(mockCtx, {
          roomCode: 'TEST',
          guestToken: 'token',
        })
      ).rejects.toThrow('Only host can start new cycle');
    });

    it('throws if room not completed', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.first.mockResolvedValue({
        _id: 'room1',
        hostUserId: 'user1',
        status: 'IN_PROGRESS',
      });

      await expect(
        // @ts-expect-error - calling handler directly for test
        startNewCycle.handler(mockCtx, {
          roomCode: 'TEST',
          guestToken: 'token',
        })
      ).rejects.toThrow('Current cycle not completed');
    });

    it('resets room to LOBBY on success', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const room = {
        _id: 'room1',
        hostUserId: 'user1',
        status: 'COMPLETED',
        currentCycle: 1,
        currentGameId: 'game1',
      };
      mockDb.first.mockResolvedValue(room);

      // @ts-expect-error - calling handler directly for test
      await startNewCycle.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });

      expect(mockDb.patch).toHaveBeenCalledWith('room1', {
        status: 'LOBBY',
        currentGameId: undefined,
      });
    });
  });

  describe('startGame', () => {
    it('starts game successfully', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.first.mockResolvedValue({
        _id: 'room1',
        hostUserId: 'user1',
        status: 'LOBBY',
        code: 'TEST',
      });
      mockDb.collect.mockResolvedValue([
        { _id: 'p1', userId: 'user1' },
        { _id: 'p2', userId: 'user2' },
      ]);
      mockDb.insert.mockResolvedValue('game1');

      // @ts-expect-error - calling handler
      await startGame.handler(mockCtx, { code: 'TEST', guestToken: 'token' });

      expect(mockDb.insert).toHaveBeenCalledWith('games', expect.anything());
      expect(mockDb.patch).toHaveBeenCalledWith('room1', expect.anything());
    });
  });

  describe('getCurrentAssignment', () => {
    it('returns null if no game in progress', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.first.mockResolvedValue({
        _id: 'room1',
        currentGameId: null,
      });

      // @ts-expect-error - calling handler
      const result = await getCurrentAssignment.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });
      expect(result).toBeNull();
    });
  });

  describe('submitLine', () => {
    it('throws if game not in progress', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get
        .mockResolvedValueOnce({ roomId: 'room1' }) // poem
        .mockResolvedValueOnce({ currentGameId: 'game1' }) // room
        .mockResolvedValueOnce({ status: 'COMPLETED' }); // game

      await expect(
        // @ts-expect-error - calling handler
        submitLine.handler(mockCtx, {
          poemId: 'poem1',
          lineIndex: 0,
          text: 'hello',
          guestToken: 'token',
        })
      ).rejects.toThrow('Game not in progress');
    });

    it('submits line successfully', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get
        .mockResolvedValueOnce({
          roomId: 'room1',
          indexInRoom: 0,
          gameId: 'game1',
        }) // poem
        .mockResolvedValueOnce({ currentGameId: 'game1' }) // room
        .mockResolvedValueOnce({
          _id: 'game1',
          status: 'IN_PROGRESS',
          currentRound: 0,
          assignmentMatrix: [['user1', 'user2']],
        }); // game

      // Mock duplicate check
      mockDb.first.mockResolvedValue(null);

      // Mock checking round completion
      mockDb.collect.mockResolvedValue([{ _id: 'poem1' }, { _id: 'poem2' }]);

      // @ts-expect-error - calling handler
      await submitLine.handler(mockCtx, {
        poemId: 'poem1',
        lineIndex: 0,
        text: 'hello',
        guestToken: 'token',
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        'lines',
        expect.objectContaining({
          text: 'hello',
          authorUserId: 'user1',
        })
      );
    });
  });

  describe('getRevealPhaseState', () => {
    it('returns state when room is completed', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });

      // Mock sequence of calls
      // 1. Room query
      mockDb.first.mockResolvedValueOnce({
        _id: 'room1',
        status: 'COMPLETED',
        currentGameId: 'game1',
        hostUserId: 'user1',
      });

      // 2. Game get
      mockDb.get.mockResolvedValueOnce({ _id: 'game1' });

      // 3. Poems query
      mockDb.collect.mockResolvedValueOnce([
        { _id: 'poem1', assignedReaderId: 'user1', indexInRoom: 0 },
      ]);

      // 4. Players query
      mockDb.collect.mockResolvedValueOnce([
        { userId: 'user1', displayName: 'User 1' },
      ]);

      // 5. First line query (preview)
      mockDb.first.mockResolvedValueOnce({ text: 'Line 1' });

      // 6. User poem lines query (for myPoem details)
      mockDb.collect.mockResolvedValueOnce([
        { text: 'Line 1', authorUserId: 'user1', indexInPoem: 0 },
      ]);

      // @ts-expect-error - calling handler
      const result = await getRevealPhaseState.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });

      expect(result).toBeTruthy();
      expect(result.isHost).toBe(true);
      expect(result.poems).toHaveLength(1);
    });
  });

  describe('revealPoem', () => {
    it('reveals poem successfully', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get.mockResolvedValue({
        _id: 'poem1',
        assignedReaderId: 'user1',
        revealedAt: null,
      });

      // @ts-expect-error - calling handler
      await revealPoem.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token',
      });

      expect(mockDb.patch).toHaveBeenCalledWith(
        'poem1',
        expect.objectContaining({
          revealedAt: expect.any(Number),
        })
      );
    });
  });

  describe('getRoundProgress', () => {
    it('returns progress', async () => {
      // 1. Room query
      mockDb.first.mockResolvedValueOnce({
        _id: 'room1',
        currentGameId: 'game1',
      });

      // 2. Game get
      mockDb.get.mockResolvedValueOnce({
        _id: 'game1',
        currentRound: 0,
        assignmentMatrix: [['user1', 'user2']],
      });

      // 3. Players query
      mockDb.collect.mockResolvedValueOnce([
        { userId: 'user1', displayName: 'User 1' },
        { userId: 'user2', displayName: 'User 2' },
      ]);

      // Loop for Player 1
      // 4. Poem query
      mockDb.first.mockResolvedValueOnce({ _id: 'poem1' });
      // 5. Line query
      mockDb.first.mockResolvedValueOnce(null); // Not submitted

      // Loop for Player 2
      // 6. Poem query
      mockDb.first.mockResolvedValueOnce({ _id: 'poem2' });
      // 7. Line query
      mockDb.first.mockResolvedValueOnce({ _id: 'line1' }); // Submitted

      // @ts-expect-error - calling handler
      const result = await getRoundProgress.handler(mockCtx, {
        roomCode: 'TEST',
      });

      expect(result).toBeTruthy();
      expect(result.round).toBe(0);
      expect(result.players).toHaveLength(2);
      expect(result.players[0].submitted).toBe(false);
      expect(result.players[1].submitted).toBe(true);
    });
  });
});
