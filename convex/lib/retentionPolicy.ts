const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_POLICY_VERSION = 'linejam-retention-v1';

/**
 * Product-owned lifetimes. Public or favorited artifacts have no age-based
 * deadline while that protection remains enabled.
 */
export const RETENTION_DURATIONS_MS = Object.freeze({
  privateCompleted: 90 * DAY_MS,
  abandoned: 7 * DAY_MS,
  protectionRemoved: 30 * DAY_MS,
  guestIdentity: 180 * DAY_MS,
  guestReferenceDeferral: 30 * DAY_MS,
  aiBookkeeping: 7 * DAY_MS,
  operationalMetrics: 90 * DAY_MS,
});

export type RetentionDurationClass = keyof typeof RETENTION_DURATIONS_MS;

/** Move blocked parent candidates past the next six-hour cron window. */
export const RETENTION_PARENT_RETRY_MS = 6 * 60 * 60 * 1000;

export function retentionEligibleAt(
  triggerAt: number,
  durationClass: RetentionDurationClass
): number {
  return triggerAt + RETENTION_DURATIONS_MS[durationClass];
}

/**
 * Hard per-mutation batch limits. Related-row guards are deliberately tiny:
 * a poem has nine lines and a room has at most twelve seated players. A row
 * over either guard is reported and skipped rather than partially deleted.
 */
export const RETENTION_BATCH_LIMITS = Object.freeze({
  rooms: 4,
  games: 8,
  poems: 12,
  users: 12,
  migrations: 32,
  aiTurns: 64,
  aiRoundLocks: 64,
  aiUsage: 32,
  aiGenerationMetrics: 64,
  shares: 64,
  rateLimits: 64,
  retentionRuns: 16,
  roomPlayersPerRoom: 12,
  linesPerPoem: 9,
});

const maxCandidateRows =
  RETENTION_BATCH_LIMITS.rooms +
  RETENTION_BATCH_LIMITS.games +
  RETENTION_BATCH_LIMITS.poems +
  RETENTION_BATCH_LIMITS.users +
  RETENTION_BATCH_LIMITS.migrations +
  RETENTION_BATCH_LIMITS.aiTurns +
  RETENTION_BATCH_LIMITS.aiRoundLocks +
  RETENTION_BATCH_LIMITS.aiUsage +
  RETENTION_BATCH_LIMITS.aiGenerationMetrics +
  RETENTION_BATCH_LIMITS.shares +
  RETENTION_BATCH_LIMITS.rateLimits +
  RETENTION_BATCH_LIMITS.retentionRuns;

export const RETENTION_INVOCATION_LIMITS = Object.freeze({
  maxCandidateRows,
  maxDocumentReads:
    maxCandidateRows +
    RETENTION_BATCH_LIMITS.rooms *
      (4 + RETENTION_BATCH_LIMITS.roomPlayersPerRoom + 1) +
    RETENTION_BATCH_LIMITS.games +
    RETENTION_BATCH_LIMITS.poems *
      (2 + RETENTION_BATCH_LIMITS.linesPerPoem + 1) +
    RETENTION_BATCH_LIMITS.users * 6,
  maxDocumentWrites:
    maxCandidateRows +
    RETENTION_BATCH_LIMITS.rooms * RETENTION_BATCH_LIMITS.roomPlayersPerRoom +
    RETENTION_BATCH_LIMITS.poems * RETENTION_BATCH_LIMITS.linesPerPoem +
    1,
});
