import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Convex server
vi.mock('../../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
}));

// Mock guestToken verification
const mockVerifyGuestToken = vi.fn();
vi.mock('../../../convex/lib/guestToken', () => ({
  verifyGuestToken: (...args: unknown[]) => mockVerifyGuestToken(...args),
}));

import { getUser, requireUser } from '../../../convex/lib/auth';

describe('convex/lib/auth', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(() => mockDb),
      withIndex: vi.fn(() => mockDb),
      first: vi.fn(),
    };
    mockCtx = {
      db: mockDb,
      auth: { getUserIdentity: vi.fn() },
    };
    mockVerifyGuestToken.mockReset();
    mockDb.first.mockResolvedValue(null);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getUser', () => {
    it('returns Clerk user when getUserIdentity returns user', async () => {
      // Arrange
      const clerkUser = {
        _id: 'user-clerk-1',
        clerkUserId: 'clerk_123',
        displayName: 'Clerk User',
        createdAt: Date.now(),
      };
      mockCtx.auth.getUserIdentity.mockResolvedValue({
        subject: 'clerk_123',
        email: 'test@example.com',
      });
      mockDb.first.mockResolvedValue(clerkUser);

      // Act
      const result = await getUser(mockCtx, undefined);

      // Assert
      expect(mockCtx.auth.getUserIdentity).toHaveBeenCalled();
      expect(mockDb.query).toHaveBeenCalledWith('users');
      expect(mockDb.withIndex).toHaveBeenCalledWith(
        'by_clerk',
        expect.any(Function)
      );
      expect(result).toEqual(clerkUser);
    });

    it('returns guest user when valid guestToken provided', async () => {
      // Arrange
      const guestUser = {
        _id: 'user-guest-1',
        guestId: 'guest-abc-123',
        displayName: 'Guest User',
        createdAt: Date.now(),
      };
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      mockVerifyGuestToken.mockResolvedValue('guest-abc-123');
      mockDb.first.mockResolvedValue(guestUser);

      // Act
      const result = await getUser(mockCtx, 'valid-guest-token');

      // Assert
      expect(mockVerifyGuestToken).toHaveBeenCalledWith('valid-guest-token');
      expect(mockDb.query).toHaveBeenCalledWith('users');
      expect(mockDb.withIndex).toHaveBeenCalledWith(
        'by_guest',
        expect.any(Function)
      );
      expect(result).toEqual(guestUser);
    });

    it('returns null when no Clerk user and no guestToken provided', async () => {
      // Arrange
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);

      // Act
      const result = await getUser(mockCtx, undefined);

      // Assert
      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns null when invalid guest token provided', async () => {
      // Arrange
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      mockVerifyGuestToken.mockRejectedValue(
        new Error('Invalid token signature')
      );

      // Act
      const result = await getUser(mockCtx, 'invalid-token');

      // Assert
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Invalid guest token:',
        expect.objectContaining({
          error: expect.any(Error),
          hasToken: true,
        })
      );
    });

    it('returns null when expired guest token provided', async () => {
      // Arrange
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      mockVerifyGuestToken.mockRejectedValue(new Error('Token expired'));

      // Act
      const result = await getUser(mockCtx, 'expired-token');

      // Assert
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Invalid guest token:',
        expect.objectContaining({
          error: expect.any(Error),
          hasToken: true,
        })
      );
    });

    it('prioritizes Clerk user over guest token when both present', async () => {
      // Arrange
      const clerkUser = {
        _id: 'user-clerk-2',
        clerkUserId: 'clerk_456',
        displayName: 'Clerk User 2',
        createdAt: Date.now(),
      };
      mockCtx.auth.getUserIdentity.mockResolvedValue({
        subject: 'clerk_456',
        email: 'clerk@example.com',
      });
      mockDb.first.mockResolvedValue(clerkUser);

      // Act
      const result = await getUser(mockCtx, 'some-guest-token');

      // Assert
      expect(result).toEqual(clerkUser);
      expect(mockVerifyGuestToken).not.toHaveBeenCalled();
    });

    it('returns null when guest user not found in database', async () => {
      // Arrange
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      mockVerifyGuestToken.mockResolvedValue('guest-xyz-789');
      mockDb.first.mockResolvedValue(null); // User not in database

      // Act
      const result = await getUser(mockCtx, 'valid-but-unknown-token');

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when Clerk user not found in database', async () => {
      // Arrange
      mockCtx.auth.getUserIdentity.mockResolvedValue({
        subject: 'clerk_unknown',
        email: 'unknown@example.com',
      });
      mockDb.first.mockResolvedValue(null); // User not in database

      // Act
      const result = await getUser(mockCtx, undefined);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('requireUser', () => {
    it('returns user when getUser finds valid user', async () => {
      // Arrange
      const validUser = {
        _id: 'user-1',
        clerkUserId: 'clerk_123',
        displayName: 'Valid User',
        createdAt: Date.now(),
      };
      mockCtx.auth.getUserIdentity.mockResolvedValue({
        subject: 'clerk_123',
        email: 'valid@example.com',
      });
      mockDb.first.mockResolvedValue(validUser);

      // Act
      const result = await requireUser(mockCtx, undefined);

      // Assert
      expect(result).toEqual(validUser);
    });

    it('throws "Unauthorized" error when getUser returns null', async () => {
      // Arrange
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);

      // Act & Assert
      await expect(requireUser(mockCtx, undefined)).rejects.toThrow(
        'Unauthorized: User not found'
      );
    });

    it('throws when invalid guest token provided', async () => {
      // Arrange
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      mockVerifyGuestToken.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(requireUser(mockCtx, 'invalid-token')).rejects.toThrow(
        'Unauthorized: User not found'
      );
    });

    it('throws when guest user not in database', async () => {
      // Arrange
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      mockVerifyGuestToken.mockResolvedValue('guest-unknown');
      mockDb.first.mockResolvedValue(null);

      // Act & Assert
      await expect(requireUser(mockCtx, 'valid-token')).rejects.toThrow(
        'Unauthorized: User not found'
      );
    });
  });
});
