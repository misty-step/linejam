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
  });

  describe('createRoom', () => {
    it('creates room with valid host and generates 4-letter code', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user1' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      mockDb.first.mockResolvedValue(null); // No existing room with this code
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
      mockDb.first.mockResolvedValue(null);
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
      mockDb.first
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
      expect(mockDb.first).toHaveBeenCalledTimes(2);
    });

    it('returns room ID and code on success', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user1' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      mockDb.first.mockResolvedValue(null);
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
        status: 'LOBBY',
      };
      mockDb.first
        .mockResolvedValueOnce(room) // Room lookup
        .mockResolvedValueOnce(null); // No existing roomPlayer
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

    it('throws error when room is IN_PROGRESS', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user2' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      mockDb.first.mockResolvedValue({
        _id: 'room1',
        status: 'IN_PROGRESS',
      });

      // Act & Assert
      await expect(
        // @ts-expect-error - calling handler directly for test
        joinRoom.handler(mockCtx, {
          code: 'ABCD',
          displayName: 'Bob',
          guestToken: 'token456',
        })
      ).rejects.toThrow('Cannot join a room that is not in LOBBY status');
    });

    it('throws error when room is at capacity (8 players)', async () => {
      // Arrange
      mockEnsureUserHelper.mockResolvedValue({ _id: 'user9' });
      mockCheckRateLimit.mockResolvedValue(undefined);
      mockDb.first
        .mockResolvedValueOnce({ _id: 'room1', status: 'LOBBY' })
        .mockResolvedValueOnce(null); // No existing roomPlayer
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
      mockDb.first.mockResolvedValue(null); // Room not found

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
        status: 'LOBBY',
      };
      mockDb.first
        .mockResolvedValueOnce(room) // Room lookup
        .mockResolvedValueOnce({ userId: 'user1', roomId: 'room1' }); // Existing roomPlayer

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
      mockDb.first.mockResolvedValue(room);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getRoom.handler(mockCtx, { code: 'ABCD' });

      // Assert
      expect(result).toEqual(room);
      expect(mockDb.query).toHaveBeenCalledWith('rooms');
    });

    it('returns null when room not found', async () => {
      // Arrange
      mockDb.first.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getRoom.handler(mockCtx, { code: 'ZZZZ' });

      // Assert
      expect(result).toBeNull();
    });

    it('normalizes code to uppercase', async () => {
      // Arrange
      const room = { _id: 'room1', code: 'ABCD' };
      mockDb.first.mockResolvedValue(room);

      // Act
      // @ts-expect-error - calling handler directly for test
      await getRoom.handler(mockCtx, { code: 'abcd' });

      // Assert
      expect(mockDb.withIndex).toHaveBeenCalledWith(
        'by_code',
        expect.any(Function)
      );
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
      mockDb.first.mockResolvedValue(room);
      mockDb.collect.mockResolvedValue(players);
      mockGetUser.mockResolvedValue({ _id: 'user1' });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getRoomState.handler(mockCtx, {
        code: 'ABCD',
        guestToken: 'token123',
      });

      // Assert - stableId falls back to userId when db.get returns undefined
      const expectedPlayers = players.map((p) => ({
        ...p,
        stableId: p.userId,
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
      mockDb.first.mockResolvedValue(room);
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
      mockDb.first.mockResolvedValue(null);

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
});
