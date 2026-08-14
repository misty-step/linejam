/**
 * Self-heal abandoned games.
 *
 * A periodic cron sweep (convex/crons.ts) finds IN_PROGRESS games that are
 * abandoned — the current round has been idle past ABANDONMENT_THRESHOLD_MS and
 * either every human heartbeat then went silent, or the round is idle past the
 * absolute ABANDONMENT_HARD_DEADLINE_MS — and schedules a per-game worker that
 * ghost-fills every remaining line and lands the room in COMPLETED.
 *
 * This is the durable backstop for the per-turn auto ghost-fill
 * (game.fillStaleHumanTurns). The per-turn floor rides on a `runAfter` chain
 * scheduled at each round open; if that chain is ever lost (action death, infra
 * incident, or a game that predates the feature) the room would strand forever.
 * The sweep re-derives state from scratch every tick and does not depend on any
 * scheduled function surviving. The sweep and the worker re-derive abandonment
 * through the same `isGameAbandoned` predicate, and the worker aborts the moment
 * a human reconnects, so a returning player is never completed over. Every line
 * is committed through the idempotent `commitAssignedLine`, so the layers are
 * safe to overlap and to fire repeatedly.
 */

import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { commitFallbackLine } from './ai';
import { getMatrixRound } from './lib/assignmentMatrix';
import { applyLineLifecycleTransition } from './lib/sessionLifecycle';
import {
  ABANDONMENT_HARD_DEADLINE_MS,
  ABANDONMENT_THRESHOLD_MS,
  getFinalRoundIndex,
  isPresenceStale,
} from './lib/gameRules';
import { log, logError } from './lib/errors';
import { returnAfterBackendReportScheduled } from './errors';

/** The human roomPlayers rows for a game (AI players excluded). */
async function getHumanPlayers(
  ctx: Pick<MutationCtx, 'db'>,
  roomId: Id<'rooms'>
): Promise<Doc<'roomPlayers'>[]> {
  const players = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
  const users = await Promise.all(players.map((p) => ctx.db.get(p.userId)));
  return players.filter((_, i) => users[i]?.kind !== 'AI');
}

/**
 * Single source of truth for "this IN_PROGRESS game is abandoned and may be
 * auto-completed", re-derived from scratch by both the cron sweep and the
 * per-game finisher so the two can never disagree.
 *
 * Abandoned ⇔ the current round has been idle past ABANDONMENT_THRESHOLD_MS AND
 * either
 *   • every human has heartbeat at least once and all have since gone silent
 *     past the threshold (confident, presence-backed abandonment), or
 *   • the round has been idle past ABANDONMENT_HARD_DEADLINE_MS (liveness
 *     backstop for games with absent/partial presence data — the rollout
 *     window, or a game already IN_PROGRESS when presence shipped).
 *
 * A human who has never heartbeat (lastSeenAt === undefined) is treated as
 * "possibly present on an old bundle": they do NOT satisfy the presence-backed
 * path, only the hard deadline. Degenerate games with no humans are left to the
 * per-turn floor.
 */
async function isGameAbandoned(
  ctx: Pick<MutationCtx, 'db'>,
  game: Doc<'games'>,
  now: number
): Promise<boolean> {
  const idleSince = game.roundStartedAt ?? game.createdAt;
  const idleMs = now - idleSince;
  if (idleMs < ABANDONMENT_THRESHOLD_MS) return false;

  const humanPlayers = await getHumanPlayers(ctx, game.roomId);
  if (humanPlayers.length === 0) return false;

  // A currently-present human (fresh heartbeat) means the room is NOT abandoned,
  // however idle the round. This keeps the hard-deadline path from ever marking
  // an actively-attended game abandoned — so the sweep never schedules a
  // finisher that would only have to bail, and never completes over someone here.
  if (anyHumanPresent(humanPlayers, now)) return false;

  const allHumansHeartbeatAndStale = humanPlayers.every(
    (player) =>
      player.lastSeenAt !== undefined &&
      isPresenceStale(player.lastSeenAt, now, ABANDONMENT_THRESHOLD_MS)
  );

  return allHumansHeartbeatAndStale || idleMs >= ABANDONMENT_HARD_DEADLINE_MS;
}

