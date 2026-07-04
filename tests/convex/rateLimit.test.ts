import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { internal } from '../../convex/_generated/api';
import { checkRateLimit } from '../../convex/lib/rateLimit';
import { setupConvexTest } from '../helpers/convexTest';

/**
 * checkRateLimit on the real convex-test engine (backlog 018): real
 * read-your-writes against the rateLimits table, asserting observable DB state
 * and thrown errors instead of mock-call stubs.
 *
 * checkRateLimit takes a MutationCtx, so every call lives inside t.run().
 * When checkRateLimit throws inside t.run, the t.run promise rejects — assert
 * with `await expect(t.run(...)).rejects.toThrow(...)`.
 *
 * Date.now() is the only non-deterministic seam; freeze it with fake timers.
 */

const KEY = 'test:1';
const OTHER_KEY = 'test:2';

/**
 * Read the rateLimits row for a key from the real DB.
 */
async function readRateLimit(
  t: ReturnType<typeof setupConvexTest>,
  key: string
) {
  return t.run((ctx) =>
    ctx.db
      .query('rateLimits')
      .withIndex('by_key', (q) => q.eq('key', key))
      .first()
  );
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows request when no limit exists and creates a row with hits=1', async () => {
    const t = setupConvexTest();

    await t.run(async (ctx) => {
      await checkRateLimit(ctx, { key: KEY, max: 5, windowMs: 1000 });
    });

    const row = await readRateLimit(t, KEY);
    expect(row).not.toBeNull();
    expect(row!.key).toBe(KEY);
    expect(row!.hits).toBe(1);
    expect(row!.resetTime).toBe(Date.now() + 1000);
  });

  it('allows request when limit exists and under max, incrementing hits', async () => {
    const t = setupConvexTest();
    const now = Date.now();

    // Seed a row at hits=2 inside an active window
    await t.run(async (ctx) => {
      await ctx.db.insert('rateLimits', {
        key: KEY,
        hits: 2,
        resetTime: now + 10000,
      });
    });

    await t.run(async (ctx) => {
      await checkRateLimit(ctx, { key: KEY, max: 5, windowMs: 1000 });
    });

    const row = await readRateLimit(t, KEY);
    expect(row!.hits).toBe(3);
    // resetTime should be unchanged (still within active window)
    expect(row!.resetTime).toBe(now + 10000);
  });

  it('allows request at hits=max-1 and increments to max', async () => {
    const t = setupConvexTest();
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert('rateLimits', {
        key: KEY,
        hits: 4,
        resetTime: now + 10000,
      });
    });

    await t.run(async (ctx) => {
      await checkRateLimit(ctx, { key: KEY, max: 5, windowMs: 1000 });
    });

    const row = await readRateLimit(t, KEY);
    expect(row!.hits).toBe(5);
  });

  it('throws when hits equals max within an active window', async () => {
    const t = setupConvexTest();
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert('rateLimits', {
        key: KEY,
        hits: 5,
        resetTime: now + 10000,
      });
    });

    await expect(
      t.run(async (ctx) => {
        await checkRateLimit(ctx, { key: KEY, max: 5, windowMs: 1000 });
      })
    ).rejects.toThrow('Rate limit exceeded');

    // DB row must be untouched — hits stay at 5
    const row = await readRateLimit(t, KEY);
    expect(row!.hits).toBe(5);
  });

  it('resets limit when window has expired (resetTime in the past)', async () => {
    const t = setupConvexTest();
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert('rateLimits', {
        key: KEY,
        hits: 5,
        resetTime: now - 1000, // Expired
      });
    });

    await t.run(async (ctx) => {
      await checkRateLimit(ctx, { key: KEY, max: 5, windowMs: 60000 });
    });

    const row = await readRateLimit(t, KEY);
    expect(row!.hits).toBe(1);
    expect(row!.resetTime).toBe(now + 60000);
  });

  it('resets when resetTime equals current time exactly (boundary)', async () => {
    const t = setupConvexTest();
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert('rateLimits', {
        key: KEY,
        hits: 5,
        resetTime: now, // Exactly at boundary — should reset (resetTime <= now)
      });
    });

    await t.run(async (ctx) => {
      await checkRateLimit(ctx, { key: KEY, max: 5, windowMs: 1000 });
    });

    const row = await readRateLimit(t, KEY);
    expect(row!.hits).toBe(1);
  });

  it('sets correct resetTime on a fresh window (no prior row)', async () => {
    const t = setupConvexTest();
    const now = Date.now();

    await t.run(async (ctx) => {
      await checkRateLimit(ctx, { key: KEY, max: 5, windowMs: 60000 });
    });

    const row = await readRateLimit(t, KEY);
    // Fake timers pin Date.now() so resetTime must be exactly now + windowMs
    expect(row!.resetTime).toBe(now + 60000);
  });

  it('allows requests again after window expires (sequential calls)', async () => {
    const t = setupConvexTest();

    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      await t.run(async (ctx) => {
        await checkRateLimit(ctx, { key: KEY, max: 3, windowMs: 60000 });
      });
    }

    // Confirm it's blocked
    await expect(
      t.run(async (ctx) => {
        await checkRateLimit(ctx, { key: KEY, max: 3, windowMs: 60000 });
      })
    ).rejects.toThrow('Rate limit exceeded');

    // Advance time past the window
    vi.advanceTimersByTime(60001);

    // Should be allowed again (window reset)
    await t.run(async (ctx) => {
      await checkRateLimit(ctx, { key: KEY, max: 3, windowMs: 60000 });
    });

    const row = await readRateLimit(t, KEY);
    expect(row!.hits).toBe(1);
    expect(row!.resetTime).toBe(Date.now() + 60000);
  });

  it('independent keys are tracked independently', async () => {
    const t = setupConvexTest();
    const now = Date.now();

    // Seed KEY at max; OTHER_KEY has no row
    await t.run(async (ctx) => {
      await ctx.db.insert('rateLimits', {
        key: KEY,
        hits: 5,
        resetTime: now + 10000,
      });
    });

    // KEY is blocked
    await expect(
      t.run(async (ctx) => {
        await checkRateLimit(ctx, { key: KEY, max: 5, windowMs: 1000 });
      })
    ).rejects.toThrow('Rate limit exceeded');

    // OTHER_KEY is independent — must be allowed
    await t.run(async (ctx) => {
      await checkRateLimit(ctx, { key: OTHER_KEY, max: 5, windowMs: 1000 });
    });

    const otherRow = await readRateLimit(t, OTHER_KEY);
    expect(otherRow!.hits).toBe(1);

    // KEY row is still untouched
    const keyRow = await readRateLimit(t, KEY);
    expect(keyRow!.hits).toBe(5);
  });
});

