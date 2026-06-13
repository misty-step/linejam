/**
 * AI Player Module
 *
 * Handles AI player lifecycle (add/remove) and turn generation.
 * AI players are real user records with kind='AI' for clean attribution.
 */

import { v } from 'convex/values';
import {
  mutation,
  internalMutation,
  internalAction,
  type MutationCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { getUser } from './lib/auth';
import { requireRoomByCode, getActiveGame } from './lib/room';
import { getMatrixRound } from './lib/assignmentMatrix';
import { getGameRules } from './lib/gameRules';
import {
  pickRandomPersona,
  getPersona,
  GHOSTWRITER_PERSONA,
  AiPersonaId,
} from './lib/ai/personas';
import { generateLine, getFallbackLine, type LLMConfig } from './lib/ai/llm';
import { countWords } from './lib/wordCount';
import { getConvexRuntimeConfig } from './lib/env';
import { log } from './lib/errors';
import {
  applyLineLifecycleTransition,
  getSubmissionWindow,
} from './lib/sessionLifecycle';

const runtimeConfig = getConvexRuntimeConfig();
const initialOpenRouterApiKey = runtimeConfig.openRouterApiKey;

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
    if (!user) throw new Error('User not found');

    const room = await requireRoomByCode(ctx, code);
    if (room.hostUserId !== user._id)
      throw new Error('Only host can add AI player');

    // Can only add AI in lobby (no active game)
    const activeGame = await getActiveGame(ctx, room._id);
    if (activeGame) throw new Error('Can only add AI in lobby');

    // Check player count
    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    if (players.length >= 8) throw new Error('Room is full');

    // Check if AI already exists
    const existingAi = await Promise.all(
      players.map((p) => ctx.db.get(p.userId))
    );
    const hasAi = existingAi.some((u) => u?.kind === 'AI');
    if (hasAi) throw new Error('Room already has an AI player');

    // Pick a random persona
    const persona = pickRandomPersona();

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
  },
  handler: async (ctx, { code, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new Error('User not found');

    const room = await requireRoomByCode(ctx, code);
    if (room.hostUserId !== user._id)
      throw new Error('Only host can remove AI player');

    // Can only remove AI in lobby (no active game)
    const activeGame = await getActiveGame(ctx, room._id);
    if (activeGame) throw new Error('Can only remove AI in lobby');

    // Find AI player
    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    const playerUsers = await Promise.all(
      players.map((p) => ctx.db.get(p.userId))
    );

    const aiPlayerIndex = playerUsers.findIndex((u) => u?.kind === 'AI');
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
    // Verify game state - use game directly, not room.currentGameId (race-prone)
    const game = await ctx.db.get(gameId);

    if (!game) return;
    if (game.status !== 'IN_PROGRESS') return;
    // Allow scheduling for current round or past rounds (late arrivals OK)
    if (round > game.currentRound) return;

    // Find AI player in room
    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .collect();

    const playerUsers = await Promise.all(
      players.map((p) => ctx.db.get(p.userId))
    );

    const aiPlayer = playerUsers.find((u) => u?.kind === 'AI');
    if (!aiPlayer) return; // No AI in this room

    // Check if AI already submitted for this round
    const aiPoemIndex = getMatrixRound(game.assignmentMatrix, round).findIndex(
      (uid) => uid === aiPlayer._id
    );
    if (aiPoemIndex === -1) return; // AI not assigned this round (shouldn't happen)

    const poem = await ctx.db
      .query('poems')
      .withIndex('by_room_game_index', (q) =>
        q
          .eq('roomId', roomId)
          .eq('gameId', gameId)
          .eq('indexInRoom', aiPoemIndex)
      )
      .first();

    if (!poem) return;

    // Check if line already exists
    const existingLine = await ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) =>
        q.eq('poemId', poem._id).eq('indexInPoem', round)
      )
      .first();

    if (existingLine) return; // Already submitted

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
    await ctx.scheduler.runAfter(AI_SAFETY_NET_MS, internal.ai.ensureAiLine, {
      roomId,
      gameId,
      round,
    });
  },
});

