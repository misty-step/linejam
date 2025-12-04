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
} from '../../convex/poems';

// Mock getUser
const mockGetUser = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
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
      mockDb.first.mockResolvedValue(null);

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
      mockDb.first
        .mockResolvedValueOnce({ _id: 'room1', code: 'ABCD' }) // Room lookup
        .mockResolvedValueOnce(null); // No player record

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemsForRoom.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual([]);
    });

    it('returns poems for room where user participated', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const room = { _id: 'room1', code: 'ABCD', currentGameId: 'game1' };
      const player = { roomId: 'room1', userId: 'user1' };
      const poems = [
        { _id: 'poem1', roomId: 'room1', gameId: 'game1' },
        { _id: 'poem2', roomId: 'room1', gameId: 'game1' },
      ];

      mockDb.first
        .mockResolvedValueOnce(room) // Room lookup
        .mockResolvedValueOnce(player) // Player check
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

    it('filters by roomId when no currentGameId', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const room = { _id: 'room1', code: 'ABCD', currentGameId: null };
      const player = { roomId: 'room1', userId: 'user1' };
      const poems = [{ _id: 'poem1', roomId: 'room1' }];

      mockDb.first
        .mockResolvedValueOnce(room)
        .mockResolvedValueOnce(player)
        .mockResolvedValueOnce({ text: 'First line' });

      mockDb.collect.mockResolvedValueOnce(poems);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemsForRoom.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith('poems');
      expect(mockDb.withIndex).toHaveBeenCalledWith(
        'by_room',
        expect.any(Function)
      );
    });

    it('uses fallback preview when no first line exists', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const room = { _id: 'room1', code: 'ABCD', currentGameId: 'game1' };
      const player = { roomId: 'room1', userId: 'user1' };
      const poems = [{ _id: 'poem1', roomId: 'room1', gameId: 'game1' }];

      mockDb.first
        .mockResolvedValueOnce(room)
        .mockResolvedValueOnce(player)
        .mockResolvedValueOnce(null); // No first line

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
      mockDb.first.mockResolvedValue(null); // No player record

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getPoemDetail.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toBeNull();
    });

    it('returns poem with lines in correct order', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const poem = { _id: 'poem1', roomId: 'room1' };
      const player = { roomId: 'room1', userId: 'user1' };
      const lines = [
        { _id: 'line3', indexInPoem: 2, authorUserId: 'user3', text: 'Third' },
        { _id: 'line1', indexInPoem: 0, authorUserId: 'user1', text: 'First' },
        { _id: 'line2', indexInPoem: 1, authorUserId: 'user2', text: 'Second' },
      ];

      mockDb.get
        .mockResolvedValueOnce(poem) // Poem lookup
        .mockResolvedValueOnce({ displayName: 'Alice' }) // Author for line1
        .mockResolvedValueOnce({ displayName: 'Bob' }) // Author for line2
        .mockResolvedValueOnce({ displayName: 'Charlie' }); // Author for line3

      mockDb.first.mockResolvedValue(player);
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
      const poem = { _id: 'poem1', roomId: 'room1' };
      const player = { roomId: 'room1', userId: 'user1' };
      const lines = [
        { _id: 'line1', indexInPoem: 0, authorUserId: 'user1', text: 'First' },
      ];

      mockDb.get.mockResolvedValueOnce(poem).mockResolvedValueOnce(null); // Author deleted

      mockDb.first.mockResolvedValue(player);
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
});
