import { MutationCtx } from '../_generated/server';

export async function checkRateLimit(
  ctx: MutationCtx,
  config: {
    key: string;
    max: number;
    windowMs: number;
  }
) {
  const now = Date.now();
  const { key, max, windowMs } = config;

  const existing = await ctx.db
    .query('rateLimits')
    .withIndex('by_key', (q) => q.eq('key', key))
    .first();

  if (existing && existing.resetTime > now) {
    if (existing.hits >= max) {
      throw new Error(`Rate limit exceeded. Please try again later.`);
    }
    await ctx.db.patch(existing._id, {
      hits: existing.hits + 1,
    });
  } else {
    if (existing) {
      await ctx.db.patch(existing._id, {
        hits: 1,
        resetTime: now + windowMs,
      });
    } else {
      await ctx.db.insert('rateLimits', {
        key,
        hits: 1,
        resetTime: now + windowMs,
      });
    }
  }
}
