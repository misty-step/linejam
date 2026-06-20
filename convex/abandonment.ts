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
import { commitAssignedLine } from './ai';
import { getMatrixRound } from './lib/assignmentMatrix';
import { getFallbackLine } from './lib/ai/llm';
import { applyLineLifecycleTransition } from './lib/sessionLifecycle';
import {
  ABANDONMENT_HARD_DEADLINE_MS,
  ABANDONMENT_THRESHOLD_MS,
  getFinalRoundIndex,
  getGameRules,
  isPresenceStale,
} from './lib/gameRules';
import { log } from './lib/errors';

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
 * Cron entry point. Cheap when idle: an indexed scan of IN_PROGRESS games, and
 * a presence check only for games already idle past the threshold (the idle-age
 * gate short-circuits before any per-game read). The heavy completion work is
 * scheduled out per game. Scans every IN_PROGRESS game so no abandoned room can
 * be starved behind a page of still-active ones.
 */
export const sweepAbandonedGames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const inProgressGames = await ctx.db
      .query('games')
      .withIndex('by_status', (q) => q.eq('status', 'IN_PROGRESS'))
      .collect();

    let scheduled = 0;
    for (const game of inProgressGames) {
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
        scanned: inProgressGames.length,
      });
    }

    return { scheduled, scanned: inProgressGames.length };
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
  handler: async (ctx, { gameId }) => {
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

    const rules = getGameRules(initial.mode);
    // One pass advances at most one round; bound the loop (CLAUDE.md loop-safety).
    const maxPasses = getFinalRoundIndex(rules) + 2;

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect();

    let filled = 0;
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
      const expectedCount = rules.wordCounts[round];

      for (let i = 0; i < missing.length; i++) {
        const poem = missing[i];
        const assignee = assignees[i];
        const baseName = assignee?.displayName ?? 'A poet';
        // Honest byline: ghost for humans, the AI's own name for AI poems.
        const authorDisplayName =
          assignee?.kind === 'AI' ? baseName : `${baseName} (ghost)`;
        const committed = await commitAssignedLine(ctx, {
          roomId: game.roomId,
          gameId,
          poemId: poem._id,
          lineIndex: round,
          text: getFallbackLine(expectedCount),
          authorUserId: roundAssignments[poem.indexInRoom],
          authorDisplayName,
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
  },
});
