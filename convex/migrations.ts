import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation } from './_generated/server';
import { verifyGuestToken } from './lib/guestToken';
import { ensureUserHelper } from './users';
import { abandonGame } from './lib/sessionLifecycle';
import { retentionEligibleAt } from './lib/retentionPolicy';

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const removeGameModePatch = { mode: undefined } as never;
const removeSelectedModePatch = { selectedMode: undefined } as never;

export const dropLegacyModeColumns = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [games, rooms] = await Promise.all([
      ctx.db.query('games').collect(),
      ctx.db.query('rooms').collect(),
    ]);

    const gamesWithMode = games.filter((game) => hasOwn(game, 'mode'));
    const roomsWithSelectedMode = rooms.filter((room) =>
      hasOwn(room, 'selectedMode')
    );

    await Promise.all([
      ...gamesWithMode.map((game) =>
        ctx.db.patch(game._id, removeGameModePatch)
      ),
      ...roomsWithSelectedMode.map((room) =>
        ctx.db.patch(room._id, removeSelectedModePatch)
      ),
    ]);

    return {
      gamesScanned: games.length,
      gamesCleared: gamesWithMode.length,
      roomsScanned: rooms.length,
      roomsCleared: roomsWithSelectedMode.length,
    };
  },
});

export const migrateGuestToUser = mutation({
  args: {
    guestToken: v.string(),
  },
  handler: async (ctx, { guestToken }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkUserId = identity?.subject;
    if (!clerkUserId) {
      throw new ConvexError('Not authenticated');
    }

    let guestId: string;
    try {
      guestId = await verifyGuestToken(guestToken);
    } catch {
      throw new ConvexError('Invalid guest token');
    }

    const guestUser = await ctx.db
      .query('users')
      .withIndex('by_guest', (q) => q.eq('guestId', guestId))
      .first();

    const existingMigration = await ctx.db
      .query('migrations')
      .withIndex('by_clerk', (q) => q.eq('clerkUserId', clerkUserId))
      .first();

    if (existingMigration) {
      return { alreadyMigrated: true };
    }

    if (!guestUser) {
      throw new ConvexError('Guest user not found');
    }

    const authUser = await ensureUserHelper(ctx, {
      displayName: guestUser.displayName,
    });

    if (authUser._id === guestUser._id) {
      return { alreadyMigrated: true };
    }

    const lines = await ctx.db
      .query('lines')
      .withIndex('by_author', (q) => q.eq('authorUserId', guestUser._id))
      .collect();

    await Promise.all(
      lines.map((line) =>
        ctx.db.patch(line._id, { authorUserId: authUser._id })
      )
    );

    const favorites = await ctx.db
      .query('favorites')
      .withIndex('by_user', (q) => q.eq('userId', guestUser._id))
      .collect();

    await Promise.all(
      favorites.map((favorite) =>
        ctx.db.patch(favorite._id, { userId: authUser._id })
      )
    );

    const roomPlayers = await ctx.db
      .query('roomPlayers')
      .withIndex('by_user', (q) => q.eq('userId', guestUser._id))
      .collect();

    await Promise.all(
      roomPlayers.map((player) =>
        ctx.db.patch(player._id, { userId: authUser._id })
      )
    );

    await ctx.db.delete(guestUser._id);

    await ctx.db.insert('migrations', {
      guestUserId: guestUser._id,
      clerkUserId,
      migratedAt: Date.now(),
    });

    return {
      success: true,
      linesTransferred: lines.length,
      favoritesTransferred: favorites.length,
      roomsTransferred: roomPlayers.length,
    };
  },
});

const MACHINE_AUTHORSHIP_BATCH_SIZE = 64;
const LEGACY_MACHINE_AUTHOR_SUFFIX = ' (legacy machine)';

const machineAuthorshipCleanupPhase = v.union(
  v.literal('games'),
  v.literal('lineAttribution'),
  v.literal('roomPlayers'),
  v.literal('readers'),
  v.literal('humanUserFields'),
  v.literal('aiUsers'),
  v.literal('aiTurns'),
  v.literal('aiRoundLocks'),
  v.literal('aiUsage'),
  v.literal('aiGenerationMetrics')
);

/**
 * Release A's bounded, resumable machine-authorship cleanup.
 *
 * Each invocation scans at most MACHINE_AUTHORSHIP_BATCH_SIZE documents and
 * returns the next cursor. Operators complete phases through
 * aiGenerationMetrics, repeat those phases from a null cursor for zero-change
 * postconditions, and only then run aiUsers. The legacy schema remains
 * declared until those receipts permit a later contraction deployment.
 */
