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

  it('rejects legacy guestId with deprecation error', async () => {
    mockGetUser.mockResolvedValue(null);

    await expect(
      ensureUserHelper(mockCtx, {
        displayName: 'Legacy',
        guestId: 'legacy-guest',
      })
    ).rejects.toThrow('guestId auth deprecated. Please refresh browser.');
  });

  it('throws when no identity information supplied', async () => {
    mockGetUser.mockResolvedValue(null);

    await expect(
      ensureUserHelper(mockCtx, { displayName: 'Nameless' })
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it('creates Clerk user when Clerk identity present', async () => {
    mockGetUser.mockResolvedValue(null);
    mockCtx.auth.getUserIdentity.mockResolvedValue({
      subject: 'clerk_user_123',
      email: 'test@example.com',
    });
    mockDb.insert.mockResolvedValue('user3');
    mockDb.get.mockResolvedValue({
      _id: 'user3',
      clerkUserId: 'clerk_user_123',
      displayName: 'Clerk User',
      createdAt: 123,
    });

    const user = await ensureUserHelper(mockCtx, {
      displayName: 'Clerk User',
    });

    expect(mockDb.insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        clerkUserId: 'clerk_user_123',
        displayName: 'Clerk User',
      })
    );
    expect(user.clerkUserId).toBe('clerk_user_123');
  });

  it('normalizes displayName with multiple spaces', async () => {
    const guestId = 'multi-space-guest';
    const guestToken = await signGuestToken(guestId);

    mockGetUser.mockResolvedValue(null);
    mockDb.insert.mockResolvedValue('user4');
    mockDb.get.mockResolvedValue({
      _id: 'user4',
      guestId,
      displayName: 'John Doe',
      createdAt: 123,
    });

    const user = await ensureUserHelper(mockCtx, {
      displayName: '  John   Doe  ',
      guestToken,
    });

    expect(mockDb.insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        displayName: 'John Doe', // Multiple spaces collapsed to single
      })
    );
    expect(user.displayName).toBe('John Doe');
  });

  it('throws when displayName is empty after trimming', async () => {
    const guestId = 'empty-name-guest';
    const guestToken = await signGuestToken(guestId);

    mockGetUser.mockResolvedValue(null);

    await expect(
      ensureUserHelper(mockCtx, {
        displayName: '   ',
        guestToken,
      })
    ).rejects.toBeInstanceOf(ConvexError);
  });
});
