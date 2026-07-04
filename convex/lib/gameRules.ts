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

/** Overtime before the host may pass a stalled turn to the ghostwriter. */
export const GHOSTWRITER_OVERTIME_MS = 90_000;

/**
 * Per-turn auto ghost-fill delay. Fires after overtime elapses without a
 * manual ghostwriter summon, so a disconnected human never strands the room.
 * Kept equal to overtime so the auto path lands right when the manual path
 * becomes available — the host keeps agency, the auto-fill is the floor.
 */
export const AUTO_GHOST_FILL_MS = GHOSTWRITER_OVERTIME_MS;

/**
 * Abandonment threshold: if every human in an IN_PROGRESS game has been
 * silent (no heartbeat) for this long, the cron ghost-fills and completes
 * the game. Tuned to the longest reasonable party pause (10 minutes).
 */
export const ABANDONMENT_THRESHOLD_MS = 10 * 60_000;

/**
 * Absolute liveness backstop. Presence evidence completes an abandoned game
 * promptly (every human heartbeat, then all went silent past
 * ABANDONMENT_THRESHOLD_MS). But a game with no usable presence data — every
 * human on a pre-presence bundle, or a game already IN_PROGRESS when presence
 * shipped — can never satisfy that path, and must still complete rather than
 * strand forever. Once a round has been idle this long, the sweep finishes it
 * regardless of presence cohort. Long enough that a merely slow party never
 * trips it; short enough that no room lingers for a human-noticeable age.
 */
export const ABANDONMENT_HARD_DEADLINE_MS = 30 * 60_000;

/** Heartbeat cadence for the client presence hook. */
export const PRESENCE_HEARTBEAT_MS = 15_000;

/** A player is "away" when no heartbeat has landed for this long. */
export const PRESENCE_AWAY_MS = 45_000;

/**
 * How long the host may be silent before a present participant is promoted to
 * host (backlog 017). Longer than the "away" indicator so a brief host blip
 * doesn't hand off ownership, far shorter than ABANDONMENT_THRESHOLD_MS so host
 * agency (summon ghostwriter, close room) is never stranded behind a vanished
 * host while the room is still live.
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
