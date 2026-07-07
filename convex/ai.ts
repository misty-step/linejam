/**
 * AI Player Module
 *
 * Handles AI player lifecycle (add/remove) and turn generation.
 * AI players are real user records with kind='AI' for clean attribution.
 */

import { ConvexError, v } from 'convex/values';
import {
  mutation,
  internalMutation,
  internalAction,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { getUser } from './lib/auth';
import { requireRoomByCode, getActiveGame } from './lib/room';
import { getMatrixRound } from './lib/assignmentMatrix';
import { WORD_COUNTS } from './lib/gameRules';
import {
  pickPersonaExcluding,
  getPersona,
  GHOSTWRITER_PERSONA,
  AiPersonaId,
} from './lib/ai/personas';
import {
  generateLine,
  getFallbackLine,
  fallbackSeed,
  type LLMConfig,
} from './lib/ai/llm';
import { normalizeText, validateWordCount } from './lib/ai/wordCountGuard';
import { getConvexRuntimeConfig } from './lib/env';
import { log, logError } from './lib/errors';
import {
  applyLineLifecycleTransition,
  getSubmissionWindow,
} from './lib/sessionLifecycle';
import { checkMutationAbuseRateLimit } from './lib/abuseRateLimit';

const runtimeConfig = getConvexRuntimeConfig();
const initialOpenRouterApiKey = runtimeConfig.openRouterApiKey;

type OpenAiCell = { poemId: Id<'poems'>; aiUserId: Id<'users'> };

/** Max bots per room (configurable). Solo play wants a few, not a swarm. */
function getMaxAiPlayers(): number {
  const raw = Number(process.env.MAX_AI_PLAYERS);
  return Number.isInteger(raw) && raw > 0 ? raw : 3;
}

/**
 * Bot model (configurable). Default `google/gemini-2.5-flash-lite` won an
 * 11-model bake-off (backlog 028): best quality+latency in the cheap band,
 * ~5× cheaper than the prior `gemini-3-flash-preview` default which scored
 * worse. See 028 for the configured alternatives.
 */
function getAiModel(): string {
  return process.env.AI_MODEL || 'google/gemini-2.5-flash-lite';
}

/** Daily budget counts claimed AI generations; provider retries are bounded inside the claim. */
function getAiDailyCallBudget(): number {
  const raw = process.env.AI_DAILY_CALL_BUDGET?.trim();
  if (!raw) return 250;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 250;
}

function usdToMicros(value: string | undefined, fallback: number): number {
  const raw = value?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 1_000_000);
}

function getAiDailyCostBudgetMicros(): number {
  return usdToMicros(process.env.AI_DAILY_COST_BUDGET_USD, 1_000_000);
}

function getAiEstimatedCostMicrosPerGeneration(): number {
  return usdToMicros(process.env.AI_ESTIMATED_COST_PER_GENERATION_USD, 2_000);
}

function isDeterministicAiMode(): boolean {
  return /^(1|true|yes)$/i.test(process.env.LINEJAM_AI_DETERMINISTIC ?? '');
}

function aiUsageDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** All AI players currently in a room (generalizes the old single-AI `.find`). */
async function getRoomAiPlayers(
  ctx: { db: QueryCtx['db'] },
  roomId: Id<'rooms'>
) {
  const players = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
  const users = await Promise.all(players.map((p) => ctx.db.get(p.userId)));
  return users.filter((u): u is NonNullable<typeof u> => u?.kind === 'AI');
}

/**
 * Every AI-assigned poem cell for a round that has no committed line yet.
 * The unit of AI work is the cell, not "the room's bot" — this is the
 * load-bearing generalization for multi-bot never-die (a dead generation can
 * never strand a round because the safety net fills *every* empty AI cell).
 */
