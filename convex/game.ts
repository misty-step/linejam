import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { generateAssignmentMatrix } from './lib/assignmentMatrix';
import { countWords } from './lib/wordCount';
import { getUser } from './lib/auth';

const WORD_COUNTS = [1, 2, 3, 4, 5, 4, 3, 2, 1];

export const startGame = mutation({
  args: {
    code: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { code, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new Error('User not found');

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .first();

    if (!room) throw new Error('Room not found');
    if (room.hostUserId !== user._id)
      throw new Error('Only host can start game');
    if (room.status !== 'LOBBY') throw new Error('Game already started');

    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    if (players.length < 2) throw new Error('Need at least 2 players');

    // Assign seats (random shuffle)
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffledPlayers.length; i++) {
      await ctx.db.patch(shuffledPlayers[i]._id, { seatIndex: i });
    }

    // Generate assignment matrix
    const playerIds = shuffledPlayers.map((p) => p.userId);
    const assignmentMatrix = generateAssignmentMatrix(playerIds);

    // Create Game
    const gameId = await ctx.db.insert('games', {
      roomId: room._id,
      status: 'IN_PROGRESS',
      cycle: (room.currentCycle || 0) + 1,
      currentRound: 0,
      assignmentMatrix,
      createdAt: Date.now(),
    });

    // Create Poems
    for (let i = 0; i < players.length; i++) {
      await ctx.db.insert('poems', {
        roomId: room._id,
        gameId,
        indexInRoom: i,
        createdAt: Date.now(),
      });
    }

    // Update Room
    await ctx.db.patch(room._id, {
      status: 'IN_PROGRESS',
      currentGameId: gameId,
      currentCycle: (room.currentCycle || 0) + 1, // Increment cycle on start if not set, or if set (redundant if startNewCycle handles it, but safe)
      startedAt: Date.now(),
    });
  },
});

export const startNewCycle = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new Error('User not found');

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', roomCode.toUpperCase()))
      .first();

    if (!room) throw new Error('Room not found');
    if (room.hostUserId !== user._id)
      throw new Error('Only host can start new cycle');
    if (room.status !== 'COMPLETED')
      throw new Error('Current cycle not completed');

    // Reset room to LOBBY for the next cycle
    // We do NOT create the game here; startGame handles that when the host clicks "Start"
    // This allows players to join/leave in the lobby before the next cycle begins.
    await ctx.db.patch(room._id, {
      status: 'LOBBY',
      // We keep the currentCycle count; startGame will increment it or we can increment it here?
      // Let's increment it here to indicate we are preparing for the next one.
      // But startGame above does `(room.currentCycle || 0) + 1`.
      // If we increment here, startGame should just use it.
      // Let's standardise:
      // 1. First game: currentCycle undefined -> startGame sets to 1.
      // 2. Replay: currentCycle 1. startNewCycle -> sets to 1 (no change? or 2?).
      //    If we set to 2 here, startGame shouldn't increment again.
      //    Let's make startGame use `room.currentCycle || 1`.
      //    And startNewCycle increments it? No, wait.
      //    If room is LOBBY, currentCycle should be the *pending* cycle?
      //    Or currentCycle is the *last* cycle?
      //    Let's say currentCycle tracks the *active* or *last completed* cycle.
      //    Safest: startGame determines the cycle number.
      //    New Cycle Number = (room.currentCycle || 0) + 1.
      //    So startNewCycle just resets status.
      currentGameId: undefined, // Clear current game so clients show Lobby
    });
  },
});