/** How long the LLM path gets before the fallback line lands. */
const AI_SAFETY_NET_MS = 25_000;

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
    const game = await ctx.db.get(gameId);
    if (!game || game.status !== 'IN_PROGRESS') return;
    if (round > game.currentRound) return;

    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .collect();
    const playerUsers = await Promise.all(
      players.map((p) => ctx.db.get(p.userId))
    );
    const aiPlayer = playerUsers.find((u) => u?.kind === 'AI');
    if (!aiPlayer) return;

    const aiPoemIndex = getMatrixRound(game.assignmentMatrix, round).findIndex(
      (uid) => uid === aiPlayer._id
    );
    if (aiPoemIndex === -1) return;

    const poem = await ctx.db
      .query('poems')
      .withIndex('by_room_game_index', (q) =>
        q
          .eq('roomId', roomId)
          .eq('gameId', gameId)
          .eq('indexInRoom', aiPoemIndex)
      )
      .first();
    if (!poem) return;

    const expectedCount = getGameRules(game.mode).wordCounts[round];
    const committed = await commitAssignedLine(ctx, {
      roomId,
      gameId,
      poemId: poem._id,
      lineIndex: round,
      text: getFallbackLine(expectedCount),
      authorUserId: aiPlayer._id,
      authorDisplayName: aiPlayer.displayName,
    });

    if (committed) {
      log.warn('AI safety net committed a fallback line', {
        roomId,
        gameId,
        round,
      });
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
    // Load game state directly (not through room.currentGameId which is race-prone)
    const game = await ctx.runQuery(internal.ai.getGameState, { gameId });
    if (!game) return;
    if (game.status !== 'IN_PROGRESS') return;
    // Allow generation for current round or past rounds (late arrivals OK)
    if (round > game.currentRound) return;

    // Find AI player
    const aiPlayer = await ctx.runQuery(internal.ai.getAiPlayerInRoom, {
      roomId,
    });
    if (!aiPlayer) return;

    // Find AI's assigned poem
    const aiPoemIndex = getMatrixRound(game.assignmentMatrix, round).findIndex(
      (uid: Id<'users'>) => uid === aiPlayer._id
    );
    if (aiPoemIndex === -1) return;

    const poem = await ctx.runQuery(internal.ai.getPoemByIndex, {
      roomId,
      gameId,
      indexInRoom: aiPoemIndex,
    });
    if (!poem) return;

    // Check if already submitted (idempotency)
    const alreadySubmitted = await ctx.runQuery(internal.ai.hasLineForRound, {
      poemId: poem._id,
      round,
    });
    if (alreadySubmitted) return;

    // Get previous line for context
    const previousLine =
      round > 0
        ? await ctx.runQuery(internal.ai.getPreviousLine, {
            poemId: poem._id,
            round: round - 1,
          })
        : null;

    // Get persona
    const persona = getPersona(aiPlayer.aiPersonaId as AiPersonaId);
    const targetWordCount = getGameRules(game.mode).wordCounts[round];

    // Generate line - graceful fallback if API key missing
    const apiKey = initialOpenRouterApiKey;
    const result = await (async () => {
      if (!apiKey) {
        log.error('OPENROUTER_API_KEY not configured - using fallback line', {
          roomId,
          gameId,
          round,
        });
        return {
          text: getFallbackLine(targetWordCount),
          fallbackUsed: true,
        };
      }

      const config: LLMConfig = {
        provider: 'openrouter',
        model: process.env.AI_MODEL || 'google/gemini-3-flash-preview',
        apiKey,
        timeoutMs: 10000,
        maxRetries: 3,
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

    // Commit the line
    await ctx.runMutation(internal.ai.commitAiLine, {
      poemId: poem._id,
      lineIndex: round,
      text: result.text,
      aiUserId: aiPlayer._id,
      roomId,
      gameId,
    });

    if (result.fallbackUsed) {
      log.warn('AI fallback used', { roomId, gameId, round });
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
 * Shared committer for machine-written lines (AI turns, safety net, ghost).
 * Idempotent and assignment-checked; substitutes a fallback when the text
 * misses the word count. Returns true when a line was inserted.
 */
async function commitAssignedLine(
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

  const wordCount = countWords(text);
  const expectedCount = getGameRules(game.mode).wordCounts[lineIndex];
  const finalText =
    wordCount === expectedCount ? text.trim() : getFallbackLine(expectedCount);

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
    await commitAssignedLine(ctx, {
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

    const targetWordCount = getGameRules(game.mode).wordCounts[round];
    const apiKey = initialOpenRouterApiKey;
    const result = await (async () => {
      if (!apiKey) {
        return { text: getFallbackLine(targetWordCount), fallbackUsed: true };
      }

      const config: LLMConfig = {
        provider: 'openrouter',
        model: process.env.AI_MODEL || 'google/gemini-3-flash-preview',
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

export const getAiPlayerInRoom = internalQuery({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => {
    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .collect();

    const playerUsers = await Promise.all(
      players.map((p) => ctx.db.get(p.userId))
    );

    return playerUsers.find((u) => u?.kind === 'AI') || null;
  },
});

export const getPoemByIndex = internalQuery({
  args: {
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    indexInRoom: v.number(),
  },
  handler: async (ctx, { roomId, gameId, indexInRoom }) => {
    return ctx.db
      .query('poems')
      .withIndex('by_room_game_index', (q) =>
        q
          .eq('roomId', roomId)
          .eq('gameId', gameId)
          .eq('indexInRoom', indexInRoom)
      )
      .first();
  },
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
