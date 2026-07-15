import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import {
  GHOSTWRITER_OVERTIME_MS,
  WORD_COUNTS,
} from '../../convex/lib/gameRules';
import { getFallbackLine } from '../../convex/lib/ai/fallbacks';
import { countWords } from '../../convex/lib/wordCount';
import { type T, getAllLines, seedUser } from '../helpers/convexSeed';
import { signGuestToken } from '../../lib/guestToken';
import {
  ABUSE_RATE_LIMITS,
  guestBucketRateLimitKey,
} from '../../convex/lib/abuseRateLimit';

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
 * guard and exercises the provider-error path when the harness supplies a key.
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

async function seedExhaustedGuestBucket(
  t: T,
  operation: 'addAiPlayer',
  bucket: string
) {
  await t.run((ctx) =>
    ctx.db.insert('rateLimits', {
      key: guestBucketRateLimitKey(operation, bucket),
      hits: ABUSE_RATE_LIMITS[operation].bucketMax,
      resetTime: Date.now() + ABUSE_RATE_LIMITS[operation].windowMs,
    })
  );
}

// ─── Test lifecycle ────────────────────────────────────────────────────────────

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.AI_DAILY_CALL_BUDGET;
  delete process.env.AI_DAILY_CALL_ALERT_THRESHOLD;
  delete process.env.AI_DAILY_COST_BUDGET_USD;
  delete process.env.AI_ESTIMATED_COST_PER_GENERATION_USD;
  delete process.env.AI_FALLBACK_ALERT_THRESHOLD_PERCENT;
  delete process.env.AI_FALLBACK_ALERT_MIN_GENERATIONS;
  delete process.env.LINEJAM_AI_DETERMINISTIC;
  delete process.env.CANARY_API_KEY;
  delete process.env.CANARY_ENDPOINT;
  // The only mocked seam is the external provider boundary.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network disabled in test')))
  );
  vi.useFakeTimers();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ─── addAiPlayer ─────────────────────────────────────────────────────────────

