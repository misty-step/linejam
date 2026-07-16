import { ConvexError, v } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  generateAssignmentMatrix,
  getMatrixRound,
  secureShuffle,
} from './lib/assignmentMatrix';
import {
  AUTO_GHOST_FILL_MS,
  GHOSTWRITER_OVERTIME_MS,
  PRESENCE_AWAY_MS,
  WORD_COUNTS,
  getFinalRoundIndex,
  isPresenceStale,
} from './lib/gameRules';
import { countWords } from './lib/wordCount';
import { getUser, checkParticipation } from './lib/auth';
import {
  getRoomByCode,
  requireRoomByCode,
  getActiveGame,
  getCompletedGame,
} from './lib/room';
import {
  applyLineLifecycleTransition,
  getCycleResetDecision,
  getSubmissionWindow,
  isRevealReady,
} from './lib/sessionLifecycle';
import { checkMutationAbuseRateLimit } from './lib/abuseRateLimit';
import {
  buildRevealParticipants,
  selectRevealAuthority,
} from './lib/revealAuthorization';

const MAX_LINE_LENGTH = 500; // More than enough for 5 words

export const startGame = mutation({
  args: {
    code: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { code, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new ConvexError('User not found');

    await checkMutationAbuseRateLimit(ctx, {
      operation: 'startGame',
      userId: user._id,
      guestToken: user.guestId ? guestToken : undefined,
    });

    const room = await requireRoomByCode(ctx, code);

    // First game is the host's call. Once the room has a completed game,
    // any participant can fire the rematch — the same room self-polices.
    if (room.hostUserId !== user._id) {
      const [completedGame, isParticipant] = await Promise.all([
        getCompletedGame(ctx, room._id),
        checkParticipation(ctx, room._id, user._id),
      ]);
      if (!completedGame || !isParticipant) {
        throw new ConvexError('Only host can start game');
      }
    }

    // Check no game is currently in progress (authoritative check)
    const activeGame = await getActiveGame(ctx, room._id);
    if (activeGame) throw new ConvexError('Game already in progress');

    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    if (players.length < 2) throw new ConvexError('Need at least 2 players');

    // Assign seats (cryptographically secure random shuffle)
    const shuffledPlayers = secureShuffle([...players]);
    await Promise.all(
      shuffledPlayers.map((player, i) =>
        ctx.db.patch(player._id, { seatIndex: i })
      )
    );

    // Generate assignment matrix — one game, WORD_COUNTS.length rounds.
    const playerIds = shuffledPlayers.map((p) => p.userId);
    const assignmentMatrix = generateAssignmentMatrix(
      playerIds,
      WORD_COUNTS.length
    );

    // Create Game
    const gameId = await ctx.db.insert('games', {
      roomId: room._id,
      status: 'IN_PROGRESS',
      cycle: (room.currentCycle || 0) + 1,
      currentRound: 0,
      roundStartedAt: Date.now(),
      assignmentMatrix,
      createdAt: Date.now(),
      retentionState: 'active',
    });

    // Create Poems
    const poemCreationTime = Date.now();
    await Promise.all(
      players.map((_, i) =>
        ctx.db.insert('poems', {
          roomId: room._id,
          gameId,
          indexInRoom: i,
          createdAt: poemCreationTime,
          retentionState: 'active',
        })
      )
    );

    // Update Room
    await ctx.db.patch(room._id, {
      status: 'IN_PROGRESS',
      currentGameId: gameId,
      currentCycle: (room.currentCycle || 0) + 1, // Increment cycle on start if not set, or if set (redundant if startNewCycle handles it, but safe)
      startedAt: Date.now(),
      retentionState: 'active',
      retentionEligibleAt: undefined,
    });

    // Schedule AI turn if AI player present
    await ctx.scheduler.runAfter(0, internal.ai.scheduleAiTurn, {
      roomId: room._id,
      gameId,
      round: 0,
    });
    // Auto ghost-fill floor: if a human never writes round 0, the room
    // still advances. Co-located with scheduleAiTurn so they don't drift.
    await ctx.scheduler.runAfter(
      AUTO_GHOST_FILL_MS,
      internal.game.fillStaleHumanTurns,
      { roomId: room._id, gameId, round: 0 }
    );
  },
});

export const startNewCycle = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new ConvexError('User not found');

    const room = await requireRoomByCode(ctx, roomCode);

    // Any participant can bring the room back to the lobby after a game —
    // a vanished host must never strand the recap.
    const isParticipant = await checkParticipation(ctx, room._id, user._id);
    if (!isParticipant) {
      throw new ConvexError('Only players in this room can start a new cycle');
    }

    // Check that there's a completed game (authoritative check)
    const [activeGame, completedGame] = await Promise.all([
      getActiveGame(ctx, room._id),
      getCompletedGame(ctx, room._id),
    ]);
    const cycleReset = getCycleResetDecision({
      activeGame,
      completedGame,
    });
    if (!cycleReset.ok) {
      if (cycleReset.reason === 'GAME_STILL_IN_PROGRESS') {
        throw new ConvexError('Game still in progress');
      }

      throw new ConvexError('No completed game to continue from');
    }

    // Reset room to LOBBY for the next cycle
    // Keep room.status for backward compatibility with frontend
    await ctx.db.patch(room._id, {
      status: 'LOBBY',
      currentGameId: undefined,
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

    const room = await getRoomByCode(ctx, roomCode);
    if (!room) return null;

    // Get active game (authoritative source)
    const game = await getActiveGame(ctx, room._id);
    if (!game) return null;

    const currentRound = game.currentRound;
    const roundAssignments = getMatrixRound(
      game.assignmentMatrix,
      currentRound
    );

    // Find which poem index this user is assigned to
    const poemIndex = roundAssignments.findIndex((uid) => uid === user._id);
    if (poemIndex === -1) return null; // Should not happen

    const poem = await ctx.db
      .query('poems')
      .withIndex('by_room_game_index', (q) =>
        q
          .eq('roomId', room._id)
          .eq('gameId', game._id)
          .eq('indexInRoom', poemIndex)
      )
      .first();
    if (!poem) return null;

    const getLine = (indexInPoem: number) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poem._id).eq('indexInPoem', indexInPoem)
        )
        .first();
    const [previousLine, currentLine] = await Promise.all([
      currentRound > 0 ? getLine(currentRound - 1) : Promise.resolve(null),
      getLine(currentRound),
    ]);

    const isFinalRound =
      currentRound === getFinalRoundIndex(game.assignmentMatrix);

    return {
      poemId: poem._id,
      lineIndex: currentRound,
      targetWordCount: WORD_COUNTS[currentRound],
      totalRounds: game.assignmentMatrix.length,
      isFinalRound,
      hasSubmitted: currentLine !== null,
      previousLineText: previousLine?.text,
      roundStartedAt: game.roundStartedAt ?? game.createdAt,
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
    if (!user) throw new ConvexError('User not found');

    await checkMutationAbuseRateLimit(ctx, {
      operation: 'submitLine',
      userId: user._id,
      guestToken: user.guestId ? guestToken : undefined,
    });

    const poem = await ctx.db.get(poemId);
    if (!poem) throw new ConvexError('Poem not found');

    // Get game directly from poem (stable, immutable reference)
    // This avoids race conditions from room.currentGameId pointer
    const game = await ctx.db.get(poem.gameId);
    if (!game) throw new ConvexError('Game not found');

    // Fetch room for completion logic (host assignment)
    const room = await ctx.db.get(poem.roomId);
    if (!room) throw new ConvexError('Room not found');

    // Check if already submitted (idempotent - silently succeed if already done)
    const existing = await ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) =>
        q.eq('poemId', poemId).eq('indexInPoem', lineIndex)
      )
      .first();
    if (existing) {
      // Already submitted - idempotent success
      return;
    }

    // Validate game state with grace for race conditions:
    // - Allow submissions for current round OR past rounds (late arrivals)
    // - For final round (8), also accept if game just became COMPLETED
    const submissionWindow = getSubmissionWindow(game, lineIndex);
    if (!submissionWindow.ok) {
      if (submissionWindow.reason === 'GAME_NOT_IN_PROGRESS') {
        throw new ConvexError('Game not in progress');
      }

      if (submissionWindow.reason === 'INVALID_ROUND') {
        throw new ConvexError('Invalid round');
      }

      throw new ConvexError('Round not started yet');
    }

    // Validate assignment (immutable matrix - always stable)
    const assignedUserId = getMatrixRound(game.assignmentMatrix, lineIndex)[
      poem.indexInRoom
    ];
    if (assignedUserId !== user._id) throw new ConvexError('Not your turn');

    // Validate line length (prevent storage abuse)
    if (text.length > MAX_LINE_LENGTH) {
      throw new ConvexError(
        `Line must be ${MAX_LINE_LENGTH} characters or less`
      );
    }

    // Validate word count against the poem shape
    const wordCount = countWords(text);
    const expectedCount = WORD_COUNTS[lineIndex];
    if (wordCount !== expectedCount) {
      throw new ConvexError(
        `Expected ${expectedCount} words, got ${wordCount}`
      );
    }

    await ctx.db.insert('lines', {
      poemId,
      indexInPoem: lineIndex,
      text: text.trim(),
      wordCount,
      authorUserId: user._id,
      authorDisplayName: user.displayName,
      createdAt: Date.now(),
    });

    await applyLineLifecycleTransition(ctx, {
      game,
      roomId: room._id,
      lineIndex,
    });
  },
});

