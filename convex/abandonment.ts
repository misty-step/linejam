/** Bounded cleanup for games whose participants have all left. */
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { abandonGame } from './lib/sessionLifecycle';
import {
  ABANDONMENT_HARD_DEADLINE_MS,
  ABANDONMENT_THRESHOLD_MS,
  isPresenceStale,
} from './lib/gameRules';
import { log, logError } from './lib/errors';
import { returnAfterBackendReportScheduled } from './errors';

async function getPlayers(
  ctx: Pick<MutationCtx, 'db'>,
  roomId: Id<'rooms'>
): Promise<Doc<'roomPlayers'>[]> {
  return ctx.db
    .query('roomPlayers')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
}

function anyPlayerPresent(
  players: readonly Doc<'roomPlayers'>[],
  now: number
): boolean {
  return players.some(
    (player) =>
      player.lastSeenAt !== undefined &&
      !isPresenceStale(player.lastSeenAt, now, ABANDONMENT_THRESHOLD_MS)
  );
}

async function isGameAbandoned(
  ctx: Pick<MutationCtx, 'db'>,
  game: Doc<'games'>,
  now: number
): Promise<boolean> {
  const idleMs = now - (game.roundStartedAt ?? game.createdAt);
  if (idleMs < ABANDONMENT_THRESHOLD_MS) return false;

  const players = await getPlayers(ctx, game.roomId);
  if (players.length === 0) return true;
  if (anyPlayerPresent(players, now)) return false;

  const allHeartbeatsAreStale = players.every(
    (player) =>
      player.lastSeenAt !== undefined &&
      isPresenceStale(player.lastSeenAt, now, ABANDONMENT_THRESHOLD_MS)
  );
  return allHeartbeatsAreStale || idleMs >= ABANDONMENT_HARD_DEADLINE_MS;
}

const MAX_FINISHERS_PER_SWEEP = 200;
const MAX_SWEEP_SCAN = 1000;

/**
 * Scan only old IN_PROGRESS rows and schedule bounded per-game mutations. The
 * worker rechecks presence, so reconnecting between scan and execution is safe.
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
        log.warn('Abandonment sweep scheduled stranded games', {
          scheduled,
          scanned,
          truncated,
        });
      }
      return { scheduled, scanned };
    } catch (error) {
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
 * Terminate an unattended game without inventing any poem lines. ABANDONED is
 * terminal but never reveal-ready. Closing removes every stale room membership
 * so the room code cannot be joined again.
 */
export const finishAbandonedGame = internalMutation({
  args: { gameId: v.id('games') },
  handler: async (
    ctx,
    { gameId }
  ): Promise<{ abandoned: boolean; error?: string }> => {
    try {
      const game = await ctx.db.get(gameId);
      if (!game || game.status !== 'IN_PROGRESS') {
        return { abandoned: false };
      }
      if (!(await isGameAbandoned(ctx, game, Date.now()))) {
        return { abandoned: false };
      }

      const players = await getPlayers(ctx, game.roomId);
      if (anyPlayerPresent(players, Date.now())) {
        return { abandoned: false };
      }

      const abandonedAt = Date.now();
      await Promise.all(players.map((player) => ctx.db.delete(player._id)));
      const abandoned = await abandonGame(ctx, {
        game,
        closeRoom: true,
        abandonedAt,
      });
      if (abandoned) {
        log.warn('Abandonment backstop closed a stranded game', { gameId });
      }
      return { abandoned };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError('finishAbandonedGame failed', err, { gameId });
      return returnAfterBackendReportScheduled(
        ctx.scheduler.runAfter(0, internal.errors.reportBackendFailure, {
          operation: 'finishAbandonedGame',
          failureCode: 'unexpected_error',
        }),
        { abandoned: false, error: err.message }
      );
    }
  },
});