describe('addAiPlayer', () => {
  it('rate-limits guest hosts by signed network bucket before room lookup', async () => {
    const t = setupConvexTest();
    const bucket = 'guestSession:testAiBucket1234567890';
    const guestId = 'guest-ai-blocked';
    await seedUser(t, { displayName: 'Blocked Host', guestId });
    await seedExhaustedGuestBucket(t, 'addAiPlayer', bucket);
    const guestToken = await signGuestToken(guestId, {
      sessionId: 'session-ai-blocked',
      rateLimitKey: bucket,
    });

    await expect(
      t.mutation(api.ai.addAiPlayer, { code: 'NOPE', guestToken })
    ).rejects.toThrow('Rate limit exceeded');
  });
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
    expect(countWords(aiLine!.text)).toBe(WORD_COUNTS[0]);

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
    expect(countWords(lines[0].text)).toBe(WORD_COUNTS[0]);
  });

  it('substitutes fallback for multiline AI text before commit', async () => {
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

    const aiId = userIds[1];
    const aiPoem = poemIds[matrix[2].indexOf(aiId)];

    await t.mutation(internal.ai.commitAiLine, {
      poemId: aiPoem,
      lineIndex: 2,
      text: 'first line\nsecond third',
      aiUserId: aiId,
      roomId,
      gameId,
    });

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', aiPoem).eq('indexInPoem', 2)
        )
        .first()
    );
    expect(line).not.toBeNull();
    expect(line!.text).not.toContain('\n');
    expect(line!.text).not.toBe('first line second third');
    expect(countWords(line!.text)).toBe(WORD_COUNTS[2]);
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
    expect(countWords(line!.text)).toBe(WORD_COUNTS[0]);
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
  it('commits and classifies a fallback when the provider is unavailable', async () => {
    process.env.AI_DAILY_CALL_BUDGET = '10';
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

    await t.mutation(internal.ai.scheduleAiTurn, {
      roomId,
      gameId,
      round: 2,
    });
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
    expect(countWords(line!.text)).toBe(WORD_COUNTS[2]);

    const usage = await t.run((ctx) =>
      ctx.db
        .query('aiUsage')
        .withIndex('by_day', (q) =>
          q.eq('day', new Date().toISOString().slice(0, 10))
        )
        .first()
    );
    expect(usage?.generationClaims).toBe(1);
    expect(usage?.fallbacks).toBe(1);

    const metric = await t.run((ctx) =>
      ctx.db.query('aiGenerationMetrics').first()
    );
    expect(metric).toMatchObject({
      totalGenerations: 1,
      fallbackGenerations: 1,
      budgetExhaustion: 0,
      providerError: 1,
      invalidOutput: 0,
      missingConfiguration: 0,
    });
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

describe('AI fallback observability', () => {
  it('keeps the non-production capability drill bounded', async () => {
    const t = setupConvexTest();

    await expect(
      t.mutation(internal.ai.probeAiFallbackMonitor, { samples: 0 })
    ).rejects.toThrow(/between 1 and 25/);
    await expect(
      t.mutation(internal.ai.probeAiFallbackMonitor, { samples: 26 })
    ).rejects.toThrow(/between 1 and 25/);

    const result = await t.mutation(internal.ai.probeAiFallbackMonitor, {
      samples: 3,
    });
    const metric = await t.run((ctx) =>
      ctx.db.query('aiGenerationMetrics').first()
    );
    expect(metric?.totalGenerations).toBe(3);
    expect(metric?.fallbackGenerations).toBe(
      result.aiLineGenerationAvailable ? 0 : 3
    );
  });

  it('aggregates every reason and emits one privacy-safe Canary event per fallback', async () => {
    process.env.CANARY_API_KEY = 'test-canary-key';
    process.env.CANARY_ENDPOINT = 'https://canary.test';
    process.env.AI_FALLBACK_ALERT_MIN_GENERATIONS = '1';
    process.env.AI_FALLBACK_ALERT_THRESHOLD_PERCENT = '80';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });
    vi.stubGlobal('fetch', fetchMock);
    const t = setupConvexTest();
    const reasons = [
      'budget_exhaustion',
      'provider_error',
      'invalid_output',
      'missing_configuration',
    ] as const;

    for (const fallbackReason of reasons) {
      await t.mutation(internal.ai.recordAiGenerationOutcome, {
        fallbackReason,
      });
    }
    await t.mutation(internal.ai.recordAiGenerationOutcome, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const metric = await t.run((ctx) =>
      ctx.db.query('aiGenerationMetrics').first()
    );
    expect(metric).toMatchObject({
      totalGenerations: 5,
      fallbackGenerations: 4,
      budgetExhaustion: 1,
      providerError: 1,
      invalidOutput: 1,
      missingConfiguration: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);

    const payloads = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(init.body)
    );
    expect(
      payloads.slice(0, 4).map((payload) => payload.context.fallbackReason)
    ).toEqual(reasons);
    expect(
      payloads.slice(0, 4).every((payload) => payload.status === 'error')
    ).toBe(true);
    expect(payloads[4]).toMatchObject({
      status: 'ok',
      context: {
        totalGenerations: 5,
        fallbackGenerations: 4,
        fallbackRatePercent: 80,
      },
    });
    expect(
      payloads.every(
        (payload) => payload.monitor === 'linejam-ai-fallback-rate'
      )
    ).toBe(true);
    for (const payload of payloads) {
      expect(Object.keys(payload.context)).not.toEqual(
        expect.arrayContaining([
          'poemId',
          'roomId',
          'guestId',
          'text',
          'userId',
        ])
      );
    }
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
    expect(countWords(line!.text)).toBe(WORD_COUNTS[2]);
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

  it('shares one atomic cell claim across automatic and host scheduling', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, poemIds, matrix } = await seedClassicGame(t, {
      players: [
        { name: 'Host', clerkUserId: 'clerk_ghostclaimhost' },
        { name: 'Guest', clerkUserId: 'clerk_ghostclaimguest' },
      ],
      currentRound: 0,
      roundStartedAt: Date.now() - GHOSTWRITER_OVERTIME_MS - 1_000,
    });
    const roomCode = await t.run((ctx) =>
      ctx.db.get(roomId).then((r) => r!.code)
    );

    // Leave exactly one cell open so both schedulers target the same cell.
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: poemIds[1],
        indexInPoem: 0,
        text: 'already',
        wordCount: WORD_COUNTS[0],
        authorUserId: matrix[0][1],
        createdAt: Date.now(),
      })
    );

    await Promise.all([
      t.mutation(internal.game.fillStaleHumanTurns, {
        roomId,
        gameId,
        round: 0,
      }),
      t
        .withIdentity({ subject: 'clerk_ghostclaimhost' })
        .mutation(api.game.summonGhostwriter, { roomCode }),
    ]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const usage = await t.run((ctx) =>
      ctx.db
        .query('aiUsage')
        .withIndex('by_day', (q) =>
          q.eq('day', new Date().toISOString().slice(0, 10))
        )
        .first()
    );
    const turns = await t.run((ctx) =>
      ctx.db
        .query('aiTurns')
        .withIndex('by_cell', (q) => q.eq('poemId', poemIds[0]).eq('round', 0))
        .collect()
    );
    const allTurns = await t.run((ctx) => ctx.db.query('aiTurns').collect());
    const cellKeys = new Set(
      allTurns.map((turn) => `${turn.poemId}:${turn.round}`)
    );

    expect(usage?.generationClaims).toBe(allTurns.length);
    expect(cellKeys.size).toBe(allTurns.length);
    expect(turns).toHaveLength(1);
  });

  it('uses a deterministic fallback without a provider attempt when the global budget is zero', async () => {
    process.env.AI_DAILY_CALL_BUDGET = '0';
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: [{ name: 'Alice' }, { name: 'Bob' }], currentRound: 0 }
    );

    await t.action(internal.ai.generateGhostLine, {
      roomId,
      gameId,
      round: 0,
      poemId: poemIds[matrix[0].indexOf(userIds[0])],
      forUserId: userIds[0],
    });

    const usage = await t.run((ctx) =>
      ctx.db
        .query('aiUsage')
        .withIndex('by_day', (q) =>
          q.eq('day', new Date().toISOString().slice(0, 10))
        )
        .first()
    );
    const turns = await t.run((ctx) =>
      ctx.db
        .query('aiTurns')
        .withIndex('by_cell', (q) =>
          q.eq('poemId', poemIds[matrix[0].indexOf(userIds[0])]).eq('round', 0)
        )
        .collect()
    );

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(usage?.generationClaims ?? 0).toBe(0);
    expect(usage?.fallbacks).toBe(1);
    expect(turns).toHaveLength(1);
    expect(turns[0].status).toBe('budget_fallback');

    const metric = await t.run((ctx) =>
      ctx.db.query('aiGenerationMetrics').first()
    );
    expect(metric).toMatchObject({
      totalGenerations: 1,
      fallbackGenerations: 1,
      budgetExhaustion: 1,
      providerError: 0,
      invalidOutput: 0,
      missingConfiguration: 0,
    });
  });

  it('does not consume a second claim for a duplicate generation attempt', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: [{ name: 'Alice' }, { name: 'Bob' }], currentRound: 0 }
    );
    const poemId = poemIds[matrix[0].indexOf(userIds[0])];

    await t.action(internal.ai.generateGhostLine, {
      roomId,
      gameId,
      round: 0,
      poemId,
      forUserId: userIds[0],
    });
    await t.action(internal.ai.generateGhostLine, {
      roomId,
      gameId,
      round: 0,
      poemId,
      forUserId: userIds[0],
    });

    const usage = await t.run((ctx) =>
      ctx.db
        .query('aiUsage')
        .withIndex('by_day', (q) =>
          q.eq('day', new Date().toISOString().slice(0, 10))
        )
        .first()
    );
    expect(usage?.generationClaims).toBe(1);
  });

  it('recovers a claimed ghost cell through the bounded safety net', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: [{ name: 'Alice' }, { name: 'Bob' }], currentRound: 0 }
    );
    const poemId = poemIds[matrix[0].indexOf(userIds[0])];

    const claim = await t.mutation(internal.ai.claimGhostGeneration, {
      roomId,
      gameId,
      round: 0,
      poemId,
      forUserId: userIds[0],
    });
    expect(claim.status).toBe('authorized');

    // Simulate an action/provider crash after the claim. The claim-owned
    // scheduler must fill the cell without a second provider authorization.
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poemId).eq('indexInPoem', 0)
        )
        .first()
    );
    expect(line?.authorDisplayName).toBe('Alice (ghost)');
  });
});

