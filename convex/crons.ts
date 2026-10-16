import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

/**
 * Close unattended Parlor matches and their app-owned games atomically.
 * The action reports success only after all bounded pages have committed.
 */
crons.interval(
  'close abandoned games',
  { minutes: 1 },
  internal.abandonment.runAbandonmentSweep,
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