export const summonGhostwriter = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new ConvexError('User not found');

    const room = await requireRoomByCode(ctx, roomCode);
    if (room.hostUserId !== user._id) {
      throw new ConvexError('Only host can summon the ghostwriter');
    }

    const game = await getActiveGame(ctx, room._id);
    if (!game) throw new ConvexError('No game in progress');

    // The ghost only answers after real overtime — no skipping slow friends.
    const roundStartedAt = game.roundStartedAt ?? game.createdAt;
    if (Date.now() - roundStartedAt < GHOSTWRITER_OVERTIME_MS) {
      throw new ConvexError('The ghostwriter only answers after overtime');
    }

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', game._id))
      .collect();

    const roundAssignments = getMatrixRound(
      game.assignmentMatrix,
      game.currentRound
    );
    const [lineChecks, assignedUsers, claimedTurns] = await Promise.all([
      Promise.all(
        poems.map((poem) =>
          ctx.db
            .query('lines')
            .withIndex('by_poem_index', (q) =>
              q.eq('poemId', poem._id).eq('indexInPoem', game.currentRound)
            )
            .first()
        )
      ),
      Promise.all(
        poems.map((poem) => ctx.db.get(roundAssignments[poem.indexInRoom]))
      ),
      ctx.db
        .query('aiTurns')
        .withIndex('by_game_round', (q) =>
          q.eq('gameId', game._id).eq('round', game.currentRound)
        )
        .collect(),
    ]);
    // The ghostwriter covers stalled humans only. AI-assigned cells already
    // have their own generation action and claim; scheduling a ghost for one
    // would create two consumers for the same authorized cell.
    const claimedPoemIds = new Set(claimedTurns.map((turn) => turn.poemId));
    const missingPoems = poems.filter(
      (poem, i) =>
        lineChecks[i] === null &&
        assignedUsers[i]?.kind !== 'AI' &&
        !claimedPoemIds.has(poem._id)
    );
    if (missingPoems.length === 0) {
      return { summoned: 0 };
    }

    // Charge only a valid, productive host summon. A non-host must not be able
    // to grief the room quota, and retries after every cell is already claimed
    // should remain a harmless no-op.
    await checkMutationAbuseRateLimit(ctx, {
      operation: 'summonGhostwriter',
      userId: user._id,
      guestToken: user.guestId ? guestToken : undefined,
      roomId: room._id,
    });

    await Promise.all(
      missingPoems.map((poem) =>
        ctx.scheduler.runAfter(0, internal.ai.generateGhostLine, {
          roomId: room._id,
          gameId: game._id,
          round: game.currentRound,
          poemId: poem._id,
          forUserId: roundAssignments[poem.indexInRoom],
        })
      )
    );

    return { summoned: missingPoems.length };
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

    const room = await getRoomByCode(ctx, roomCode);
    if (!room) return null;

    // Verify user is a participant
    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();
    if (!players.some((p) => p.userId === user._id)) return null;

    // Get most recently completed game (authoritative source)
    const completedGame = await getCompletedGame(ctx, room._id);
    if (!completedGame || !isRevealReady(completedGame)) return null;
    const game = completedGame;

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', game._id))
      .collect();

    // Batch fetch user records for stable IDs (for avatar colors)
    const playerUserRecords = await Promise.all(
      players.map((p) => ctx.db.get(p.userId))
    );
    const userRecordById = new Map(
      players.map((p, i) => [p.userId, playerUserRecords[i]])
    );
    const now = Date.now();
    const revealParticipants = buildRevealParticipants(
      players,
      playerUserRecords
    );

    // Get first line of each poem for preview
    const poemsWithPreview = await Promise.all(
      poems.map(async (poem) => {
        const revealAuthority = selectRevealAuthority(
          revealParticipants,
          poem.assignedReaderId,
          room.hostUserId,
          now
        );
        const firstLine = await ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) =>
            q.eq('poemId', poem._id).eq('indexInPoem', 0)
          )
          .first();

        const reader = players.find((p) => p.userId === poem.assignedReaderId);
        const readerUserRecord = poem.assignedReaderId
          ? userRecordById.get(poem.assignedReaderId)
          : null;

        return {
          _id: poem._id,
          indexInRoom: poem.indexInRoom,
          createdAt: poem.createdAt,
          preview: firstLine?.text || '',
          assignedReaderId: poem.assignedReaderId,
          readerName: reader?.displayName || 'Unknown',
          readerStableId:
            readerUserRecord?.clerkUserId ||
            readerUserRecord?.guestId ||
            poem.assignedReaderId ||
            '',
          revealedAt: poem.revealedAt,
          isRevealed: !!poem.revealedAt,
          canReveal:
            poem.assignedReaderId === user._id ||
            revealAuthority?.userId === user._id,
          isFallbackReader:
            poem.assignedReaderId !== user._id &&
            revealAuthority?.userId === user._id,
        };
      })
    );

    // Full lines stay scoped to poems this device may reveal, plus the current
    // user's already-revealed assignments for re-reading.
    const myPoemsRaw = poemsWithPreview.filter(
      (poem) =>
        (!poem.isRevealed && poem.canReveal) ||
        (poem.isRevealed && poem.assignedReaderId === user._id)
    );

    // Find current user's seat
    const currentPlayer = players.find((p) => p.userId === user._id);
    const currentUserSeat = currentPlayer?.seatIndex;

    const getPoemLines = async (poemId: Id<'poems'>) => {
      const lines = await ctx.db
        .query('lines')
        .withIndex('by_poem', (q) => q.eq('poemId', poemId))
        .collect();

      const uniqueAuthorIds = [...new Set(lines.map((l) => l.authorUserId))];
      const authors = await Promise.all(
        uniqueAuthorIds.map((id) => ctx.db.get(id))
      );
      const authorMap = new Map(
        uniqueAuthorIds.map((id, i) => [id, authors[i]])
      );

      return lines
        .sort((a, b) => a.indexInPoem - b.indexInPoem)
        .map((line) => {
          const author = authorMap.get(line.authorUserId);
          return {
            text: line.text,
            authorUserId: line.authorUserId,
            authorStableId: author?.clerkUserId || author?.guestId || '',
            // Prefer captured pen name, fall back to current user name for legacy data
            authorName:
              line.authorDisplayName || author?.displayName || 'Unknown',
            isBot: author?.kind === 'AI',
            aiPersonaId: author?.aiPersonaId,
          };
        });
    };

    // Get full lines for ALL user's poems
    const myPoems = await Promise.all(
      myPoemsRaw.map(async (poem) => {
        const poemLines = await getPoemLines(poem._id);

        // Determine poem's origin: which player started this poem?
        const poemStarterPlayer = players.find(
          (p) => p.seatIndex === poem.indexInRoom
        );
        const poemStarterUserRecord = poemStarterPlayer
          ? userRecordById.get(poemStarterPlayer.userId)
          : null;

        const isOwnPoem = poem.indexInRoom === currentUserSeat;
        const isForAi = poemStarterUserRecord?.kind === 'AI';

        return {
          ...poem,
          lines: poemLines,
          isOwnPoem,
          isForAi,
          aiPersonaName: isForAi
            ? poemStarterUserRecord?.displayName
            : undefined,
        };
      })
    );

    const revealedPoems = await Promise.all(
      poemsWithPreview
        .filter((poem) => poem.isRevealed)
        .map(async (poem) => ({
          ...poem,
          lines: await getPoemLines(poem._id),
        }))
    );

    const allRevealed = poemsWithPreview.every((p) => p.isRevealed);

    // For backward compatibility, also return singular myPoem (first one)
    const myPoem = myPoems.length > 0 ? myPoems[0] : null;

    return {
      poems: poemsWithPreview,
      myPoem,
      myPoems,
      revealedPoems,
      allRevealed,
      isHost: room.hostUserId === user._id,
      players: players.map((p) => {
        const userRecord = userRecordById.get(p.userId);
        return {
          userId: p.userId,
          displayName: p.displayName,
          stableId: userRecord?.clerkUserId || userRecord?.guestId || p.userId,
          isBot: userRecord?.kind === 'AI',
          aiPersonaId: userRecord?.aiPersonaId,
        };
      }),
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
    if (!user) throw new ConvexError('User not found');

    const poem = await ctx.db.get(poemId);
    if (!poem) throw new ConvexError('Poem not found');

    const [room, game, players] = await Promise.all([
      ctx.db.get(poem.roomId),
      ctx.db.get(poem.gameId),
      ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', poem.roomId))
        .collect(),
    ]);
    if (!room) throw new ConvexError('Room not found');
    if (!isRevealReady(game)) {
      throw new ConvexError('Poem is not ready to reveal');
    }

    const currentPlayer = players.find((player) => player.userId === user._id);
    if (!currentPlayer) throw new ConvexError('Not a room participant');

    if (poem.revealedAt) {
      return { revealed: false };
    }

    const playerUsers = await Promise.all(
      players.map((player) => ctx.db.get(player.userId))
    );
    const revealAuthority = selectRevealAuthority(
      buildRevealParticipants(players, playerUsers),
      poem.assignedReaderId,
      room.hostUserId,
      Date.now()
    );

    if (
      poem.assignedReaderId !== user._id &&
      revealAuthority?.userId !== user._id
    ) {
      throw new ConvexError('This poem is not assigned to you');
    }

    await ctx.db.patch(poemId, {
      revealedAt: Date.now(),
    });
    return { revealed: true };
  },
});

