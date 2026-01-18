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
} from './_generated/server';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { getUser } from './lib/auth';
import { requireRoomByCode, getActiveGame } from './lib/room';
import { pickRandomPersona, getPersona, AiPersonaId } from './lib/ai/personas';
import { generateLine, getFallbackLine, type LLMConfig } from './lib/ai/llm';
import { countWords } from './lib/wordCount';
import { assignPoemReaders } from './lib/assignPoemReaders';

const WORD_COUNTS = [1, 2, 3, 4, 5, 4, 3, 2, 1];

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
    const aiPoemIndex = game.assignmentMatrix[round].findIndex(
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
    const aiPoemIndex = game.assignmentMatrix[round].findIndex(
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
    const targetWordCount = WORD_COUNTS[round];

    // Generate line - graceful fallback if API key missing
    const apiKey = process.env.OPENROUTER_API_KEY;
    const result = await (async () => {
      if (!apiKey) {
        console.error(
          'OPENROUTER_API_KEY not configured - using fallback line'
        );
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
      console.log(`AI fallback used for room ${roomId}, round ${round}`);
    }
  },
});

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
    // Get entities
    const room = await ctx.db.get(roomId);
    const game = await ctx.db.get(gameId);
    const poem = await ctx.db.get(poemId);

    if (!room || !game || !poem) return;

    // Check for duplicate first (idempotent)
    const existing = await ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) =>
        q.eq('poemId', poemId).eq('indexInPoem', lineIndex)
      )
      .first();
    if (existing) return;

    // Validate game state with grace for race conditions:
    // - Allow submissions for current round OR past rounds (late arrivals)
    // - For final round (8), also accept if game just became COMPLETED
    const isFinalRound = lineIndex === 8;
    const gameInProgress = game.status === 'IN_PROGRESS';
    const gameJustCompleted = game.status === 'COMPLETED' && isFinalRound;

    if (!gameInProgress && !gameJustCompleted) return;

    // Prevent early submissions (future rounds)
    if (lineIndex > game.currentRound && gameInProgress) return;

    // Check assignment (immutable matrix - always stable)
    const assignedUserId = game.assignmentMatrix[lineIndex][poem.indexInRoom];
    if (assignedUserId !== aiUserId) return;

    // Get AI user for displayName
    const aiUser = await ctx.db.get(aiUserId);
    const aiDisplayName = aiUser?.displayName ?? 'AI';

    // Validate word count
    const wordCount = countWords(text);
    const expectedCount = WORD_COUNTS[lineIndex];
    if (wordCount !== expectedCount) {
      // Use fallback if word count is wrong
      const fallbackText = getFallbackLine(expectedCount);
      await ctx.db.insert('lines', {
        poemId,
        indexInPoem: lineIndex,
        text: fallbackText,
        wordCount: expectedCount,
        authorUserId: aiUserId,
        authorDisplayName: aiDisplayName,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert('lines', {
        poemId,
        indexInPoem: lineIndex,
        text: text.trim(),
        wordCount,
        authorUserId: aiUserId,
        authorDisplayName: aiDisplayName,
        createdAt: Date.now(),
      });
    }

    // Check if round is complete
    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect();

    const lineChecks = await Promise.all(
      poems.map((p) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) =>
            q.eq('poemId', p._id).eq('indexInPoem', lineIndex)
          )
          .first()
      )
    );
    const allSubmitted = lineChecks.every((line) => line !== null);

    if (allSubmitted) {
      if (lineIndex < 8) {
        // Advance round
        await ctx.db.patch(gameId, { currentRound: lineIndex + 1 });

        // Schedule next AI turn
        await ctx.scheduler.runAfter(0, internal.ai.scheduleAiTurn, {
          roomId,
          gameId,
          round: lineIndex + 1,
        });
      } else {
        // Game Complete
        const completionTime = Date.now();
        const players = await ctx.db
          .query('roomPlayers')
          .withIndex('by_room', (q) => q.eq('roomId', roomId))
          .collect();

        await ctx.db.patch(gameId, {
          status: 'COMPLETED',
          completedAt: completionTime,
        });
        await ctx.db.patch(roomId, {
          status: 'COMPLETED',
          completedAt: completionTime,
        });

        // Mark all poems as completed and assign readers
        // Fetch user records for reader assignment
        const playerUserRecords = await Promise.all(
          players.map((p) => ctx.db.get(p.userId))
        );

        // Deep module: assigns readers with fairness + derangement
        const readerAssignments = assignPoemReaders(
          poems.map((p) => ({
            _id: p._id,
            // Author = user who wrote first line (from assignment matrix)
            authorUserId: game.assignmentMatrix[0][p.indexInRoom],
          })),
          playerUserRecords
            .filter((u) => u !== null)
            .map((u) => ({ userId: u!._id, kind: u!.kind }))
        );

        // Patch all poems with assigned readers (parallel for performance)
        await Promise.all(
          poems.map((poem) =>
            ctx.db.patch(poem._id, {
              completedAt: completionTime,
              assignedReaderId: readerAssignments.get(poem._id),
            })
          )
        );
      }
    }
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