export const getCurrentAssignment = query({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return null;

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', roomCode.toUpperCase()))
      .first();
    if (!room) return null;

    // If no current game (Lobby), return null
    if (!room.currentGameId) return null;

    const game = await ctx.db.get(room.currentGameId);
    if (!game || game.status !== 'IN_PROGRESS') return null;

    const currentRound = game.currentRound;
    const roundAssignments = game.assignmentMatrix[currentRound];

    // Find which poem index this user is assigned to
    const poemIndex = roundAssignments.findIndex((uid) => uid === user._id);
    if (poemIndex === -1) return null; // Should not happen

    const poem = await ctx.db
      .query('poems')
      .withIndex('by_room_index', (q) =>
        q.eq('roomId', room._id).eq('indexInRoom', poemIndex)
      )
      .first();
    if (!poem) return null;

    let previousLineText = undefined;
    if (currentRound > 0) {
      const prevLine = await ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poem._id).eq('indexInPoem', currentRound - 1)
        )
        .first();
      previousLineText = prevLine?.text;
    }

    return {
      poemId: poem._id,
      lineIndex: currentRound,
      targetWordCount: WORD_COUNTS[currentRound],
      previousLineText,
    };
  },
});

export const submitLine = mutation({
  args: {
    poemId: v.id('poems'),
    lineIndex: v.number(),
    text: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, lineIndex, text, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new Error('User not found');

    const poem = await ctx.db.get(poemId);
    if (!poem) throw new Error('Poem not found');

    const room = await ctx.db.get(poem.roomId);
    if (!room) throw new Error('Room not found');

    if (!room.currentGameId) throw new Error('No active game');

    const game = await ctx.db.get(room.currentGameId);

    if (!game || game.status !== 'IN_PROGRESS')
      throw new Error('Game not in progress');

    // Ensure the poem belongs to the current game
    if (poem.gameId !== game._id) throw new Error('Poem from different game');

    if (game.currentRound !== lineIndex) throw new Error('Wrong round');

    // Validate assignment
    const assignedUserId = game.assignmentMatrix[lineIndex][poem.indexInRoom];
    if (assignedUserId !== user._id) throw new Error('Not your turn');

    // Validate word count
    const wordCount = countWords(text);
    const expectedCount = WORD_COUNTS[lineIndex];
    if (wordCount !== expectedCount) {
      throw new Error(`Expected ${expectedCount} words, got ${wordCount}`);
    }

    // Check if already submitted
    const existing = await ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) =>
        q.eq('poemId', poemId).eq('indexInPoem', lineIndex)
      )
      .first();
    if (existing) throw new Error('Already submitted');

    await ctx.db.insert('lines', {
      poemId,
      indexInPoem: lineIndex,
      text: text.trim(),
      wordCount,
      authorUserId: user._id,
      createdAt: Date.now(),
    });

    // Check if round is complete
    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', poem.roomId))
      .collect();

    // We need to check if ALL poems have a line for this round
    // Since there is 1 poem per player, and 1 line per poem per round.
    // We can count the lines for this round across all poems in the room.
    // But querying all lines might be expensive if we don't have the right index.
    // We have `by_poem_index`.
    // We can iterate over all poems in the room and check if they have a line for this round.

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', game._id))
      .collect();

    let allSubmitted = true;
    for (const p of poems) {
      const line = await ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', p._id).eq('indexInPoem', lineIndex)
        )
        .first();
      if (!line) {
        allSubmitted = false;
        break;
      }
    }

    if (allSubmitted) {
      if (lineIndex < 8) {
        await ctx.db.patch(game._id, { currentRound: lineIndex + 1 });
      } else {
        // Game Complete
        await ctx.db.patch(game._id, {
          status: 'COMPLETED',
          completedAt: Date.now(),
        });
        await ctx.db.patch(poem.roomId, {
          status: 'COMPLETED',
          completedAt: Date.now(),
        });

        // Mark all poems as completed and assign readers
        // Each player reads the poem at offset +1 from their seat
        // (so they don't read the poem they started)
        for (let i = 0; i < poems.length; i++) {
          const readerIndex = (i + 1) % players.length;
          const readerPlayer = players.find((p) => p.seatIndex === readerIndex);
          await ctx.db.patch(poems[i]._id, {
            completedAt: Date.now(),
            assignedReaderId: readerPlayer?.userId,
          });
        }
      }
    }
  },
});

