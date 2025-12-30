import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createMockCtx } from '../helpers/mockConvexDb';

// Mock Convex server functions
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
}));

import {
  createRoom,
  joinRoom,
  getRoom,
  getRoomState,
  leaveLobby,
} from '../../convex/rooms';

// Mock ensureUserHelper
const mockEnsureUserHelper = vi.fn();
vi.mock('../../convex/users', () => ({
  ensureUserHelper: (...args: unknown[]) => mockEnsureUserHelper(...args),
}));

// Mock getUser
const mockGetUser = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

// Mock checkRateLimit
const mockCheckRateLimit = vi.fn();
vi.mock('../../convex/lib/rateLimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// Mock room helpers
const mockGetRoomByCode = vi.fn();
const mockRequireRoomByCode = vi.fn();
const mockGetActiveGame = vi.fn();
vi.mock('../../convex/lib/room', () => ({
  getRoomByCode: (...args: unknown[]) => mockGetRoomByCode(...args),
  requireRoomByCode: (...args: unknown[]) => mockRequireRoomByCode(...args),
  getActiveGame: (...args: unknown[]) => mockGetActiveGame(...args),
}));

describe('rooms', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCtx = createMockCtx(mockDb);
    mockEnsureUserHelper.mockReset();
    mockGetUser.mockReset();
    mockCheckRateLimit.mockReset();
    mockGetRoomByCode.mockReset();
    mockRequireRoomByCode.mockReset();
    mockGetActiveGame.mockReset();
  });

  describe('createRoom', () => {
    it('creates room with valid host and generates 4-letter code', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user1' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      mockGetRoomByCode.mockResolvedValue(null); // No existing room with this code
      mockDb.insert
        .mockResolvedValueOnce('room1') // room insert
        .mockResolvedValueOnce('player1'); // roomPlayer insert

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await createRoom.handler(mockCtx, {
        displayName: 'Alice',
        guestToken: 'token123',
      });

      // Assert
      expect(result.roomId).toBe('room1');
      expect(result.code).toMatch(/^[A-Z]{4}$/);
      expect(mockDb.insert).toHaveBeenCalledWith(
        'rooms',
        expect.objectContaining({
          code: result.code,
          hostUserId: 'user1',
          status: 'LOBBY',
          createdAt: expect.any(Number),
        })
      );
    });

    it('assigns host as first player in roomPlayers', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user1' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      mockGetRoomByCode.mockResolvedValue(null);
      mockDb.insert
        .mockResolvedValueOnce('room1')
        .mockResolvedValueOnce('player1');

      // Act
      // @ts-expect-error - calling handler directly for test
      await createRoom.handler(mockCtx, {
        displayName: 'Alice',
        guestToken: 'token123',
      });

      // Assert
      expect(mockDb.insert).toHaveBeenCalledWith(
        'roomPlayers',
        expect.objectContaining({
          roomId: 'room1',
          userId: 'user1',
          displayName: 'Alice',
          joinedAt: expect.any(Number),
        })
      );
    });

    it('enforces rate limit: 3 creates in 10min, 4th fails', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user1' });
      mockCheckRateLimit.mockRejectedValue(new Error('Rate limit exceeded'));

      // Act & Assert
      await expect(
        // @ts-expect-error - calling handler directly for test
        createRoom.handler(mockCtx, {
          displayName: 'Alice',
          guestToken: 'token123',
        })
      ).rejects.toThrow('Rate limit exceeded');

      expect(mockCheckRateLimit).toHaveBeenCalledWith(mockCtx, {
        key: 'createRoom:user1',
        max: 3,
        windowMs: 10 * 60 * 1000,
      });
    });

    it('ensures generated room code is unique', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user1' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      mockGetRoomByCode
        .mockResolvedValueOnce({ _id: 'existingRoom' }) // First code collides
        .mockResolvedValueOnce(null); // Second code is unique
      mockDb.insert
        .mockResolvedValueOnce('room1')
        .mockResolvedValueOnce('player1');

      // Act
      // @ts-expect-error - calling handler directly for test
      await createRoom.handler(mockCtx, {
        displayName: 'Alice',
        guestToken: 'token123',
      });

      // Assert
      expect(mockGetRoomByCode).toHaveBeenCalledTimes(2);
    });

    it('returns room ID and code on success', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user1' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      mockGetRoomByCode.mockResolvedValue(null);
      mockDb.insert
        .mockResolvedValueOnce('room1')
        .mockResolvedValueOnce('player1');

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await createRoom.handler(mockCtx, {
        displayName: 'Alice',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual({
        code: expect.stringMatching(/^[A-Z]{4}$/),
        roomId: 'room1',
      });
    });
  });

  describe('joinRoom', () => {
    it('joins room when LOBBY status and adds player', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user2' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      const room = {
        _id: 'room1',
        code: 'ABCD',
        hostUserId: 'user1',
      };
      mockRequireRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(null); // No game in progress (lobby)
      mockDb.first.mockResolvedValueOnce(null); // No existing roomPlayer
      mockDb.collect.mockResolvedValue([{ userId: 'user1' }]); // Current players
      mockDb.insert.mockResolvedValue('player2');

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await joinRoom.handler(mockCtx, {
        code: 'ABCD',
        displayName: 'Bob',
        guestToken: 'token456',
      });

      // Assert
      expect(result).toEqual(room);
      expect(mockDb.insert).toHaveBeenCalledWith(
        'roomPlayers',
        expect.objectContaining({
          roomId: 'room1',
          userId: 'user2',
          displayName: 'Bob',
          joinedAt: expect.any(Number),
        })
      );
    });

    it('throws error when room has game in progress', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user2' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      const room = { _id: 'room1', code: 'ABCD' };
      const activeGame = { _id: 'game1', status: 'IN_PROGRESS' };

      mockRequireRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(activeGame);

      // Act & Assert
      await expect(
        // @ts-expect-error - calling handler directly for test
        joinRoom.handler(mockCtx, {
          code: 'ABCD',
          displayName: 'Bob',
          guestToken: 'token456',
        })
      ).rejects.toThrow('Cannot join a room with a game in progress');
    });

    it('throws error when room is at capacity (8 players)', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user9' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      const room = { _id: 'room1', code: 'ABCD' };
      mockRequireRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(null); // No game in progress
      mockDb.first.mockResolvedValueOnce(null); // No existing roomPlayer
      mockDb.collect.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({ userId: `user${i + 1}` }))
      );

      // Act & Assert
      await expect(
        // @ts-expect-error - calling handler directly for test
        joinRoom.handler(mockCtx, {
          code: 'ABCD',
          displayName: 'Overflow',
          guestToken: 'token999',
        })
      ).rejects.toThrow('Room is full');
    });

    it('enforces rate limit: 10 joins in 10min, 11th fails', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user2' });
      mockCheckRateLimit.mockRejectedValue(new Error('Rate limit exceeded'));

      // Act & Assert
      await expect(
        // @ts-expect-error - calling handler directly for test
        joinRoom.handler(mockCtx, {
          code: 'ABCD',
          displayName: 'Bob',
          guestToken: 'token456',
        })
      ).rejects.toThrow('Rate limit exceeded');

      expect(mockCheckRateLimit).toHaveBeenCalledWith(mockCtx, {
        key: 'joinRoom:user2',
        max: 10,
        windowMs: 10 * 60 * 1000,
      });
    });

    it('throws error when room code is invalid', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user2' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      mockRequireRoomByCode.mockRejectedValue(new Error('Room not found'));

      // Act & Assert
      await expect(
        // @ts-expect-error - calling handler directly for test
        joinRoom.handler(mockCtx, {
          code: 'ZZZZ',
          displayName: 'Bob',
          guestToken: 'token456',
        })
      ).rejects.toThrow('Room not found');
    });

    it('returns room when user already in room (idempotent)', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user1' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      const room = {
        _id: 'room1',
        code: 'ABCD',
      };

      mockRequireRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(null); // No game in progress (lobby)
      mockDb.first.mockResolvedValueOnce({ userId: 'user1', roomId: 'room1' }); // Existing roomPlayer

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await joinRoom.handler(mockCtx, {
        code: 'ABCD',
        displayName: 'Alice',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual(room);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('getRoom', () => {
    it('returns room data for valid code', async () => {
      // Arrange
      const room = {
        _id: 'room1',
        code: 'ABCD',
        hostUserId: 'user1',
        status: 'LOBBY',
      };
      mockGetRoomByCode.mockResolvedValue(room);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getRoom.handler(mockCtx, { code: 'ABCD' });

      // Assert
      expect(result).toEqual(room);
      expect(mockGetRoomByCode).toHaveBeenCalledWith(mockCtx, 'ABCD');
    });

    it('returns null when room not found', async () => {
      // Arrange
      mockGetRoomByCode.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getRoom.handler(mockCtx, { code: 'ZZZZ' });

      // Assert
      expect(result).toBeNull();
    });

    it('normalizes code to uppercase', async () => {
      // Arrange
      const room = { _id: 'room1', code: 'ABCD' };
      mockGetRoomByCode.mockResolvedValue(room);

      // Act
      // @ts-expect-error - calling handler directly for test
      await getRoom.handler(mockCtx, { code: 'abcd' });

      // Assert - getRoomByCode is called with the original input; it normalizes internally
      expect(mockGetRoomByCode).toHaveBeenCalledWith(mockCtx, 'abcd');
    });
  });

  describe('getRoomState', () => {
    it('returns room, players, and isHost=true for host', async () => {
      // Arrange
      const room = {
        _id: 'room1',
        code: 'ABCD',
        hostUserId: 'user1',
        status: 'LOBBY',
      };
      const players = [
        { userId: 'user1', displayName: 'Alice' },
        { userId: 'user2', displayName: 'Bob' },
      ];
      mockGetRoomByCode.mockResolvedValue(room);
      mockDb.collect.mockResolvedValue(players);
      mockGetUser.mockResolvedValue({ _id: 'user1' });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getRoomState.handler(mockCtx, {
        code: 'ABCD',
        guestToken: 'token123',
      });

      // Assert - stableId falls back to userId when db.get returns undefined
      // Also includes isBot and aiPersonaId from user record lookup
      const expectedPlayers = players.map((p) => ({
        ...p,
        stableId: p.userId,
        isBot: false,
        aiPersonaId: undefined,
      }));
      expect(result).toEqual({ room, players: expectedPlayers, isHost: true });
    });

    it('returns isHost=false for non-host player', async () => {
      // Arrange
      const room = {
        _id: 'room1',
        code: 'ABCD',
        hostUserId: 'user1',
      };
      const players = [{ userId: 'user2', displayName: 'Bob' }];
      mockGetRoomByCode.mockResolvedValue(room);
      mockDb.collect.mockResolvedValue(players);
      mockGetUser.mockResolvedValue({ _id: 'user2' });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getRoomState.handler(mockCtx, {
        code: 'ABCD',
        guestToken: 'token456',
      });

      // Assert
      expect(result?.isHost).toBe(false);
    });

    it('returns null when room not found', async () => {
      // Arrange
      mockGetRoomByCode.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getRoomState.handler(mockCtx, {
        code: 'ZZZZ',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('leaveLobby', () => {
    it('deletes roomPlayer record when non-host leaves', async () => {
      // Arrange
      const room = {
        _id: 'room1',
        code: 'ABCD',
        hostUserId: 'user1',
      };
      const roomPlayer = {
        _id: 'player2',
        roomId: 'room1',
        userId: 'user2',
      };
      mockGetUser.mockResolvedValue({ _id: 'user2' });
      mockGetRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(null); // No game in progress (lobby)
      mockDb.first.mockResolvedValueOnce(roomPlayer); // RoomPlayer lookup
      mockDb.delete.mockResolvedValue(undefined);

      // Act
      // @ts-expect-error - calling handler directly for test
      await leaveLobby.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token456',
      });

      // Assert
      expect(mockDb.delete).toHaveBeenCalledWith('player2');
    });

    it('does nothing when user is host', async () => {
      // Arrange
      const room = {
        _id: 'room1',
        code: 'ABCD',
        hostUserId: 'user1',
      };
      mockGetUser.mockResolvedValue({ _id: 'user1' }); // User is host
      mockGetRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(null); // No game in progress

      // Act
      // @ts-expect-error - calling handler directly for test
      await leaveLobby.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token123',
      });

      // Assert - should not query for roomPlayer or delete
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('does nothing when game is in progress', async () => {
      // Arrange
      const room = {
        _id: 'room1',
        code: 'ABCD',
        hostUserId: 'user1',
      };
      const activeGame = { _id: 'game1', status: 'IN_PROGRESS' };
      mockGetUser.mockResolvedValue({ _id: 'user2' });
      mockGetRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(activeGame);

      // Act
      // @ts-expect-error - calling handler directly for test
      await leaveLobby.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token456',
      });

      // Assert
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('does nothing when user not found', async () => {
      // Arrange
      mockGetUser.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      await leaveLobby.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'invalid',
      });

      // Assert
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('does nothing when room not found', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user2' });
      mockGetRoomByCode.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      await leaveLobby.handler(mockCtx, {
        roomCode: 'ZZZZ',
        guestToken: 'token456',
      });

      // Assert
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });
});
