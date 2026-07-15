import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { verifyGuestTokenPayload } from './guestToken';
import { checkRateLimit } from './rateLimit';

export const ABUSE_RATE_LIMITS = {
  createRoom: {
    userMax: 3,
    bucketMax: 5,
    windowMs: 10 * 60 * 1000,
  },
  joinRoom: {
    userMax: 10,
    bucketMax: 30,
    windowMs: 10 * 60 * 1000,
  },
  startGame: {
    userMax: 10,
    bucketMax: 20,
    windowMs: 10 * 60 * 1000,
  },
  submitLine: {
    userMax: 30,
    bucketMax: 80,
    windowMs: 10 * 60 * 1000,
  },
  addAiPlayer: {
    userMax: 6,
    bucketMax: 10,
    windowMs: 10 * 60 * 1000,
  },
  summonGhostwriter: {
    userMax: 5,
    bucketMax: 10,
    roomMax: 8,
    windowMs: 10 * 60 * 1000,
  },
} as const;

export type AbuseRateLimitOperation = keyof typeof ABUSE_RATE_LIMITS;

export function guestBucketRateLimitKey(
  operation: AbuseRateLimitOperation,
  bucket: string
) {
  return `mutation:${operation}:bucket:${bucket}`;
}

export function userRateLimitKey(
  operation: AbuseRateLimitOperation,
  userId: Id<'users'>
) {
  return `mutation:${operation}:user:${userId}`;
}

export function roomRateLimitKey(
  operation: AbuseRateLimitOperation,
  roomId: Id<'rooms'>
) {
  return `mutation:${operation}:room:${roomId}`;
}

export async function checkMutationAbuseRateLimit(
  ctx: MutationCtx,
  args: {
    operation: AbuseRateLimitOperation;
    userId: Id<'users'>;
    guestToken?: string;
    roomId?: Id<'rooms'>;
  }
) {
  const limits = ABUSE_RATE_LIMITS[args.operation];

  if (args.guestToken) {
    const payload = await verifyGuestTokenPayload(args.guestToken);
    if (payload.rateLimitKey) {
      await checkRateLimit(ctx, {
        key: guestBucketRateLimitKey(args.operation, payload.rateLimitKey),
        max: limits.bucketMax,
        windowMs: limits.windowMs,
      });
    }
  }

  if ('roomMax' in limits && limits.roomMax !== undefined && args.roomId) {
    await checkRateLimit(ctx, {
      key: roomRateLimitKey(args.operation, args.roomId),
      max: limits.roomMax,
      windowMs: limits.windowMs,
    });
  }

  await checkRateLimit(ctx, {
    key: userRateLimitKey(args.operation, args.userId),
    max: limits.userMax,
    windowMs: limits.windowMs,
  });
}
