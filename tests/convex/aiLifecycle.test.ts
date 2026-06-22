import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { WORD_COUNTS } from '../../convex/lib/gameRules';
import { getFallbackLine } from '../../convex/lib/ai/fallbacks';
import { type T, getAllLines } from '../helpers/convexSeed';

/**
 * AI lifecycle integration tests on the real convex-test engine (backlog 018
 * / slice 014 groundwork). Replaces the mock-DB approach with real DB +
 * scheduler so every assertion reflects observable DB state instead of
 * stub-call counts.
 *
 * The only mocked boundary is the external OpenRouter fetch — stubbed to
 * reject so tests are deterministic and network-free (same pattern as
 * abandonment.test.ts). Because OPENROUTER_API_KEY is absent in the test
 * environment, generateLineForRound / generateGhostLine always take the
 * no-API-key fallback path anyway; the fetch stub is a belt-and-suspenders
 * guard in case a future env change leaks a key into tests.
 */

// ─── Seed helpers ─────────────────────────────────────────────────────────────

type SeedPlayer = {
  name: string;
  kind?: 'AI' | 'human';
  clerkUserId?: string;
  aiPersonaId?: string;
  lastSeenAt?: number;
};

type Seeded = {
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  userIds: Id<'users'>[];
  poemIds: Id<'poems'>[];
  /** Deterministic cyclic-shift assignment matrix (same as abandonment.test.ts). */
  matrix: Id<'users'>[][];
};

/**
 * Seed an IN_PROGRESS classic game bypassing auth/lobby plumbing.
 * Assignment matrix: cyclic shift (player i writes poem (i+r) % n in round r).
 */
async function seedClassicGame(
  t: T,
  opts: {
    players: SeedPlayer[];
    currentRound?: number;
    roundStartedAt?: number;
    createdAt?: number;
  }
): Promise<Seeded> {
  const createdAt = opts.createdAt ?? Date.now();
  const currentRound = opts.currentRound ?? 0;
  const rounds = WORD_COUNTS.length; // 9 for classic

  return t.run(async (ctx) => {
    const userIds: Id<'users'>[] = [];
    for (const p of opts.players) {
      userIds.push(
        await ctx.db.insert('users', {
          displayName: p.name,
          kind: p.kind ?? 'human',
          ...(p.clerkUserId ? { clerkUserId: p.clerkUserId } : {}),
          ...(p.aiPersonaId ? { aiPersonaId: p.aiPersonaId } : {}),
          createdAt,
        })
      );
    }

    const roomId = await ctx.db.insert('rooms', {
      code: `R${Math.floor(Math.random() * 9000) + 1000}`,
      hostUserId: userIds[0],
      status: 'IN_PROGRESS',
      createdAt,
    });

    await Promise.all(
      opts.players.map((p, i) =>
        ctx.db.insert('roomPlayers', {
          roomId,
          userId: userIds[i],
          displayName: p.name,
          seatIndex: i,
          joinedAt: createdAt,
          lastSeenAt: p.lastSeenAt,
        })
      )
    );

    const n = userIds.length;
    const matrix: Id<'users'>[][] = [];
    for (let r = 0; r < rounds; r++) {
      matrix.push(
        Array.from({ length: n }, (_, poem) => userIds[(poem + r) % n])
      );
    }

    const gameId = await ctx.db.insert('games', {
      roomId,
      status: 'IN_PROGRESS',
      cycle: 1,
      mode: 'classic',
      currentRound,
      roundStartedAt: opts.roundStartedAt ?? createdAt,
      assignmentMatrix: matrix,
      createdAt,
    });

    const poemIds: Id<'poems'>[] = [];
    for (let i = 0; i < n; i++) {
      poemIds.push(
        await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: i,
          createdAt,
        })
      );
    }

    return { roomId, gameId, userIds, poemIds, matrix };
  });
}

// ─── Test lifecycle ────────────────────────────────────────────────────────────

