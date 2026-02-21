import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createMockCtx } from '../helpers/mockConvexDb';

// Mock Convex server functions
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
}));

import { logShare } from '../../convex/shares';

describe('shares', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCtx = createMockCtx(mockDb);
  });

  describe('logShare', () => {
    it('inserts a share record when poem exists', async () => {
      // Arrange
      const poemId = 'poem1';
      mockDb.get.mockResolvedValue({ _id: poemId });

      // Act
      // @ts-expect-error - calling handler directly for test
      await logShare.handler(mockCtx, { poemId });

      // Assert
      expect(mockDb.get).toHaveBeenCalledWith(poemId);
      expect(mockDb.insert).toHaveBeenCalledWith('shares', {
        poemId,
        createdAt: expect.any(Number),
      });
    });

    it('throws ConvexError when poem does not exist', async () => {
      // Arrange
      const poemId = 'invalid-poem';
      mockDb.get.mockResolvedValue(null);

      // Act & Assert
      // @ts-expect-error - calling handler directly for test
      await expect(logShare.handler(mockCtx, { poemId })).rejects.toThrow(
        'Poem not found'
      );
      expect(mockDb.get).toHaveBeenCalledWith(poemId);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});