/**
 * Whether a human we may have judged absent has since come back — a fresh
 * heartbeat within the threshold. The finisher checks this every pass (by
 * presence, NOT idle-age, since its own round advances reset roundStartedAt) so
 * a player who reconnects between the sweep's decision and the finisher running,
 * or partway through the walk, immediately ends the backstop.
 */
function anyHumanPresent(
  humanPlayers: Doc<'roomPlayers'>[],
  now: number
): boolean {
  return humanPlayers.some(
    (player) =>
      player.lastSeenAt !== undefined &&
      !isPresenceStale(player.lastSeenAt, now, ABANDONMENT_THRESHOLD_MS)
  );
}

/**
 * Hard bounds for one sweep tick. Convex rejects a mutation that schedules
 * more than 1,000 functions — an unbounded sweep over a large stranded
 * backlog throws, rolls back every finisher it scheduled, and completes
 * nothing, forever (the 2026-07-09 incident). Capping the tick keeps each
 * run small and lets the every-minute cron drain any backlog at
 * MAX_FINISHERS_PER_SWEEP games per minute. The scan bound keeps read volume
 * flat; index order is oldest-idle-first, so the queue drains front to back
 * and completed games leave the index.
 */
const MAX_FINISHERS_PER_SWEEP = 200;
const MAX_SWEEP_SCAN = 1000;

/**
 * Cron entry point. Cheap and self-bounding: an indexed range scan reads only
 * games whose round has been idle past ABANDONMENT_THRESHOLD_MS. Still-active
 * games (recent roundStartedAt) are excluded by the index — not scanned then
 * discarded — so the work scales with the number of *stuck* games (≈0 in a
 * healthy system), never with total traffic. An idle-but-not-abandoned game
 * (a present player whose round hasn't advanced) consumes scan but never a
 * finisher slot, so it cannot pin the batch cap either. Heavy completion work
 * is scheduled out per game, at most MAX_FINISHERS_PER_SWEEP per tick.
 *
 * `limit` narrows the per-tick finisher cap (test seam); it can never raise
 * it above MAX_FINISHERS_PER_SWEEP.
 */
export const sweepAbandonedGames = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (
    ctx,
    { limit }
  ): Promise<{ scheduled: number; scanned: number; error?: string }> => {
    const maxFinishers = Math.max(
      1,
      Math.min(limit ?? MAX_FINISHERS_PER_SWEEP, MAX_FINISHERS_PER_SWEEP)
    );
    let scheduled = 0;
    let scanned = 0;
    try {
      const now = Date.now();
      const idleCutoff = now - ABANDONMENT_THRESHOLD_MS;
      const idleGames = await ctx.db
        .query('games')
        .withIndex('by_status_round', (q) =>
          q.eq('status', 'IN_PROGRESS').lte('roundStartedAt', idleCutoff)
        )
        .take(MAX_SWEEP_SCAN);
      scanned = idleGames.length;

      let truncated = false;
      for (const game of idleGames) {
        if (scheduled >= maxFinishers) {
          truncated = true;
          break;
        }
        if (!(await isGameAbandoned(ctx, game, now))) continue;
        await ctx.scheduler.runAfter(
          0,
          internal.abandonment.finishAbandonedGame,
          { gameId: game._id }
        );
        scheduled++;
      }

      if (scheduled > 0) {
        log.warn('Abandonment sweep scheduled stranded games for completion', {
          scheduled,
          scanned,
          truncated,
        });
      }

      return { scheduled, scanned };
    } catch (error) {
      // Report without rethrowing: a mutation that throws rolls back the
      // finishers scheduled above and any report scheduled here. Returning
      // commits both; the cron retries the remaining idempotent work next
      // minute.
      const err = error instanceof Error ? error : new Error(String(error));
      logError('sweepAbandonedGames failed', err, { scheduled, scanned });
      return returnAfterBackendReportScheduled(
        ctx.scheduler.runAfter(0, internal.errors.reportBackendFailure, {
          operation: 'sweepAbandonedGames',
          failureCode: 'unexpected_error',
          scheduled,
          scanned,
        }),
        { scheduled, scanned, error: err.message }
      );
    }
  },
});

/**
 * Per-game finisher. Walks the game forward round by round, deterministically
 * ghost-filling every missing line until the room reaches COMPLETED. Pure
 * mutation — no LLM action — so completion does not depend on OpenRouter or on
 * any action surviving. Idempotent: re-running on an already-finished game is a
 * no-op, and a line a real player commits in the meantime is left untouched. It
 * re-derives abandonment on entry and re-checks presence each pass, so it never
 * completes a room out from under a human who has come back.
 */