beforeEach(() => {
  // Belt-and-suspenders: stub OpenRouter offline. In practice the test env has
  // no OPENROUTER_API_KEY, so the action code already falls back before fetch.
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

// ─── commitAiLine ─────────────────────────────────────────────────────────────

describe('commitAiLine', () => {
  it('does not double-advance when a concurrent mutation already moved the round', async () => {
    // Seed a 2-player game at round 0, with a human at seat 0 and AI at seat 1.
    // The matrix assigns: round 0 → [human, ai], round 1 → [ai, human].
    // We manually seed lines for BOTH poems at round 0 to simulate that the
    // lifecycle already advanced to round 1 before commitAiLine fires.
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [
          { name: 'Human' },
          { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
        ],
        currentRound: 1, // already advanced
      }
    );

    const humanId = userIds[0];
    const aiId = userIds[1];

    // In round 0: poem 0 → human, poem 1 → AI (cyclic shift 0).
    // Pre-seed a line for poem 0 (human's poem at round 0) so round 0 is fully
    // filled. The game is at round 1, so commitAiLine for round 0 is a late arrival.
    const humanPoem0 = poemIds[matrix[0].indexOf(humanId)];
    const aiPoem0 = poemIds[matrix[0].indexOf(aiId)];

    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: humanPoem0,
        indexInPoem: 0,
        text: getFallbackLine(WORD_COUNTS[0]),
        wordCount: WORD_COUNTS[0],
        authorUserId: humanId,
        createdAt: Date.now(),
      })
    );

    // commitAiLine for round 0, poem assigned to AI. Submission window allows
    // past rounds, so the line should be inserted (late arrival). But the round
    // must NOT advance again (already at 1).
    await t.mutation(internal.ai.commitAiLine, {
      poemId: aiPoem0,
      lineIndex: 0,
      text: getFallbackLine(WORD_COUNTS[0]),
      aiUserId: aiId,
      roomId,
      gameId,
    });

    // The AI line landed as a late arrival.
    const aiLine = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', aiPoem0).eq('indexInPoem', 0)
        )
        .first()
    );
    expect(aiLine).not.toBeNull();
    expect(aiLine?.text).toBe(getFallbackLine(WORD_COUNTS[0]));

    // Round must remain at 1 — lifecycle must NOT advance it to 2.
    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.currentRound).toBe(1);
    expect(game?.status).toBe('IN_PROGRESS');
  });

  it('marks the game and room completed on the final round', async () => {
    // Seed at round 8 (the final round of classic). Pre-fill all 8 earlier
    // rounds and all of the last round except the AI poem, then commit the AI
    // line for round 8 and expect COMPLETED.
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [
          { name: 'Human' },
          { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
        ],
        currentRound: 8,
      }
    );

    const humanId = userIds[0];
    const aiId = userIds[1];

    // Fill ALL lines except the AI's line at round 8.
    await t.run(async (ctx) => {
      for (let round = 0; round < WORD_COUNTS.length; round++) {
        for (let poem = 0; poem < poemIds.length; poem++) {
          const assignedUser = matrix[round][poem];
          // Skip the AI's line at the final round — that's what we're testing.
          if (round === 8 && assignedUser === aiId) continue;
          await ctx.db.insert('lines', {
            poemId: poemIds[poem],
            indexInPoem: round,
            text: getFallbackLine(WORD_COUNTS[round]),
            wordCount: WORD_COUNTS[round],
            authorUserId: assignedUser,
            createdAt: Date.now(),
          });
        }
      }
    });

    const aiPoem8 = poemIds[matrix[8].indexOf(aiId)];

    await t.mutation(internal.ai.commitAiLine, {
      poemId: aiPoem8,
      lineIndex: 8,
      text: getFallbackLine(WORD_COUNTS[8]),
      aiUserId: aiId,
      roomId,
      gameId,
    });

    const game = await t.run((ctx) => ctx.db.get(gameId));
    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(game?.status).toBe('COMPLETED');
    expect(room?.status).toBe('COMPLETED');
    expect(game?.completedAt).toBeDefined();

    // Every poem has an assigned reader.
    const poems = await t.run((ctx) =>
      ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect()
    );
    expect(poems.every((p) => p.assignedReaderId !== undefined)).toBe(true);

    // Assigned reader must be a human (the one human in this game).
    expect(poems.every((p) => p.assignedReaderId === humanId)).toBe(true);
  });

  it('treats duplicate submissions as a no-op', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [
          { name: 'Human' },
          { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
        ],
        currentRound: 0,
      }
    );

    const aiId = userIds[1];
    const aiPoem = poemIds[matrix[0].indexOf(aiId)];

    // First submission.
    await t.mutation(internal.ai.commitAiLine, {
      poemId: aiPoem,
      lineIndex: 0,
      text: getFallbackLine(WORD_COUNTS[0]),
      aiUserId: aiId,
      roomId,
      gameId,
    });

    // Second (duplicate) submission — same (poem, round).
    await t.mutation(internal.ai.commitAiLine, {
      poemId: aiPoem,
      lineIndex: 0,
      text: 'different text',
      aiUserId: aiId,
      roomId,
      gameId,
    });

    // Exactly one line must exist — the first write wins.
    const lines = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', aiPoem).eq('indexInPoem', 0)
        )
        .collect()
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe(getFallbackLine(WORD_COUNTS[0]));
  });
});

// ─── ensureAiLine (safety net) ────────────────────────────────────────────────

