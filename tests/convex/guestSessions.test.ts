import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { signGuestSessionThrottleProof } from '../../lib/guestSessionThrottleProof';
import { setupConvexTest } from '../helpers/convexTest';

const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-change-in-production';

describe('guest session throttle', () => {
  it('accepts a server-signed bucket and keeps repeated writes to one row', async () => {
    const t = setupConvexTest();
    const key = 'guestSession:0123456789abcdef';
    const proof = await signGuestSessionThrottleProof(
      key,
      process.env.GUEST_TOKEN_SECRET || DEV_FALLBACK_SECRET
    );

    await Promise.all(
      Array.from({ length: 10 }, () =>
        t.mutation(api.guestSessions.checkGuestSessionThrottle, { key, proof })
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
        t.mutation(api.guestSessions.checkGuestSessionThrottle, {
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
});