// ─── Multi-bot (solo play) ────────────────────────────────────────────────────

describe('multi-bot scheduling (solo play)', () => {
  // 1 human + 3 bots. Cyclic-shift matrix at round 0: poem i → seat i, so the
  // human owns poem 0 and the three bots own poems 1, 2, 3 — three open AI cells.
  const SOLO_PLAYERS: SeedPlayer[] = [
    { name: 'Human' },
    { name: 'Bashō', kind: 'AI', aiPersonaId: 'bashō' },
    { name: 'Emily', kind: 'AI', aiPersonaId: 'dickinson' },
    { name: 'e.e.', kind: 'AI', aiPersonaId: 'cummings' },
  ];

  async function lineFor(t: T, poemId: Id<'poems'>, round: number) {
    return t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poemId).eq('indexInPoem', round)
        )
        .first()
    );
  }

  async function aiUsageForToday(t: T) {
    return t.run((ctx) =>
      ctx.db
        .query('aiUsage')
        .withIndex('by_day', (q) =>
          q.eq('day', new Date().toISOString().slice(0, 10))
        )
        .first()
    );
  }

  async function aiTurnsForRound(t: T, gameId: Id<'games'>, round: number) {
    return t.run((ctx) =>
      ctx.db
        .query('aiTurns')
        .withIndex('by_game_round', (q) =>
          q.eq('gameId', gameId).eq('round', round)
        )
        .collect()
    );
  }

  it('claims one paid generation per open bot cell and dedups re-nudges', async () => {
    process.env.AI_DAILY_CALL_BUDGET = '10';
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: SOLO_PLAYERS,
      currentRound: 0,
    });

    await t.mutation(internal.ai.scheduleAiTurn, { roomId, gameId, round: 0 });
    await t.mutation(internal.ai.scheduleAiTurn, { roomId, gameId, round: 0 });

    const usage = await aiUsageForToday(t);
    expect(usage?.generationClaims).toBe(3);
    expect(usage?.fallbacks).toBe(0);

    const turns = await aiTurnsForRound(t, gameId, 0);
    expect(turns).toHaveLength(3);
    expect(turns.every((turn) => turn.status === 'authorized')).toBe(true);
  });

  it('treats a blank daily budget env as the documented default', async () => {
    process.env.AI_DAILY_CALL_BUDGET = '   ';
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: SOLO_PLAYERS,
      currentRound: 0,
    });

    await t.mutation(internal.ai.scheduleAiTurn, { roomId, gameId, round: 0 });

    const usage = await aiUsageForToday(t);
    expect(usage?.generationClaims).toBe(3);
    expect(usage?.fallbacks).toBe(0);
  });

  it('commits deterministic fallbacks without generation claims when budget is zero', async () => {
    process.env.AI_DAILY_CALL_BUDGET = '0';
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: SOLO_PLAYERS, currentRound: 0 }
    );
    const aiIds = new Set([userIds[1], userIds[2], userIds[3]]);

    await t.mutation(internal.ai.scheduleAiTurn, { roomId, gameId, round: 0 });

    const usage = await aiUsageForToday(t);
    expect(usage?.generationClaims ?? 0).toBe(0);
    expect(usage?.fallbacks).toBe(3);

    for (let poem = 0; poem < poemIds.length; poem++) {
      const line = await lineFor(t, poemIds[poem], 0);
      if (aiIds.has(matrix[0][poem])) {
        expect(line).not.toBeNull();
        expect(countWords(line!.text)).toBe(WORD_COUNTS[0]);
        expect(line!.authorUserId).toBe(matrix[0][poem]);
      } else {
        expect(line).toBeNull();
      }
    }
  });

  it('enforces the daily budget atomically before scheduling paid cells', async () => {
    process.env.AI_DAILY_CALL_BUDGET = '1';
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: SOLO_PLAYERS, currentRound: 0 }
    );
    const aiIds = new Set([userIds[1], userIds[2], userIds[3]]);

    await t.mutation(internal.ai.scheduleAiTurn, { roomId, gameId, round: 0 });
    await t.mutation(internal.ai.scheduleAiTurn, { roomId, gameId, round: 0 });

    const usage = await aiUsageForToday(t);
    expect(usage?.generationClaims).toBe(1);
    expect(usage?.fallbacks).toBe(2);

    const turns = await aiTurnsForRound(t, gameId, 0);
    expect(turns.filter((turn) => turn.status === 'authorized')).toHaveLength(
      1
    );
    expect(
      turns.filter((turn) => turn.status === 'budget_fallback')
    ).toHaveLength(2);

    const committedBotLines = await Promise.all(
      poemIds.map((poemId, poemIndex) =>
        aiIds.has(matrix[0][poemIndex]) ? lineFor(t, poemId, 0) : null
      )
    );
    expect(committedBotLines.filter(Boolean)).toHaveLength(2);
  });

  it('opens the breaker on estimated daily cost before scheduling paid cells', async () => {
    process.env.AI_DAILY_CALL_BUDGET = '10';
    process.env.AI_DAILY_COST_BUDGET_USD = '0.02';
    process.env.AI_ESTIMATED_COST_PER_GENERATION_USD = '0.01';
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: SOLO_PLAYERS,
      currentRound: 0,
    });

    await t.mutation(internal.ai.scheduleAiTurn, { roomId, gameId, round: 0 });

    const usage = await aiUsageForToday(t);
    expect(usage?.generationClaims).toBe(2);
    expect(usage?.estimatedCostMicros).toBe(20_000);
    expect(usage?.fallbacks).toBe(1);

    const turns = await aiTurnsForRound(t, gameId, 0);
    expect(turns.filter((turn) => turn.status === 'authorized')).toHaveLength(
      2
    );
    expect(
      turns.filter((turn) => turn.status === 'budget_fallback')
    ).toHaveLength(1);
  });

  it('claim rows never block the safety net from filling a stranded cell', async () => {
    process.env.AI_DAILY_CALL_BUDGET = '10';
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: SOLO_PLAYERS, currentRound: 0 }
    );
    const aiIds = new Set([userIds[1], userIds[2], userIds[3]]);

    await t.mutation(internal.ai.scheduleAiTurn, { roomId, gameId, round: 0 });

    // Do not run the generation action. This simulates the action dying after
    // paid cells were claimed.
    await t.mutation(internal.ai.ensureAiLine, { roomId, gameId, round: 0 });

    for (let poem = 0; poem < poemIds.length; poem++) {
      const line = await lineFor(t, poemIds[poem], 0);
      if (aiIds.has(matrix[0][poem])) {
        expect(line).not.toBeNull();
        expect(countWords(line!.text)).toBe(WORD_COUNTS[0]);
      } else {
        expect(line).toBeNull();
      }
    }

    const usage = await aiUsageForToday(t);
    expect(usage?.generationClaims).toBe(3);
    expect(usage?.fallbacks).toBe(3);
  });

  it('completes a full deterministic solo game with one human and three bots', async () => {
    process.env.LINEJAM_AI_DETERMINISTIC = '1';
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: SOLO_PLAYERS, currentRound: 0 }
    );
    const humanId = userIds[0];

    for (let round = 0; round < WORD_COUNTS.length; round++) {
      const humanPoem = poemIds[matrix[round].indexOf(humanId)];
      await t.run((ctx) =>
        ctx.db.insert('lines', {
          poemId: humanPoem,
          indexInPoem: round,
          text: getFallbackLine(WORD_COUNTS[round], `human:${round}`),
          wordCount: WORD_COUNTS[round],
          authorUserId: humanId,
          authorDisplayName: 'Human',
          createdAt: Date.now(),
        })
      );

      await t.mutation(internal.ai.scheduleAiTurn, {
        roomId,
        gameId,
        round,
      });
    }

    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('COMPLETED');

    const lines = await getAllLines(t, gameId);
    expect(lines).toHaveLength(WORD_COUNTS.length * poemIds.length);
    for (const line of lines) {
      expect(countWords(line.text)).toBe(WORD_COUNTS[line.indexInPoem]);
    }
  });

  it('ensureAiLine fills EVERY open AI cell, never just one (the never-die fix)', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: SOLO_PLAYERS, currentRound: 0 }
    );
    const aiIds = new Set([userIds[1], userIds[2], userIds[3]]);

    // Safety net only — no generation ran (simulates all 3 actions dying).
    await t.mutation(internal.ai.ensureAiLine, { roomId, gameId, round: 0 });

    for (let poem = 0; poem < poemIds.length; poem++) {
      const line = await lineFor(t, poemIds[poem], 0);
      if (aiIds.has(matrix[0][poem])) {
        expect(line).not.toBeNull(); // every bot cell filled
        expect(countWords(line!.text)).toBe(WORD_COUNTS[0]);
        expect(line!.authorUserId).toBe(matrix[0][poem]);
      } else {
        expect(line).toBeNull(); // the human cell is NOT auto-filled
      }
    }
  });

  it('generateLineForRound fills every bot cell on the fallback path', async () => {
    process.env.AI_DAILY_CALL_BUDGET = '10';
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: SOLO_PLAYERS, currentRound: 0 }
    );
    const aiIds = new Set([userIds[1], userIds[2], userIds[3]]);

    await t.mutation(internal.ai.scheduleAiTurn, {
      roomId,
      gameId,
      round: 0,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const aiPoemIndexes = [1, 2, 3].filter((p) => aiIds.has(matrix[0][p]));
    for (const poem of aiPoemIndexes) {
      const line = await lineFor(t, poemIds[poem], 0);
      expect(line).not.toBeNull();
      expect(countWords(line!.text)).toBe(WORD_COUNTS[0]);
    }
  });

  it('allows only one running AI generation action per game round', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: SOLO_PLAYERS,
      currentRound: 0,
    });

    const first = await t.mutation(internal.ai.claimAiRoundGeneration, {
      roomId,
      gameId,
      round: 0,
    });
    const second = await t.mutation(internal.ai.claimAiRoundGeneration, {
      roomId,
      gameId,
      round: 0,
    });

    expect(first.claimed).toBe(true);
    expect(first.lockId).toBeTruthy();
    expect(second).toEqual({ claimed: false });

    if (!first.lockId || !first.owner) {
      throw new Error('expected the first AI round claim to return a lock id');
    }

    await t.mutation(internal.ai.finishAiRoundGeneration, {
      lockId: first.lockId,
      owner: first.owner,
    });
    const afterRelease = await t.mutation(internal.ai.claimAiRoundGeneration, {
      roomId,
      gameId,
      round: 0,
    });

    expect(afterRelease.claimed).toBe(true);
  });

  it('does not let an old stale-lock owner finish a newer running claim', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: SOLO_PLAYERS,
      currentRound: 0,
    });

    const first = await t.mutation(internal.ai.claimAiRoundGeneration, {
      roomId,
      gameId,
      round: 0,
    });
    if (!first.claimed || !first.lockId) {
      throw new Error('expected first claim to succeed');
    }

    await t.run((ctx) =>
      ctx.db.patch(first.lockId, {
        updatedAt: Date.now() - 120_000,
      })
    );

    const second = await t.mutation(internal.ai.claimAiRoundGeneration, {
      roomId,
      gameId,
      round: 0,
    });
    expect(second.claimed).toBe(true);
    if (!second.claimed || !second.lockId) {
      throw new Error('expected stale reclaim to return a lock id');
    }
    expect(second.lockId).toBe(first.lockId);
    expect(second.owner).not.toBe(first.owner);

    await t.mutation(internal.ai.finishAiRoundGeneration, {
      lockId: first.lockId,
      owner: first.owner,
    });
    const third = await t.mutation(internal.ai.claimAiRoundGeneration, {
      roomId,
      gameId,
      round: 0,
    });

    expect(third).toEqual({ claimed: false });

    await t.mutation(internal.ai.finishAiRoundGeneration, {
      lockId: second.lockId,
      owner: second.owner,
    });
    const afterCurrentOwnerFinishes = await t.mutation(
      internal.ai.claimAiRoundGeneration,
      {
        roomId,
        gameId,
        round: 0,
      }
    );
    expect(afterCurrentOwnerFinishes.claimed).toBe(true);
  });

  it('a round whose bots all strand still completes via the safety net (no cron)', async () => {
    // The critical solo invariant: the abandonment cron never fires while the
    // human is present, so ensureAiLine alone must clear every bot cell so the
    // round can advance. Drive a single round end-to-end with the human filling
    // their own poem and the safety net filling all three bot poems.
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: SOLO_PLAYERS, currentRound: 0 }
    );

    // Human submits their assigned poem at round 0 (poem 0).
    const humanPoem = poemIds[matrix[0].indexOf(userIds[0])];
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: humanPoem,
        indexInPoem: 0,
        text: getFallbackLine(WORD_COUNTS[0], 'human:0'),
        wordCount: WORD_COUNTS[0],
        authorUserId: userIds[0],
        createdAt: Date.now(),
      })
    );

    // Safety net clears all three bot cells.
    await t.mutation(internal.ai.ensureAiLine, { roomId, gameId, round: 0 });

    // Every poem at round 0 now has a line — the round is unblocked.
    for (const poemId of poemIds) {
      expect(await lineFor(t, poemId, 0)).not.toBeNull();
    }
  });

  it('multi-bot fallback lines vary (no canned-line repetition across cells)', async () => {
    // Use a higher word count where the combinatorial pool is large.
    const t = setupConvexTest();
    const { gameId, roomId, poemIds } = await seedClassicGame(t, {
      players: SOLO_PLAYERS,
      currentRound: 4, // WORD_COUNTS[4] = 5 → large fallback pool
    });
    // Pre-fill rounds 0–3 so the lifecycle sits at round 4.
    await t.run(async (ctx) => {
      const seeded = await ctx.db
        .query('games')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .first();
      const matrix = seeded!.assignmentMatrix;
      for (let r = 0; r < 4; r++) {
        for (let p = 0; p < poemIds.length; p++) {
          await ctx.db.insert('lines', {
            poemId: poemIds[p],
            indexInPoem: r,
            text: getFallbackLine(WORD_COUNTS[r], `${poemIds[p]}:${r}`),
            wordCount: WORD_COUNTS[r],
            authorUserId: matrix[r][p],
            createdAt: Date.now(),
          });
        }
      }
    });

    await t.mutation(internal.ai.ensureAiLine, { roomId, gameId, round: 4 });

    const botLines = (await Promise.all(poemIds.map((id) => lineFor(t, id, 4))))
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .map((l) => l.text);
    // At least the three bot cells produced lines, and they are not all identical.
    expect(botLines.length).toBeGreaterThanOrEqual(3);
    expect(new Set(botLines).size).toBeGreaterThan(1);
    botLines.forEach((text) => expect(countWords(text)).toBe(WORD_COUNTS[4]));
  });
});