describe('ensureAiLine (safety net)', () => {
  it('commits a fallback line when the AI turn never landed', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [
          { name: 'Human' },
          { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
        ],
        currentRound: 0,
      }
    );

    const aiId = userIds[1];
    const aiPoem = poemIds[matrix[0].indexOf(aiId)];

    // No line exists yet — ensureAiLine should commit the fallback.
    await t.mutation(internal.ai.ensureAiLine, {
      roomId,
      gameId,
      round: 0,
    });

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', aiPoem).eq('indexInPoem', 0)
        )
        .first()
    );
    expect(line).not.toBeNull();
    expect(line?.text).toBe(getFallbackLine(WORD_COUNTS[0]));
    expect(line?.authorUserId).toBe(aiId);
    expect(line?.authorDisplayName).toBe('Bot');
  });

  it('does nothing when the AI line already exists', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [
          { name: 'Human' },
          { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
        ],
        currentRound: 0,
      }
    );

    const aiId = userIds[1];
    const aiPoem = poemIds[matrix[0].indexOf(aiId)];

    // Pre-seed the AI line.
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: aiPoem,
        indexInPoem: 0,
        text: 'already written',
        wordCount: WORD_COUNTS[0],
        authorUserId: aiId,
        createdAt: Date.now(),
      })
    );

    await t.mutation(internal.ai.ensureAiLine, { roomId, gameId, round: 0 });

    // Still exactly one line — no duplicate inserted.
    const lines = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', aiPoem).eq('indexInPoem', 0)
        )
        .collect()
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('already written');
  });

  it('does nothing once the game is no longer in progress', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: [
        { name: 'Human' },
        { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
      ],
      currentRound: 8,
    });

    // Mark game COMPLETED.
    await t.run((ctx) =>
      ctx.db.patch(gameId, { status: 'COMPLETED', completedAt: Date.now() })
    );
    await t.run((ctx) =>
      ctx.db.patch(roomId, { status: 'COMPLETED', completedAt: Date.now() })
    );

    await t.mutation(internal.ai.ensureAiLine, { roomId, gameId, round: 8 });

    // No lines should have been inserted.
    const lines = await getAllLines(t, gameId);
    expect(lines).toHaveLength(0);
  });

  it('does nothing for a round that has not opened yet', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: [
        { name: 'Human' },
        { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
      ],
      currentRound: 3,
    });

    // Round 5 is ahead of currentRound 3 → safety net must skip.
    await t.mutation(internal.ai.ensureAiLine, { roomId, gameId, round: 5 });

    const lines = await getAllLines(t, gameId);
    expect(lines).toHaveLength(0);
  });

  it('does nothing when the room has no AI player', async () => {
    const t = setupConvexTest();
    // Both players are human — no AI in the room.
    const { gameId, roomId } = await seedClassicGame(t, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      currentRound: 0,
    });

    await t.mutation(internal.ai.ensureAiLine, { roomId, gameId, round: 0 });

    const lines = await getAllLines(t, gameId);
    expect(lines).toHaveLength(0);
  });
});

// ─── commitGhostLine ──────────────────────────────────────────────────────────

describe('commitGhostLine', () => {
  it('bylines the line as "<name> (ghost)" while keeping the matrix attribution', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [{ name: 'Alice' }, { name: 'Bob' }],
        currentRound: 0,
      }
    );

    const aliceId = userIds[0];
    const alicePoem = poemIds[matrix[0].indexOf(aliceId)];

    await t.mutation(internal.ai.commitGhostLine, {
      poemId: alicePoem,
      lineIndex: 0,
      text: 'moonlight',
      forUserId: aliceId,
      roomId,
      gameId,
    });

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', alicePoem).eq('indexInPoem', 0)
        )
        .first()
    );
    expect(line).not.toBeNull();
    // Attribution stays on the original human; display name gets the ghost suffix.
    expect(line?.authorUserId).toBe(aliceId);
    expect(line?.authorDisplayName).toBe('Alice (ghost)');
    // Word count mismatch → fallback substitution ('moonlight' = 1 word = correct for round 0)
    expect(line?.text).toBe('moonlight');
  });
});

// ─── generateLineForRound (action, fallback path) ────────────────────────────

