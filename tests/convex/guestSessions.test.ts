import { describe, expect, it } from 'vitest';
import { makeFunctionReference } from 'convex/server';
import { api } from '../../convex/_generated/api';
import { signGuestSessionThrottleProof } from '../../lib/guestSessionThrottleProof';
import { setupConvexTest } from '../helpers/convexTest';

const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-change-in-production';
const legacyGuestSessionThrottle = makeFunctionReference<
  'mutation',
  { key: string },
  { ok: true }
>('guestSessions:checkGuestSessionThrottle');

describe('guest session throttle', () => {
  it('does not expose the legacy throttle endpoint', async () => {
    const t = setupConvexTest();

    await expect(
      t.mutation(legacyGuestSessionThrottle, {
        key: 'guestSession:0123456789abcdef',
      })
    ).rejects.toThrow(/there is no such export/i);
  });

  it('accepts a server-signed bucket and keeps repeated writes to one row', async () => {
    const t = setupConvexTest();
    const key = 'guestSession:0123456789abcdef';
    const proof = await signGuestSessionThrottleProof(
      key,
      process.env.GUEST_TOKEN_SECRET || DEV_FALLBACK_SECRET
    );

    await Promise.all(
      Array.from({ length: 10 }, () =>
        t.mutation(api.guestSessions.checkSignedGuestSessionThrottle, {
          key,
          proof,
        })
      )
    );

    const rows = await t.run((ctx) => ctx.db.query('rateLimits').collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key, hits: 10 });
  });

  it('rejects forged unique buckets before they can grow durable state', async () => {
    const t = setupConvexTest();
    const attempts = await Promise.allSettled(
      Array.from({ length: 25 }, (_, index) =>
        t.mutation(api.guestSessions.checkSignedGuestSessionThrottle, {
          key: `guestSession:${index.toString().padStart(16, '0')}`,
          proof: 'forged-proof',
        })
      )
    );

    expect(attempts).toHaveLength(25);
    for (const attempt of attempts) {
      expect(attempt.status).toBe('rejected');
      if (attempt.status === 'rejected') {
        expect(String(attempt.reason)).toContain(
          'Invalid guest session throttle proof'
        );
      }
    }

    const rows = await t.run((ctx) => ctx.db.query('rateLimits').collect());
    expect(rows).toEqual([]);
  });

  it('rejects malformed proof encodings before they can grow durable state', async () => {
    const t = setupConvexTest();
    const key = 'guestSession:0123456789abcdef';

    for (const proof of ['not+base64url', 'a'.repeat(42), 'a'.repeat(44)]) {
      await expect(
        t.mutation(api.guestSessions.checkSignedGuestSessionThrottle, {
          key,
          proof,
        })
      ).rejects.toThrow('Invalid guest session throttle proof');
    }

    const rows = await t.run((ctx) => ctx.db.query('rateLimits').collect());
    expect(rows).toEqual([]);
  });
});