async function getOpenAiCells(
  ctx: { db: QueryCtx['db'] },
  args: {
    roomId: Id<'rooms'>;
    gameId: Id<'games'>;
    round: number;
    matrix: Id<'users'>[][];
  }
): Promise<OpenAiCell[]> {
  const aiPlayers = await getRoomAiPlayers(ctx, args.roomId);
  if (aiPlayers.length === 0) return [];
  const aiIds = new Set(aiPlayers.map((u) => u._id));
  const roundRow = getMatrixRound(args.matrix, args.round);

  const candidateCells = roundRow
    .map((assignedUserId, poemIndex) => ({ assignedUserId, poemIndex }))
    .filter(({ assignedUserId }) => aiIds.has(assignedUserId));

  const resolvedCells = await Promise.all(
    candidateCells.map(async ({ assignedUserId, poemIndex }) => {
      const poem = await ctx.db
        .query('poems')
        .withIndex('by_room_game_index', (q) =>
          q
            .eq('roomId', args.roomId)
            .eq('gameId', args.gameId)
            .eq('indexInRoom', poemIndex)
        )
        .first();
      if (!poem) return null;

      const existing = await ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poem._id).eq('indexInPoem', args.round)
        )
        .first();
      if (existing) return null;

      return { poemId: poem._id, aiUserId: assignedUserId };
    })
  );

  return resolvedCells.filter((cell): cell is OpenAiCell => cell !== null);
}

async function getAiTurnByCell(
  ctx: { db: QueryCtx['db'] },
  poemId: Id<'poems'>,
  round: number
) {
  return ctx.db
    .query('aiTurns')
    .withIndex('by_cell', (q) => q.eq('poemId', poemId).eq('round', round))
    .first();
}

async function recordAiUsage(
  ctx: { db: MutationCtx['db'] },
  delta: {
    day: string;
    generationClaims?: number;
    httpAttempts?: number;
    fallbacks?: number;
    estimatedCostMicros?: number;
  }
): Promise<void> {
  const existing = await ctx.db
    .query('aiUsage')
    .withIndex('by_day', (q) => q.eq('day', delta.day))
    .first();
  const fields = {
    day: delta.day,
    generationClaims:
      (existing?.generationClaims ?? 0) + (delta.generationClaims ?? 0),
    httpAttempts: (existing?.httpAttempts ?? 0) + (delta.httpAttempts ?? 0),
    fallbacks: (existing?.fallbacks ?? 0) + (delta.fallbacks ?? 0),
    estimatedCostMicros:
      (existing?.estimatedCostMicros ?? 0) + (delta.estimatedCostMicros ?? 0),
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
  } else {
    await ctx.db.insert('aiUsage', fields);
  }
}

async function commitFallbackForCell(
  ctx: { db: MutationCtx['db']; scheduler: MutationCtx['scheduler'] },
  args: {
    roomId: Id<'rooms'>;
    gameId: Id<'games'>;
    round: number;
    cell: OpenAiCell;
  }
): Promise<boolean> {
  const aiUser = await ctx.db.get(args.cell.aiUserId);
  return commitFallbackLine(ctx, {
    roomId: args.roomId,
    gameId: args.gameId,
    poemId: args.cell.poemId,
    lineIndex: args.round,
    authorUserId: args.cell.aiUserId,
    authorDisplayName: aiUser?.displayName ?? 'AI',
  });
}