export const cleanupMachineAuthorship = internalMutation({
  args: {
    phase: machineAuthorshipCleanupPhase,
    cursor: v.optional(v.union(v.string(), v.null())),
    verifiedZeroChangePrerequisites: v.optional(v.literal(true)),
  },
  handler: async (ctx, { phase, cursor, verifiedZeroChangePrerequisites }) => {
    if (phase === 'aiUsers' && verifiedZeroChangePrerequisites !== true) {
      throw new ConvexError(
        'AI user cleanup requires verified zero-change prerequisite receipts'
      );
    }
    const paginationOpts = {
      cursor: cursor ?? null,
      numItems: MACHINE_AUTHORSHIP_BATCH_SIZE,
    };
    let scanned = 0;
    let changed = 0;
    let blocked = 0;
    let isDone = false;
    let continueCursor = '';

    switch (phase) {
      case 'games': {
        const page = await ctx.db.query('games').paginate(paginationOpts);
        scanned = page.page.length;
        isDone = page.isDone;
        continueCursor = page.continueCursor;
        changed = (
          await Promise.all(
            page.page.map(async (game) => {
              if (game.status === 'IN_PROGRESS') {
                const participantIds = [
                  ...new Set(game.assignmentMatrix.flat()),
                ];
                const participants = await Promise.all(
                  participantIds.map((userId) => ctx.db.get(userId))
                );
                if (
                  participants.some((participant) => participant?.kind === 'AI')
                ) {
                  await abandonGame(ctx, { game, closeRoom: false });
                  return 1;
                }
              }

              if (game.completionKind === undefined) return 0;
              if (game.completionKind === 'abandoned') {
                const abandonedAt = Math.min(
                  game.completedAt ?? game.createdAt,
                  Date.now()
                );
                const retentionDeadline = retentionEligibleAt(
                  abandonedAt,
                  'abandoned'
                );
                const [room, poems, roomPlayers] = await Promise.all([
                  ctx.db.get(game.roomId),
                  ctx.db
                    .query('poems')
                    .withIndex('by_game', (q) => q.eq('gameId', game._id))
                    .collect(),
                  ctx.db
                    .query('roomPlayers')
                    .withIndex('by_room', (q) => q.eq('roomId', game.roomId))
                    .collect(),
                ]);
                const playerUsers = await Promise.all(
                  roomPlayers.map((player) => ctx.db.get(player.userId))
                );
                const hasHumanPlayer = playerUsers.some(
                  (player) => player !== null && player.kind !== 'AI'
                );
                await Promise.all([
                  ctx.db.patch(game._id, {
                    status: 'ABANDONED',
                    publicRecapEnabled: undefined,
                    publicRecapEnabledAt: undefined,
                    publicRecapDisabledAt: abandonedAt,
                    completionKind: undefined,
                    retentionState: 'pending',
                    retentionEligibleAt: retentionDeadline,
                  }),
                  ...(room?.currentGameId === game._id
                    ? [
                        ctx.db.patch(
                          room._id,
                          hasHumanPlayer
                            ? {
                                status: 'LOBBY' as const,
                                currentGameId: undefined,
                                completedAt: undefined,
                                retentionState: 'active' as const,
                                retentionEligibleAt: undefined,
                              }
                            : {
                                status: 'COMPLETED' as const,
                                currentGameId: undefined,
                                completedAt: abandonedAt,
                                retentionState: 'pending' as const,
                                retentionEligibleAt: retentionDeadline,
                              }
                        ),
                      ]
                    : []),
                  ...poems.map((poem) =>
                    ctx.db.patch(poem._id, {
                      publicShareEnabled: undefined,
                      publicShareEnabledAt: undefined,
                      publicShareDisabledAt: abandonedAt,
                      publicShareAttempt: undefined,
                      retentionState: 'pending',
                      retentionEligibleAt: retentionDeadline,
                    })
                  ),
                ]);
              } else {
                await ctx.db.patch(game._id, {
                  completionKind: undefined,
                });
              }
              return 1;
            })
          )
        ).reduce<number>((sum, rowChanged) => sum + rowChanged, 0);
        break;
      }

      case 'lineAttribution': {
        const page = await ctx.db.query('lines').paginate(paginationOpts);
        scanned = page.page.length;
        isDone = page.isDone;
        continueCursor = page.continueCursor;
        changed = (
          await Promise.all(
            page.page.map(async (line) => {
              const author = await ctx.db.get(line.authorUserId);
              if (author?.kind !== 'AI') return 0;

              const capturedName =
                line.authorDisplayName?.trim() ||
                author.displayName.trim() ||
                'Unknown machine author';
              if (capturedName.endsWith(LEGACY_MACHINE_AUTHOR_SUFFIX)) {
                return 0;
              }

              await ctx.db.patch(line._id, {
                authorDisplayName: `${capturedName}${LEGACY_MACHINE_AUTHOR_SUFFIX}`,
              });
              return 1;
            })
          )
        ).reduce<number>((sum, rowChanged) => sum + rowChanged, 0);
        break;
      }

      case 'roomPlayers': {
        const page = await ctx.db.query('roomPlayers').paginate(paginationOpts);
        scanned = page.page.length;
        isDone = page.isDone;
        continueCursor = page.continueCursor;
        changed = (
          await Promise.all(
            page.page.map(async (roomPlayer) => {
              const user = await ctx.db.get(roomPlayer.userId);
              if (user?.kind !== 'AI') return 0;
              await ctx.db.delete(roomPlayer._id);
              return 1;
            })
          )
        ).reduce<number>((sum, rowChanged) => sum + rowChanged, 0);
        break;
      }

      case 'readers': {
        const page = await ctx.db.query('poems').paginate(paginationOpts);
        scanned = page.page.length;
        isDone = page.isDone;
        continueCursor = page.continueCursor;
        changed = (
          await Promise.all(
            page.page.map(async (poem) => {
              if (poem.assignedReaderId === undefined) return 0;
              const reader = await ctx.db.get(poem.assignedReaderId);
              if (reader?.kind !== 'AI') return 0;
              await ctx.db.patch(poem._id, {
                assignedReaderId: undefined,
              });
              return 1;
            })
          )
        ).reduce<number>((sum, rowChanged) => sum + rowChanged, 0);
        break;
      }

      case 'humanUserFields': {
        const page = await ctx.db.query('users').paginate(paginationOpts);
        scanned = page.page.length;
        isDone = page.isDone;
        continueCursor = page.continueCursor;
        changed = (
          await Promise.all(
            page.page.map(async (user) => {
              if (
                user.kind === 'AI' ||
                (user.kind === undefined && user.aiPersonaId === undefined)
              ) {
                return 0;
              }
              await ctx.db.patch(user._id, {
                kind: undefined,
                aiPersonaId: undefined,
              });
              return 1;
            })
          )
        ).reduce<number>((sum, rowChanged) => sum + rowChanged, 0);
        break;
      }

      case 'aiUsers': {
        const page = await ctx.db.query('users').paginate(paginationOpts);
        scanned = page.page.length;
        isDone = page.isDone;
        continueCursor = page.continueCursor;
        const results = await Promise.all(
          page.page.map(async (user) => {
            if (user.kind !== 'AI') return { changed: 0, blocked: 0 };
            const [membership, readerAssignment] = await Promise.all([
              ctx.db
                .query('roomPlayers')
                .withIndex('by_user', (q) => q.eq('userId', user._id))
                .first(),
              ctx.db
                .query('poems')
                .withIndex('by_reader', (q) =>
                  q.eq('assignedReaderId', user._id)
                )
                .first(),
            ]);
            if (membership !== null || readerAssignment !== null) {
              return { changed: 0, blocked: 1 };
            }
            await ctx.db.delete(user._id);
            return { changed: 1, blocked: 0 };
          })
        );
        changed = results.reduce((sum, result) => sum + result.changed, 0);
        blocked = results.reduce((sum, result) => sum + result.blocked, 0);
        break;
      }

      case 'aiTurns': {
        const page = await ctx.db.query('aiTurns').paginate(paginationOpts);
        scanned = page.page.length;
        isDone = page.isDone;
        continueCursor = page.continueCursor;
        await Promise.all(page.page.map((row) => ctx.db.delete(row._id)));
        changed = page.page.length;
        break;
      }

      case 'aiRoundLocks': {
        const page = await ctx.db
          .query('aiRoundLocks')
          .paginate(paginationOpts);
        scanned = page.page.length;
        isDone = page.isDone;
        continueCursor = page.continueCursor;
        await Promise.all(page.page.map((row) => ctx.db.delete(row._id)));
        changed = page.page.length;
        break;
      }

      case 'aiUsage': {
        const page = await ctx.db.query('aiUsage').paginate(paginationOpts);
        scanned = page.page.length;
        isDone = page.isDone;
        continueCursor = page.continueCursor;
        await Promise.all(page.page.map((row) => ctx.db.delete(row._id)));
        changed = page.page.length;
        break;
      }

      case 'aiGenerationMetrics': {
        const page = await ctx.db
          .query('aiGenerationMetrics')
          .paginate(paginationOpts);
        scanned = page.page.length;
        isDone = page.isDone;
        continueCursor = page.continueCursor;
        await Promise.all(page.page.map((row) => ctx.db.delete(row._id)));
        changed = page.page.length;
        break;
      }
    }

    return {
      phase,
      scanned,
      changed,
      blocked,
      remaining: !isDone,
      cursor: isDone ? null : continueCursor,
    };
  },
});
