import {
  abandonMatch,
  beginMatch,
  requireActiveMatch,
} from '@parlor/convex/matches';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import {
  generateAssignmentMatrix,
  getMatrixRound,
  secureShuffle,
} from './lib/assignmentMatrix';
import {
  PRESENCE_AWAY_MS,
  WORD_COUNTS,
  getFinalRoundIndex,
  isPresenceStale,
} from './lib/gameRules';
import { countWords } from './lib/wordCount';
import { MAX_LINE_LENGTH, normalizeLineText } from './lib/lineText';
import {
  getUser,
  checkParticipation,
  checkGameParticipation,
} from './lib/auth';
import {
  getRoomByCode,
  requireLiveRoomByCode,
  getRoomPlayers,
  getGamePlayers,
  getActiveGame,
  getCompletedGame,
} from './lib/room';
import {
  abandonRoomMatch,
  applyLineLifecycleTransition,
  getCycleResetDecision,
  getSubmissionWindow,
  isRevealReady,
} from './lib/sessionLifecycle';
import { checkMutationAbuseRateLimit } from './lib/abuseRateLimit';
import {
  buildRevealParticipants,
  getRevealAuthorityForParticipant,
} from './lib/revealAuthorization';
import { getDefaultAvatarId } from '../lib/avatars';
import {
  findRoomMember,
  getRoomActor,
  parlorErrorCode,
  recordRoomActivity,
} from './lib/parlor';

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

    const room = await requireLiveRoomByCode(ctx, code);
    const [actor, completedGame] = await Promise.all([
      getRoomActor(ctx, user, room._id),
      getCompletedGame(ctx, room._id),
    ]);

    let match;
    try {
      match = await beginMatch(ctx, {
        roomId: room._id,
        actor,
        authorization: completedGame ? 'member' : 'host',
        participation: 'eligible',
        minPlayers: 2,
        maxPlayers: 8,
        hardDeadline: false,
      });
    } catch (error) {
      const code = parlorErrorCode(error);
      if (code === 'HOST_REQUIRED') {
        throw new ConvexError('Only host can start game');
      }
      if (
        code === 'NOT_ENOUGH_PRESENT_PLAYERS' ||
        code === 'NOT_ENOUGH_ELIGIBLE_PLAYERS'
      ) {
        throw new ConvexError('Need at least 2 players');
      }
      if (code === 'MATCH_ALREADY_ACTIVE') {
        throw new ConvexError('Game already in progress');
      }
      throw error;
    }
    const [participants] = await Promise.all([
      ctx.db
        .query('matchParticipants')
        .withIndex('by_match_seat', (q) => q.eq('matchId', match.id))
        .collect(),
      recordRoomActivity(ctx, room, actor),
    ]);
    const playerIds = await Promise.all(
      participants.map(async (participant) => {
        const profile = await ctx.db
          .query('roomPlayers')
          .withIndex('by_room_player', (q) =>
            q.eq('roomId', room._id).eq('playerId', participant.playerId)
          )
          .unique();
        if (!profile) throw new ConvexError('Room player profile not found');
        return profile.userId;
      })
    );

    // Writer order belongs to this game; canonical room seats never shuffle.
    const assignmentMatrix = generateAssignmentMatrix(
      secureShuffle(playerIds),
      WORD_COUNTS.length
    );

    // Create Game
    const gameId = await ctx.db.insert('games', {
      roomId: room._id,
      matchId: match.id,
      status: 'IN_PROGRESS',
      cycle: match.cycle,
      currentRound: 0,
      roundStartedAt: match.startedAt,
      assignmentMatrix,
      createdAt: match.startedAt,
      retentionState: 'active',
    });

    // Create Poems
    await Promise.all(
      participants.map((_, i) =>
        ctx.db.insert('poems', {
          roomId: room._id,
          gameId,
          indexInRoom: i,
          createdAt: match.startedAt,
          retentionState: 'active',
        })
      )
    );

    // Update Room
    await ctx.db.patch(room._id, {
      status: 'IN_PROGRESS',
      currentGameId: gameId,
      currentCycle: match.cycle,
      startedAt: match.startedAt,
      retentionState: 'active',
      retentionEligibleAt: undefined,
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
    if (!user) throw new ConvexError('User not found');

    const room = await requireLiveRoomByCode(ctx, roomCode);

    // Any participant can bring the room back to the lobby after a game —
    // a vanished host must never strand the recap.
    const isParticipant = await checkParticipation(ctx, room._id, user._id);
    if (!isParticipant) {
      throw new ConvexError('Only players in this room can start a new cycle');
    }
    await getRoomActor(ctx, user, room._id);

    // Check that there's a completed game (authoritative check)
    const [activeGame, completedGame] = await Promise.all([
      getActiveGame(ctx, room),
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

export const endGame = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new ConvexError('User not found');

    const room = await requireLiveRoomByCode(ctx, roomCode);
    if (room.hostUserId !== user._id) {
      throw new ConvexError('Only host can end game');
    }

    const game = await getActiveGame(ctx, room);
    if (!game) throw new ConvexError('No game in progress');

    if (!game.matchId) throw new ConvexError('Game not in progress');
    const actor = await getRoomActor(ctx, user, room._id);
    await requireActiveMatch(ctx, game.matchId, room._id);
    const envelope = await abandonMatch(ctx, {
      matchId: game.matchId,
      actor,
      reason: 'host-ended',
    });
    const now = Date.now();
    const players = await getRoomPlayers(ctx, room);
    const staleNonHosts = players.filter(
      (player) =>
        player.userId !== room.hostUserId &&
        player.lastSeenAt !== undefined &&
        isPresenceStale(player.lastSeenAt, now, PRESENCE_AWAY_MS)
    );

    await Promise.all(
      staleNonHosts.map(async (player) => {
        const member = await ctx.db
          .query('roomMembers')
          .withIndex('by_room_player', (q) =>
            q.eq('roomId', room._id).eq('playerId', player.playerId!)
          )
          .unique();
        if (member) await ctx.db.delete(member._id);
      })
    );
    await abandonRoomMatch(ctx, { envelope, closeRoom: false });

    return { abandoned: true };
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

    const [game, membership] = await Promise.all([
      getActiveGame(ctx, room),
      room.hostPlayerId ? findRoomMember(ctx, user._id, room._id) : null,
    ]);
    if (!game || (game.matchId && !membership)) return null;

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
      roomId: room._id,
      cycle: game.cycle,
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
    // Check if already submitted (idempotent - silently succeed if already done)
    const existing = await ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) =>
        q.eq('poemId', poemId).eq('indexInPoem', lineIndex)
      )
      .first();
    if (existing) {
      // A reconnect retry may discover that the first request committed. Return
      // the stored text so the client never labels an unsaved draft as settled.
      return { status: 'already_submitted' as const, text: existing.text };
    }

    const roomPlayer = (await getRoomPlayers(ctx, room)).find(
      (player) => player.userId === user._id
    );
    if (!roomPlayer) {
      throw new ConvexError('Not a room participant');
    }
    if (game.matchId) {
      if (
        game.status !== 'IN_PROGRESS' ||
        !room.hostPlayerId ||
        room.closedAt !== undefined
      ) {
        throw new ConvexError('Game not in progress');
      }
      await requireActiveMatch(ctx, game.matchId, room._id);
      const playerId = roomPlayer.playerId;
      if (!playerId) {
        throw new ConvexError('Not a room participant');
      }
      const participant = await ctx.db
        .query('matchParticipants')
        .withIndex('by_match_player', (q) =>
          q.eq('matchId', game.matchId!).eq('playerId', playerId)
        )
        .unique();
      if (!participant) throw new ConvexError('Not a game participant');
      await recordRoomActivity(
        ctx,
        room,
        await getRoomActor(ctx, user, room._id)
      );
    }

    // Validate line length (prevent storage abuse) before normalization.
    if (text.length > MAX_LINE_LENGTH) {
      throw new ConvexError(
        `Line must be ${MAX_LINE_LENGTH} characters or less`
      );
    }

    // Collapse pasted tabs/newlines before counting and storing.
    const normalizedText = normalizeLineText(text);

    // Validate word count against the poem shape
    const wordCount = countWords(normalizedText);
    const expectedCount = WORD_COUNTS[lineIndex];
    if (wordCount !== expectedCount) {
      throw new ConvexError(
        `Expected ${expectedCount} words, got ${wordCount}`
      );
    }

    await ctx.db.insert('lines', {
      poemId,
      indexInPoem: lineIndex,
      text: normalizedText,
      wordCount,
      authorUserId: user._id,
      authorDisplayName: roomPlayer.displayName,
      createdAt: Date.now(),
    });

    await applyLineLifecycleTransition(ctx, {
      game,
      roomId: room._id,
      lineIndex,
    });

    return { status: 'committed' as const, text: text.trim() };
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

    const game = await getCompletedGame(ctx, room._id);
    if (!game || !isRevealReady(game)) return null;

    const [isParticipant, membership] = await Promise.all([
      checkGameParticipation(ctx, game, user._id),
      game.matchId && room.closedAt === undefined
        ? findRoomMember(ctx, user._id, room._id)
        : null,
    ]);
    const isLiveMember = membership !== null;
    if (!isParticipant && !isLiveMember) return null;
    const [players, poems] = await Promise.all([
      getGamePlayers(ctx, game),
      ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', game._id))
        .collect(),
    ]);

    // Reuse the identity records for stable IDs and legacy avatar defaults.
    const playerUserRecords = await Promise.all(
      players.map((p) => ctx.db.get(p.userId))
    );
    const userRecordById = new Map(
      players.map((p, i) => [p.userId, playerUserRecords[i]])
    );
    const now = Date.now();
    const revealParticipants = buildRevealParticipants(players);
    const lineRowsByPoem = new Map<Id<'poems'>, Doc<'lines'>[]>();

    // Spectators see a preview only after that poem has been revealed.
    const poemsWithPreview = await Promise.all(
      poems.map(async (poem) => {
        const revealAuthority = getRevealAuthorityForParticipant({
          participants: revealParticipants,
          assignedReaderId: poem.assignedReaderId,
          hostUserId: room.hostUserId,
          participantUserId: isParticipant ? user._id : null,
          roomClosedAt: room.closedAt,
          now,
        });
        const needsFullLines =
          !!poem.revealedAt || (isParticipant && revealAuthority !== null);
        const readableLines = needsFullLines
          ? await ctx.db
              .query('lines')
              .withIndex('by_poem_index', (q) => q.eq('poemId', poem._id))
              .collect()
          : [];
        if (needsFullLines) lineRowsByPoem.set(poem._id, readableLines);
        const firstLine = needsFullLines
          ? readableLines[0]
          : isParticipant
            ? await ctx.db
                .query('lines')
                .withIndex('by_poem_index', (q) =>
                  q.eq('poemId', poem._id).eq('indexInPoem', 0)
                )
                .first()
            : null;

        const reader = players.find((p) => p.userId === poem.assignedReaderId);
        const readerUserRecord = poem.assignedReaderId
          ? userRecordById.get(poem.assignedReaderId)
          : null;
        const readerStableId =
          readerUserRecord?.clerkUserId ||
          readerUserRecord?.guestId ||
          poem.assignedReaderId ||
          '';

        return {
          _id: poem._id,
          indexInRoom: poem.indexInRoom,
          createdAt: poem.createdAt,
          preview: firstLine?.text || '',
          assignedReaderId: poem.assignedReaderId,
          readerName: reader?.displayName || 'Unknown',
          readerStableId,
          readerAvatarId:
            reader?.avatarId ?? getDefaultAvatarId(readerStableId),
          revealedAt: poem.revealedAt,
          isRevealed: !!poem.revealedAt,
          canReveal: revealAuthority !== null,
          isFallbackReader:
            revealAuthority !== null && poem.assignedReaderId !== user._id,
        };
      })
    );

    // Only frozen participants get private reading assignments.
    const myPoemsRaw = poemsWithPreview.filter(
      (poem) =>
        isParticipant &&
        ((!poem.isRevealed && poem.canReveal) ||
          (poem.isRevealed && poem.assignedReaderId === user._id))
    );

    // Poem ownership follows the frozen writer order, not persistent room seats.
    const currentUserPoemIndex = getMatrixRound(
      game.assignmentMatrix,
      0
    ).findIndex((userId) => userId === user._id);

    // The frozen roster already supplied these authors. Only legacy lines can
    // require a profile outside it; fetch those once across the whole reveal.
    const missingAuthorIds = new Set<Id<'users'>>();
    for (const lines of lineRowsByPoem.values()) {
      for (const line of lines) {
        if (!userRecordById.has(line.authorUserId)) {
          missingAuthorIds.add(line.authorUserId);
        }
      }
    }
    await Promise.all(
      Array.from(missingAuthorIds, async (id) => {
        userRecordById.set(id, await ctx.db.get(id));
      })
    );
    const linesByPoem = new Map(
      Array.from(
        lineRowsByPoem,
        ([poemId, lines]) =>
          [
            poemId,
            lines.map((line) => {
              const author = userRecordById.get(line.authorUserId);
              return {
                text: line.text,
                authorUserId: line.authorUserId,
                authorStableId: author?.clerkUserId || author?.guestId || '',
                authorName:
                  line.authorDisplayName || author?.displayName || 'Unknown',
              };
            }),
          ] as const
      )
    );
    const myPoems = myPoemsRaw.map((poem) => ({
      ...poem,
      lines: linesByPoem.get(poem._id)!,
      isOwnPoem: poem.indexInRoom === currentUserPoemIndex,
    }));
    const revealedPoems = poemsWithPreview
      .filter((poem) => poem.isRevealed)
      .map((poem) => ({
        ...poem,
        lines: linesByPoem.get(poem._id)!,
      }));

    const allRevealed = poemsWithPreview.every((p) => p.isRevealed);

    // For backward compatibility, also return singular myPoem (first one)
    const myPoem = myPoems.length > 0 ? myPoems[0] : null;

    return {
      roomId: room._id,
      cycle: game.cycle,
      canManageArtifacts: isParticipant,
      canContinueRoom: isLiveMember,
      poems: poemsWithPreview,
      myPoem,
      myPoems,
      revealedPoems,
      allRevealed,
      isHost: room.hostUserId === user._id,
      players: players.map((p) => {
        const userRecord = userRecordById.get(p.userId);
        const stableId =
          userRecord?.clerkUserId || userRecord?.guestId || p.userId;
        return {
          userId: p.userId,
          displayName: p.displayName,
          stableId,
          avatarId: p.avatarId ?? getDefaultAvatarId(stableId),
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

    const [storedRoom, game] = await Promise.all([
      ctx.db.get(poem.roomId),
      ctx.db.get(poem.gameId),
    ]);
    const room = storedRoom ? await getRoomByCode(ctx, storedRoom.code) : null;
    if (!room) throw new ConvexError('Room not found');
    if (!game || !isRevealReady(game)) {
      throw new ConvexError('Poem is not ready to reveal');
    }

    if (!(await checkGameParticipation(ctx, game, user._id))) {
      throw new ConvexError('Not a game participant');
    }

    if (poem.revealedAt) {
      return { revealed: false };
    }

    const players = await getGamePlayers(ctx, game);
    const revealAuthority = getRevealAuthorityForParticipant({
      participants: buildRevealParticipants(players),
      assignedReaderId: poem.assignedReaderId,
      hostUserId: room.hostUserId,
      participantUserId: user._id,
      roomClosedAt: room.closedAt,
      now: Date.now(),
    });

    if (!revealAuthority) {
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

    const [roomPlayers, game] = await Promise.all([
      getRoomPlayers(ctx, room),
      getActiveGame(ctx, room),
    ]);
    if (!game || !roomPlayers.some((p) => p.userId === user._id)) return null;

    const [poems, userRecords] = await Promise.all([
      ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', game._id))
        .collect(),
      Promise.all(roomPlayers.map((rp) => ctx.db.get(rp.userId))),
    ]);
    const poemByIndex = new Map(poems.map((p) => [p.indexInRoom, p]));
    const userById = new Map(
      roomPlayers.map((rp, i) => [rp.userId, userRecords[i]])
    );

    // Build player -> poem assignments for current round
    const roundAssignments = getMatrixRound(
      game.assignmentMatrix,
      game.currentRound
    );
    const playerAssignments = roomPlayers.map((player) => {
      const poemIndex = roundAssignments.findIndex(
        (uid) => uid === player.userId
      );
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
      const stableId =
        userRecord?.clerkUserId || userRecord?.guestId || player.userId;
      return {
        displayName: player.displayName,
        submitted: lineChecks[i] !== null,
        // Late arrivals have a room seat but no column in this game's
        // immutable matrix. They observe the current round and never block
        // completion; the next game will include them normally.
        isSpectator: poemIndex === -1,
        userId: player.userId,
        stableId,
        avatarId: player.avatarId ?? getDefaultAvatarId(stableId),
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
