import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createMockCtx } from '../helpers/mockConvexDb';

// Mock Convex server functions
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
}));

const mockGetUser = vi.fn();
const mockCheckParticipation = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  checkParticipation: (...args: unknown[]) => mockCheckParticipation(...args),
}));

const mockGetRoomByCode = vi.fn();
const mockGetCompletedGame = vi.fn();
vi.mock('../../convex/lib/room', () => ({
  getRoomByCode: (...args: unknown[]) => mockGetRoomByCode(...args),
  getCompletedGame: (...args: unknown[]) => mockGetCompletedGame(...args),
}));

import {
  disablePublicPoemShare,
  disablePublicSessionRecapShare,
  enablePublicPoemShare,
  enablePublicSessionRecapShare,
  logShare,
} from '../../convex/shares';

describe('shares', () => {
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
    mockGetCompletedGame.mockReset();
  });

  describe('enablePublicPoemShare', () => {
    it('marks a poem public when the caller participates in its room', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockCheckParticipation.mockResolvedValue(true);
      mockDb.get.mockResolvedValue({ _id: 'poem1', roomId: 'room1' });

      // @ts-expect-error - calling handler directly for test
      await enablePublicPoemShare.handler(mockCtx, {
        poemId: 'poem1',
        guestToken: 'guest-token',
      });

      expect(mockCheckParticipation).toHaveBeenCalledWith(
        mockCtx,
        'room1',
        'user1'
      );
      expect(mockDb.patch).toHaveBeenCalledWith('poem1', {
        publicShareEnabled: true,
        publicShareEnabledAt: expect.any(Number),
        publicShareDisabledAt: undefined,
      });
    });

    it('rejects poem sharing for non-participants', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user2' });
      mockCheckParticipation.mockResolvedValue(false);
      mockDb.get.mockResolvedValue({ _id: 'poem1', roomId: 'room1' });

      await expect(
        // @ts-expect-error - calling handler directly for test
        enablePublicPoemShare.handler(mockCtx, { poemId: 'poem1' })
      ).rejects.toThrow('Not authorized to share this poem');

      expect(mockDb.patch).not.toHaveBeenCalled();
    });
  });

  describe('disablePublicPoemShare', () => {
    it('marks a shared poem private when the caller participates', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockCheckParticipation.mockResolvedValue(true);
      mockDb.get.mockResolvedValue({ _id: 'poem1', roomId: 'room1' });

      // @ts-expect-error - calling handler directly for test
      await disablePublicPoemShare.handler(mockCtx, { poemId: 'poem1' });

      expect(mockDb.patch).toHaveBeenCalledWith('poem1', {
        publicShareEnabled: false,
        publicShareDisabledAt: expect.any(Number),
      });
    });
  });

  describe('enablePublicSessionRecapShare', () => {
    it('marks a completed revealed session recap public for participants', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockCheckParticipation.mockResolvedValue(true);
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1', code: 'ABCD' });
      mockGetCompletedGame.mockResolvedValue({
        _id: 'game1',
        roomId: 'room1',
      });
      mockDb.collect.mockResolvedValue([
        { _id: 'poem1', revealedAt: 1000 },
        { _id: 'poem2', revealedAt: 1000 },
      ]);

      // @ts-expect-error - calling handler directly for test
      await enablePublicSessionRecapShare.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'guest-token',
      });

      expect(mockCheckParticipation).toHaveBeenCalledWith(
        mockCtx,
        'room1',
        'user1'
      );
      expect(mockDb.patch).toHaveBeenCalledWith('game1', {
        publicRecapEnabled: true,
        publicRecapEnabledAt: expect.any(Number),
        publicRecapDisabledAt: undefined,
      });
    });

    it('rejects recap sharing before every poem is revealed', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockCheckParticipation.mockResolvedValue(true);
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1', code: 'ABCD' });
      mockGetCompletedGame.mockResolvedValue({
        _id: 'game1',
        roomId: 'room1',
      });
      mockDb.collect.mockResolvedValue([
        { _id: 'poem1', revealedAt: 1000 },
        { _id: 'poem2' },
      ]);

      await expect(
        // @ts-expect-error - calling handler directly for test
        enablePublicSessionRecapShare.handler(mockCtx, { roomCode: 'ABCD' })
      ).rejects.toThrow('Session recap not ready');

      expect(mockDb.patch).not.toHaveBeenCalled();
    });
  });

  describe('disablePublicSessionRecapShare', () => {
    it('marks a public recap private for participants', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1' });
      mockCheckParticipation.mockResolvedValue(true);
      mockGetRoomByCode.mockResolvedValue({ _id: 'room1', code: 'ABCD' });
      mockGetCompletedGame.mockResolvedValue({
        _id: 'game1',
        roomId: 'room1',
      });
      mockDb.collect.mockResolvedValue([{ _id: 'poem1', revealedAt: 1000 }]);

      // @ts-expect-error - calling handler directly for test
      await disablePublicSessionRecapShare.handler(mockCtx, {
        roomCode: 'ABCD',
      });

      expect(mockDb.patch).toHaveBeenCalledWith('game1', {
        publicRecapEnabled: false,
        publicRecapDisabledAt: expect.any(Number),
      });
    });
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