export const getRevealPhaseState = query({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return null;

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', roomCode.toUpperCase()))
      .first();
    if (!room || room.status !== 'COMPLETED' || !room.currentGameId)
      return null;

    // Get game to verify it's the one we expect (optional but good for consistency)
    const game = await ctx.db.get(room.currentGameId);
    if (!game) return null;

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', game._id))
      .collect();

    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    // Get first line of each poem for preview
    const poemsWithPreview = await Promise.all(
      poems.map(async (poem) => {
        const firstLine = await ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) =>
            q.eq('poemId', poem._id).eq('indexInPoem', 0)
          )
          .first();

        const reader = players.find((p) => p.userId === poem.assignedReaderId);

        return {
          _id: poem._id,
          indexInRoom: poem.indexInRoom,
          preview: firstLine?.text || '',
          assignedReaderId: poem.assignedReaderId,
          readerName: reader?.displayName || 'Unknown',
          revealedAt: poem.revealedAt,
          isRevealed: !!poem.revealedAt,
        };
      })
    );

    // Find the current user's assigned poem
    const myPoem = poemsWithPreview.find(
      (p) => p.assignedReaderId === user._id
    );

    // Get full lines for user's poem if they want to reveal
    let myPoemLines: { text: string; authorUserId: string }[] = [];
    if (myPoem) {
      const lines = await ctx.db
        .query('lines')
        .withIndex('by_poem', (q) => q.eq('poemId', myPoem._id))
        .collect();
      myPoemLines = lines
        .sort((a, b) => a.indexInPoem - b.indexInPoem)
        .map((l) => ({ text: l.text, authorUserId: l.authorUserId }));
    }

    const allRevealed = poemsWithPreview.every((p) => p.isRevealed);

    return {
      poems: poemsWithPreview,
      myPoem: myPoem
        ? {
            ...myPoem,
            lines: myPoemLines,
          }
        : null,
      allRevealed,
      isHost: room.hostUserId === user._id,
      players: players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
      })),
    };
  },
});

export const revealPoem = mutation({
  args: {
    poemId: v.id('poems'),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { poemId, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new Error('User not found');

    const poem = await ctx.db.get(poemId);
    if (!poem) throw new Error('Poem not found');

    if (poem.assignedReaderId !== user._id) {
      throw new Error('This poem is not assigned to you');
    }

    if (poem.revealedAt) {
      throw new Error('Poem already revealed');
    }

    await ctx.db.patch(poemId, {
      revealedAt: Date.now(),
    });
  },
});

export const getRoundProgress = query({
  args: {
    roomCode: v.string(),
  },
  handler: async (ctx, { roomCode }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', roomCode.toUpperCase()))
      .first();
    if (!room || !room.currentGameId) return null;

    const game = await ctx.db.get(room.currentGameId);
    if (!game) return null;

    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    const progress = [];
    for (const player of players) {
      // Find which poem this player is assigned to in the current round
      const poemIndex = game.assignmentMatrix[game.currentRound].findIndex(
        (uid) => uid === player.userId
      );

      let submitted = false;
      if (poemIndex !== -1) {
        const poem = await ctx.db
          .query('poems')
          .withIndex('by_room_game_index', (q) =>
            q
              .eq('roomId', room._id)
              .eq('gameId', game._id)
              .eq('indexInRoom', poemIndex)
          )
          .first();

        if (poem) {
          const line = await ctx.db
            .query('lines')
            .withIndex('by_poem_index', (q) =>
              q.eq('poemId', poem._id).eq('indexInPoem', game.currentRound)
            )
            .first();
          if (line) submitted = true;
        }
      }

      progress.push({
        displayName: player.displayName,
        submitted,
        userId: player.userId,
      });
    }

    return {
      round: game.currentRound,
      players: progress,
    };
  },
});