export const getRoundProgress = query({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return null;

    const room = await getRoomByCode(ctx, roomCode);
    if (!room) return null;

    // Fetch all room players and verify user is a participant
    const roomPlayers = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    const isParticipant = roomPlayers.some((p) => p.userId === user._id);
    if (!isParticipant) return null;

    // Get active game (authoritative source)
    const game = await getActiveGame(ctx, room._id);
    if (!game) return null;

    // Batch fetch all poems for this game (O(1) instead of per-player)
    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', game._id))
      .collect();

    // Create poemIndex -> poem lookup map
    const poemByIndex = new Map(poems.map((p) => [p.indexInRoom, p]));

    // Fetch user records to get stable IDs for avatar colors
    const userRecords = await Promise.all(
      roomPlayers.map((rp) => ctx.db.get(rp.userId))
    );
    const userById = new Map(
      roomPlayers.map((rp, i) => [rp.userId, userRecords[i]])
    );

    // Build player -> poem assignments for current round
    const playerAssignments = roomPlayers.map((player) => {
      const poemIndex = getMatrixRound(
        game.assignmentMatrix,
        game.currentRound
      ).findIndex((uid) => uid === player.userId);
      return {
        player,
        poemIndex,
        poem: poemIndex !== -1 ? poemByIndex.get(poemIndex) : undefined,
      };
    });

    // Parallelize line checks for all players
    const lineChecks = await Promise.all(
      playerAssignments.map(({ poem }) =>
        poem
          ? ctx.db
              .query('lines')
              .withIndex('by_poem_index', (q) =>
                q.eq('poemId', poem._id).eq('indexInPoem', game.currentRound)
              )
              .first()
          : Promise.resolve(null)
      )
    );
    const now = Date.now();
    const progress = playerAssignments.map(({ player, poemIndex }, i) => {
      const userRecord = userById.get(player.userId);
      return {
        displayName: player.displayName,
        submitted: lineChecks[i] !== null,
        // Late arrivals have a room seat but no column in this game's
        // immutable matrix. They observe the current round and never block
        // completion; the next game will include them normally.
        isSpectator: poemIndex === -1,
        userId: player.userId,
        stableId:
          userRecord?.clerkUserId || userRecord?.guestId || player.userId,
        isBot: userRecord?.kind === 'AI',
        aiPersonaId: userRecord?.aiPersonaId,
        isAway: isPresenceStale(player.lastSeenAt, now, PRESENCE_AWAY_MS),
      };
    });

    return {
      round: game.currentRound,
      totalRounds: game.assignmentMatrix.length,
      roundStartedAt: game.roundStartedAt ?? game.createdAt,
      isHost: room.hostUserId === user._id,
      isCurrentUserSpectator:
        playerAssignments.find(({ player }) => player.userId === user._id)
          ?.poemIndex === -1,
      players: progress,
    };
  },
});

