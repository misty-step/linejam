import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../convex/_generated/server', () => ({
  mutation: (config: { args: unknown; handler: unknown }) => config,
}));

vi.mock('../../convex/lib/guestToken', () => ({
  verifyGuestToken: vi.fn(),
}));

import { migrateGuestToUser } from '../../convex/migrations';
import { verifyGuestToken } from '../../convex/lib/guestToken';

describe('migrateGuestToUser', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: vi.fn(),
      get: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      insert: vi.fn(),
    };
    mockCtx = {
      db: mockDb,
      auth: {
        getUserIdentity: vi.fn(),
      },
    };
  });

  it('throws error when not authenticated', async () => {
    mockCtx.auth.getUserIdentity.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (migrateGuestToUser as any).handler;
    await expect(handler(mockCtx, { guestToken: 'token' })).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('returns alreadyMigrated when migration exists', async () => {
    mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: 'clerk_123' });
    vi.mocked(verifyGuestToken).mockResolvedValue('guest_abc');

    mockDb.query.mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: vi
          .fn()
          .mockResolvedValueOnce({ _id: 'guest_user_id', displayName: 'Guest' }) // guest user
          .mockResolvedValueOnce({ _id: 'existing_migration' }), // migration exists
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (migrateGuestToUser as any).handler(mockCtx, {
      guestToken: 'token',
    });

    expect(result).toEqual({ alreadyMigrated: true });
  });

  it('throws error when guest user not found', async () => {
    mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: 'clerk_123' });
    vi.mocked(verifyGuestToken).mockResolvedValue('guest_abc');

    // Guest user query returns null, migration check returns null
    mockDb.query.mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (migrateGuestToUser as any).handler;
    await expect(handler(mockCtx, { guestToken: 'token' })).rejects.toThrow(
      'Guest user not found'
    );
  });
});
