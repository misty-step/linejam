import {
  closeRoomForPlayer,
  createRoomForPlayer,
  joinRoomForPlayer,
  leaveRoomForPlayer,
  type JoinRoomErrorCode,
} from '@parlor/convex/rooms';
import { v, ConvexError } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ensureUserHelper, normalizeDisplayName } from './users';
import {
  getUser,
  checkParticipation,
  checkGameParticipation,
} from './lib/auth';
import {
  ensureParlorPlayer,
  findRoomActor,
  getRoomActor,
  parlorErrorCode,
} from './lib/parlor';
import { PRESENCE_AWAY_MS, isPresenceStale } from './lib/gameRules';
import { checkMutationAbuseRateLimit } from './lib/abuseRateLimit';
import {
  getRoomByCode,
  getRoomActivity,
  requireLiveRoomByCode,
  getActiveGame,
  getCompletedGame,
  getRoomPlayers,
} from './lib/room';
import { abandonRoomMatch } from './lib/sessionLifecycle';
import { retentionEligibleAt } from './lib/retentionPolicy';
import { avatarIdValidator } from './lib/avatars';
import { getDefaultAvatarId } from '../lib/avatars';
import { RATE_LIMIT_EXCEEDED_MESSAGE } from '../lib/rateLimit';

const parlorDisplayName = (value: string): string | null => {
  try {
    return normalizeDisplayName(value);
  } catch {
    return null;
  }
};

const joinFailureMessages = {
  INVALID_DISPLAY_NAME: 'Display name is required',
  INVALID_ROOM_CODE: 'Room not found',
  ROOM_JOIN_RATE_LIMIT: RATE_LIMIT_EXCEEDED_MESSAGE,
  ROOM_NOT_OPEN: 'Room not found',
  ROOM_DATA_INVALID: 'Room is unavailable',
  ROOM_FULL: 'Room is full',
} satisfies Record<JoinRoomErrorCode, string>;

export const createRoom = mutation({
  args: {
    displayName: v.string(),
    avatarId: v.optional(avatarIdValidator),
    guestToken: v.optional(v.string()),
    guestId: v.optional(v.string()), // Rejected by the existing identity boundary.
  },
  handler: async (ctx, { displayName, avatarId, guestToken, guestId }) => {
    const user = await ensureUserHelper(ctx, {
      displayName,
      guestToken,
      guestId,
    });
    await checkMutationAbuseRateLimit(ctx, {
      operation: 'createRoom',
      userId: user._id,
      guestToken: user.guestId ? guestToken : undefined,
    });

    const actor = await ensureParlorPlayer(ctx, user);
    const typedName = normalizeDisplayName(displayName);
    let receipt;
    try {
      receipt = await createRoomForPlayer(ctx, {
        actor,
        displayName: typedName,
        normalizeName: parlorDisplayName,
        // Closed and historical room codes still identify published recaps.
        isCodeAvailable: async (code) =>
          !(await ctx.db
            .query('rooms')
            .withIndex('by_code', (q) => q.eq('code', code))
            .first()),
      });
    } catch (error) {
      const code = parlorErrorCode(error);
      if (code === 'ROOM_CREATION_RATE_LIMIT') {
        throw new ConvexError(RATE_LIMIT_EXCEEDED_MESSAGE);
      }
      if (code === 'ROOM_CODE_EXHAUSTED') {
        throw new ConvexError(
          'Could not generate unique room code. Try again.'
        );
      }
      throw error;
    }
    await ctx.db.patch(receipt.roomId, {
      hostUserId: user._id,
      status: 'LOBBY',
      retentionState: 'active',
    });
    await ctx.db.insert('roomPlayers', {
      roomId: receipt.roomId,
      userId: user._id,
      playerId: actor.playerId,
      displayName: typedName,
      avatarId:
        avatarId ??
        getDefaultAvatarId(user.clerkUserId || user.guestId || user._id),
      joinedAt: Date.now(),
    });
    return { code: receipt.code, roomId: receipt.roomId };
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    displayName: v.string(),
    avatarId: v.optional(avatarIdValidator),
    guestToken: v.optional(v.string()),
    guestId: v.optional(v.string()), // Rejected by the existing identity boundary.
  },
  handler: async (
    ctx,
    { code, displayName, avatarId, guestToken, guestId }
  ) => {
    const user = await ensureUserHelper(ctx, {
      displayName,
      guestToken,
      guestId,
    });
    await checkMutationAbuseRateLimit(ctx, {
      operation: 'joinRoom',
      userId: user._id,
      guestToken: user.guestId ? guestToken : undefined,
    });

    const room = await getRoomByCode(ctx, code);
    const profile = room
      ? await ctx.db
          .query('roomPlayers')
          .withIndex('by_room_user', (q) =>
            q.eq('roomId', room._id).eq('userId', user._id)
          )
          .first()
      : null;
    // Rejoin must keep the room's player identity even after a lobby leave.
    let actor;
    if (profile?.playerId) {
      const player = await ctx.db.get(profile.playerId);
      if (!player) throw new ConvexError('Room player identity not found');
      actor = {
        playerId: player._id,
        identityKey: player.identityKey,
        kind: player.kind,
        guestId: player.guestId,
      };
    } else {
      actor = await ensureParlorPlayer(ctx, user);
    }
    const typedName = normalizeDisplayName(displayName);
    const result = await joinRoomForPlayer(ctx, {
      actor,
      code,
      displayName: typedName,
      normalizeName: parlorDisplayName,
      capacity: 8,
    });
    if (!result.ok) {
      // Returning, rather than throwing, commits Parlor's failed-attempt counter.
      return {
        ...result,
        message:
          result.code === 'ROOM_NOT_OPEN' && room
            ? 'Room is closed'
            : joinFailureMessages[result.code],
      };
    }

    const joinedRoom = await requireLiveRoomByCode(ctx, result.code);
    const selectedAvatarId =
      avatarId ??
      profile?.avatarId ??
      getDefaultAvatarId(user.clerkUserId || user.guestId || user._id);
    if (profile) {
      if (
        profile.displayName !== typedName ||
        profile.avatarId !== selectedAvatarId ||
        !profile.playerId
      ) {
        await ctx.db.patch(profile._id, {
          displayName: typedName,
          avatarId: selectedAvatarId,
          playerId: profile.playerId ?? actor.playerId,
        });
      }
    } else {
      await ctx.db.insert('roomPlayers', {
        roomId: result.roomId,
        userId: user._id,
        playerId: actor.playerId,
        displayName: typedName,
        avatarId: selectedAvatarId,
        joinedAt: Date.now(),
      });
    }
    if (user.displayName !== typedName) {
      await ctx.db.patch(user._id, { displayName: typedName });
    }
    return { ...joinedRoom, ok: true as const };
  },
});

