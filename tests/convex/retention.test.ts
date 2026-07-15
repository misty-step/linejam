import { describe, expect, it } from 'vitest';
import { makeFunctionReference } from 'convex/server';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import {
  RETENTION_BATCH_LIMITS,
  RETENTION_PARENT_RETRY_MS,
} from '../../convex/lib/retentionPolicy';

type T = ReturnType<typeof setupConvexTest>;

const runRetentionSweep = makeFunctionReference<
  'mutation',
  { dryRun: boolean; now: number },
  {
    dryRun: boolean;
    eligible: number;
    deleted: number;
    errors: number;
    eligibleByTable: Record<string, number>;
    deletedByTable: Record<string, number>;
  }
>('retention:runRetentionSweep');

const backfillRetentionPolicy = makeFunctionReference<
  'mutation',
  { dryRun: boolean; now: number },
  {
    dryRun: boolean;
    scanned: number;
    patched: number;
    hasMore: boolean;
  }
>('retention:backfillRetentionPolicy');

const runScheduledRetentionSweep = makeFunctionReference<
  'action',
  Record<string, never>,
  { dryRun: boolean; deleted: number }
>('retention:runScheduledRetentionSweep');

async function seedCompletedArtifact(
  t: T,
  args: {
    code: string;
    now: number;
    recent?: boolean;
    publicShare?: boolean;
    favorite?: boolean;
  }
) {
  return t.run(async (ctx) => {
    const createdAt = args.now - 200 * 24 * 60 * 60 * 1000;
    const retentionEligibleAt = args.recent
      ? args.now + 24 * 60 * 60 * 1000
      : args.now - 1;
    const userId = await ctx.db.insert('users', {
      clerkUserId: `clerk-${args.code}`,
      displayName: `Poet ${args.code}`,
      kind: 'human',
      createdAt,
      retentionState: 'protected',
    });
    const roomId = await ctx.db.insert('rooms', {
      code: args.code,
      hostUserId: userId,
      status: 'COMPLETED',
      createdAt,
      completedAt: createdAt,
      retentionState: 'pending',
      retentionEligibleAt,
    });
    await ctx.db.insert('roomPlayers', {
      roomId,
      userId,
      displayName: `Poet ${args.code}`,
      joinedAt: createdAt,
    });
    const gameId = await ctx.db.insert('games', {
      roomId,
      status: 'COMPLETED',
      cycle: 1,
      currentRound: 8,
      assignmentMatrix: Array.from({ length: 9 }, () => [userId]),
      createdAt,
      completedAt: createdAt,
      retentionState: 'pending',
      retentionEligibleAt,
    });
    const poemId = await ctx.db.insert('poems', {
      roomId,
      gameId,
      indexInRoom: 0,
      createdAt,
      completedAt: createdAt,
      revealedAt: createdAt,
      ...(args.publicShare ? { publicShareEnabled: true } : {}),
      retentionState: 'pending',
      retentionEligibleAt,
    });
    const lineIds: Id<'lines'>[] = await Promise.all(
      Array.from({ length: 9 }, (_, indexInPoem) =>
        ctx.db.insert('lines', {
          poemId,
          indexInPoem,
          text: `line ${indexInPoem}`,
          wordCount: 2,
          authorUserId: userId,
          authorDisplayName: `Poet ${args.code}`,
          createdAt,
        })
      )
    );
    if (args.favorite) {
      await ctx.db.insert('favorites', { userId, poemId, createdAt });
    }
    return { roomId, gameId, poemId, lineIds, userId, createdAt };
  });
}

