import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

/**
 * Never let the room die: finish any IN_PROGRESS game whose human players have
 * all gone silent past the abandonment threshold. The sweep is cheap (one
 * indexed query when nothing is active) and schedules the heavy per-game
 * completion out to `finishAbandonedGame`. See convex/abandonment.ts.
 */
crons.interval(
  'finish abandoned games',
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

export default crons;