async function prepareAiCellForGeneration(
  ctx: { db: MutationCtx['db']; scheduler: MutationCtx['scheduler'] },
  args: {
    roomId: Id<'rooms'>;
    gameId: Id<'games'>;
    round: number;
    cell: OpenAiCell;
  }
): Promise<boolean> {
  const existingTurn = await getAiTurnByCell(ctx, args.cell.poemId, args.round);
  if (existingTurn) return false;

  const day = aiUsageDay();
  const now = Date.now();
  const fallbackStatus = isDeterministicAiMode()
    ? 'deterministic_fallback'
    : 'budget_fallback';
  const usage = await ctx.db
    .query('aiUsage')
    .withIndex('by_day', (q) => q.eq('day', day))
    .first();
  const callBudget = getAiDailyCallBudget();
  const costBudgetMicros = getAiDailyCostBudgetMicros();
  const costPerGenerationMicros = getAiEstimatedCostMicrosPerGeneration();
  const currentClaims = usage?.generationClaims ?? 0;
  const currentCostMicros = usage?.estimatedCostMicros ?? 0;
  const callBudgetExhausted = currentClaims >= callBudget;
  const costBudgetExhausted =
    costPerGenerationMicros > 0 &&
    currentCostMicros + costPerGenerationMicros > costBudgetMicros;
  const budgetExhausted = callBudgetExhausted || costBudgetExhausted;

  if (isDeterministicAiMode() || budgetExhausted) {
    await ctx.db.insert('aiTurns', {
      roomId: args.roomId,
      gameId: args.gameId,
      poemId: args.cell.poemId,
      round: args.round,
      aiUserId: args.cell.aiUserId,
      day,
      status: fallbackStatus,
      claimedAt: now,
      updatedAt: now,
    });
    const committed = await commitFallbackForCell(ctx, args);
    if (committed) await recordAiUsage(ctx, { day, fallbacks: 1 });
    if (committed && budgetExhausted && !isDeterministicAiMode()) {
      log.warn('AI daily budget exhausted; committed fallback', {
        roomId: args.roomId,
        gameId: args.gameId,
        round: args.round,
        poemId: args.cell.poemId,
        callBudget,
        costBudgetMicros,
        currentClaims,
        currentCostMicros,
        costPerGenerationMicros,
        reason: callBudgetExhausted ? 'call_budget' : 'cost_budget',
      });
    }
    return false;
  }

  await ctx.db.insert('aiTurns', {
    roomId: args.roomId,
    gameId: args.gameId,
    poemId: args.cell.poemId,
    round: args.round,
    aiUserId: args.cell.aiUserId,
    day,
    status: 'authorized',
    claimedAt: now,
    updatedAt: now,
  });
  await recordAiUsage(ctx, {
    day,
    generationClaims: 1,
    estimatedCostMicros: costPerGenerationMicros,
  });
  return true;
}

/**
 * Add an AI player to a room (host-only, lobby-only).
 */
