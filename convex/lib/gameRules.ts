/**
 * The one game: a nine-round paper-fold, 1·2·3·4·5·4·3·2·1 words per line.
 * `WORD_COUNTS` is the single source for the poem shape.
 *
 * Round *bounds* come from each game's own `assignmentMatrix` length, not from a
 * constant — so a pre-consolidation game still in flight at deploy (the only way
 * a non-nine-round matrix can exist; no new game is ever anything but classic)
 * finishes without an out-of-bounds throw. Its per-round *word counts* still read
 * from the canonical shape below: a legacy 5-round "quick" game would see classic
 * counts on its two divergent rounds (the original shape is no longer stored and
 * isn't recoverable from the matrix). That cosmetic mismatch is
 * acceptable for a deploy-window-only game; the crash the matrix bound avoids is
 * not.
 */

/** Words per line, by round. The poem shape — and the round count — of every game. */
export const WORD_COUNTS = [1, 2, 3, 4, 5, 4, 3, 2, 1] as const;

/**
 * Late-arrival contract for the one-game loop. A join during an active game
 * gets a room seat but not a retroactive assignment: the current game keeps
 * its matrix, poem count, and round position unchanged. The newcomer is a
 * spectator until the next lobby cycle, can watch the reveal, and becomes a
 * normal matrix participant only when the next game starts.
 */
export const LATE_JOIN_POLICY = {
  allowedStatus: 'IN_PROGRESS',
  assignment: 'next-game-only',
  fairness: 'preserve-completed-and-active-matrix-rows',
  poemCount: 'unchanged',
  roundPosition: 'current-round-spectator',
  spectatorFallback: 'wait-until-next-game',
  revealParticipation: 'viewer',
} as const;

export function isLateJoinAllowed(
  game:
    | { readonly status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' }
    | null
    | undefined
): boolean {
  return game?.status === LATE_JOIN_POLICY.allowedStatus;
}

/**
 * A game's final round index = the last row of its own assignment matrix (see
 * the module header on why this is matrix-derived, not a constant). Typed to
 * what it uses — only the length — so it never widens a caller's matrix.
 */
export function getFinalRoundIndex(assignmentMatrix: {
  readonly length: number;
}): number {
  return assignmentMatrix.length - 1;
}

/** Soft pacing target for a round. The clock pressures; it never blocks. */
export const ROUND_CLOCK_MS = 90_000;

/**
 * Abandonment threshold: if every participant in an IN_PROGRESS game has been
 * silent (no heartbeat) for this long, the cron terminates the game without
 * revealing its partial poems.
 */
export const ABANDONMENT_THRESHOLD_MS = 10 * 60_000;

/**
 * Absolute liveness backstop. Presence evidence abandons a silent game
 * promptly. A game with no usable presence data must also terminate rather
 * than strand forever, but only after this longer deadline. A fresh heartbeat
 * always prevents abandonment.
 */
export const ABANDONMENT_HARD_DEADLINE_MS = 30 * 60_000;

/** Heartbeat cadence for the client presence hook. */
export const PRESENCE_HEARTBEAT_MS = 15_000;

/** A player is "away" when no heartbeat has landed for this long. */
export const PRESENCE_AWAY_MS = 45_000;

/**
 * How long the host may be silent before a present participant is promoted to
 * host. Longer than the away indicator so a brief host blip does not hand off
 * ownership, and shorter than the abandonment threshold so host-only actions
 * are not stranded behind a vanished host.
 */
export const HOST_MIGRATION_STALE_MS = 60_000;

/**
 * Whether a heartbeat-bearing row has gone quiet past `thresholdMs`. A missing
 * `lastSeenAt` (legacy rows, never-heartbeat clients) counts as stale. Shared by
 * the "away" indicators (PRESENCE_AWAY_MS) and the abandonment sweep
 * (ABANDONMENT_THRESHOLD_MS) so the predicate can't drift between them.
 */
export function isPresenceStale(
  lastSeenAt: number | undefined,
  now: number,
  thresholdMs: number
): boolean {
  return lastSeenAt === undefined || now - lastSeenAt > thresholdMs;
}
