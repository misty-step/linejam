import { v } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { log } from './lib/errors';
import {
  RETENTION_BATCH_LIMITS,
  RETENTION_DURATIONS_MS,
  RETENTION_PARENT_RETRY_MS,
  RETENTION_POLICY_VERSION,
  retentionEligibleAt,
} from './lib/retentionPolicy';

const TABLES = [
  'rooms',
  'games',
  'poems',
  'users',
  'migrations',
  'aiTurns',
  'aiRoundLocks',
  'aiUsage',
  'aiGenerationMetrics',
  'shares',
  'rateLimits',
  'retentionRuns',
] as const;

type RetentionTable = (typeof TABLES)[number];
type TableCounts = Record<RetentionTable, number>;
type CandidateResult = {
  eligible: number;
  deleted: number;
  errors: number;
};

const retentionSweepRef = makeFunctionReference<
  'mutation',
  { dryRun: boolean },
  {
    policyVersion: string;
    dryRun: boolean;
    eligible: number;
    deleted: number;
    errors: number;
    eligibleByTable: TableCounts;
    deletedByTable: TableCounts;
  }
>('retention:runRetentionSweep');

function emptyCounts(): TableCounts {
  return Object.fromEntries(TABLES.map((table) => [table, 0])) as TableCounts;
}

function recordCandidateResults(
  table: RetentionTable,
  results: CandidateResult[],
  eligibleByTable: TableCounts,
  deletedByTable: TableCounts
): number {
  const totals = results.reduce<CandidateResult>(
    (aggregate, result) => ({
      eligible: aggregate.eligible + result.eligible,
      deleted: aggregate.deleted + result.deleted,
      errors: aggregate.errors + result.errors,
    }),
    { eligible: 0, deleted: 0, errors: 0 }
  );
  eligibleByTable[table] += totals.eligible;
  deletedByTable[table] += totals.deleted;
  return totals.errors;
}

async function hasPublicRoomArtifact(
  ctx: Pick<MutationCtx, 'db'>,
  roomId: Id<'rooms'>
): Promise<boolean> {
  const [game, poem] = await Promise.all([
    ctx.db
      .query('games')
      .withIndex('by_room_public', (q) =>
        q.eq('roomId', roomId).eq('publicRecapEnabled', true)
      )
      .first(),
    ctx.db
      .query('poems')
      .withIndex('by_room_public_created', (q) =>
        q.eq('roomId', roomId).eq('publicShareEnabled', true)
      )
      .first(),
  ]);
  return game !== null || poem !== null;
}

async function hasRoomDependents(
  ctx: Pick<MutationCtx, 'db'>,
  roomId: Id<'rooms'>
): Promise<boolean> {
  const [game, poem] = await Promise.all([
    ctx.db
      .query('games')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .first(),
    ctx.db
      .query('poems')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .first(),
  ]);
  return game !== null || poem !== null;
}

