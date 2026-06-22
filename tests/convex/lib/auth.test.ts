import { describe, it, expect, vi } from 'vitest';
import { setupConvexTest } from '../../helpers/convexTest';
import { type T, seedUser } from '../../helpers/convexSeed';
import { signGuestToken } from '../../../lib/guestToken';
import {
  getUser,
  requireUser,
  checkParticipation,
} from '../../../convex/lib/auth';

/**
 * convex/lib/auth on the real convex-test engine (backlog 018):
 * real read-your-writes + real auth (Clerk identity via t.withIdentity) and
 * real HMAC guest-token verification — asserting observable return values and
 * DB state instead of mock-call stubs.
 *
 * No vi.mock of internal modules. Guest tokens signed with lib/guestToken
 * (same DEV_FALLBACK_SECRET as convex/lib/guestToken.verifyGuestToken).
 */

/** Return a scoped tester that presents a Clerk identity with the given subject. */
const asClerk = (t: T, subject: string) => t.withIdentity({ subject });

describe('convex/lib/auth', () => {
  describe('getUser', () => {
    it('returns Clerk user when getUserIdentity resolves to a known user', async () => {
      const t = setupConvexTest();
      const subject = 'clerk_test_001';
      await seedUser(t, { displayName: 'Alice', clerkUserId: subject });

      const result = await asClerk(t, subject).run((ctx) =>
        getUser(ctx, undefined)
      );

      expect(result).not.toBeNull();
      expect(result?.clerkUserId).toBe(subject);
      expect(result?.displayName).toBe('Alice');
    });

    it('returns guest user when a valid signed guestToken is provided', async () => {
      const t = setupConvexTest();
      const guestId = 'guest-abc-001';
      const guestToken = await signGuestToken(guestId);
      await seedUser(t, { displayName: 'Bob Guest', guestId });

      const result = await t.run((ctx) => getUser(ctx, guestToken));

      expect(result).not.toBeNull();
      expect(result?.guestId).toBe(guestId);
      expect(result?.displayName).toBe('Bob Guest');
    });

    it('returns null when there is no Clerk identity and no guestToken', async () => {
      const t = setupConvexTest();

      const result = await t.run((ctx) => getUser(ctx, undefined));

      expect(result).toBeNull();
    });

    it('returns null when guestToken has invalid signature', async () => {
      const t = setupConvexTest();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await t.run((ctx) => getUser(ctx, 'bad.token'));

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logEntry).toMatchObject({
        level: 'error',
        message: 'Invalid guest token',
        service: 'convex',
        hasToken: true,
      });

      consoleSpy.mockRestore();
    });

    it('returns null when guestToken is malformed (wrong number of segments)', async () => {
      const t = setupConvexTest();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // A real signGuestToken produces "payload.sig" (2 parts).
      // A token with no dot at all fails "Invalid token format".
      const result = await t.run((ctx) => getUser(ctx, 'notavalidtoken'));

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logEntry).toMatchObject({
        level: 'error',
        message: 'Invalid guest token',
        service: 'convex',
        hasToken: true,
        errorMessage: 'Invalid token format',
      });

      consoleSpy.mockRestore();
    });

    it('prioritizes Clerk identity over guestToken when both are present', async () => {
      const t = setupConvexTest();
      const subject = 'clerk_prio_001';
      await seedUser(t, {
        displayName: 'Clerk Prio User',
        clerkUserId: subject,
      });
      // Also seed a guest so the guest path would succeed if accidentally taken.
      const guestToken = await signGuestToken('guest-prio-001');
      await seedUser(t, { displayName: 'Ghost', guestId: 'guest-prio-001' });

      const result = await asClerk(t, subject).run((ctx) =>
        getUser(ctx, guestToken)
      );

      expect(result).not.toBeNull();
      expect(result?.clerkUserId).toBe(subject);
      // guest path was NOT taken — result is the Clerk user, not the guest
      expect(result?.guestId).toBeUndefined();
    });

    it('returns null when guestToken resolves to an unknown guestId (no matching row)', async () => {
      const t = setupConvexTest();
      // Sign a valid token for a guestId that has no user row.
      const orphanToken = await signGuestToken('guest-orphan-999');

      const result = await t.run((ctx) => getUser(ctx, orphanToken));

      expect(result).toBeNull();
    });

    it('returns null when Clerk identity subject has no matching user row', async () => {
      const t = setupConvexTest();
      // No seedClerkUser call — subject is unknown in the DB.
      const result = await asClerk(t, 'clerk_unknown_999').run((ctx) =>
        getUser(ctx, undefined)
      );

      expect(result).toBeNull();
    });
  });

  describe('requireUser', () => {
    it('returns the user when a valid Clerk identity maps to an existing user row', async () => {
      const t = setupConvexTest();
      const subject = 'clerk_req_001';
      await seedUser(t, { displayName: 'Required User', clerkUserId: subject });

      const result = await asClerk(t, subject).run((ctx) =>
        requireUser(ctx, undefined)
      );

      expect(result).not.toBeNull();
      expect(result.clerkUserId).toBe(subject);
    });

    it('throws "Unauthorized: User not found" when there is no identity and no guestToken', async () => {
      const t = setupConvexTest();

      await expect(t.run((ctx) => requireUser(ctx, undefined))).rejects.toThrow(
        'Unauthorized: User not found'
      );
    });

    it('throws "Unauthorized: User not found" when guestToken is invalid', async () => {
      const t = setupConvexTest();

      await expect(
        t.run((ctx) => requireUser(ctx, 'invalid-token'))
      ).rejects.toThrow('Unauthorized: User not found');
    });

    it('throws "Unauthorized: User not found" when valid guestToken has no matching user row', async () => {
      const t = setupConvexTest();
      // Sign a real token but never insert a user row for that guestId.
      const orphanToken = await signGuestToken('guest-req-orphan');

      await expect(
        t.run((ctx) => requireUser(ctx, orphanToken))
      ).rejects.toThrow('Unauthorized: User not found');
    });
  });

  describe('checkParticipation', () => {
    it('returns true when a roomPlayers row exists for the (room, user) pair', async () => {
      const t = setupConvexTest();
      const { userId, roomId } = await t.run(async (ctx) => {
        const uId = await ctx.db.insert('users', {
          displayName: 'Player',
          kind: 'human',
          createdAt: 0,
        });
        const rId = await ctx.db.insert('rooms', {
          code: 'AAAA',
          hostUserId: uId,
          status: 'LOBBY',
          createdAt: 0,
        });
        await ctx.db.insert('roomPlayers', {
          roomId: rId,
          userId: uId,
          displayName: 'Player',
          joinedAt: 0,
        });
        return { userId: uId, roomId: rId };
      });

      const result = await t.run((ctx) =>
        checkParticipation(ctx, roomId, userId)
      );

      expect(result).toBe(true);
    });

    it('returns false when no roomPlayers row exists for the (room, user) pair', async () => {
      const t = setupConvexTest();
      const { userId, roomId } = await t.run(async (ctx) => {
        const uId = await ctx.db.insert('users', {
          displayName: 'Outsider',
          kind: 'human',
          createdAt: 0,
        });
        const rId = await ctx.db.insert('rooms', {
          code: 'BBBB',
          hostUserId: uId,
          status: 'LOBBY',
          createdAt: 0,
        });
        // Deliberately do NOT insert a roomPlayers row.
        return { userId: uId, roomId: rId };
      });

      const result = await t.run((ctx) =>
        checkParticipation(ctx, roomId, userId)
      );

      expect(result).toBe(false);
    });

    it('returns false when a roomPlayers row exists for the room but a different user', async () => {
      const t = setupConvexTest();
      const { outsiderId, roomId } = await t.run(async (ctx) => {
        const hostId = await ctx.db.insert('users', {
          displayName: 'Host',
          kind: 'human',
          createdAt: 0,
        });
        const otherId = await ctx.db.insert('users', {
          displayName: 'Other',
          kind: 'human',
          createdAt: 0,
        });
        const rId = await ctx.db.insert('rooms', {
          code: 'CCCC',
          hostUserId: hostId,
          status: 'LOBBY',
          createdAt: 0,
        });
        // Room has "Other" as a player, but not "Outsider".
        await ctx.db.insert('roomPlayers', {
          roomId: rId,
          userId: otherId,
          displayName: 'Other',
          joinedAt: 0,
        });
        return { outsiderId: hostId, roomId: rId };
      });

      const result = await t.run((ctx) =>
        checkParticipation(ctx, roomId, outsiderId)
      );

      // The host has no roomPlayers row — they are not a "participant" in this room.
      expect(result).toBe(false);
    });
  });
});
