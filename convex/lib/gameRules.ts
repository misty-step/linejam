import { v } from 'convex/values';

/**
 * Game rules are data, keyed by mode. Every round structure literal in the
 * codebase lives in this module; game-path code resolves rules from the
 * game document's `mode` and never assumes a round count.
 */

/** Legacy alias for the classic shape. Game-path code must use getGameRules. */
export const WORD_COUNTS = [1, 2, 3, 4, 5, 4, 3, 2, 1] as const;

export const GAME_MODES = ['classic', 'rhyme', 'quick'] as const;
export type GameMode = (typeof GAME_MODES)[number];

/** Convex arg/schema validator matching GAME_MODES. */
export const gameModeValidator = v.union(
  v.literal('classic'),
  v.literal('rhyme'),
  v.literal('quick')
);

export interface GameRules {
  mode: GameMode;
  label: string;
  tagline: string;
  wordCounts: readonly number[];
  /** Final line must rhyme with the poem's opening word. Judged by the room, never the server. */
  finalRhyme: boolean;
}

const RULES: Record<GameMode, GameRules> = {
  classic: {
    mode: 'classic',
    label: 'Classic',
    tagline: 'The original 1·2·3·4·5·4·3·2·1.',
    wordCounts: WORD_COUNTS,
    finalRhyme: false,
  },
  rhyme: {
    mode: 'rhyme',
    label: 'Rhyme Relay',
    tagline: 'Same shape — but the last word must rhyme with the first.',
    wordCounts: WORD_COUNTS,
    finalRhyme: true,
  },
  quick: {
    mode: 'quick',
    label: 'Quick Jam',
    tagline: 'A five-round espresso shot: 1·2·3·2·1.',
    wordCounts: [1, 2, 3, 2, 1] as const,
    finalRhyme: false,
  },
};

export const DEFAULT_GAME_MODE: GameMode = 'classic';

export function isGameMode(value: unknown): value is GameMode {
  return (
    typeof value === 'string' &&
    (GAME_MODES as readonly string[]).includes(value)
  );
}

/** Legacy games predate modes; anything unrecognized plays classic. */
export function normalizeGameMode(value: string | null | undefined): GameMode {
  return isGameMode(value) ? value : DEFAULT_GAME_MODE;
}

export function getGameRules(mode?: string | null): GameRules {
  return RULES[normalizeGameMode(mode)];
}

export function getFinalRoundIndex(rules: GameRules): number {
  return rules.wordCounts.length - 1;
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

/** Heartbeat cadence for the client presence hook. */
export const PRESENCE_HEARTBEAT_MS = 15_000;

/** A player is "away" when no heartbeat has landed for this long. */
export const PRESENCE_AWAY_MS = 45_000;

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