describe('cleanupExpiredRateLimits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes expired rows and preserves active windows', async () => {
    const t = setupConvexTest();
    const now = Date.now();

    await t.run(async (ctx) => {
      await Promise.all([
        ctx.db.insert('rateLimits', {
          key: 'expired:past',
          hits: 9,
          resetTime: now - 1,
        }),
        ctx.db.insert('rateLimits', {
          key: 'expired:boundary',
          hits: 3,
          resetTime: now,
        }),
        ctx.db.insert('rateLimits', {
          key: 'active:future',
          hits: 5,
          resetTime: now + 1,
        }),
      ]);
    });

    const result = await t.mutation(
      internal.rateLimits.cleanupExpiredRateLimits,
      { now }
    );

    expect(result).toEqual({ deleted: 2, hasMore: false });
    expect(await readRateLimit(t, 'expired:past')).toBeNull();
    expect(await readRateLimit(t, 'expired:boundary')).toBeNull();
    expect(await readRateLimit(t, 'active:future')).not.toBeNull();
  });

  it('caps each cleanup batch and reports when more rows may remain', async () => {
    const t = setupConvexTest();
    const now = Date.now();

    await t.run(async (ctx) => {
      await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          ctx.db.insert('rateLimits', {
            key: `expired:${i}`,
            hits: 1,
            resetTime: now - 1000 + i,
          })
        )
      );
    });

    const result = await t.mutation(
      internal.rateLimits.cleanupExpiredRateLimits,
      { now, limit: 2 }
    );

    expect(result).toEqual({ deleted: 2, hasMore: true });

    const remaining = await t.run((ctx) =>
      ctx.db.query('rateLimits').collect()
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0].key).toBe('expired:2');
  });
});
