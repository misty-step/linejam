import { cronJobs, makeFunctionReference } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

/**
 * Close IN_PROGRESS games after every participant has gone silent. The indexed
 * sweep is cheap when nothing is stranded and schedules bounded per-game
 * abandonment mutations.
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

crons.interval(
  'recover expired Sentry GitHub bridge leases',
  { minutes: 1 },
  makeFunctionReference<
    'mutation',
    { now?: number; limit?: number },
    { recovered: number }
  >('sentryGithub:recoverExpiredLeases'),
  {}
);

export default crons;