export const getRoom = query({
  args: {
    code: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { code, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return null;

    const room = await getRoomByCode(ctx, code);
    if (!room) return null;
    const { activeGame, status } = await getRoomActivity(ctx, room);
    const isParticipant = await checkParticipation(ctx, room._id, user._id);
    if (isParticipant) return { ...room, status };
    if (!room.hostPlayerId || room.closedAt !== undefined || activeGame)
      return null;
    const roomPlayers = await getRoomPlayers(ctx, room._id);
    if (roomPlayers.length >= 8) return null;
    return { code: room.code, status };
  },
});

export const getRoomState = query({
  args: {
    code: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { code, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return null;
    const room = await getRoomByCode(ctx, code);
    if (!room) return null;
    const { status } = await getRoomActivity(ctx, room);
    if (room.hostPlayerId || room.closedAt !== undefined) {
      const actor = room.hostPlayerId
        ? await findRoomActor(ctx, user, room._id)
        : null;
      if (!actor) {
        const completedGame =
          status === 'COMPLETED' ? await getCompletedGame(ctx, room._id) : null;
        if (!(await checkGameParticipation(ctx, completedGame, user._id))) {
          return null;
        }
      }
    } else if (!(await checkParticipation(ctx, room._id, user._id))) {
      return null;
    }
    const roomPlayers = await getRoomPlayers(ctx, room._id);
    const now = Date.now();
    const players = await Promise.all(
      roomPlayers.map(async (rp) => {
        const userRecord = await ctx.db.get(rp.userId);
        const stableId =
          userRecord?.clerkUserId || userRecord?.guestId || rp.userId;
        const { lastSeenAt, ...rest } = rp;
        return {
          ...rest,
          stableId,
          avatarId: rp.avatarId ?? getDefaultAvatarId(stableId),
          isAway: isPresenceStale(lastSeenAt, now, PRESENCE_AWAY_MS),
        };
      })
    );
    return {
      room: { ...room, status },
      players,
      isHost: user._id === room.hostUserId,
    };
  },
});

export const leaveLobby = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return;
    const room = await getRoomByCode(ctx, roomCode);
    if (!room?.hostPlayerId || room.closedAt !== undefined) return;
    if (await getActiveGame(ctx, room._id)) return;
    if (room.hostUserId === user._id) return;
    const members = await getRoomPlayers(ctx, room._id);
    if (!members.some((member) => member.userId === user._id)) return;
    const actor = await getRoomActor(ctx, user, room._id);
    await leaveRoomForPlayer(ctx, {
      actor,
      roomId: room._id,
      onAbandoned: (envelope) =>
        abandonRoomMatch(ctx, { envelope, closeRoom: true }),
    });
    // Keep room profiles: completed poems and archive authority outlive membership.
  },
});

export const closeRoom = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) throw new ConvexError('Not authenticated');
    const room = await requireLiveRoomByCode(ctx, roomCode);
    if (room.hostUserId !== user._id) {
      throw new ConvexError('Only the host can close the room');
    }
    if (await getActiveGame(ctx, room._id)) {
      throw new ConvexError('Cannot close room while game is in progress');
    }
    const actor = await getRoomActor(ctx, user, room._id);
    await closeRoomForPlayer(ctx, {
      actor,
      roomId: room._id,
      onAbandoned: (envelope) =>
        abandonRoomMatch(ctx, { envelope, closeRoom: true }),
    });
    const completedAt = Date.now();
    await ctx.db.patch(room._id, {
      status: 'COMPLETED',
      completedAt,
      retentionState: 'pending',
      retentionEligibleAt: retentionEligibleAt(completedAt, 'abandoned'),
    });
  },
});
