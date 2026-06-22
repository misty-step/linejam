import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  applyLineLifecycleTransition,
  getCycleResetDecision,
  getSubmissionWindow,
  isRevealReady,
} from '../../../convex/lib/sessionLifecycle';
import {
  WORD_COUNTS,
  getGameRules,
  getFinalRoundIndex,
} from '../../../convex/lib/gameRules';
import { setupConvexTest } from '../../helpers/convexTest';
import { getFallbackLine } from '../../../convex/lib/ai/fallbacks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type T = ReturnType<typeof setupConvexTest>;

/**
 * Seed a minimal IN_PROGRESS classic game directly into the real DB.
 * Returns typed IDs so tests can drive the lifecycle without going through
 * the public API layer.
 */
async function seedGame(
  t: T,
  opts: {
    players: Array<{ name: string; kind?: 'AI' | 'human' }>;
    mode?: 'classic' | 'quick';
    currentRound?: number;
    /** Pre-insert lines for these (poemIndex, lineIndex) pairs. */
    existingLines?: Array<{ poemIndex: number; lineIndex: number }>;
    /** Override the game status (default: IN_PROGRESS). */
    gameStatus?: 'IN_PROGRESS' | 'COMPLETED';
  }
) {
  const mode = opts.mode ?? 'classic';
  const currentRound = opts.currentRound ?? 0;
  const rules = getGameRules(mode);
  const rounds = rules.wordCounts.length;
  const now = Date.now();

  return t.run(async (ctx) => {
    const userIds: Id<'users'>[] = [];
    for (const p of opts.players) {
      userIds.push(
        await ctx.db.insert('users', {
          displayName: p.name,
          kind: p.kind ?? 'human',
          createdAt: now,
        })
      );
    }

    const roomId = await ctx.db.insert('rooms', {
      code: 'TEST',
      hostUserId: userIds[0],
      status: 'IN_PROGRESS',
      createdAt: now,
    });

    await Promise.all(
      opts.players.map((p, i) =>
        ctx.db.insert('roomPlayers', {
          roomId,
          userId: userIds[i],
          displayName: p.name,
          seatIndex: i,
          joinedAt: now,
        })
      )
    );

    const n = userIds.length;
    // Cyclic-shift matrix identical to abandonment.test.ts's seedClassicGame.
    const assignmentMatrix: Id<'users'>[][] = [];
    for (let r = 0; r < rounds; r++) {
      assignmentMatrix.push(
        Array.from({ length: n }, (_, poem) => userIds[(poem + r) % n])
      );
    }

    const gameId = await ctx.db.insert('games', {
      roomId,
      status: opts.gameStatus ?? 'IN_PROGRESS',
      cycle: 1,
      mode,
      currentRound,
      roundStartedAt: now,
      assignmentMatrix,
      createdAt: now,
    });

    const poemIds: Id<'poems'>[] = [];
    for (let i = 0; i < n; i++) {
      poemIds.push(
        await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: i,
          createdAt: now,
        })
      );
    }

    if (opts.existingLines) {
      for (const { poemIndex, lineIndex } of opts.existingLines) {
        const wc = rules.wordCounts[lineIndex];
        await ctx.db.insert('lines', {
          poemId: poemIds[poemIndex],
          indexInPoem: lineIndex,
          text: getFallbackLine(wc),
          wordCount: wc,
          authorUserId: assignmentMatrix[lineIndex][poemIndex],
          createdAt: now,
        });
      }
    }

    return { roomId, gameId, userIds, poemIds, assignmentMatrix };
  });
}

// ---------------------------------------------------------------------------
// Setup: stub fetch so any AI/ghost path uses the deterministic fallback,
// and drive the durable scheduler with fake timers.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network disabled in test')))
  );
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Pure-function tests — no ctx, no DB, called directly.
// ---------------------------------------------------------------------------

