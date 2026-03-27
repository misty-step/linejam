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

  // Window expired or no record — reset to fresh window
  if (!existing || existing.resetTime <= now) {
    const fields = { key, hits: 1, resetTime: now + windowMs };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert('rateLimits', fields);
    }
    return;
  }

  // Within active window — enforce limit before incrementing
  if (existing.hits >= max) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  await ctx.db.patch(existing._id, { hits: existing.hits + 1 });
}
