import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

/**
 * Close unattended Parlor matches and their app-owned games atomically.
 * Each bounded page schedules its cursor continuation, even if none close.
 */
crons.interval(
  'close abandoned games',
  { minutes: 1 },
  internal.abandonment.sweepAbandonedGames,
  {}
);

crons.interval(
  'cleanup expired rate limits',
  { minutes: 30 },
  internal.rateLimits.cleanupExpiredRateLimits,
  {}
);

crons.interval(
  'apply bounded data retention',
  { hours: 6 },
  internal.retention.runScheduledRetentionSweep,
  {}
);

export default crons;