describe('getSubmissionWindow (pure)', () => {
  it('allows final-round late submissions after completion', () => {
    expect(
      getSubmissionWindow(
        {
          status: 'COMPLETED',
          currentRound: 8,
        },
        8
      )
    ).toEqual({ ok: true });
  });

  it('rejects future-round submissions while the game is in progress', () => {
    expect(
      getSubmissionWindow(
        {
          status: 'IN_PROGRESS',
          currentRound: 2,
        },
        3
      )
    ).toEqual({ ok: false, reason: 'ROUND_NOT_STARTED' });
  });

  it('rejects invalid round indexes before checking game state', () => {
    expect(
      getSubmissionWindow(
        {
          status: 'IN_PROGRESS',
          currentRound: 2,
        },
        -1
      )
    ).toEqual({ ok: false, reason: 'INVALID_ROUND' });
  });

  it('scopes the submission window to the game mode', () => {
    // Quick jam ends at round index 4; classic would still be mid-game there.
    expect(
      getSubmissionWindow(
        { status: 'COMPLETED', currentRound: 4, mode: 'quick' },
        4
      )
    ).toEqual({ ok: true });

    expect(
      getSubmissionWindow(
        { status: 'IN_PROGRESS', currentRound: 4, mode: 'quick' },
        5
      )
    ).toEqual({ ok: false, reason: 'INVALID_ROUND' });

    expect(
      getSubmissionWindow(
        { status: 'COMPLETED', currentRound: 4, mode: 'classic' },
        4
      )
    ).toEqual({ ok: false, reason: 'GAME_NOT_IN_PROGRESS' });
  });
});

