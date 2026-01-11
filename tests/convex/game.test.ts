import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createMockCtx } from '../helpers/mockConvexDb';

// Mock Convex server functions
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
  internalMutation: (args: unknown) => args,
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

// Mock room helpers
const mockGetRoomByCode = vi.fn();
const mockRequireRoomByCode = vi.fn();
const mockGetActiveGame = vi.fn();
const mockGetCompletedGame = vi.fn();
vi.mock('../../convex/lib/room', () => ({
  getRoomByCode: (...args: unknown[]) => mockGetRoomByCode(...args),
  requireRoomByCode: (...args: unknown[]) => mockRequireRoomByCode(...args),
  getActiveGame: (...args: unknown[]) => mockGetActiveGame(...args),
  getCompletedGame: (...args: unknown[]) => mockGetCompletedGame(...args),
}));

// assignmentMatrix uses crypto.getRandomValues internally - mock at non-deterministic boundary
vi.mock('../../convex/lib/assignmentMatrix', () => ({
  generateAssignmentMatrix: () => [
    [0, 1],
    [1, 0],
  ],
  secureShuffle: <T>(arr: T[]) => arr, // Identity for deterministic tests
}));

// wordCount is deterministic - use real implementation (no mock)

describe('game', () => {
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
    mockGetUser.mockReset();
    mockGetRoomByCode.mockReset();
    mockRequireRoomByCode.mockReset();
    mockGetActiveGame.mockReset();
    mockGetCompletedGame.mockReset();
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
      mockRequireRoomByCode.mockRejectedValue(new Error('Room not found'));

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
      mockRequireRoomByCode.mockResolvedValue({
        _id: 'room1',
        hostUserId: 'user1',
      });

      await expect(
        // @ts-expect-error - calling handler directly for test
        startNewCycle.handler(mockCtx, {
          roomCode: 'TEST',
          guestToken: 'token',
        })
      ).rejects.toThrow('Only host can start new cycle');
    });

    it('throws if game still in progress', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockRequireRoomByCode.mockResolvedValue({
        _id: 'room1',
        hostUserId: 'user1',
      });
      mockGetActiveGame.mockResolvedValue({
        _id: 'game1',
        status: 'IN_PROGRESS',
      });

      await expect(
        // @ts-expect-error - calling handler directly for test
        startNewCycle.handler(mockCtx, {
          roomCode: 'TEST',
          guestToken: 'token',
        })
      ).rejects.toThrow('Game still in progress');
    });

    it('throws if no completed game', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockRequireRoomByCode.mockResolvedValue({
        _id: 'room1',
        hostUserId: 'user1',
      });
      mockGetActiveGame.mockResolvedValue(null);
      mockGetCompletedGame.mockResolvedValue(null);

      await expect(
        // @ts-expect-error - calling handler directly for test
        startNewCycle.handler(mockCtx, {
          roomCode: 'TEST',
          guestToken: 'token',
        })
      ).rejects.toThrow('No completed game to continue from');
    });

    it('resets room to LOBBY on success', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const room = {
        _id: 'room1',
        hostUserId: 'user1',
        currentCycle: 1,
        currentGameId: 'game1',
      };
      mockRequireRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(null);
      mockGetCompletedGame.mockResolvedValue({
        _id: 'game1',
        status: 'COMPLETED',
      });

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
      mockRequireRoomByCode.mockResolvedValue({
        _id: 'room1',
        hostUserId: 'user1',
        code: 'TEST',
      });
      mockGetActiveGame.mockResolvedValue(null); // No game in progress
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
    it('returns null if user not found', async () => {
      mockGetUser.mockResolvedValue(null);

      // @ts-expect-error - calling handler
      const result = await getCurrentAssignment.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });
      expect(result).toBeNull();
    });

    it('returns null if room not found', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockGetRoomByCode.mockResolvedValue(null);

      // @ts-expect-error - calling handler
      const result = await getCurrentAssignment.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });
      expect(result).toBeNull();
    });

    it('returns null if no game in progress', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1' });
      mockGetActiveGame.mockResolvedValue(null);

      // @ts-expect-error - calling handler
      const result = await getCurrentAssignment.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });
      expect(result).toBeNull();
    });

    it('returns null if user not in assignment matrix', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user3' });
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1' });
      mockGetActiveGame.mockResolvedValue({
        _id: 'game1',
        status: 'IN_PROGRESS',
        currentRound: 0,
        assignmentMatrix: [['user1', 'user2']], // user3 not in matrix
      });

      // @ts-expect-error - calling handler
      const result = await getCurrentAssignment.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });
      expect(result).toBeNull();
    });

    it('returns null if poem not found', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1' });
      mockGetActiveGame.mockResolvedValue({
        _id: 'game1',
        status: 'IN_PROGRESS',
        currentRound: 0,
        assignmentMatrix: [['user1', 'user2']],
      });
      // Poem query returns null
      mockDb.first.mockResolvedValue(null);

      // @ts-expect-error - calling handler
      const result = await getCurrentAssignment.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });
      expect(result).toBeNull();
    });

    it('returns assignment with previous line for round > 0', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1' });
      mockGetActiveGame.mockResolvedValue({
        _id: 'game1',
        status: 'IN_PROGRESS',
        currentRound: 2, // Round 2
        assignmentMatrix: [[], [], ['user1', 'user2']],
      });

      // Poem query
      mockDb.first.mockResolvedValueOnce({ _id: 'poem1' });
      // Previous line query
      mockDb.first.mockResolvedValueOnce({ text: 'Previous line text' });

      // @ts-expect-error - calling handler
      const result = await getCurrentAssignment.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });

      expect(result).toEqual({
        poemId: 'poem1',
        lineIndex: 2,
        targetWordCount: 3, // WORD_COUNTS[2]
        previousLineText: 'Previous line text',
      });
    });
  });

  describe('submitLine', () => {
    it('throws if game not in progress', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      // submitLine now uses poem.gameId directly
      mockDb.get
        .mockResolvedValueOnce({ roomId: 'room1', gameId: 'game1' }) // poem
        .mockResolvedValueOnce({ status: 'COMPLETED' }) // game (via poem.gameId)
        .mockResolvedValueOnce({ _id: 'room1' }); // room

      // Duplicate check - no existing line
      mockDb.first.mockResolvedValue(null);

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

    it('throws if word count is incorrect', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get
        .mockResolvedValueOnce({
          roomId: 'room1',
          indexInRoom: 0,
          gameId: 'game1',
        }) // poem
        .mockResolvedValueOnce({
          _id: 'game1',
          status: 'IN_PROGRESS',
          currentRound: 2, // Round 2 expects 3 words
          assignmentMatrix: [[], [], ['user1', 'user2']],
        }) // game (via poem.gameId)
        .mockResolvedValueOnce({ _id: 'room1' }); // room

      // Duplicate check - no existing line
      mockDb.first.mockResolvedValue(null);

      await expect(
        // @ts-expect-error - calling handler
        submitLine.handler(mockCtx, {
          poemId: 'poem1',
          lineIndex: 2,
          text: 'hello world', // Only 2 words, expected 3
          guestToken: 'token',
        })
      ).rejects.toThrow('Expected 3 words, got 2');
    });

    it('throws if line text exceeds 500 characters', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get
        .mockResolvedValueOnce({
          roomId: 'room1',
          indexInRoom: 0,
          gameId: 'game1',
        }) // poem
        .mockResolvedValueOnce({
          _id: 'game1',
          status: 'IN_PROGRESS',
          currentRound: 0,
          assignmentMatrix: [['user1', 'user2']],
        }) // game (via poem.gameId)
        .mockResolvedValueOnce({ _id: 'room1' }); // room

      // Duplicate check - no existing line
      mockDb.first.mockResolvedValue(null);

      // 501 character "word" (exceeds limit)
      const longText = 'a'.repeat(501);

      await expect(
        // @ts-expect-error - calling handler
        submitLine.handler(mockCtx, {
          poemId: 'poem1',
          lineIndex: 0,
          text: longText,
          guestToken: 'token',
        })
      ).rejects.toThrow('Line must be 500 characters or less');
    });

    it('accepts line text at exactly 500 characters', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1', displayName: 'Test User' });
      mockDb.get
        .mockResolvedValueOnce({
          roomId: 'room1',
          indexInRoom: 0,
          gameId: 'game1',
        }) // poem
        .mockResolvedValueOnce({
          _id: 'game1',
          status: 'IN_PROGRESS',
          currentRound: 0,
          assignmentMatrix: [['user1', 'user2']],
        }) // game (via poem.gameId)
        .mockResolvedValueOnce({ _id: 'room1' }); // room

      // Duplicate check - no existing line
      mockDb.first.mockResolvedValue(null);

      // Mock checking round completion
      mockDb.collect.mockResolvedValue([{ _id: 'poem1' }, { _id: 'poem2' }]);

      // 500 character word passes length check but the word count is 1
      // Round 0 expects 1 word, so it should succeed
      const exactLengthText = 'a'.repeat(500);

      // @ts-expect-error - calling handler
      await submitLine.handler(mockCtx, {
        poemId: 'poem1',
        lineIndex: 0,
        text: exactLengthText,
        guestToken: 'token',
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        'lines',
        expect.objectContaining({
          text: exactLengthText,
          wordCount: 1,
        })
      );
    });

    it('succeeds silently if line already submitted (idempotent)', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get
        .mockResolvedValueOnce({
          roomId: 'room1',
          indexInRoom: 0,
          gameId: 'game1',
        }) // poem
        .mockResolvedValueOnce({
          _id: 'game1',
          status: 'IN_PROGRESS',
          currentRound: 0,
          assignmentMatrix: [['user1', 'user2']],
        }) // game
        .mockResolvedValueOnce({ _id: 'room1' }); // room

      // Mock duplicate check - line already exists
      mockDb.first.mockResolvedValue({ _id: 'existing-line' });

      // Should not throw - idempotent success
      // @ts-expect-error - calling handler
      await submitLine.handler(mockCtx, {
        poemId: 'poem1',
        lineIndex: 0,
        text: 'hello',
        guestToken: 'token',
      });

      // Should not have inserted anything
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('throws if user not assigned to this poem', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get
        .mockResolvedValueOnce({
          roomId: 'room1',
          indexInRoom: 0,
          gameId: 'game1',
        }) // poem
        .mockResolvedValueOnce({
          _id: 'game1',
          status: 'IN_PROGRESS',
          currentRound: 0,
          assignmentMatrix: [['user2', 'user3']], // user1 not assigned
        }) // game
        .mockResolvedValueOnce({ _id: 'room1' }); // room

      // Duplicate check - no existing line
      mockDb.first.mockResolvedValue(null);

      await expect(
        // @ts-expect-error - calling handler
        submitLine.handler(mockCtx, {
          poemId: 'poem1',
          lineIndex: 0,
          text: 'hello',
          guestToken: 'token',
        })
      ).rejects.toThrow('Not your turn');
    });

    it('throws if submitting for future round', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get
        .mockResolvedValueOnce({
          roomId: 'room1',
          indexInRoom: 0,
          gameId: 'game1',
        }) // poem
        .mockResolvedValueOnce({
          _id: 'game1',
          status: 'IN_PROGRESS',
          currentRound: 0, // Currently round 0
          assignmentMatrix: [
            ['user1', 'user2'],
            ['user2', 'user1'],
          ],
        }) // game (via poem.gameId)
        .mockResolvedValueOnce({ _id: 'room1' }); // room

      // Duplicate check - no existing line
      mockDb.first.mockResolvedValue(null);

      await expect(
        // @ts-expect-error - calling handler
        submitLine.handler(mockCtx, {
          poemId: 'poem1',
          lineIndex: 1, // Trying to submit for round 1 (future round)
          text: 'hello world',
          guestToken: 'token',
        })
      ).rejects.toThrow('Round not started yet');
    });

    it('submits line successfully', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get
        .mockResolvedValueOnce({
          roomId: 'room1',
          indexInRoom: 0,
          gameId: 'game1',
        }) // poem
        .mockResolvedValueOnce({
          _id: 'game1',
          status: 'IN_PROGRESS',
          currentRound: 0,
          assignmentMatrix: [['user1', 'user2']],
        }) // game (via poem.gameId)
        .mockResolvedValueOnce({ _id: 'room1' }); // room

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
    it('returns null if user not found', async () => {
      mockGetUser.mockResolvedValue(null);

      // @ts-expect-error - calling handler
      const result = await getRevealPhaseState.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });

      expect(result).toBeNull();
    });

    it('returns null if room not found', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockGetRoomByCode.mockResolvedValue(null);

      // @ts-expect-error - calling handler
      const result = await getRevealPhaseState.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });

      expect(result).toBeNull();
    });

    it('returns null if no completed game', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1' });
      mockGetCompletedGame.mockResolvedValue(null);

      // @ts-expect-error - calling handler
      const result = await getRevealPhaseState.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });

      expect(result).toBeNull();
    });

    it('returns state with no assigned poem for user', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockGetRoomByCode.mockResolvedValue({
        _id: 'room1',
        hostUserId: 'user2', // user1 is not host
      });
      mockGetCompletedGame.mockResolvedValue({ _id: 'game1' });

      // Poems query - no poems assigned to user1
      mockDb.collect.mockResolvedValueOnce([
        { _id: 'poem1', assignedReaderId: 'user2', indexInRoom: 0 },
      ]);

      // Players query
      mockDb.collect.mockResolvedValueOnce([
        { userId: 'user1', displayName: 'User 1' },
        { userId: 'user2', displayName: 'User 2' },
      ]);

      // First line query (preview)
      mockDb.first.mockResolvedValueOnce({ text: 'Line 1' });

      // @ts-expect-error - calling handler
      const result = await getRevealPhaseState.handler(mockCtx, {
        roomCode: 'TEST',
        guestToken: 'token',
      });

      expect(result).toBeTruthy();
      expect(result.isHost).toBe(false);
      expect(result.poems).toHaveLength(1);
      expect(result.myPoem).toBeNull();
    });

    it('returns state when game is completed', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockGetRoomByCode.mockResolvedValue({
        _id: 'room1',
        hostUserId: 'user1',
      });
      mockGetCompletedGame.mockResolvedValue({ _id: 'game1' });

      // Poems query
      mockDb.collect.mockResolvedValueOnce([
        { _id: 'poem1', assignedReaderId: 'user1', indexInRoom: 0 },
      ]);

      // Players query
      mockDb.collect.mockResolvedValueOnce([
        { userId: 'user1', displayName: 'User 1' },
      ]);

      // First line query (preview)
      mockDb.first.mockResolvedValueOnce({ text: 'Line 1' });

      // User poem lines query (for myPoem details)
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

    it('throws if user not found', async () => {
      mockGetUser.mockResolvedValue(null);

      await expect(
        // @ts-expect-error - calling handler
        revealPoem.handler(mockCtx, {
          poemId: 'poem1',
          guestToken: 'token',
        })
      ).rejects.toThrow('User not found');
    });

    it('throws if poem not found', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get.mockResolvedValue(null);

      await expect(
        // @ts-expect-error - calling handler
        revealPoem.handler(mockCtx, {
          poemId: 'poem1',
          guestToken: 'token',
        })
      ).rejects.toThrow('Poem not found');
    });

    it('throws if poem not assigned to user', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get.mockResolvedValue({
        _id: 'poem1',
        assignedReaderId: 'user2', // Different user
        revealedAt: null,
      });

      await expect(
        // @ts-expect-error - calling handler
        revealPoem.handler(mockCtx, {
          poemId: 'poem1',
          guestToken: 'token',
        })
      ).rejects.toThrow('This poem is not assigned to you');
    });

    it('throws if poem already revealed', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get.mockResolvedValue({
        _id: 'poem1',
        assignedReaderId: 'user1',
        revealedAt: 1234567890, // Already revealed
      });

      await expect(
        // @ts-expect-error - calling handler
        revealPoem.handler(mockCtx, {
          poemId: 'poem1',
          guestToken: 'token',
        })
      ).rejects.toThrow('Poem already revealed');
    });
  });

  describe('getRoundProgress', () => {
    it('returns null when room not found', async () => {
      mockGetRoomByCode.mockResolvedValue(null);

      // @ts-expect-error - calling handler
      const result = await getRoundProgress.handler(mockCtx, {
        roomCode: 'TEST',
      });

      expect(result).toBeNull();
    });

    it('returns null when no active game', async () => {
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1' });
      mockGetActiveGame.mockResolvedValue(null);

      // @ts-expect-error - calling handler
      const result = await getRoundProgress.handler(mockCtx, {
        roomCode: 'TEST',
      });

      expect(result).toBeNull();
    });

    it('returns progress', async () => {
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1' });
      mockGetActiveGame.mockResolvedValue({
        _id: 'game1',
        currentRound: 0,
        assignmentMatrix: [['user1', 'user2']],
      });

      // Players query
      mockDb.collect.mockResolvedValueOnce([
        { userId: 'user1', displayName: 'User 1' },
        { userId: 'user2', displayName: 'User 2' },
      ]);

      // Poems batch fetch (collect)
      mockDb.collect.mockResolvedValueOnce([
        { _id: 'poem1', indexInRoom: 0 },
        { _id: 'poem2', indexInRoom: 1 },
      ]);

      // Parallel line checks (first)
      mockDb.first.mockResolvedValueOnce(null); // User 1 not submitted
      mockDb.first.mockResolvedValueOnce({ _id: 'line1' }); // User 2 submitted

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
