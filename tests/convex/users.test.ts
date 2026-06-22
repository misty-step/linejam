import { describe, it, expect } from 'vitest';
import { api } from '../../convex/_generated/api';
import { setupConvexTest } from '../helpers/convexTest';
import { signGuestToken } from '../../lib/guestToken';
import { ConvexError } from 'convex/values';

/**
 * users.ensureUser on the real convex-test engine (backlog 018): real
 * read-your-writes, real crypto (guest token HMAC), real Clerk identity —
 * asserting observable DB state and return values instead of mock stubs.
 */

describe('ensureUser', () => {
  it('creates a guest user from a signed guestToken', async () => {
    const t = setupConvexTest();
    const guestId = 'guest-from-token';
    const guestToken = await signGuestToken(guestId);

    const user = await t.mutation(api.users.ensureUser, {
      displayName: 'Tester',
      guestToken,
    });

    expect(user.guestId).toBe(guestId);
    expect(user.displayName).toBe('Tester');

    // Verify the row exists in the real DB.
    const row = await t.run((ctx) => ctx.db.get(user._id));
    expect(row?.guestId).toBe(guestId);
    expect(row?.displayName).toBe('Tester');
  });

  it('returns the existing guest user on a second call (idempotent)', async () => {
    const t = setupConvexTest();
    const guestId = 'idempotent-guest';
    const guestToken = await signGuestToken(guestId);

    const first = await t.mutation(api.users.ensureUser, {
      displayName: 'Tester',
      guestToken,
    });
    const second = await t.mutation(api.users.ensureUser, {
      displayName: 'Different Name',
      guestToken,
    });

    // Same DB record — no duplicate row created.
    expect(second._id).toBe(first._id);
    const allUsers = await t.run((ctx) => ctx.db.query('users').collect());
    const matchingGuests = allUsers.filter((u) => u.guestId === guestId);
    expect(matchingGuests).toHaveLength(1);
  });

  it('rejects legacy guestId with deprecation error', async () => {
    const t = setupConvexTest();

    await expect(
      t.mutation(api.users.ensureUser, {
        displayName: 'Legacy',
        guestId: 'legacy-guest',
      })
    ).rejects.toThrow('guestId auth deprecated. Please refresh browser.');
  });

  it('throws ConvexError when no identity information is supplied', async () => {
    const t = setupConvexTest();

    await expect(
      t.mutation(api.users.ensureUser, { displayName: 'Nameless' })
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it('creates a Clerk user when Clerk identity is present', async () => {
    const t = setupConvexTest();

    const user = await t
      .withIdentity({ subject: 'clerk_user_123', email: 'test@example.com' })
      .mutation(api.users.ensureUser, { displayName: 'Clerk User' });

    expect(user.clerkUserId).toBe('clerk_user_123');
    expect(user.displayName).toBe('Clerk User');

    const row = await t.run((ctx) => ctx.db.get(user._id));
    expect(row?.clerkUserId).toBe('clerk_user_123');
    expect(row?.displayName).toBe('Clerk User');
  });

  it('returns the existing Clerk user on a second call (idempotent)', async () => {
    const t = setupConvexTest();
    const as = t.withIdentity({ subject: 'clerk_user_idem' });

    const first = await as.mutation(api.users.ensureUser, {
      displayName: 'Clerk User',
    });
    const second = await as.mutation(api.users.ensureUser, {
      displayName: 'Different Name',
    });

    expect(second._id).toBe(first._id);
    const allUsers = await t.run((ctx) => ctx.db.query('users').collect());
    const clerkUsers = allUsers.filter(
      (u) => u.clerkUserId === 'clerk_user_idem'
    );
    expect(clerkUsers).toHaveLength(1);
  });

  it('normalizes displayName with multiple spaces', async () => {
    const t = setupConvexTest();
    const guestId = 'multi-space-guest';
    const guestToken = await signGuestToken(guestId);

    const user = await t.mutation(api.users.ensureUser, {
      displayName: '  John   Doe  ',
      guestToken,
    });

    expect(user.displayName).toBe('John Doe');
    const row = await t.run((ctx) => ctx.db.get(user._id));
    expect(row?.displayName).toBe('John Doe');
  });

  it('throws ConvexError when displayName is empty after trimming', async () => {
    const t = setupConvexTest();
    const guestId = 'empty-name-guest';
    const guestToken = await signGuestToken(guestId);

    await expect(
      t.mutation(api.users.ensureUser, {
        displayName: '   ',
        guestToken,
      })
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it('throws ConvexError when displayName exceeds 50 characters', async () => {
    const t = setupConvexTest();
    const guestId = 'long-name-guest';
    const guestToken = await signGuestToken(guestId);
    const longName = 'a'.repeat(51);

    await expect(
      t.mutation(api.users.ensureUser, {
        displayName: longName,
        guestToken,
      })
    ).rejects.toThrow('Display name must be 50 characters or less');
  });

  it('accepts displayName at exactly 50 characters', async () => {
    const t = setupConvexTest();
    const guestId = 'exact-length-guest';
    const guestToken = await signGuestToken(guestId);
    const exactName = 'a'.repeat(50);

    const user = await t.mutation(api.users.ensureUser, {
      displayName: exactName,
      guestToken,
    });

    expect(user.displayName).toBe(exactName);
    const row = await t.run((ctx) => ctx.db.get(user._id));
    expect(row?.displayName).toBe(exactName);
  });

  it('rejects an invalid (tampered) guest token', async () => {
    const t = setupConvexTest();

    await expect(
      t.mutation(api.users.ensureUser, {
        displayName: 'Bad Actor',
        guestToken: 'invalid.token',
      })
    ).rejects.toBeInstanceOf(ConvexError);
  });
});