describe('generateLineForRound (action, fallback path)', () => {
  it('commits a fallback line via commitAiLine when no API key is set', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [
          { name: 'Human' },
          { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
        ],
        currentRound: 2,
      }
    );

    // Pre-fill rounds 0 and 1 so the lifecycle is actually at round 2.
    await t.run(async (ctx) => {
      for (let r = 0; r < 2; r++) {
        for (let p = 0; p < poemIds.length; p++) {
          await ctx.db.insert('lines', {
            poemId: poemIds[p],
            indexInPoem: r,
            text: getFallbackLine(WORD_COUNTS[r]),
            wordCount: WORD_COUNTS[r],
            authorUserId: matrix[r][p],
            createdAt: Date.now(),
          });
        }
      }
    });

    const aiId = userIds[1];
    const aiPoem = poemIds[matrix[2].indexOf(aiId)];

    await t.action(internal.ai.generateLineForRound, {
      roomId,
      gameId,
      round: 2,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', aiPoem).eq('indexInPoem', 2)
        )
        .first()
    );
    expect(line).not.toBeNull();
    expect(line?.authorUserId).toBe(aiId);
    // Fallback text (WORD_COUNTS[2] = 3 words).
    expect(line?.text).toBe(getFallbackLine(WORD_COUNTS[2]));
  });

  it('bails out when the game is no longer in progress', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: [
        { name: 'Human' },
        { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
      ],
      currentRound: 8,
    });

    await t.run((ctx) =>
      ctx.db.patch(gameId, { status: 'COMPLETED', completedAt: Date.now() })
    );
    await t.run((ctx) =>
      ctx.db.patch(roomId, { status: 'COMPLETED', completedAt: Date.now() })
    );

    await t.action(internal.ai.generateLineForRound, {
      roomId,
      gameId,
      round: 8,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const lines = await getAllLines(t, gameId);
    expect(lines).toHaveLength(0);
  });

  it('bails out when no AI player is in the room', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      currentRound: 0,
    });

    await t.action(internal.ai.generateLineForRound, {
      roomId,
      gameId,
      round: 0,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const lines = await getAllLines(t, gameId);
    expect(lines).toHaveLength(0);
  });
});

// ─── generateGhostLine (action, fallback path) ───────────────────────────────

describe('generateGhostLine (action, fallback path)', () => {
  it('commits a ghost line via commitGhostLine when no API key is set', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [{ name: 'Alice' }, { name: 'Bob' }],
        currentRound: 2,
      }
    );

    // Pre-fill rounds 0 and 1.
    await t.run(async (ctx) => {
      for (let r = 0; r < 2; r++) {
        for (let p = 0; p < poemIds.length; p++) {
          await ctx.db.insert('lines', {
            poemId: poemIds[p],
            indexInPoem: r,
            text: getFallbackLine(WORD_COUNTS[r]),
            wordCount: WORD_COUNTS[r],
            authorUserId: matrix[r][p],
            createdAt: Date.now(),
          });
        }
      }
    });

    const aliceId = userIds[0];
    const alicePoem = poemIds[matrix[2].indexOf(aliceId)];

    await t.action(internal.ai.generateGhostLine, {
      roomId,
      gameId,
      round: 2,
      poemId: alicePoem,
      forUserId: aliceId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', alicePoem).eq('indexInPoem', 2)
        )
        .first()
    );
    expect(line).not.toBeNull();
    expect(line?.authorUserId).toBe(aliceId);
    expect(line?.authorDisplayName).toBe('Alice (ghost)');
    expect(line?.text).toBe(getFallbackLine(WORD_COUNTS[2]));
  });

  it('does nothing when the stalled turn was already filled', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [{ name: 'Alice' }, { name: 'Bob' }],
        currentRound: 2,
      }
    );

    const aliceId = userIds[0];
    const alicePoem = poemIds[matrix[2].indexOf(aliceId)];

    // Pre-fill round 2 for Alice — she already submitted.
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: alicePoem,
        indexInPoem: 2,
        text: getFallbackLine(WORD_COUNTS[2]),
        wordCount: WORD_COUNTS[2],
        authorUserId: aliceId,
        createdAt: Date.now(),
      })
    );

    await t.action(internal.ai.generateGhostLine, {
      roomId,
      gameId,
      round: 2,
      poemId: alicePoem,
      forUserId: aliceId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // Still exactly one line — the ghost must not overwrite.
    const lines = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', alicePoem).eq('indexInPoem', 2)
        )
        .collect()
    );
    expect(lines).toHaveLength(1);
    // The original (non-ghost) line is preserved.
    expect(lines[0].authorDisplayName).toBeUndefined();
  });

  it('does nothing when the round has moved on', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [{ name: 'Alice' }, { name: 'Bob' }],
        currentRound: 5,
      }
    );

    const aliceId = userIds[0];
    const alicePoem = poemIds[matrix[2].indexOf(aliceId)];

    // Invoke generateGhostLine for round 2, but the game is at round 5.
    // generateGhostLine guards: game.currentRound !== round → bail.
    await t.action(internal.ai.generateGhostLine, {
      roomId,
      gameId,
      round: 2,
      poemId: alicePoem,
      forUserId: aliceId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', alicePoem).eq('indexInPoem', 2)
        )
        .first()
    );
    // No ghost line written for the stale round.
    expect(line).toBeNull();
  });
});
