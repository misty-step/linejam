/**
 * Self-heal abandoned games.
 *
 * A periodic cron sweep (convex/crons.ts) finds IN_PROGRESS games whose human
 * players have all gone silent — no presence heartbeat past
 * ABANDONMENT_THRESHOLD_MS — and schedules a per-game worker that ghost-fills
 * every remaining line and lands the room in COMPLETED.
 *
 * This is the durable backstop for the per-turn auto ghost-fill
 * (game.fillStaleHumanTurns). The per-turn floor rides on a `runAfter` chain
 * scheduled at each round open; if that chain is ever lost (action death, infra
 * incident, or a game that predates the feature) the room would strand forever.
 * The sweep re-derives state from scratch every tick and does not depend on any
 * scheduled function surviving, so it always finishes a stranded game. Both
 * paths commit through the idempotent `commitAssignedLine`, so they are safe to
 * run concurrently and to fire repeatedly.
 */

import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { commitAssignedLine } from './ai';
import { getMatrixRound } from './lib/assignmentMatrix';
import { getFallbackLine } from './lib/ai/llm';
import {
  ABANDONMENT_THRESHOLD_MS,
  getFinalRoundIndex,
  getGameRules,
  isPresenceStale,
} from './lib/gameRules';
import { log } from './lib/errors';

/**
 * Cron entry point. Cheap when idle: a single indexed scan plus a presence
 * check per active game. The heavy completion work is scheduled out per game.
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
      // Idle-age gate: never complete a fresh or actively-advancing game. This
      // also protects games whose clients have not heartbeat yet (legacy
      // clients with no lastSeenAt would otherwise read as "all stale" on the
      // very first tick).
      const idleSince = game.roundStartedAt ?? game.createdAt;
      if (now - idleSince < ABANDONMENT_THRESHOLD_MS) continue;

      const players = await ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', game.roomId))
        .collect();
      const users = await Promise.all(players.map((p) => ctx.db.get(p.userId)));
      const humanPlayers = players.filter((_, i) => users[i]?.kind !== 'AI');

      // Degenerate game with no humans — leave it to the per-turn floor.
      if (humanPlayers.length === 0) continue;

      const allHumansStale = humanPlayers.every((player) =>
        isPresenceStale(player.lastSeenAt, now, ABANDONMENT_THRESHOLD_MS)
      );
      if (!allHumansStale) continue;

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
 * no-op, and a line a real player commits in the meantime is left untouched.
 */
export const finishAbandonedGame = internalMutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, { gameId }) => {
    const initial = await ctx.db.get(gameId);
    if (!initial || initial.status !== 'IN_PROGRESS') {
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
      // Round fully present but game not advancing: the line-commit transition
      // already ran on every poem, so there is nothing more this backstop can
      // do. Bail rather than spin (the next sweep will retry if needed).
      if (missing.length === 0) break;

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
