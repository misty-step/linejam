import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createMockCtx } from '../helpers/mockConvexDb';
import type { Id } from '../../convex/_generated/dataModel';

// Mock Convex server functions
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
  internalMutation: (args: unknown) => args,
}));

import { heartbeat } from '../../convex/presence';

const mockGetUser = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

const mockGetRoomByCode = vi.fn();
vi.mock('../../convex/lib/room', () => ({
  getRoomByCode: (...args: unknown[]) => mockGetRoomByCode(...args),
}));

const asRoomId = (v: string) => v as unknown as Id<'rooms'>;
const asUserId = (v: string) => v as unknown as Id<'users'>;

type MockDb = ReturnType<typeof createMockDb>;
type MockCtx = ReturnType<typeof createMockCtx> & {
  scheduler: { runAfter: ReturnType<typeof vi.fn> };
};

describe('presence', () => {
  let mockDb: MockDb;
  let mockCtx: MockCtx;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCtx = {
      ...createMockCtx(mockDb),
      scheduler: { runAfter: vi.fn() },
    };
    mockGetUser.mockReset();
    mockGetRoomByCode.mockReset();
  });

  describe('heartbeat', () => {
    it('stamps lastSeenAt on the caller roomPlayers row', async () => {
      const user = { _id: asUserId('user1') };
      const room = { _id: asRoomId('room1') };
      const player = {
        _id: 'rp1',
        userId: asUserId('user1'),
        roomId: asRoomId('room1'),
      };

      mockGetUser.mockResolvedValue(user);
      mockGetRoomByCode.mockResolvedValue(room);
      mockDb.first.mockResolvedValue(player);

      const before = Date.now();
      // @ts-expect-error — calling handler directly for test
      await heartbeat.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token',
      });
      const after = Date.now();

      expect(mockDb.patch).toHaveBeenCalledWith('rp1', {
        lastSeenAt: expect.any(Number),
      });
      const stamped = (mockDb.patch as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as { lastSeenAt: number };
      expect(stamped.lastSeenAt).toBeGreaterThanOrEqual(before);
      expect(stamped.lastSeenAt).toBeLessThanOrEqual(after);
    });

    it('does nothing when the user is not found', async () => {
      mockGetUser.mockResolvedValue(null);

      // @ts-expect-error — calling handler directly for test
      await heartbeat.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token',
      });

      expect(mockDb.patch).not.toHaveBeenCalled();
    });

    it('does nothing when the room is not found', async () => {
      mockGetUser.mockResolvedValue({ _id: asUserId('user1') });
      mockGetRoomByCode.mockResolvedValue(null);

      // @ts-expect-error — calling handler directly for test
      await heartbeat.handler(mockCtx, {
        roomCode: 'XXXX',
        guestToken: 'token',
      });

      expect(mockDb.patch).not.toHaveBeenCalled();
    });

    it('does nothing when the user is not a room player', async () => {
      mockGetUser.mockResolvedValue({ _id: asUserId('user1') });
      mockGetRoomByCode.mockResolvedValue({ _id: asRoomId('room1') });
      mockDb.first.mockResolvedValue(null);

      // @ts-expect-error — calling handler directly for test
      await heartbeat.handler(mockCtx, {
        roomCode: 'ABCD',
        guestToken: 'token',
      });

      expect(mockDb.patch).not.toHaveBeenCalled();
    });
  });
});