export const runRetentionSweep = internalMutation({
  args: {
    dryRun: v.boolean(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startedAt = args.now ?? Date.now();
    const now = startedAt;
    const eligibleByTable = emptyCounts();
    const deletedByTable = emptyCounts();
    let errors = 0;

    const operationalCutoff = now - RETENTION_DURATIONS_MS.operationalMetrics;
    const bookkeepingCutoff = now - RETENTION_DURATIONS_MS.aiBookkeeping;

    const [
      rooms,
      games,
      poems,
      users,
      migrations,
      aiTurns,
      aiRoundLocks,
      aiUsage,
      aiGenerationMetrics,
      shares,
      rateLimits,
      retentionRuns,
    ] = await Promise.all([
      ctx.db
        .query('rooms')
        .withIndex('by_retention', (q) =>
          q.eq('retentionState', 'pending').lte('retentionEligibleAt', now)
        )
        .take(RETENTION_BATCH_LIMITS.rooms),
      ctx.db
        .query('games')
        .withIndex('by_retention', (q) =>
          q.eq('retentionState', 'pending').lte('retentionEligibleAt', now)
        )
        .take(RETENTION_BATCH_LIMITS.games),
      ctx.db
        .query('poems')
        .withIndex('by_retention', (q) =>
          q.eq('retentionState', 'pending').lte('retentionEligibleAt', now)
        )
        .take(RETENTION_BATCH_LIMITS.poems),
      ctx.db
        .query('users')
        .withIndex('by_retention', (q) =>
          q.eq('retentionState', 'pending').lte('retentionEligibleAt', now)
        )
        .take(RETENTION_BATCH_LIMITS.users),
      ctx.db
        .query('migrations')
        .withIndex('by_migrated', (q) =>
          q.lte('migratedAt', now - RETENTION_DURATIONS_MS.guestIdentity)
        )
        .take(RETENTION_BATCH_LIMITS.migrations),
      ctx.db
        .query('aiTurns')
        .withIndex('by_updated', (q) => q.lte('updatedAt', bookkeepingCutoff))
        .take(RETENTION_BATCH_LIMITS.aiTurns),
      ctx.db
        .query('aiRoundLocks')
        .withIndex('by_updated', (q) => q.lte('updatedAt', bookkeepingCutoff))
        .take(RETENTION_BATCH_LIMITS.aiRoundLocks),
      ctx.db
        .query('aiUsage')
        .withIndex('by_updated', (q) => q.lte('updatedAt', operationalCutoff))
        .take(RETENTION_BATCH_LIMITS.aiUsage),
      ctx.db
        .query('aiGenerationMetrics')
        .withIndex('by_bucket', (q) => q.lte('bucketStart', operationalCutoff))
        .take(RETENTION_BATCH_LIMITS.aiGenerationMetrics),
      ctx.db
        .query('shares')
        .withIndex('by_created', (q) => q.lte('createdAt', operationalCutoff))
        .take(RETENTION_BATCH_LIMITS.shares),
      ctx.db
        .query('rateLimits')
        .withIndex('by_reset_time', (q) => q.lte('resetTime', now))
        .take(RETENTION_BATCH_LIMITS.rateLimits),
      ctx.db
        .query('retentionRuns')
        .withIndex('by_completed', (q) =>
          q.lte('completedAt', operationalCutoff)
        )
        .take(RETENTION_BATCH_LIMITS.retentionRuns),
    ]);

    const roomResults = await Promise.all(
      rooms.map(async (room): Promise<CandidateResult> => {
        if (await hasPublicRoomArtifact(ctx, room._id)) {
          if (!args.dryRun) {
            await ctx.db.patch(room._id, {
              retentionState: 'protected',
              retentionEligibleAt: undefined,
            });
          }
          return { eligible: 0, deleted: 0, errors: 0 };
        }
        // Parent deletion is deliberately staged. A kept or anomalous child
        // must retain its provenance/auth context; ordinary private children
        // are removed by their own bounded batch and the parent drains later.
        if (await hasRoomDependents(ctx, room._id)) {
          if (!args.dryRun) {
            await ctx.db.patch(room._id, {
              retentionEligibleAt: now + RETENTION_PARENT_RETRY_MS,
            });
          }
          return { eligible: 0, deleted: 0, errors: 0 };
        }
        const players = await ctx.db
          .query('roomPlayers')
          .withIndex('by_room', (q) => q.eq('roomId', room._id))
          .take(RETENTION_BATCH_LIMITS.roomPlayersPerRoom + 1);
        if (players.length > RETENTION_BATCH_LIMITS.roomPlayersPerRoom) {
          return { eligible: 0, deleted: 0, errors: 1 };
        }
        if (!args.dryRun) {
          await Promise.all([
            ...players.map((player) => ctx.db.delete(player._id)),
            ctx.db.delete(room._id),
          ]);
        }
        return {
          eligible: 1,
          deleted: args.dryRun ? 0 : 1,
          errors: 0,
        };
      })
    );
    errors += recordCandidateResults(
      'rooms',
      roomResults,
      eligibleByTable,
      deletedByTable
    );

    const gameResults = await Promise.all(
      games.map(async (game): Promise<CandidateResult> => {
        if (game.publicRecapEnabled === true) {
          if (!args.dryRun) {
            await ctx.db.patch(game._id, {
              retentionState: 'protected',
              retentionEligibleAt: undefined,
            });
          }
          return { eligible: 0, deleted: 0, errors: 0 };
        }
        const poem = await ctx.db
          .query('poems')
          .withIndex('by_game', (q) => q.eq('gameId', game._id))
          .first();
        if (poem) {
          if (!args.dryRun) {
            await ctx.db.patch(game._id, {
              retentionEligibleAt: now + RETENTION_PARENT_RETRY_MS,
            });
          }
          return { eligible: 0, deleted: 0, errors: 0 };
        }
        if (!args.dryRun) await ctx.db.delete(game._id);
        return {
          eligible: 1,
          deleted: args.dryRun ? 0 : 1,
          errors: 0,
        };
      })
    );
    errors += recordCandidateResults(
      'games',
      gameResults,
      eligibleByTable,
      deletedByTable
    );

    const poemResults = await Promise.all(
      poems.map(async (poem): Promise<CandidateResult> => {
        const [favorite, game] = await Promise.all([
          ctx.db
            .query('favorites')
            .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
            .first(),
          ctx.db.get(poem.gameId),
        ]);
        if (
          poem.publicShareEnabled === true ||
          favorite !== null ||
          game?.publicRecapEnabled === true
        ) {
          if (!args.dryRun) {
            await ctx.db.patch(poem._id, {
              retentionState: 'protected',
              retentionEligibleAt: undefined,
            });
          }
          return { eligible: 0, deleted: 0, errors: 0 };
        }
        const lines = await ctx.db
          .query('lines')
          .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
          .take(RETENTION_BATCH_LIMITS.linesPerPoem + 1);
        if (lines.length > RETENTION_BATCH_LIMITS.linesPerPoem) {
          return { eligible: 0, deleted: 0, errors: 1 };
        }
        if (!args.dryRun) {
          await Promise.all([
            ...lines.map((line) => ctx.db.delete(line._id)),
            ctx.db.delete(poem._id),
          ]);
        }
        return {
          eligible: 1,
          deleted: args.dryRun ? 0 : 1,
          errors: 0,
        };
      })
    );
    errors += recordCandidateResults(
      'poems',
      poemResults,
      eligibleByTable,
      deletedByTable
    );

    const userResults = await Promise.all(
      users.map(async (user): Promise<CandidateResult> => {
        const isGuest = Boolean(user.guestId && !user.clerkUserId);
        const isAi = user.kind === 'AI';
        if (!isGuest && !isAi) {
          if (!args.dryRun) {
            await ctx.db.patch(user._id, {
              retentionState: 'protected',
              retentionEligibleAt: undefined,
            });
          }
          return { eligible: 0, deleted: 0, errors: 0 };
        }
        const references = await Promise.all([
          ctx.db
            .query('roomPlayers')
            .withIndex('by_user', (q) => q.eq('userId', user._id))
            .first(),
          ctx.db
            .query('lines')
            .withIndex('by_author', (q) => q.eq('authorUserId', user._id))
            .first(),
          ctx.db
            .query('favorites')
            .withIndex('by_user', (q) => q.eq('userId', user._id))
            .first(),
          ctx.db
            .query('rooms')
            .withIndex('by_host', (q) => q.eq('hostUserId', user._id))
            .first(),
          ctx.db
            .query('poems')
            .withIndex('by_reader', (q) => q.eq('assignedReaderId', user._id))
            .first(),
          ctx.db
            .query('migrations')
            .withIndex('by_guest', (q) => q.eq('guestUserId', user._id))
            .first(),
        ]);
        if (references.some((reference) => reference !== null)) {
          if (!args.dryRun) {
            await ctx.db.patch(user._id, {
              retentionEligibleAt: retentionEligibleAt(
                now,
                'guestReferenceDeferral'
              ),
            });
          }
          return { eligible: 0, deleted: 0, errors: 0 };
        }
        if (!args.dryRun) await ctx.db.delete(user._id);
        return {
          eligible: 1,
          deleted: args.dryRun ? 0 : 1,
          errors: 0,
        };
      })
    );
    errors += recordCandidateResults(
      'users',
      userResults,
      eligibleByTable,
      deletedByTable
    );

    const directBatches = {
      aiTurns,
      migrations,
      aiRoundLocks,
      aiUsage,
      aiGenerationMetrics,
      shares,
      rateLimits,
      retentionRuns,
    } as const;
    const directTables = Object.keys(directBatches) as Array<
      keyof typeof directBatches
    >;
    for (const table of directTables) {
      const rows = directBatches[table];
      eligibleByTable[table] += rows.length;
      if (!args.dryRun) deletedByTable[table] += rows.length;
    }
    if (!args.dryRun) {
      await Promise.all(
        directTables.flatMap((table) =>
          directBatches[table].map((row) => ctx.db.delete(row._id))
        )
      );
    }

    const eligible = Object.values(eligibleByTable).reduce(
      (sum, count) => sum + count,
      0
    );
    const deleted = Object.values(deletedByTable).reduce(
      (sum, count) => sum + count,
      0
    );
    const completedAt = args.now ?? Date.now();
    await ctx.db.insert('retentionRuns', {
      policyVersion: RETENTION_POLICY_VERSION,
      dryRun: args.dryRun,
      startedAt,
      completedAt,
      eligible,
      deleted,
      errors,
      eligibleByTable,
      deletedByTable,
    });

    log.info('Retention sweep completed', {
      policyVersion: RETENTION_POLICY_VERSION,
      dryRun: args.dryRun,
      eligible,
      deleted,
      errors,
      eligibleByTable,
      deletedByTable,
    });

    return {
      policyVersion: RETENTION_POLICY_VERSION,
      dryRun: args.dryRun,
      eligible,
      deleted,
      errors,
      eligibleByTable,
      deletedByTable,
    };
  },
});

export const getRetentionTrend = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const boundedLimit = Math.max(1, Math.min(90, Math.floor(limit ?? 30)));
    return ctx.db
      .query('retentionRuns')
      .withIndex('by_completed')
      .order('desc')
      .take(boundedLimit);
  },
});

