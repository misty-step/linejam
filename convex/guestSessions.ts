import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';
import { checkRateLimit } from './lib/rateLimit';

const GUEST_SESSION_THROTTLE_MAX = 20;
const GUEST_SESSION_THROTTLE_WINDOW_MS = 10 * 60 * 1000;

export const checkGuestSessionThrottle = mutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, { key }) => {
    if (!/^guestSession:[A-Za-z0-9_-]{16,64}$/.test(key)) {
      throw new ConvexError('Invalid guest session rate-limit key');
    }

    await checkRateLimit(ctx, {
      key,
      max: GUEST_SESSION_THROTTLE_MAX,
      windowMs: GUEST_SESSION_THROTTLE_WINDOW_MS,
    });

    return { ok: true as const };
  },
});