/**
 * Auto ghost-fill: finds poems missing a line for the current round where the
 * assigned author is a human, and schedules a ghost line for each. Idempotent —
 * if all lines are already committed, it's a no-op. Scheduled via `runAfter`
 * on round start so a disconnected human never strands the room.
 */
export const fillStaleHumanTurns = internalMutation({
  args: {
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    round: v.number(),
  },
  handler: async (ctx, { roomId, gameId, round }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status !== 'IN_PROGRESS') return;
    if (game.currentRound !== round) return;

    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect();

    const roundAssignments = getMatrixRound(game.assignmentMatrix, round);

    // Parallelize line checks for all poems
    const lineChecks = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem_index', (q) =>
            q.eq('poemId', poem._id).eq('indexInPoem', round)
          )
          .first()
      )
    );

    // Fetch user records to distinguish humans from AI
    const playerUsers = await Promise.all(
      poems.map((poem) => ctx.db.get(roundAssignments[poem.indexInRoom]))
    );

    const staleHumanPoems = poems.filter(
      (poem, i) => lineChecks[i] === null && playerUsers[i]?.kind !== 'AI'
    );
    if (staleHumanPoems.length === 0) return;

    await Promise.all(
      staleHumanPoems.map((poem) =>
        ctx.scheduler.runAfter(0, internal.ai.generateGhostLine, {
          roomId,
          gameId,
          round,
          poemId: poem._id,
          forUserId: roundAssignments[poem.indexInRoom],
        })
      )
    );

    return { filled: staleHumanPoems.length };
  },
});