/**
 * Cron face. Production remains metrics-only until an operator has completed
 * the bounded backfill, inspected a dry-run receipt, and explicitly enables
 * deletion in the Convex environment.
 */
export const runScheduledRetentionSweep = internalAction({
  args: {},
  handler: async (ctx) =>
    ctx.runMutation(retentionSweepRef, {
      dryRun: process.env.RETENTION_GC_ENABLED !== '1',
    }),
});

/** Bounded legacy classifier. Repeat until hasMore=false before enabling GC. */
export const backfillRetentionPolicy = internalMutation({
  args: { dryRun: v.boolean(), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = 20;
    const [users, rooms, games, poems] = await Promise.all([
      ctx.db
        .query('users')
        .withIndex('by_retention', (q) => q.eq('retentionState', undefined))
        .take(limit),
      ctx.db
        .query('rooms')
        .withIndex('by_retention', (q) => q.eq('retentionState', undefined))
        .take(limit),
      ctx.db
        .query('games')
        .withIndex('by_retention', (q) => q.eq('retentionState', undefined))
        .take(limit),
      ctx.db
        .query('poems')
        .withIndex('by_retention', (q) => q.eq('retentionState', undefined))
        .take(limit),
    ]);

    if (!args.dryRun) {
      await Promise.all([
        ...users.map((user) =>
          ctx.db.patch(
            user._id,
            user.kind === 'AI'
              ? {
                  retentionState: 'pending' as const,
                  retentionEligibleAt: retentionEligibleAt(
                    Math.min(user.createdAt, now),
                    'aiBookkeeping'
                  ),
                }
              : user.guestId && !user.clerkUserId
                ? {
                    retentionState: 'pending' as const,
                    retentionEligibleAt: retentionEligibleAt(
                      Math.min(user.createdAt, now),
                      'guestIdentity'
                    ),
                  }
                : {
                    retentionState: 'protected' as const,
                    retentionEligibleAt: undefined,
                  }
          )
        ),
        ...rooms.map((room) =>
          ctx.db.patch(
            room._id,
            room.status === 'COMPLETED'
              ? {
                  retentionState: 'pending' as const,
                  retentionEligibleAt: retentionEligibleAt(
                    Math.min(room.completedAt ?? room.createdAt, now),
                    'privateCompleted'
                  ),
                }
              : {
                  retentionState: 'active' as const,
                  retentionEligibleAt: undefined,
                }
          )
        ),
        ...games.map((game) =>
          ctx.db.patch(
            game._id,
            game.status !== 'COMPLETED'
              ? {
                  retentionState: 'active' as const,
                  retentionEligibleAt: undefined,
                }
              : game.publicRecapEnabled === true
                ? {
                    retentionState: 'protected' as const,
                    retentionEligibleAt: undefined,
                  }
                : {
                    retentionState: 'pending' as const,
                    retentionEligibleAt: retentionEligibleAt(
                      Math.min(game.completedAt ?? game.createdAt, now),
                      'privateCompleted'
                    ),
                  }
          )
        ),
      ]);

      await Promise.all(
        poems.map(async (poem) => {
          const [favorite, game] = await Promise.all([
            ctx.db
              .query('favorites')
              .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
              .first(),
            ctx.db.get(poem.gameId),
          ]);
          const protectedArtifact =
            poem.publicShareEnabled === true ||
            favorite !== null ||
            game?.publicRecapEnabled === true;
          await ctx.db.patch(
            poem._id,
            protectedArtifact
              ? {
                  retentionState: 'protected',
                  retentionEligibleAt: undefined,
                }
              : poem.completedAt !== undefined
                ? {
                    retentionState: 'pending',
                    retentionEligibleAt: retentionEligibleAt(
                      Math.min(poem.completedAt, now),
                      'privateCompleted'
                    ),
                  }
                : {
                    retentionState: 'active',
                    retentionEligibleAt: undefined,
                  }
          );
        })
      );
    }

    const scanned = users.length + rooms.length + games.length + poems.length;
    return {
      policyVersion: RETENTION_POLICY_VERSION,
      dryRun: args.dryRun,
      scanned,
      patched: args.dryRun ? 0 : scanned,
      hasMore:
        users.length === limit ||
        rooms.length === limit ||
        games.length === limit ||
        poems.length === limit,
    };
  },
});
