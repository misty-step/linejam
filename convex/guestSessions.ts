import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';
import { checkRateLimit } from './lib/rateLimit';
import { getConvexGuestTokenSecret } from './lib/env';
import { verifyGuestSessionThrottleProof } from '../lib/guestSessionThrottleProof';

const GUEST_SESSION_THROTTLE_MAX = 20;
const GUEST_SESSION_THROTTLE_WINDOW_MS = 10 * 60 * 1000;
const LEGACY_ROLLOUT_THROTTLE_KEY = 'guestSession:legacy-rollout-global';
const LEGACY_ROLLOUT_THROTTLE_MAX = 200;
// Resolve once at module load so a production deployment without the shared
// secret cannot expose the public mutation with a guessable fallback key.
const guestSessionThrottleSecret = getConvexGuestTokenSecret();

// Staged-rollout compatibility only. The production build deploys Convex
// before replacing the web process, so the previous web release needs its
// existing export until the signed caller is live. Since callers cannot prove
// their supplied key, collapse all legacy traffic into one bounded rollout
// bucket rather than allowing arbitrary durable row creation. New code must
// never call this mutation; remove it in the cleanup deploy immediately after
// rollout.
export const checkGuestSessionThrottle = mutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, { key }) => {
    if (!/^guestSession:[A-Za-z0-9_-]{16,64}$/.test(key)) {
      throw new ConvexError('Invalid guest session rate-limit key');
    }

    await checkRateLimit(ctx, {
      key: LEGACY_ROLLOUT_THROTTLE_KEY,
      max: LEGACY_ROLLOUT_THROTTLE_MAX,
      windowMs: GUEST_SESSION_THROTTLE_WINDOW_MS,
    });

    return { ok: true as const };
  },
});

export const checkSignedGuestSessionThrottle = mutation({
  args: {
    key: v.string(),
    proof: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { key, proof, dryRun }) => {
    if (!/^guestSession:[A-Za-z0-9_-]{16,64}$/.test(key)) {
      throw new ConvexError('Invalid guest session rate-limit key');
    }

    if (
      !(await verifyGuestSessionThrottleProof(
        key,
        proof,
        guestSessionThrottleSecret
      ))
    ) {
      throw new ConvexError('Invalid guest session throttle proof');
    }

    // CI uses this signed, zero-write path to prove the deployed web and
    // Convex environments share the same secret before any browser QA runs.
    if (dryRun) return { ok: true as const };

    await checkRateLimit(ctx, {
      key,
      max: GUEST_SESSION_THROTTLE_MAX,
      windowMs: GUEST_SESSION_THROTTLE_WINDOW_MS,
    });

    return { ok: true as const };
  },
});