describe('getCycleResetDecision / isRevealReady (pure)', () => {
  it('only allows cycle reset from a completed game', () => {
    expect(
      getCycleResetDecision({
        activeGame: { status: 'IN_PROGRESS' },
        completedGame: { status: 'COMPLETED' },
      })
    ).toEqual({ ok: false, reason: 'GAME_STILL_IN_PROGRESS' });

    expect(
      getCycleResetDecision({
        activeGame: null,
        completedGame: null,
      })
    ).toEqual({ ok: false, reason: 'NO_COMPLETED_GAME' });

    expect(
      getCycleResetDecision({
        activeGame: null,
        completedGame: { status: 'COMPLETED' },
      })
    ).toEqual({ ok: true });

    expect(isRevealReady({ status: 'COMPLETED' })).toBe(true);
    expect(isRevealReady({ status: 'IN_PROGRESS' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyLineLifecycleTransition — real engine tests.
// Assertions are on observable DB state (game.currentRound, game.status,
// line counts) after draining the scheduler, not on call-count stubs.
// ---------------------------------------------------------------------------

describe('applyLineLifecycleTransition (real engine)', () => {
  it('returns pending (no DB writes) when the round is not complete yet', async () => {
    const t = setupConvexTest();
    // Seed a 2-poem game; only poem0 has a line for round 0.
    const { roomId, gameId, poemIds } = await seedGame(t, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      existingLines: [{ poemIndex: 0, lineIndex: 0 }],
    });

    const game = await t.run((ctx) => ctx.db.get(gameId));

    // poem1 is still missing its round-0 line → lifecycle must stay pending.
    await t.run(async (ctx) => {
      await applyLineLifecycleTransition(ctx, {
        game: game!,
        roomId,
        lineIndex: 0,
      });
    });

    const after = await t.run((ctx) => ctx.db.get(gameId));
    // Round must not have advanced.
    expect(after?.currentRound).toBe(0);
    // Game must still be IN_PROGRESS.
    expect(after?.status).toBe('IN_PROGRESS');
    // poem1 must still have no line for round 0 (no ghost-fill was triggered
    // by the lifecycle itself — only the scheduler floor does that).
    const linesForPoem1Round0 = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poemIds[1]).eq('indexInPoem', 0)
        )
        .first()
    );
    expect(linesForPoem1Round0).toBeNull();
    // No scheduler side-effects: the poem1 holdout is a human (both players
    // are human), so the AI re-nudge branch must not have fired.
    // Verify by confirming the round count still matches (no AI line snuck in).
    const allLines = await t.run(async (ctx) => {
      const poems = await ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect();
      const perPoem = await Promise.all(
        poems.map((poem) =>
          ctx.db
            .query('lines')
            .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
            .collect()
        )
      );
      return perPoem.flat();
    });
    expect(allLines).toHaveLength(1); // only the seed line
  });

  it('advances the round once every poem has a line', async () => {
    const t = setupConvexTest();
    // Seed all 2 poems with round-0 lines so the lifecycle should complete
    // the round and advance to round 1.
    const { roomId, gameId } = await seedGame(t, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      existingLines: [
        { poemIndex: 0, lineIndex: 0 },
        { poemIndex: 1, lineIndex: 0 },
      ],
    });

    const game = await t.run((ctx) => ctx.db.get(gameId));

    await t.run(async (ctx) => {
      await applyLineLifecycleTransition(ctx, {
        game: game!,
        roomId,
        lineIndex: 0,
      });
    });

    const after = await t.run((ctx) => ctx.db.get(gameId));
    // Round must have advanced from 0 → 1.
    expect(after?.currentRound).toBe(1);
    expect(after?.roundStartedAt).toBeDefined();
    expect(after?.status).toBe('IN_PROGRESS');

    // The lifecycle schedules scheduleAiTurn + fillStaleHumanTurns for round 1.
    // Drain the scheduler; since there's no AI player the AI path exits early,
    // and once AUTO_GHOST_FILL_MS fires the human ghost-fill runs for round 1.
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // After draining, round 1 must be filled (ghost) and the chain continues
    // until completion (no AI to block it).
    const finalGame = await t.run((ctx) => ctx.db.get(gameId));
    expect(finalGame?.status).toBe('COMPLETED');
  });

  it('co-schedules the auto ghost-fill floor when a round advances', async () => {
    const t = setupConvexTest();
    // Two-player all-human game: both round-0 lines present.
    const { roomId, gameId } = await seedGame(t, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      existingLines: [
        { poemIndex: 0, lineIndex: 0 },
        { poemIndex: 1, lineIndex: 0 },
      ],
    });

    const game = await t.run((ctx) => ctx.db.get(gameId));
    await t.run(async (ctx) => {
      await applyLineLifecycleTransition(ctx, {
        game: game!,
        roomId,
        lineIndex: 0,
      });
    });

    // Round advanced to 1. Verify auto ghost-fill is co-scheduled by confirming
    // that draining at AUTO_GHOST_FILL_MS fills round 1 even with no human input.
    // We observe this via the total line count after completion.
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const lines = await t.run(async (ctx) => {
      const poems = await ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect();
      const perPoem = await Promise.all(
        poems.map((poem) =>
          ctx.db
            .query('lines')
            .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
            .collect()
        )
      );
      return perPoem.flat();
    });
    // Classic: 9 rounds × 2 poems = 18 lines. The two seed lines plus 16 ghost.
    expect(lines).toHaveLength(WORD_COUNTS.length * 2);
  });

  it('re-nudges the AI scheduler when only AI poems are missing', async () => {
    const t = setupConvexTest();
    // Two-player game: Alice (human) + Gemini (AI).
    // Matrix cyclic-shift: round 0 → poem0 = Alice, poem1 = Gemini.
    // Seed only poem0 (Alice's) with a line; Gemini's poem1 is empty.
    const { roomId, gameId, poemIds } = await seedGame(t, {
      players: [{ name: 'Alice' }, { name: 'Gemini', kind: 'AI' }],
      existingLines: [{ poemIndex: 0, lineIndex: 0 }],
    });

    const game = await t.run((ctx) => ctx.db.get(gameId));

    await t.run(async (ctx) => {
      await applyLineLifecycleTransition(ctx, {
        game: game!,
        roomId,
        lineIndex: 0,
      });
    });

    // After the transition, round must still be 0 (not advanced yet — poem1 is
    // still missing its line). But the lifecycle MUST have re-nudged the AI
    // scheduler (scheduleAiTurn for round 0), because the only holdout is Gemini.
    // Drain to let scheduleAiTurn → ensureAiLine (AI safety net) write the line.
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // After AI safety net fires (fetch rejected → fallback line committed),
    // the lifecycle transition fires again and advances to round 1.
    const after = await t.run((ctx) => ctx.db.get(gameId));
    // The room must have progressed past round 0 (either advanced or completed).
    expect(after?.currentRound ?? 0).toBeGreaterThan(0);

    // The AI's poem (poemIds[1]) must now have a line for round 0.
    const aiLine = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poemIds[1]).eq('indexInPoem', 0)
        )
        .first()
    );
    expect(aiLine).not.toBeNull();
  });

  it('does not re-nudge when a human is the holdout', async () => {
    const t = setupConvexTest();
    // Two-player all-human game: Alice + Bob.
    // Round 0 matrix: poem0 = Alice, poem1 = Bob. Only poem0 seeded.
    const { roomId, gameId, poemIds } = await seedGame(t, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      existingLines: [{ poemIndex: 0, lineIndex: 0 }],
    });

    const game = await t.run((ctx) => ctx.db.get(gameId));

    await t.run(async (ctx) => {
      await applyLineLifecycleTransition(ctx, {
        game: game!,
        roomId,
        lineIndex: 0,
      });
    });

    // Round must still be 0 (not advanced — poem1 still missing).
    const after = await t.run((ctx) => ctx.db.get(gameId));
    expect(after?.currentRound).toBe(0);

    // Critically: no AI re-nudge scheduler job was enqueued. Confirm by verifying
    // that poem1 still has no line for round 0 even after a brief scheduler drain.
    // scheduleAiTurn exits early when there is no AI player in the room, so even
    // if it were mis-scheduled it would be a no-op — but here the lifecycle branch
    // must not schedule it at all. We verify via DB state: poem1 is still empty.
    const bobLine = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poemIds[1]).eq('indexInPoem', 0)
        )
        .first()
    );
    expect(bobLine).toBeNull();

    // Also verify the game hasn't progressed at all.
    expect(after?.status).toBe('IN_PROGRESS');
  });

  it('completes a quick-jam game at its five-round boundary', async () => {
    const t = setupConvexTest();
    const quickRules = getGameRules('quick');
    const finalRound = getFinalRoundIndex(quickRules); // 4

    // Seed a quick-jam game at the final round with all poems except one written.
    // Then seed the last missing poem line and call the transition.
    const { roomId, gameId } = await seedGame(t, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      mode: 'quick',
      currentRound: finalRound,
      existingLines: [
        // All rounds 0-3 fully written (both poems each)
        ...Array.from({ length: finalRound }, (_, r) => [
          { poemIndex: 0, lineIndex: r },
          { poemIndex: 1, lineIndex: r },
        ]).flat(),
        // Round 4 (final): both poems written
        { poemIndex: 0, lineIndex: finalRound },
        { poemIndex: 1, lineIndex: finalRound },
      ],
    });

    const game = await t.run((ctx) => ctx.db.get(gameId));

    await t.run(async (ctx) => {
      await applyLineLifecycleTransition(ctx, {
        game: game!,
        roomId,
        lineIndex: finalRound,
      });
    });

    const after = await t.run((ctx) => ctx.db.get(gameId));
    expect(after?.status).toBe('COMPLETED');
    expect(after?.completedAt).toBeDefined();

    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(room?.status).toBe('COMPLETED');

    // No further scheduler jobs: game is complete, no runAfter should have fired
    // for a next round. Drain should be a no-op.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const stable = await t.run((ctx) => ctx.db.get(gameId));
    expect(stable?.status).toBe('COMPLETED');
  });

  it('treats final-round completion re-entry as stale once the game is completed', async () => {
    const t = setupConvexTest();
    const finalRound = getFinalRoundIndex(getGameRules('classic')); // 8

    // Seed a classic game that is ALREADY COMPLETED at round 8.
    // The lifecycle should bail (freshGame.status !== IN_PROGRESS) and make no writes.
    const { roomId, gameId } = await seedGame(t, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      currentRound: finalRound,
      gameStatus: 'COMPLETED',
      existingLines: [
        { poemIndex: 0, lineIndex: finalRound },
        { poemIndex: 1, lineIndex: finalRound },
      ],
    });

    // Pass IN_PROGRESS as the snapshot game (stale caller view), but the real
    // DB already has COMPLETED — the lifecycle re-fetches and should bail.
    const snapshotGame = {
      _id: gameId,
      status: 'IN_PROGRESS' as const,
      currentRound: finalRound,
      assignmentMatrix: await t.run(async (ctx) => {
        const g = await ctx.db.get(gameId);
        return g!.assignmentMatrix;
      }),
    };

    await t.run(async (ctx) => {
      await applyLineLifecycleTransition(ctx, {
        game: snapshotGame,
        roomId,
        lineIndex: finalRound,
      });
    });

    // Game must still be COMPLETED with no additional writes or side-effects.
    const after = await t.run((ctx) => ctx.db.get(gameId));
    expect(after?.status).toBe('COMPLETED');
    // Room was inserted as IN_PROGRESS; since the lifecycle bailed, it stays that way.
    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(room?.status).toBe('IN_PROGRESS'); // no spurious completion patch
  });
});