export const finishAbandonedGame = internalMutation({
  args: { gameId: v.id('games') },
  handler: async (
    ctx,
    { gameId }
  ): Promise<{ completed: boolean; filled: number; error?: string }> => {
    let filled = 0;
    try {
      const initial = await ctx.db.get(gameId);
      if (!initial || initial.status !== 'IN_PROGRESS') {
        return { completed: false, filled: 0 };
      }

      // Re-derive abandonment from scratch. The sweep decided in an earlier
      // transaction; a human may have reconnected since. Never complete a room
      // out from under someone who just came back.
      if (!(await isGameAbandoned(ctx, initial, Date.now()))) {
        return { completed: false, filled: 0 };
      }

      // One pass advances at most one round; keep the loop explicitly bounded.
      // Round count comes from the game's own matrix (legacy games may differ).
      const maxPasses = getFinalRoundIndex(initial.assignmentMatrix) + 2;

      const poems = await ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect();

      filled = 0;
      for (let pass = 0; pass < maxPasses; pass++) {
        const game = await ctx.db.get(gameId);
        if (!game || game.status !== 'IN_PROGRESS') break;

        // A returning human ends the backstop immediately — judged by presence,
        // not idle-age, because our own round advances reset roundStartedAt.
        const humanPlayers = await getHumanPlayers(ctx, game.roomId);
        if (anyHumanPresent(humanPlayers, Date.now())) break;

        const round = game.currentRound;
        const roundAssignments = getMatrixRound(game.assignmentMatrix, round);

        const lineChecks = await Promise.all(
          poems.map((poem) =>
            ctx.db
              .query('lines')
              .withIndex('by_poem_index', (q) =>
                q.eq('poemId', poem._id).eq('indexInPoem', round)
              )
              .first()
          )
        );
        const missing = poems.filter((_, index) => lineChecks[index] === null);

        if (missing.length === 0) {
          // Round fully present but the game has not advanced — a wedged state the
          // per-line transition normally prevents (legacy data, a prior bug, a
          // manual repair). Nudge the canonical transition to heal it instead of
          // letting the cron reschedule a no-op forever.
          await applyLineLifecycleTransition(ctx, {
            game,
            roomId: game.roomId,
            lineIndex: round,
            completionKind: 'abandoned',
          });
          const after = await ctx.db.get(gameId);
          if (
            after &&
            after.status === 'IN_PROGRESS' &&
            after.currentRound === round
          ) {
            // Could not advance — nothing more this backstop can do.
            break;
          }
          continue;
        }

        const assignees = await Promise.all(
          missing.map((poem) => ctx.db.get(roundAssignments[poem.indexInRoom]))
        );
        for (let i = 0; i < missing.length; i++) {
          const poem = missing[i];
          const assignee = assignees[i];
          const baseName = assignee?.displayName ?? 'A poet';
          // Honest byline: ghost for humans, the AI's own name for AI poems.
          const authorDisplayName =
            assignee?.kind === 'AI' ? baseName : `${baseName} (ghost)`;
          const committed = await commitFallbackLine(ctx, {
            roomId: game.roomId,
            gameId,
            poemId: poem._id,
            lineIndex: round,
            authorUserId: roundAssignments[poem.indexInRoom],
            authorDisplayName,
            completionKind: 'abandoned',
          });
          if (committed) filled++;
        }
      }

      const finalGame = await ctx.db.get(gameId);
      const completed = finalGame?.status === 'COMPLETED';
      if (completed) {
        log.warn('Abandonment backstop completed a stranded game', {
          gameId,
          filled,
        });
      }
      return { completed, filled };
    } catch (error) {
      // Report without rethrowing: returning commits both the partial,
      // idempotent fills and the scheduled comparison report. A throw would
      // roll both back; the next sweep tick re-derives state and resumes.
      const err = error instanceof Error ? error : new Error(String(error));
      logError('finishAbandonedGame failed', err, { gameId });
      return returnAfterBackendReportScheduled(
        ctx.scheduler.runAfter(0, internal.errors.reportBackendFailure, {
          operation: 'finishAbandonedGame',
          failureCode: 'unexpected_error',
          filled,
        }),
        { completed: false, filled: 0, error: err.message }
      );
    }
  },
});
