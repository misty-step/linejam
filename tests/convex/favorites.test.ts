import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createMockCtx } from '../helpers/mockConvexDb';

// Mock Convex server functions
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
}));

import {
  toggleFavorite,
  getMyFavorites,
  isFavorited,
} from '../../convex/favorites';

// Mock getUser
const mockGetUser = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

describe('favorites', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCtx = createMockCtx(mockDb);
    mockGetUser.mockReset();
  });

  describe('toggleFavorite', () => {
    it('creates favorite on first toggle', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.first.mockResolvedValue(null); // No existing favorite
      mockDb.insert.mockResolvedValue('favorite1');

      // Act
      // @ts-expect-error - calling handler directly for test
      await toggleFavorite.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(mockDb.insert).toHaveBeenCalledWith(
        'favorites',
        expect.objectContaining({
          userId: 'user1',
          poemId: 'poem1',
          createdAt: expect.any(Number),
        })
      );
    });

    it('removes favorite on second toggle', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const existingFavorite = {
        _id: 'favorite1',
        userId: 'user1',
        poemId: 'poem1',
      };
      mockDb.first.mockResolvedValue(existingFavorite);
      mockDb.delete.mockResolvedValue(undefined);

      // Act
      // @ts-expect-error - calling handler directly for test
      await toggleFavorite.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(mockDb.delete).toHaveBeenCalledWith('favorite1');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('creates favorite again on third toggle (idempotent)', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.first.mockResolvedValue(null); // Removed again
      mockDb.insert.mockResolvedValue('favorite2');

      // Act
      // @ts-expect-error - calling handler directly for test
      await toggleFavorite.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(mockDb.insert).toHaveBeenCalledWith(
        'favorites',
        expect.objectContaining({
          userId: 'user1',
          poemId: 'poem1',
        })
      );
    });

    it('throws error when user not found', async () => {
      // Arrange
      mockGetUser.mockResolvedValue(null);

      // Act & Assert
      await expect(
        // @ts-expect-error - calling handler directly for test
        toggleFavorite.handler(mockCtx, {
          poemId: 'poem1',
          guestToken: 'token123',
        })
      ).rejects.toThrow('User not found');
    });

    it('enforces authorization (user owns favorite)', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.first.mockResolvedValue(null);
      mockDb.insert.mockResolvedValue('favorite1');

      // Act
      // @ts-expect-error - calling handler directly for test
      await toggleFavorite.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert - Verify the favorite is created for the authenticated user
      expect(mockDb.withIndex).toHaveBeenCalledWith(
        'by_user_poem',
        expect.any(Function)
      );
      expect(mockDb.insert).toHaveBeenCalledWith(
        'favorites',
        expect.objectContaining({
          userId: 'user1',
        })
      );
    });
  });

  describe('getMyFavorites', () => {
    it('returns empty array when user not found', async () => {
      // Arrange
      mockGetUser.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyFavorites.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual([]);
    });

    it('returns empty array when no favorites', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.collect.mockResolvedValue([]);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyFavorites.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result).toEqual([]);
    });

    it('returns all user favorites', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const favorites = [
        { poemId: 'poem1', userId: 'user1', createdAt: 1000 },
        { poemId: 'poem2', userId: 'user1', createdAt: 2000 },
      ];
      mockDb.collect.mockResolvedValue(favorites);

      mockDb.get
        .mockResolvedValueOnce({ _id: 'poem1', roomId: 'room1' })
        .mockResolvedValueOnce({ _id: 'poem2', roomId: 'room2' });

      mockDb.first
        .mockResolvedValueOnce({ text: 'First line of poem 1' })
        .mockResolvedValueOnce({ text: 'First line of poem 2' });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyFavorites.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        _id: 'poem1',
        preview: 'First line of poem 1',
        favoritedAt: 1000,
      });
      expect(result[1]).toMatchObject({
        _id: 'poem2',
        preview: 'First line of poem 2',
        favoritedAt: 2000,
      });
    });

    it('resolves poem details for each favorite', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const favorites = [{ poemId: 'poem1', userId: 'user1', createdAt: 1000 }];
      mockDb.collect.mockResolvedValue(favorites);

      const poem = {
        _id: 'poem1',
        roomId: 'room1',
        title: 'Beautiful Poem',
        createdAt: 500,
      };
      mockDb.get.mockResolvedValue(poem);
      mockDb.first.mockResolvedValue({ text: 'First line' });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyFavorites.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result[0]).toMatchObject({
        ...poem,
        preview: 'First line',
        favoritedAt: 1000,
      });
    });

    it('handles missing poems gracefully', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const favorites = [
        { poemId: 'poem1', userId: 'user1', createdAt: 1000 },
        { poemId: 'poem2', userId: 'user1', createdAt: 2000 },
      ];
      mockDb.collect.mockResolvedValue(favorites);

      mockDb.get
        .mockResolvedValueOnce({ _id: 'poem1', roomId: 'room1' })
        .mockResolvedValueOnce(null); // Poem deleted

      mockDb.first.mockResolvedValueOnce({ text: 'First line' });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyFavorites.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result).toHaveLength(1); // Only non-deleted poem
      expect(result[0]._id).toBe('poem1');
    });

    it('uses fallback preview when no first line exists', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      const favorites = [{ poemId: 'poem1', userId: 'user1', createdAt: 1000 }];
      mockDb.collect.mockResolvedValue(favorites);

      mockDb.get.mockResolvedValue({ _id: 'poem1', roomId: 'room1' });
      mockDb.first.mockResolvedValue(null); // No first line

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await getMyFavorites.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(result[0].preview).toBe('...');
    });

    it('enforces authorization (only user favorites)', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.collect.mockResolvedValue([]);

      // Act
      // @ts-expect-error - calling handler directly for test
      await getMyFavorites.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Assert
      expect(mockDb.withIndex).toHaveBeenCalledWith(
        'by_user',
        expect.any(Function)
      );
    });
  });

  describe('isFavorited', () => {
    it('returns true when favorited', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.first.mockResolvedValue({
        _id: 'favorite1',
        userId: 'user1',
        poemId: 'poem1',
      });

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await isFavorited.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toBe(true);
    });

    it('returns false when not favorited', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.first.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await isFavorited.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toBe(false);
    });

    it('returns false when user not found', async () => {
      // Arrange
      mockGetUser.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      const result = await isFavorited.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert
      expect(result).toBe(false);
    });

    it('enforces authorization check', async () => {
      // Arrange
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockDb.first.mockResolvedValue(null);

      // Act
      // @ts-expect-error - calling handler directly for test
      await isFavorited.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'token123',
      });

      // Assert - Verify we're checking for the specific user+poem combination
      expect(mockDb.withIndex).toHaveBeenCalledWith(
        'by_user_poem',
        expect.any(Function)
      );
    });
  });
});
