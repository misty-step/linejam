import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
}));

const mockGetUser = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

import { ensureUserHelper } from '../../convex/users';
import { signGuestToken } from '../../lib/guestToken';
import { ConvexError } from 'convex/values';

describe('ensureUserHelper', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(),
      get: vi.fn(),
      query: vi.fn(() => mockDb),
      withIndex: vi.fn(() => mockDb),
      first: vi.fn(),
    };
    mockCtx = {
      db: mockDb,
      auth: { getUserIdentity: vi.fn().mockResolvedValue(null) },
    };
    mockGetUser.mockReset();
    mockDb.first.mockResolvedValue(null);
  });

  it('creates a guest user from a signed guestToken', async () => {
    const guestId = 'guest-from-token';
    const guestToken = await signGuestToken(guestId);

    mockGetUser.mockResolvedValue(null);
    mockDb.insert.mockResolvedValue('user1');
    mockDb.get.mockResolvedValue({
      _id: 'user1',
      guestId,
      displayName: 'Tester',
      createdAt: 123,
    });

    const user = await ensureUserHelper(mockCtx, {
      displayName: 'Tester',
      guestToken,
    });

    expect(mockDb.insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        guestId,
        displayName: 'Tester',
      })
    );
    expect(user.guestId).toBe(guestId);
  });

  it('accepts legacy guestId when no token is provided', async () => {
    mockGetUser.mockResolvedValue(null);
    mockDb.insert.mockResolvedValue('user2');
    mockDb.get.mockResolvedValue({
      _id: 'user2',
      guestId: 'legacy-guest',
      displayName: 'Legacy',
      createdAt: 123,
    });

    const user = await ensureUserHelper(mockCtx, {
      displayName: ' Legacy  ',
      guestId: 'legacy-guest',
    });

    expect(mockDb.insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        guestId: 'legacy-guest',
        displayName: 'Legacy', // trimmed
      })
    );
    expect(user.displayName).toBe('Legacy');
  });

  it('throws when no identity information supplied', async () => {
    mockGetUser.mockResolvedValue(null);

    await expect(
      ensureUserHelper(mockCtx, { displayName: 'Nameless' })
    ).rejects.toBeInstanceOf(ConvexError);
  });
});
