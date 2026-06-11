import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createMockCtx } from '../helpers/mockConvexDb';

// Mock Convex server functions
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
}));

import {
  getPoemsForRoom,
  getPoemDetail,
  getMyPoems,
  getPublicPoemPreview,
  getPublicPoemFull,
  getPublicSessionRecap,
} from '../../convex/poems';

// Mock auth helpers
const mockGetUser = vi.fn();
const mockCheckParticipation = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  checkParticipation: (...args: unknown[]) => mockCheckParticipation(...args),
}));

// Mock room helpers
const mockGetRoomByCode = vi.fn();
const mockGetActiveGame = vi.fn();
const mockGetCompletedGame = vi.fn();
vi.mock('../../convex/lib/room', () => ({
  getRoomByCode: (...args: unknown[]) => mockGetRoomByCode(...args),
  getActiveGame: (...args: unknown[]) => mockGetActiveGame(...args),
  getCompletedGame: (...args: unknown[]) => mockGetCompletedGame(...args),
}));

describe('poems', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCtx = createMockCtx(mockDb);
    mockGetUser.mockReset();
    mockCheckParticipation.mockReset();
    mockGetRoomByCode.mockReset();
    mockGetActiveGame.mockReset();
    mockGetCompletedGame.mockReset();
  });

  describe('getPoemsForRoom', () => {
    it('returns empty array when user not found', async () => {
      // Arrange
      mockGetUser.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemsForRoom.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual([]);
    });

    it('returns empty array when room not found', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockGetRoomByCode.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemsForRoom.handler(mockCtx, {
        roomCode: 'ZZZZ',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual([]);
    });

    it('returns empty array when user is not participant', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user2' });
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1', code: 'ABCD' });
      mockCheckParticipation.mockResolvedValue(false);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemsForRoom.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual([]);
      expect(mockCheckParticipation).toHaveBeenCalledWith(
        mockCtx,
        'room1',
        'user2'
      );
    });

    it('returns poems for room where user participated', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockCheckParticipation.mockResolvedValue(true);
      const room = { _id: 'room1', code: 'ABCD' };
      const game = { _id: 'game1', roomId: 'room1', status: 'IN_PROGRESS' };
      const poems = [
        { _id: 'poem1', roomId: 'room1', gameId: 'game1' },
        { _id: 'poem2', roomId: 'room1', gameId: 'game1' },
      ];

      mockGetRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(game);
      mockGetCompletedGame.mockResolvedValue(null);

      mockDb.first
        .mockResolvedValueOnce({ text: 'First line of poem 1' }) // First line for poem1
        .mockResolvedValueOnce({ text: 'First line of poem 2' }); // First line for poem2

      mockDb.collect.mockResolvedValueOnce(poems);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemsForRoom.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        _id: 'poem1',
        preview: 'First line of poem 1',
      });
      expect(result[1]).toMatchObject({
        _id: 'poem2',
        preview: 'First line of poem 2',
      });
    });

    it('returns empty array when no active or completed game', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockCheckParticipation.mockResolvedValue(true);
      const room = { _id: 'room1', code: 'ABCD' };

      mockGetRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(null);
      mockGetCompletedGame.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemsForRoom.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual([]);
    });

    it('uses fallback preview when no first line exists', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockCheckParticipation.mockResolvedValue(true);
      const room = { _id: 'room1', code: 'ABCD' };
      const game = { _id: 'game1', roomId: 'room1', status: 'IN_PROGRESS' };
      const poems = [{ _id: 'poem1', roomId: 'room1', gameId: 'game1' }];

      mockGetRoomByCode.mockResolvedValue(room);
      mockGetActiveGame.mockResolvedValue(game);
      mockGetCompletedGame.mockResolvedValue(null);

      mockDb.first.mockResolvedValueOnce(null); // No first line

      mockDb.collect.mockResolvedValueOnce(poems);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemsForRoom.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token123',
      });

      // Assert
      expect(result[0].preview).toBe('...');
    });
  });

  describe('getPoemDetail', () => {
    it('returns null when user not found', async () => {
      // Arrange
      mockGetUser.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemDetail.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when poem not found', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.get.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemDetail.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when user is not participant', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user2' });
      mockDb.get.mockResolvedValue({ _id: 'poem1', roomId: 'room1' });
      mockCheckParticipation.mockResolvedValue(false);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemDetail.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toBeNull();
      expect(mockCheckParticipation).toHaveBeenCalledWith(
        mockCtx,
        'room1',
        'user2'
      );
    });

    it('returns poem with lines in correct order', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockCheckParticipation.mockResolvedValue(true);
      const poem = { _id: 'poem1', roomId: 'room1' };
      const lines = [
        { _id: 'line3', indexInPoem: 2, authorUserId: 'user3', text: 'Third' },
        { _id: 'line1', indexInPoem: 0, authorUserId: 'user1', text: 'First' },
        { _id: 'line2', indexInPoem: 1, authorUserId: 'user2', text: 'Second' },
      ];

      mockDb.get
        .mockResolvedValueOnce(poem) // Poem lookup
        .mockResolvedValueOnce({ displayName: 'Alice' }) // Author for user1
        .mockResolvedValueOnce({ displayName: 'Bob' }) // Author for user2
        .mockResolvedValueOnce({ displayName: 'Charlie' }); // Author for user3

      mockDb.collect.mockResolvedValue(lines);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemDetail.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(result?.poem).toEqual(poem);
      expect(result?.lines).toHaveLength(3);
      expect(result?.lines[0]).toMatchObject({
        text: 'First',
        indexInPoem: 0,
        authorName: 'Alice',
      });
      expect(result?.lines[1]).toMatchObject({
        text: 'Second',
        indexInPoem: 1,
        authorName: 'Bob',
      });
      expect(result?.lines[2]).toMatchObject({
        text: 'Third',
        indexInPoem: 2,
        authorName: 'Charlie',
      });
    });

    it('handles missing/deleted authors gracefully', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockCheckParticipation.mockResolvedValue(true);
      const poem = { _id: 'poem1', roomId: 'room1' };
      const lines = [
        { _id: 'line1', indexInPoem: 0, authorUserId: 'user1', text: 'First' },
      ];

      mockDb.get.mockResolvedValueOnce(poem).mockResolvedValueOnce(null); // Author deleted

      mockDb.collect.mockResolvedValue(lines);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemDetail.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(result?.lines[0].authorName).toBe('Unknown');
    });
  });

  describe('getMyPoems', () => {
    it('returns empty array when user not found', async () => {
      // Arrange
      mockGetUser.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyPoems.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual([]);
    });

    it('returns empty array when user has no poems', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.collect.mockResolvedValue([]);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyPoems.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual([]);
    });

    it('returns only poems where user contributed', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const lines = [
        { poemId: 'poem1', authorUserId: 'user1' },
        { poemId: 'poem1', authorUserId: 'user1' }, // Duplicate poem
        { poemId: 'poem2', authorUserId: 'user1' },
      ];

      // 1. Lines by author
      mockDb.collect.mockResolvedValueOnce(lines);

      // 2. Batch fetch poems (Promise.all with get)
      mockDb.get
        .mockResolvedValueOnce({
          _id: 'poem1',
          roomId: 'room1',
          createdAt: 1000,
        })
        .mockResolvedValueOnce({
          _id: 'poem2',
          roomId: 'room2',
          createdAt: 2000,
        })
        // 3. Batch fetch rooms (Promise.all with get)
        .mockResolvedValueOnce({ _id: 'room1', createdAt: 500 })
        .mockResolvedValueOnce({ _id: 'room2', createdAt: 1500 });

      // 4. Batch fetch first lines (Promise.all with first)
      mockDb.first
        .mockResolvedValueOnce({ text: 'First line of poem 1' })
        .mockResolvedValueOnce({ text: 'First line of poem 2' });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyPoems.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe('poem2'); // Sorted by createdAt desc
      expect(result[1]._id).toBe('poem1');
    });

    it('includes all rooms user participated in', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const lines = [
        { poemId: 'poem1', authorUserId: 'user1' },
        { poemId: 'poem2', authorUserId: 'user1' },
        { poemId: 'poem3', authorUserId: 'user1' },
      ];

      // 1. Lines by author
      mockDb.collect.mockResolvedValueOnce(lines);

      // 2. Batch fetch poems
      mockDb.get
        .mockResolvedValueOnce({
          _id: 'poem1',
          roomId: 'room1',
          createdAt: 1000,
        })
        .mockResolvedValueOnce({
          _id: 'poem2',
          roomId: 'room2',
          createdAt: 2000,
        })
        .mockResolvedValueOnce({
          _id: 'poem3',
          roomId: 'room1',
          createdAt: 3000,
        })
        // 3. Batch fetch unique rooms (room1 and room2)
        .mockResolvedValueOnce({ _id: 'room1', createdAt: 500 })
        .mockResolvedValueOnce({ _id: 'room2', createdAt: 1500 });

      // 4. Batch fetch first lines
      mockDb.first
        .mockResolvedValueOnce({ text: 'Line 1' })
        .mockResolvedValueOnce({ text: 'Line 2' })
        .mockResolvedValueOnce({ text: 'Line 3' });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyPoems.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result).toHaveLength(3);
      // Note: poems are sorted by createdAt desc: poem3 (3000), poem2 (2000), poem1 (1000)
      expect(result.map((p: { roomId: string }) => p.roomId)).toEqual([
        'room1', // poem3
        'room2', // poem2
        'room1', // poem1
      ]);
    });

    it('sorts poems by date descending', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const lines = [
        { poemId: 'poem1', authorUserId: 'user1' },
        { poemId: 'poem2', authorUserId: 'user1' },
        { poemId: 'poem3', authorUserId: 'user1' },
      ];

      // 1. Lines by author
      mockDb.collect.mockResolvedValueOnce(lines);

      // 2. Batch fetch poems
      mockDb.get
        .mockResolvedValueOnce({
          _id: 'poem1',
          roomId: 'room1',
          createdAt: 1000,
        })
        .mockResolvedValueOnce({
          _id: 'poem2',
          roomId: 'room1',
          createdAt: 3000,
        })
        .mockResolvedValueOnce({
          _id: 'poem3',
          roomId: 'room1',
          createdAt: 2000,
        })
        // 3. Batch fetch unique rooms
        .mockResolvedValueOnce({ _id: 'room1', createdAt: 500 });

      // 4. Batch fetch first lines
      mockDb.first
        .mockResolvedValueOnce({ text: 'Line 1' })
        .mockResolvedValueOnce({ text: 'Line 2' })
        .mockResolvedValueOnce({ text: 'Line 3' });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyPoems.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result.map((p: { _id: string }) => p._id)).toEqual([
        'poem2',
        'poem3',
        'poem1',
      ]);
    });

    it('includes roomDate from room', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const lines = [{ poemId: 'poem1', authorUserId: 'user1' }];

      // 1. Lines by author
      mockDb.collect.mockResolvedValueOnce(lines);

      // 2. Batch fetch poems
      mockDb.get
        .mockResolvedValueOnce({
          _id: 'poem1',
          roomId: 'room1',
          createdAt: 1000,
        })
        // 3. Batch fetch rooms
        .mockResolvedValueOnce({ _id: 'room1', createdAt: 500 });

      // 4. Batch fetch first lines
      mockDb.first.mockResolvedValueOnce({ text: 'Line 1' });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyPoems.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result[0].roomDate).toBe(500);
    });
  });

  describe('getPublicPoemPreview', () => {
    it('returns null when poem not found', async () => {
      // Arrange
      mockDb.get.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPublicPoemPreview.handler(mockCtx, {
        poemId: 'poem1',
      });

      // Assert
      expect(result).toBeNull();
    });

    it('returns preview data correctly', async () => {
      // Arrange
      const poem = { _id: 'poem1', indexInRoom: 4 };
      const lines = [
        { text: 'Line 1', indexInPoem: 0, authorUserId: 'u1' },
        { text: 'Line 2', indexInPoem: 1, authorUserId: 'u2' },
        { text: 'Line 3', indexInPoem: 2, authorUserId: 'u1' },
        { text: 'Line 4', indexInPoem: 3, authorUserId: 'u3' },
      ];

      mockDb.get.mockResolvedValue(poem);
      mockDb.collect.mockResolvedValue(lines);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPublicPoemPreview.handler(mockCtx, {
        poemId: 'poem1',
      });

      // Assert
      expect(result).toEqual({
        lines: ['Line 1', 'Line 2', 'Line 3'],
        poetCount: 3, // u1, u2, u3
        poemNumber: 5, // 4 + 1
      });
    });

    it('returns lines in database order (using by_poem_index)', async () => {
      // Arrange - lines returned in index order from DB (simulating .order('asc'))
      const poem = { _id: 'poem1', indexInRoom: 0 };
      const lines = [
        { text: 'Line 1', indexInPoem: 0, authorUserId: 'u1' },
        { text: 'Line 2', indexInPoem: 1, authorUserId: 'u1' },
        { text: 'Line 4', indexInPoem: 3, authorUserId: 'u1' },
      ];

      mockDb.get.mockResolvedValue(poem);
      mockDb.collect.mockResolvedValue(lines);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPublicPoemPreview.handler(mockCtx, {
        poemId: 'poem1',
      });

      // Assert - should return first 3 lines in DB order
      expect(result?.lines).toEqual(['Line 1', 'Line 2', 'Line 4']);
    });
  });

  describe('getPublicPoemFull', () => {
    it('returns null when poem not found', async () => {
      // Arrange
      mockDb.get.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPublicPoemFull.handler(mockCtx, {
        poemId: 'poem1',
      });

      // Assert
      expect(result).toBeNull();
    });

    it('returns full poem with lines and author names', async () => {
      // Arrange
      const poem = { _id: 'poem1', indexInRoom: 2, roomId: 'room1' };
      const lines = [
        { _id: 'l1', text: 'First line', indexInPoem: 0, authorUserId: 'u1' },
        { _id: 'l2', text: 'Second line', indexInPoem: 1, authorUserId: 'u2' },
        { _id: 'l3', text: 'Third line', indexInPoem: 2, authorUserId: 'u1' },
      ];
      const user1 = { _id: 'u1', displayName: 'Alice' };
      const user2 = { _id: 'u2', displayName: 'Bob' };

      mockDb.get.mockResolvedValueOnce(poem); // poem lookup
      mockDb.collect.mockResolvedValue(lines); // lines query
      mockDb.get.mockResolvedValueOnce(user1); // author 1
      mockDb.get.mockResolvedValueOnce(user2); // author 2

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPublicPoemFull.handler(mockCtx, {
        poemId: 'poem1',
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result?.poem).toEqual(poem);
      expect(result?.lines).toHaveLength(3);
      expect(result?.lines[0].authorName).toBe('Alice');
      expect(result?.lines[1].authorName).toBe('Bob');
      expect(result?.lines[2].authorName).toBe('Alice');
    });

    it('uses "Unknown" for missing author names', async () => {
      // Arrange
      const poem = { _id: 'poem1', indexInRoom: 0 };
      const lines = [
        {
          _id: 'l1',
          text: 'Solo line',
          indexInPoem: 0,
          authorUserId: 'missing',
        },
      ];

      mockDb.get.mockResolvedValueOnce(poem); // poem lookup
      mockDb.collect.mockResolvedValue(lines); // lines query
      mockDb.get.mockResolvedValueOnce(null); // missing author

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPublicPoemFull.handler(mockCtx, {
        poemId: 'poem1',
      });

      // Assert
      expect(result?.lines[0].authorName).toBe('Unknown');
    });
  });

  describe('getPublicSessionRecap', () => {
    it('returns null when room is not found', async () => {
      mockGetRoomByCode.mockResolvedValue(null);

      // @ts-expect-error - calling handler directly for test
      const result = await getPublicSessionRecap.handler(mockCtx, {
        roomCode: 'MISS',
      });

      expect(result).toBeNull();
    });

    it('returns null when room has no completed game', async () => {
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1', code: 'ABCD' });
      mockGetCompletedGame.mockResolvedValue(null);

      // @ts-expect-error - calling handler directly for test
      const result = await getPublicSessionRecap.handler(mockCtx, {
        roomCode: 'ABCD',
      });

      expect(result).toBeNull();
    });

    it('returns session-level poems, contributors, and replay metadata', async () => {
      const room = { _id: 'room1', code: 'ABCD' };
      const game = {
        _id: 'game1',
        roomId: 'room1',
        cycle: 2,
        completedAt: 2000,
      };
      const poems = [
        {
          _id: 'poem2',
          roomId: 'room1',
          gameId: 'game1',
          indexInRoom: 1,
          createdAt: 1000,
          assignedReaderId: 'user2',
          revealedAt: 3000,
        },
        {
          _id: 'poem1',
          roomId: 'room1',
          gameId: 'game1',
          indexInRoom: 0,
          createdAt: 1000,
          assignedReaderId: 'user1',
          revealedAt: 3000,
        },
      ];
      const players = [
        {
          _id: 'player1',
          roomId: 'room1',
          userId: 'user1',
          displayName: 'Alice',
          seatIndex: 0,
        },
        {
          _id: 'player2',
          roomId: 'room1',
          userId: 'user2',
          displayName: 'Bob',
          seatIndex: 1,
        },
      ];

      mockGetRoomByCode.mockResolvedValue(room);
      mockGetCompletedGame.mockResolvedValue(game);
      mockDb.collect
        .mockResolvedValueOnce(poems)
        .mockResolvedValueOnce(players)
        .mockResolvedValueOnce([
          {
            text: 'Second poem line two',
            indexInPoem: 1,
            authorUserId: 'user1',
          },
          {
            text: 'Second poem line one',
            indexInPoem: 0,
            authorUserId: 'user2',
          },
        ])
        .mockResolvedValueOnce([
          {
            text: 'First poem line',
            indexInPoem: 0,
            authorUserId: 'user1',
            authorDisplayName: 'Alice Pen',
          },
        ]);
      mockDb.get
        .mockResolvedValueOnce({ _id: 'user1', displayName: 'Alice' })
        .mockResolvedValueOnce({ _id: 'user2', displayName: 'Bob' });

      // @ts-expect-error - calling handler directly for test
      const result = await getPublicSessionRecap.handler(mockCtx, {
        roomCode: 'ABCD',
      });

      expect(result).toMatchObject({
        roomCode: 'ABCD',
        cycle: 2,
        completedAt: 2000,
        poemCount: 2,
        playerCount: 2,
      });
      expect(result?.poems.map((poem: { _id: string }) => poem._id)).toEqual([
        'poem1',
        'poem2',
      ]);
      expect(result?.poems[0]).toMatchObject({
        preview: 'First poem line',
        readerName: 'Alice',
        starterName: 'Alice Pen',
        poetCount: 1,
        lines: [{ text: 'First poem line', authorName: 'Alice Pen' }],
      });
      expect(
        result?.poems[1].lines.map((line: { text: string }) => line.text)
      ).toEqual(['Second poem line one', 'Second poem line two']);
    });

    it('falls back cleanly when recap names and lines are missing', async () => {
      const room = { _id: 'room1', code: 'ABCD' };
      const game = {
        _id: 'game1',
        roomId: 'room1',
        cycle: 1,
        completedAt: 3000,
      };
      const poems = [
        {
          _id: 'poem1',
          roomId: 'room1',
          gameId: 'game1',
          indexInRoom: 0,
          createdAt: 1000,
          assignedReaderId: 'missing-reader',
          revealedAt: 4000,
        },
      ];
      const players = [
        {
          _id: 'player1',
          roomId: 'room1',
          userId: 'user1',
          displayName: 'Alice',
        },
      ];

      mockGetRoomByCode.mockResolvedValue(room);
      mockGetCompletedGame.mockResolvedValue(game);
      mockDb.collect
        .mockResolvedValueOnce(poems)
        .mockResolvedValueOnce(players)
        .mockResolvedValueOnce([]);

      // @ts-expect-error - calling handler directly for test
      const result = await getPublicSessionRecap.handler(mockCtx, {
        roomCode: 'ABCD',
      });

      expect(result?.poems[0]).toMatchObject({
        preview: '',
        readerName: 'Unknown',
        starterName: 'Unknown',
        poetCount: 0,
        lines: [],
      });
    });

    it('marks AI authors and falls back to Unknown for missing author records', async () => {
      const room = { _id: 'room1', code: 'ABCD' };
      const game = {
        _id: 'game1',
        roomId: 'room1',
        cycle: 1,
        completedAt: 3000,
      };
      const poems = [
        {
          _id: 'poem1',
          roomId: 'room1',
          gameId: 'game1',
          indexInRoom: 0,
          createdAt: 1000,
          assignedReaderId: 'user1',
          revealedAt: 4000,
        },
      ];
      const players = [
        {
          _id: 'player1',
          roomId: 'room1',
          userId: 'user1',
          displayName: 'Alice',
          seatIndex: 0,
        },
      ];

      mockGetRoomByCode.mockResolvedValue(room);
      mockGetCompletedGame.mockResolvedValue(game);
      mockDb.collect
        .mockResolvedValueOnce(poems)
        .mockResolvedValueOnce(players)
        .mockResolvedValueOnce([
          {
            text: 'AI line',
            indexInPoem: 1,
            authorUserId: 'ai-user',
          },
          {
            text: 'Mystery line',
            indexInPoem: 0,
            authorUserId: 'missing-user',
          },
        ]);
      mockDb.get
        .mockResolvedValueOnce({
          _id: 'ai-user',
          displayName: 'Muse',
          kind: 'AI',
        })
        .mockResolvedValueOnce(null);

      // @ts-expect-error - calling handler directly for test
      const result = await getPublicSessionRecap.handler(mockCtx, {
        roomCode: 'ABCD',
      });

      expect(result?.poems[0].lines).toEqual([
        {
          text: 'Mystery line',
          authorName: 'Unknown',
          isBot: false,
        },
        {
          text: 'AI line',
          authorName: 'Muse',
          isBot: true,
        },
      ]);
    });

    it('returns null until every completed-game poem has been revealed', async () => {
      const room = { _id: 'room1', code: 'ABCD' };
      const game = {
        _id: 'game1',
        roomId: 'room1',
        cycle: 1,
        completedAt: 3000,
      };
      const poems = [
        {
          _id: 'poem1',
          roomId: 'room1',
          gameId: 'game1',
          indexInRoom: 0,
          createdAt: 1000,
          assignedReaderId: 'user1',
          revealedAt: 4000,
        },
        {
          _id: 'poem2',
          roomId: 'room1',
          gameId: 'game1',
          indexInRoom: 1,
          createdAt: 1000,
          assignedReaderId: 'user2',
        },
      ];

      mockGetRoomByCode.mockResolvedValue(room);
      mockGetCompletedGame.mockResolvedValue(game);
      mockDb.collect.mockResolvedValueOnce(poems).mockResolvedValueOnce([]);

      // @ts-expect-error - calling handler directly for test
      const result = await getPublicSessionRecap.handler(mockCtx, {
        roomCode: 'ABCD',
      });

      expect(result).toBeNull();
    });

    it('derives starter names from the first line author, not mutable room seats', async () => {
      const room = { _id: 'room1', code: 'ABCD' };
      const game = {
        _id: 'game1',
        roomId: 'room1',
        cycle: 1,
        completedAt: 3000,
      };
      const poems = [
        {
          _id: 'poem1',
          roomId: 'room1',
          gameId: 'game1',
          indexInRoom: 0,
          createdAt: 1000,
          assignedReaderId: 'reader',
          revealedAt: 4000,
        },
      ];
      const players = [
        {
          _id: 'player1',
          roomId: 'room1',
          userId: 'reader',
          displayName: 'Reader',
          seatIndex: 0,
        },
        {
          _id: 'player2',
          roomId: 'room1',
          userId: 'starter',
          displayName: 'Starter',
          seatIndex: 2,
        },
      ];

      mockGetRoomByCode.mockResolvedValue(room);
      mockGetCompletedGame.mockResolvedValue(game);
      mockDb.collect
        .mockResolvedValueOnce(poems)
        .mockResolvedValueOnce(players)
        .mockResolvedValueOnce([
          {
            text: 'Opening line',
            indexInPoem: 0,
            authorUserId: 'starter',
          },
        ]);
      mockDb.get.mockResolvedValueOnce({
        _id: 'starter',
        displayName: 'Starter',
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getPublicSessionRecap.handler(mockCtx, {
        roomCode: 'ABCD',
      });

      expect(result?.poems[0]).toMatchObject({
        readerName: 'Reader',
        starterName: 'Starter',
      });
    });

    it('ignores legacy lines without author ids when building recap authors', async () => {
      const room = { _id: 'room1', code: 'ABCD' };
      const game = {
        _id: 'game1',
        roomId: 'room1',
        cycle: 1,
        completedAt: 3000,
      };
      const poems = [
        {
          _id: 'poem1',
          roomId: 'room1',
          gameId: 'game1',
          indexInRoom: 0,
          createdAt: 1000,
          assignedReaderId: 'reader',
          revealedAt: 4000,
        },
      ];

      mockGetRoomByCode.mockResolvedValue(room);
      mockGetCompletedGame.mockResolvedValue(game);
      mockDb.collect
        .mockResolvedValueOnce(poems)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            text: 'Legacy line',
            indexInPoem: 0,
            authorUserId: undefined,
          },
        ]);

      // @ts-expect-error - calling handler directly for test
      const result = await getPublicSessionRecap.handler(mockCtx, {
        roomCode: 'ABCD',
      });

      expect(mockDb.get).not.toHaveBeenCalled();
      expect(result?.poems[0]).toMatchObject({
        starterName: 'Unknown',
        poetCount: 0,
        lines: [
          {
            text: 'Legacy line',
            authorName: 'Unknown',
            isBot: false,
          },
        ],
      });
    });
  });
});