export const addAiPlayer = mutation({
  args: {
    code: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { code, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new ConvexError('User not found');

    await checkMutationAbuseRateLimit(ctx, {
      operation: 'addAiPlayer',
      userId: user._id,
      guestToken: user.guestId ? guestToken : undefined,
    });

    const room = await requireRoomByCode(ctx, code);
    if (room.hostUserId !== user._id)
      throw new ConvexError('Only host can add AI player');

    // Can only add AI in lobby (no active game)
    const activeGame = await getActiveGame(ctx, room._id);
    if (activeGame) throw new ConvexError('Can only add AI in lobby');

    // Check player count
    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    if (players.length >= 8) throw new ConvexError('Room is full');

    // Bots are capped per room (configurable). Solo play wants a few, not a
    // swarm. Selection stays inside this mutation so Convex OCC serializes the
    // read-then-insert (the cap + distinct persona are safe under concurrent
    // host clicks).
    const existingUsers = await Promise.all(
      players.map((p) => ctx.db.get(p.userId))
    );
    const existingAi = existingUsers.filter((u) => u?.kind === 'AI');
    if (existingAi.length >= getMaxAiPlayers()) {
      throw new ConvexError('Bot limit reached');
    }

    // Distinct persona per bot until the roster is exhausted.
    const usedPersonaIds = existingAi
      .map((u) => u?.aiPersonaId)
      .filter((id): id is string => Boolean(id));
    const persona = pickPersonaExcluding(usedPersonaIds);

    // Create AI user record
    const aiUserId = await ctx.db.insert('users', {
      // System ID that can't be impersonated
      clerkUserId: `system:ai:${crypto.randomUUID()}`,
      displayName: persona.displayName,
      kind: 'AI',
      aiPersonaId: persona.id,
      createdAt: Date.now(),
    });

    // Add to room
    await ctx.db.insert('roomPlayers', {
      roomId: room._id,
      userId: aiUserId,
      displayName: persona.displayName,
      joinedAt: Date.now(),
    });

    return {
      aiUserId,
      personaId: persona.id,
      displayName: persona.displayName,
    };
  },
});

/**
 * Remove AI player from room (host-only, lobby-only).
 */
export const removeAiPlayer = mutation({
  args: {
    code: v.string(),
    guestToken: v.optional(v.string()),
    // Target a specific bot. Omit to remove any one bot (back-compat).
    aiUserId: v.optional(v.id('users')),
  },
  handler: async (ctx, { code, guestToken, aiUserId }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new ConvexError('User not found');

    const room = await requireRoomByCode(ctx, code);
    if (room.hostUserId !== user._id)
      throw new ConvexError('Only host can remove AI player');

    // Can only remove AI in lobby (no active game)
    const activeGame = await getActiveGame(ctx, room._id);
    if (activeGame) throw new ConvexError('Can only remove AI in lobby');

    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    const playerUsers = await Promise.all(
      players.map((p) => ctx.db.get(p.userId))
    );

    const aiPlayerIndex = playerUsers.findIndex((u) =>
      aiUserId ? u?._id === aiUserId && u?.kind === 'AI' : u?.kind === 'AI'
    );
    if (aiPlayerIndex === -1) {
      return { removed: false };
    }

    // Remove from roomPlayers (keep user record for attribution history)
    await ctx.db.delete(players[aiPlayerIndex]._id);

    return { removed: true };
  },
});

/**
 * Schedule AI turn generation for a round.
 * Called by game.startGame and when a round advances.
 */
export const scheduleAiTurn = internalMutation({
  args: {
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    round: v.number(),
  },
  handler: async (ctx, { roomId, gameId, round }) => {
    try {
      // Verify game state - use game directly, not room.currentGameId (race-prone)
      const game = await ctx.db.get(gameId);

      if (!game) return;
      if (game.status !== 'IN_PROGRESS') return;
      // Allow scheduling for current round or past rounds (late arrivals OK)
      if (round > game.currentRound) return;

      // Schedule once if ANY AI-assigned cell this round is still empty. The
      // generation action and the safety net each fill *every* open AI cell, so
      // one schedule covers all bots; re-nudge re-enters here idempotently.
      const openCells = await getOpenAiCells(ctx, {
        roomId,
        gameId,
        round,
        matrix: game.assignmentMatrix,
      });
      if (openCells.length === 0) return;

      let authorizedCells = 0;
      for (const cell of openCells) {
        const authorized = await prepareAiCellForGeneration(ctx, {
          roomId,
          gameId,
          round,
          cell,
        });
        if (authorized) authorizedCells += 1;
      }
      if (authorizedCells === 0) return;

      // Schedule with random delay (2-4 seconds)
      const randomBytes = new Uint32Array(1);
      crypto.getRandomValues(randomBytes);
      const delayMs = 2000 + (randomBytes[0] % 2001); // 2000-4000ms

      await ctx.scheduler.runAfter(delayMs, internal.ai.generateLineForRound, {
        roomId,
        gameId,
        round,
      });

      // Safety net: actions are not retried by Convex. If generation dies,
      // commit a deterministic fallback so the AI can never strand the round.
      // Fills EVERY open AI cell (not one) — the multi-bot never-die backstop,
      // which in solo play is the *only* backstop (the abandonment cron never
      // fires while the human is present).
      await ctx.scheduler.runAfter(AI_SAFETY_NET_MS, internal.ai.ensureAiLine, {
        roomId,
        gameId,
        round,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError('scheduleAiTurn failed', err, { roomId, gameId, round });
      await ctx.scheduler.runAfter(
        0,
        internal.errors.reportBackendErrorToCanary,
        {
          errorName: err.name || 'Error',
          errorMessage: err.message,
          errorStack: err.stack,
          operation: 'scheduleAiTurn',
          roomId,
          gameId,
          round,
        }
      );
      throw error;
    }
  },
});

/** How long the LLM path gets before the fallback line lands. */
const AI_SAFETY_NET_MS = 25_000;
const AI_ROUND_GENERATION_LOCK_STALE_MS = 60_000;

export const claimAiRoundGeneration = internalMutation({
  args: {
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    round: v.number(),
  },
  handler: async (ctx, { roomId, gameId, round }) => {
    const now = Date.now();
    const owner = crypto.randomUUID();
    const existing = await ctx.db
      .query('aiRoundLocks')
      .withIndex('by_game_round', (q) =>
        q.eq('gameId', gameId).eq('round', round)
      )
      .first();

    if (
      existing?.status === 'running' &&
      now - existing.updatedAt < AI_ROUND_GENERATION_LOCK_STALE_MS
    ) {
      return { claimed: false as const };
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        roomId,
        owner,
        status: 'running',
        claimedAt: now,
        updatedAt: now,
      });
      return { claimed: true as const, lockId: existing._id, owner };
    }

    const lockId = await ctx.db.insert('aiRoundLocks', {
      roomId,
      gameId,
      round,
      owner,
      status: 'running',
      claimedAt: now,
      updatedAt: now,
    });

    return { claimed: true as const, lockId, owner };
  },
});

export const finishAiRoundGeneration = internalMutation({
  args: {
    lockId: v.id('aiRoundLocks'),
    owner: v.string(),
  },
  handler: async (ctx, { lockId, owner }) => {
    const existing = await ctx.db.get(lockId);
    if (!existing) return;
    if (existing.owner !== owner) return;
    await ctx.db.patch(lockId, {
      status: 'finished',
      updatedAt: Date.now(),
    });
  },
});

/**
 * Last-resort committer for an AI turn. Idempotent: does nothing when the
 * line already exists or the round has moved on.
 */
export const ensureAiLine = internalMutation({
  args: {
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    round: v.number(),
  },
  handler: async (ctx, { roomId, gameId, round }) => {
    try {
      const game = await ctx.db.get(gameId);
      if (!game || game.status !== 'IN_PROGRESS') return;
      if (round > game.currentRound) return;

      // Fill EVERY open AI cell — keyed on the actual line row, never on any
      // generation claim. A dead generation action can therefore never strand a
      // cell. Idempotent: commitAssignedLine no-ops on an already-filled cell.
      const openCells = await getOpenAiCells(ctx, {
        roomId,
        gameId,
        round,
        matrix: game.assignmentMatrix,
      });
      for (const cell of openCells) {
        const aiUser = await ctx.db.get(cell.aiUserId);
        const committed = await commitFallbackLine(ctx, {
          roomId,
          gameId,
          poemId: cell.poemId,
          lineIndex: round,
          authorUserId: cell.aiUserId,
          authorDisplayName: aiUser?.displayName ?? 'AI',
        });

        if (committed) {
          await recordAiUsage(ctx, { day: aiUsageDay(), fallbacks: 1 });
          log.warn('AI safety net committed a fallback line', {
            roomId,
            gameId,
            round,
            poemId: cell.poemId,
          });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError('ensureAiLine failed', err, { roomId, gameId, round });
      await ctx.scheduler.runAfter(
        0,
        internal.errors.reportBackendErrorToCanary,
        {
          errorName: err.name || 'Error',
          errorMessage: err.message,
          errorStack: err.stack,
          operation: 'ensureAiLine',
          roomId,
          gameId,
          round,
        }
      );
      throw error;
    }
  },
});

/**
 * Generate and commit an AI line for a round.
 * This is an internal action because it calls external API (Gemini).
 */
export const generateLineForRound = internalAction({
  args: {
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    round: v.number(),
  },
  handler: async (ctx, { roomId, gameId, round }) => {
    let generationLock: { lockId: Id<'aiRoundLocks'>; owner: string } | null =
      null;
    try {
      const claim = await ctx.runMutation(internal.ai.claimAiRoundGeneration, {
        roomId,
        gameId,
        round,
      });
      if (!claim.claimed) return;
      generationLock = { lockId: claim.lockId, owner: claim.owner };

      // Load game state directly (not through room.currentGameId which is race-prone)
      const game = await ctx.runQuery(internal.ai.getGameState, { gameId });
      if (!game) return;
      if (game.status !== 'IN_PROGRESS') return;
      // Allow generation for current round or past rounds (late arrivals OK)
      if (round > game.currentRound) return;

      // Generate for EVERY open AI cell this round (multi-bot). One dead cell
      // never blocks the others, and any cell left empty is still covered by the
      // ensureAiLine safety net.
      const cells = await ctx.runQuery(internal.ai.getOpenAiCellsForRound, {
        roomId,
        gameId,
        round,
      });
      if (cells.length === 0) return;

      const targetWordCount = WORD_COUNTS[round];
      const apiKey = initialOpenRouterApiKey;

      for (const cell of cells) {
        const turn = await ctx.runQuery(internal.ai.getAiTurnForCell, {
          poemId: cell.poemId,
          round,
        });
        if (turn?.status !== 'authorized') continue;

        // Re-check idempotency: another cell's commit may have advanced state.
        const alreadySubmitted = await ctx.runQuery(
          internal.ai.hasLineForRound,
          {
            poemId: cell.poemId,
            round,
          }
        );
        if (alreadySubmitted) continue;

        const aiUser = await ctx.runQuery(internal.ai.getUserById, {
          userId: cell.aiUserId,
        });
        // Explicit invariant: a bot cell must resolve to an AI user with a
        // persona. If not (e.g. user deleted mid-game), skip — the safety net
        // fills the cell rather than throwing inside the action.
        if (!aiUser?.aiPersonaId) continue;
        const persona = getPersona(aiUser.aiPersonaId as AiPersonaId);

        // Bots see ONLY the previous line — same constraint as a human (the
        // game's defining symmetry, kept on purpose).
        const previousLine =
          round > 0
            ? await ctx.runQuery(internal.ai.getPreviousLine, {
                poemId: cell.poemId,
                round: round - 1,
              })
            : null;

        const result = await (async () => {
          if (!apiKey) {
            log.error(
              'OPENROUTER_API_KEY not configured - using fallback line',
              {
                roomId,
                gameId,
                round,
              }
            );
            return {
              text: getFallbackLine(
                targetWordCount,
                fallbackSeed(cell.poemId, round)
              ),
              fallbackUsed: true,
              attemptsUsed: 0,
            };
          }

          const config: LLMConfig = {
            provider: 'openrouter',
            model: getAiModel(),
            apiKey,
            timeoutMs: 10000,
            maxRetries: 2,
          };

          return generateLine(
            {
              persona,
              previousLineText: previousLine?.text,
              targetWordCount,
            },
            config
          );
        })();
        if (result.attemptsUsed > 0) {
          await ctx.runMutation(internal.ai.recordAiHttpAttempts, {
            day: turn.day,
            attempts: result.attemptsUsed,
          });
        }

        // On any fallback (no key, API failure, or word-count miss) use the
        // varied bank seeded by the cell, so multi-bot fallback reveals don't
        // repeat one canned line.
        const text = result.fallbackUsed
          ? getFallbackLine(targetWordCount, fallbackSeed(cell.poemId, round))
          : result.text;

        const committed = await ctx.runMutation(internal.ai.commitAiLine, {
          poemId: cell.poemId,
          lineIndex: round,
          text,
          aiUserId: cell.aiUserId,
          roomId,
          gameId,
        });

        if (result.fallbackUsed && committed) {
          await ctx.runMutation(internal.ai.recordAiFallback, {
            day: turn.day,
            count: 1,
          });
          log.warn('AI fallback used', {
            roomId,
            gameId,
            round,
            poemId: cell.poemId,
          });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError('generateLineForRound failed', err, { roomId, gameId, round });
      await ctx
        .runAction(internal.errors.reportBackendErrorToCanary, {
          errorName: err.name || 'Error',
          errorMessage: err.message,
          errorStack: err.stack,
          operation: 'generateLineForRound',
          roomId,
          gameId,
          round,
        })
        .catch(() => {});
      throw error;
    } finally {
      if (generationLock) {
        await ctx
          .runMutation(internal.ai.finishAiRoundGeneration, generationLock)
          .catch(() => {});
      }
    }
  },
});

type CommitAssignedLineArgs = {
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  poemId: Id<'poems'>;
  lineIndex: number;
  text: string;
  authorUserId: Id<'users'>;
  authorDisplayName: string;
};

/**
 * Shared committer for machine-written lines (AI turns, safety net, ghost,
 * abandonment backstop). Idempotent and assignment-checked; substitutes a
 * fallback when the text misses the word count. Returns true when a line was
 * inserted. Exported for the abandonment sweep (convex/abandonment.ts).
 */
export async function commitAssignedLine(
  ctx: { db: MutationCtx['db']; scheduler: MutationCtx['scheduler'] },
  {
    roomId,
    gameId,
    poemId,
    lineIndex,
    text,
    authorUserId,
    authorDisplayName,
  }: CommitAssignedLineArgs
): Promise<boolean> {
  const room = await ctx.db.get(roomId);
  const game = await ctx.db.get(gameId);
  const poem = await ctx.db.get(poemId);

  if (!room || !game || !poem) return false;

  // Check for duplicate first (idempotent)
  const existing = await ctx.db
    .query('lines')
    .withIndex('by_poem_index', (q) =>
      q.eq('poemId', poemId).eq('indexInPoem', lineIndex)
    )
    .first();
  if (existing) return false;

  // Validate game state with grace for race conditions:
  // - Allow submissions for current round OR past rounds (late arrivals)
  // - For the final round, also accept if game just became COMPLETED
  const submissionWindow = getSubmissionWindow(game, lineIndex);
  if (!submissionWindow.ok) return false;

  // Check assignment (immutable matrix - always stable)
  const assignedUserId = getMatrixRound(game.assignmentMatrix, lineIndex)[
    poem.indexInRoom
  ];
  if (assignedUserId !== authorUserId) return false;

  const expectedCount = WORD_COUNTS[lineIndex];
  const finalText = validateWordCount(text, expectedCount)
    ? normalizeText(text)
    : getFallbackLine(expectedCount, fallbackSeed(poemId, lineIndex));

  await ctx.db.insert('lines', {
    poemId,
    indexInPoem: lineIndex,
    text: finalText,
    wordCount: expectedCount,
    authorUserId,
    authorDisplayName,
    createdAt: Date.now(),
  });

  await applyLineLifecycleTransition(ctx, { game, roomId, lineIndex });
  return true;
}

export async function commitFallbackLine(
  ctx: { db: MutationCtx['db']; scheduler: MutationCtx['scheduler'] },
  args: Omit<CommitAssignedLineArgs, 'text'>
): Promise<boolean> {
  const expectedCount = WORD_COUNTS[args.lineIndex];
  return commitAssignedLine(ctx, {
    ...args,
    text: getFallbackLine(
      expectedCount,
      fallbackSeed(args.poemId, args.lineIndex)
    ),
  });
}

/**
 * Commit an AI-generated line to the database.
 * Internal mutation - not exposed to clients.
 */
export const commitAiLine = internalMutation({
  args: {
    poemId: v.id('poems'),
    lineIndex: v.number(),
    text: v.string(),
    aiUserId: v.id('users'),
    roomId: v.id('rooms'),
    gameId: v.id('games'),
  },
  handler: async (
    ctx,
    { poemId, lineIndex, text, aiUserId, roomId, gameId }
  ) => {
    const aiUser = await ctx.db.get(aiUserId);
    return commitAssignedLine(ctx, {
      roomId,
      gameId,
      poemId,
      lineIndex,
      text,
      authorUserId: aiUserId,
      authorDisplayName: aiUser?.displayName ?? 'AI',
    });
  },
});

/**
 * Ghostwriter: generate a line for a stalled human turn (host-summoned).
 * Attribution stays honest — the line is bylined "<name> (ghost)".
 */
export const generateGhostLine = internalAction({
  args: {
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    round: v.number(),
    poemId: v.id('poems'),
    forUserId: v.id('users'),
  },
  handler: async (ctx, { roomId, gameId, round, poemId, forUserId }) => {
    try {
      const game = await ctx.runQuery(internal.ai.getGameState, { gameId });
      if (!game || game.status !== 'IN_PROGRESS') return;
      if (game.currentRound !== round) return;

      const alreadySubmitted = await ctx.runQuery(internal.ai.hasLineForRound, {
        poemId,
        round,
      });
      if (alreadySubmitted) return;

      const previousLine =
        round > 0
          ? await ctx.runQuery(internal.ai.getPreviousLine, {
              poemId,
              round: round - 1,
            })
          : null;

      const targetWordCount = WORD_COUNTS[round];
      const apiKey = initialOpenRouterApiKey;
      const result = await (async () => {
        if (!apiKey) {
          return {
            text: getFallbackLine(targetWordCount, fallbackSeed(poemId, round)),
            fallbackUsed: true,
            attemptsUsed: 0,
          };
        }

        const config: LLMConfig = {
          provider: 'openrouter',
          model: getAiModel(),
          apiKey,
          timeoutMs: 10000,
          maxRetries: 2,
        };

        return generateLine(
          {
            persona: GHOSTWRITER_PERSONA,
            previousLineText: previousLine?.text,
            targetWordCount,
          },
          config
        );
      })();

      await ctx.runMutation(internal.ai.commitGhostLine, {
        roomId,
        gameId,
        poemId,
        lineIndex: round,
        text: result.text,
        forUserId,
      });

      log.warn('Ghostwriter covered a stalled turn', { roomId, gameId, round });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError('generateGhostLine failed', err, {
        roomId,
        gameId,
        round,
        poemId,
      });
      await ctx
        .runAction(internal.errors.reportBackendErrorToCanary, {
          errorName: err.name || 'Error',
          errorMessage: err.message,
          errorStack: err.stack,
          operation: 'generateGhostLine',
          roomId,
          gameId,
          poemId,
          round,
        })
        .catch(() => {});
      throw error;
    }
  },
});

export const commitGhostLine = internalMutation({
  args: {
    poemId: v.id('poems'),
    lineIndex: v.number(),
    text: v.string(),
    forUserId: v.id('users'),
    roomId: v.id('rooms'),
    gameId: v.id('games'),
  },
  handler: async (
    ctx,
    { poemId, lineIndex, text, forUserId, roomId, gameId }
  ) => {
    const stalledUser = await ctx.db.get(forUserId);
    const baseName = stalledUser?.displayName ?? 'A poet';
    await commitAssignedLine(ctx, {
      roomId,
      gameId,
      poemId,
      lineIndex,
      text,
      authorUserId: forUserId,
      authorDisplayName: `${baseName} (ghost)`,
    });
  },
});

// Internal queries for action use
import { internalQuery } from './_generated/server';

export const getRoomState = internalQuery({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => ctx.db.get(roomId),
});

export const getGameState = internalQuery({
  args: { gameId: v.id('games') },
  handler: async (ctx, { gameId }) => ctx.db.get(gameId),
});

export const hasLineForRound = internalQuery({
  args: {
    poemId: v.id('poems'),
    round: v.number(),
  },
  handler: async (ctx, { poemId, round }) => {
    const line = await ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) =>
        q.eq('poemId', poemId).eq('indexInPoem', round)
      )
      .first();
    return line !== null;
  },
});

export const getPreviousLine = internalQuery({
  args: {
    poemId: v.id('poems'),
    round: v.number(),
  },
  handler: async (ctx, { poemId, round }) => {
    return ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) =>
        q.eq('poemId', poemId).eq('indexInPoem', round)
      )
      .first();
  },
});

/** All AI-assigned, still-empty cells for a round (action-side accessor). */
export const getOpenAiCellsForRound = internalQuery({
  args: {
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    round: v.number(),
  },
  handler: async (ctx, { roomId, gameId, round }) => {
    const game = await ctx.db.get(gameId);
    if (!game) return [];
    return getOpenAiCells(ctx, {
      roomId,
      gameId,
      round,
      matrix: game.assignmentMatrix,
    });
  },
});

export const getAiTurnForCell = internalQuery({
  args: {
    poemId: v.id('poems'),
    round: v.number(),
  },
  handler: async (ctx, { poemId, round }) =>
    getAiTurnByCell(ctx, poemId, round),
});

export const recordAiHttpAttempts = internalMutation({
  args: {
    day: v.string(),
    attempts: v.number(),
  },
  handler: async (ctx, { day, attempts }) => {
    if (attempts <= 0) return;
    await recordAiUsage(ctx, { day, httpAttempts: attempts });
  },
});

export const recordAiFallback = internalMutation({
  args: {
    day: v.string(),
    count: v.number(),
  },
  handler: async (ctx, { day, count }) => {
    if (count <= 0) return;
    await recordAiUsage(ctx, { day, fallbacks: count });
  },
});

export const getUserById = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => ctx.db.get(userId),
});