describe('bounded data retention', () => {
  it('dry-runs safely, then deletes expired private data while preserving kept and recent artifacts', async () => {
    const now = Date.UTC(2026, 6, 15, 20);
    const t = setupConvexTest();
    const expired = await seedCompletedArtifact(t, {
      code: 'OLD1',
      now,
    });
    const published = await seedCompletedArtifact(t, {
      code: 'PUB1',
      now,
      publicShare: true,
    });
    const favorited = await seedCompletedArtifact(t, {
      code: 'FAV1',
      now,
      favorite: true,
    });
    const recent = await seedCompletedArtifact(t, {
      code: 'NEW1',
      now,
      recent: true,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert('aiTurns', {
        roomId: expired.roomId,
        gameId: expired.gameId,
        poemId: expired.poemId,
        round: 0,
        aiUserId: expired.userId,
        day: '2026-01-01',
        status: 'authorized',
        claimedAt: expired.createdAt,
        updatedAt: expired.createdAt,
      });
      await ctx.db.insert('aiRoundLocks', {
        roomId: expired.roomId,
        gameId: expired.gameId,
        round: 0,
        owner: 'retention-test',
        status: 'finished',
        claimedAt: expired.createdAt,
        updatedAt: expired.createdAt,
      });
      await ctx.db.insert('aiUsage', {
        day: '2026-01-01',
        generationClaims: 1,
        httpAttempts: 1,
        fallbacks: 0,
        updatedAt: expired.createdAt,
      });
      await ctx.db.insert('aiGenerationMetrics', {
        bucketStart: expired.createdAt,
        totalGenerations: 1,
        fallbackGenerations: 0,
        budgetExhaustion: 0,
        providerError: 0,
        invalidOutput: 0,
        missingConfiguration: 0,
        updatedAt: expired.createdAt,
      });
      await ctx.db.insert('shares', {
        poemId: expired.poemId,
        createdAt: expired.createdAt,
      });
      await ctx.db.insert('rateLimits', {
        key: 'expired:test',
        hits: 1,
        resetTime: expired.createdAt,
      });
    });

    const dryRun = await t.mutation(runRetentionSweep, {
      dryRun: true,
      now,
    });
    expect(dryRun.deleted).toBe(0);
    expect(dryRun.eligible).toBeGreaterThan(0);
    expect(await t.run((ctx) => ctx.db.get(expired.poemId))).not.toBeNull();

    const receipt = await t.mutation(runRetentionSweep, {
      dryRun: false,
      now,
    });
    expect(receipt.errors).toBe(0);
    expect(receipt.deleted).toBeGreaterThan(0);
    expect(await t.run((ctx) => ctx.db.get(expired.poemId))).toBeNull();
    for (const lineId of expired.lineIds) {
      expect(await t.run((ctx) => ctx.db.get(lineId))).toBeNull();
    }

    // The cascade is child-first: parent rows drain only after the poem batch
    // has completed, preventing an anomalous/kept poem from being orphaned.
    expect(await t.run((ctx) => ctx.db.get(expired.roomId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(expired.gameId))).not.toBeNull();
    const secondSweepAt = now + RETENTION_PARENT_RETRY_MS + 1;
    await t.mutation(runRetentionSweep, {
      dryRun: false,
      now: secondSweepAt,
    });
    expect(await t.run((ctx) => ctx.db.get(expired.roomId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(expired.gameId))).toBeNull();
    await t.mutation(runRetentionSweep, {
      dryRun: false,
      now: secondSweepAt + RETENTION_PARENT_RETRY_MS + 1,
    });
    expect(await t.run((ctx) => ctx.db.get(expired.roomId))).toBeNull();

    for (const kept of [published, favorited, recent]) {
      expect(await t.run((ctx) => ctx.db.get(kept.poemId))).not.toBeNull();
      expect(await t.run((ctx) => ctx.db.get(kept.lineIds[0]))).not.toBeNull();
    }
    expect(await t.run((ctx) => ctx.db.get(published.roomId))).not.toBeNull();

    const metrics = await t.run((ctx) =>
      ctx.db.query('retentionRuns').order('desc').first()
    );
    expect(metrics).toMatchObject({
      policyVersion: 'linejam-retention-v1',
      dryRun: false,
      errors: 0,
    });
    expect(Object.keys(metrics ?? {})).not.toEqual(
      expect.arrayContaining(['text', 'poemText', 'guestId', 'roomCode'])
    );
  });

  it('deletes at most the declared batch from one table per invocation', async () => {
    const now = Date.UTC(2026, 6, 15, 20);
    const t = setupConvexTest();
    await t.run(async (ctx) => {
      await Promise.all(
        Array.from(
          { length: RETENTION_BATCH_LIMITS.rateLimits + 1 },
          (_, index) =>
            ctx.db.insert('rateLimits', {
              key: `expired:${index}`,
              hits: 1,
              resetTime: now - 1,
            })
        )
      );
    });

    const receipt = await t.mutation(runRetentionSweep, {
      dryRun: false,
      now,
    });
    expect(receipt.deletedByTable.rateLimits).toBe(
      RETENTION_BATCH_LIMITS.rateLimits
    );
    expect(
      await t.run((ctx) => ctx.db.query('rateLimits').collect())
    ).toHaveLength(1);
  });

  it('keeps the scheduled cron metrics-only until deletion is explicitly enabled', async () => {
    const original = process.env.RETENTION_GC_ENABLED;
    delete process.env.RETENTION_GC_ENABLED;
    try {
      const now = Date.now();
      const t = setupConvexTest();
      const rowId = await t.run((ctx) =>
        ctx.db.insert('rateLimits', {
          key: 'expired:fail-closed',
          hits: 1,
          resetTime: now - 1,
        })
      );

      const receipt = await t.action(runScheduledRetentionSweep, {});
      expect(receipt).toMatchObject({ dryRun: true, deleted: 0 });
      expect(await t.run((ctx) => ctx.db.get(rowId))).not.toBeNull();
    } finally {
      if (original === undefined) delete process.env.RETENTION_GC_ENABLED;
      else process.env.RETENTION_GC_ENABLED = original;
    }
  });

  it('deletes orphan guest identities but defers identities referenced by kept lines', async () => {
    const now = Date.UTC(2026, 6, 15, 20);
    const t = setupConvexTest();
    const kept = await seedCompletedArtifact(t, {
      code: 'ID01',
      now,
      publicShare: true,
    });
    const { orphanId, referencedId } = await t.run(async (ctx) => {
      const orphanId = await ctx.db.insert('users', {
        guestId: 'orphan-guest',
        displayName: 'Orphan',
        kind: 'human',
        createdAt: now - 200 * 24 * 60 * 60 * 1000,
        retentionState: 'pending',
        retentionEligibleAt: now - 1,
      });
      const referencedId = await ctx.db.insert('users', {
        guestId: 'referenced-guest',
        displayName: 'Referenced',
        kind: 'human',
        createdAt: now - 200 * 24 * 60 * 60 * 1000,
        retentionState: 'pending',
        retentionEligibleAt: now - 1,
      });
      await ctx.db.patch(kept.lineIds[0], { authorUserId: referencedId });
      return { orphanId, referencedId };
    });

    await t.mutation(runRetentionSweep, { dryRun: false, now });
    expect(await t.run((ctx) => ctx.db.get(orphanId))).toBeNull();
    const referenced = await t.run((ctx) => ctx.db.get(referencedId));
    expect(referenced).not.toBeNull();
    expect(referenced?.retentionEligibleAt).toBeGreaterThan(now);
  });

  it('reports and skips an over-cardinality poem instead of partially deleting it', async () => {
    const now = Date.UTC(2026, 6, 15, 20);
    const t = setupConvexTest();
    const artifact = await seedCompletedArtifact(t, {
      code: 'WIDE',
      now,
    });
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: artifact.poemId,
        indexInPoem: 9,
        text: 'unexpected tenth line',
        wordCount: 3,
        authorUserId: artifact.userId,
        authorDisplayName: 'Poet WIDE',
        createdAt: artifact.createdAt,
      })
    );

    const receipt = await t.mutation(runRetentionSweep, {
      dryRun: false,
      now,
    });
    expect(receipt.errors).toBe(1);
    expect(receipt.deletedByTable.poems).toBe(0);
    const retainedRoom = await t.run((ctx) => ctx.db.get(artifact.roomId));
    const retainedGame = await t.run((ctx) => ctx.db.get(artifact.gameId));
    expect(retainedRoom?.retentionEligibleAt).toBeGreaterThan(now);
    expect(retainedGame?.retentionEligibleAt).toBeGreaterThan(now);
    expect(await t.run((ctx) => ctx.db.get(artifact.poemId))).not.toBeNull();
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem', (q) => q.eq('poemId', artifact.poemId))
          .collect()
      )
    ).toHaveLength(10);
  });

  it('classifies legacy rows in bounded, rerunnable batches before GC', async () => {
    const now = Date.UTC(2026, 6, 15, 20);
    const t = setupConvexTest();
    const ids = await t.run(async (ctx) => {
      const guestId = await ctx.db.insert('users', {
        guestId: 'legacy-guest',
        displayName: 'Legacy guest',
        kind: 'human',
        createdAt: now - 200 * 24 * 60 * 60 * 1000,
      });
      const clerkId = await ctx.db.insert('users', {
        clerkUserId: 'legacy-clerk',
        displayName: 'Legacy member',
        kind: 'human',
        createdAt: now - 200 * 24 * 60 * 60 * 1000,
      });
      const roomId = await ctx.db.insert('rooms', {
        code: 'LEG1',
        hostUserId: clerkId,
        status: 'COMPLETED',
        createdAt: now - 100 * 24 * 60 * 60 * 1000,
        completedAt: now - 100 * 24 * 60 * 60 * 1000,
      });
      const gameId = await ctx.db.insert('games', {
        roomId,
        status: 'COMPLETED',
        cycle: 1,
        currentRound: 8,
        assignmentMatrix: Array.from({ length: 9 }, () => [clerkId]),
        createdAt: now - 100 * 24 * 60 * 60 * 1000,
        completedAt: now - 100 * 24 * 60 * 60 * 1000,
      });
      const poemId = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: now - 100 * 24 * 60 * 60 * 1000,
        completedAt: now - 100 * 24 * 60 * 60 * 1000,
        publicShareEnabled: true,
      });
      return { guestId, clerkId, roomId, gameId, poemId };
    });

    const preview = await t.mutation(backfillRetentionPolicy, {
      dryRun: true,
      now,
    });
    expect(preview.scanned).toBe(5);
    expect(preview.patched).toBe(0);
    expect(
      (await t.run((ctx) => ctx.db.get(ids.poemId)))?.retentionState
    ).toBeUndefined();

    const applied = await t.mutation(backfillRetentionPolicy, {
      dryRun: false,
      now,
    });
    expect(applied).toMatchObject({ patched: 5, hasMore: false });
    expect(
      (await t.run((ctx) => ctx.db.get(ids.guestId)))?.retentionState
    ).toBe('pending');
    expect(
      (await t.run((ctx) => ctx.db.get(ids.clerkId)))?.retentionState
    ).toBe('protected');
    expect((await t.run((ctx) => ctx.db.get(ids.roomId)))?.retentionState).toBe(
      'pending'
    );
    expect((await t.run((ctx) => ctx.db.get(ids.gameId)))?.retentionState).toBe(
      'pending'
    );
    expect((await t.run((ctx) => ctx.db.get(ids.poemId)))?.retentionState).toBe(
      'protected'
    );

    const rerun = await t.mutation(backfillRetentionPolicy, {
      dryRun: false,
      now,
    });
    expect(rerun).toMatchObject({ scanned: 0, patched: 0, hasMore: false });
  });
});
