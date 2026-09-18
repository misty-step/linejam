import { ConvexError } from 'convex/values';
import type { QueryCtx, MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { isRevealReady } from './sessionLifecycle';
import { isPresenceStale } from './gameRules';

export type RoomView = Doc<'rooms'> & {
  hostUserId: Id<'users'>;
  status: NonNullable<Doc<'rooms'>['status']>;
};

type RoomStatus = RoomView['status'];
type RoomActivityInput = Pick<Doc<'rooms'>, '_id' | 'status' | 'hostPlayerId'>;
type HostCandidate = Pick<
  Doc<'roomPlayers'>,
  'userId' | 'seatIndex' | 'lastSeenAt'
>;

/** Historical codes keep resolving; native hosts come from canonical membership. */
export async function getRoomByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<RoomView | null> {
  const room = await ctx.db
    .query('rooms')
    .withIndex('by_code', (q) => q.eq('code', code.trim().toUpperCase()))
    .first();
  if (!room) return null;

  let hostUserId = room.hostUserId;
  if (room.hostPlayerId) {
    const host = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room_player', (q) =>
        q.eq('roomId', room._id).eq('playerId', room.hostPlayerId)
      )
      .unique();
    if (!host) throw new ConvexError('Room host profile not found');
    hostUserId = host.userId;
  }
  if (!hostUserId || !room.status) {
    throw new ConvexError('Room metadata not found');
  }
  return { ...room, hostUserId, status: room.status };
}

/** Project app profiles through the canonical live roster, preserving old archives. */
export async function getRoomPlayers(
  ctx: QueryCtx | MutationCtx,
  room: Pick<Doc<'rooms'>, '_id' | 'hostPlayerId'>
): Promise<Doc<'roomPlayers'>[]> {
  const roomId = room._id;
  if (!room.hostPlayerId) {
    return await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .collect();
  }

  const members = await ctx.db
    .query('roomMembers')
    .withIndex('by_room_seat', (q) => q.eq('roomId', roomId))
    .filter((q) => q.eq(q.field('closedAt'), undefined))
    .collect();
  return await Promise.all(
    members.map(async (member) => {
      const profile = await ctx.db
        .query('roomPlayers')
        .withIndex('by_room_player', (q) =>
          q.eq('roomId', roomId).eq('playerId', member.playerId)
        )
        .unique();
      if (!profile) throw new ConvexError('Room player profile not found');
      return {
        ...profile,
        seatIndex: member.seatIndex,
        lastSeenAt: member.lastSeenAt ?? member.joinedAt,
      };
    })
  );
}

/** Project a game's frozen writers, retaining their profiles after room closure. */
export async function getGamePlayers(
  ctx: QueryCtx | MutationCtx,
  game: Doc<'games'>
): Promise<Doc<'roomPlayers'>[]> {
  const matchId = game.matchId;
  if (!matchId) {
    const room = await ctx.db.get(game.roomId);
    return room ? await getRoomPlayers(ctx, room) : [];
  }

  const participants = await ctx.db
    .query('matchParticipants')
    .withIndex('by_match_seat', (q) => q.eq('matchId', matchId))
    .collect();
  return await Promise.all(
    participants.map(async (participant) => {
      const [profile, member] = await Promise.all([
        ctx.db
          .query('roomPlayers')
          .withIndex('by_room_player', (q) =>
            q.eq('roomId', game.roomId).eq('playerId', participant.playerId)
          )
          .unique(),
        ctx.db
          .query('roomMembers')
          .withIndex('by_room_player', (q) =>
            q.eq('roomId', game.roomId).eq('playerId', participant.playerId)
          )
          .unique(),
      ]);
      if (!profile) throw new ConvexError('Room player profile not found');
      return {
        ...profile,
        seatIndex: participant.seatIndex,
        lastSeenAt:
          member && member.closedAt === undefined
            ? (member.lastSeenAt ?? member.joinedAt)
            : undefined,
      };
    })
  );
}

/** Parlor owns native match liveness; legacy rows remain readable while draining. */
export async function getActiveGame(
  ctx: QueryCtx | MutationCtx,
  room: Pick<Doc<'rooms'>, '_id' | 'hostPlayerId'>
): Promise<Doc<'games'> | null> {
  const roomId = room._id;
  if (room.hostPlayerId) {
    const match = await ctx.db
      .query('matches')
      .withIndex('by_room_status', (q) =>
        q.eq('roomId', roomId).eq('status', 'active')
      )
      .unique();
    if (!match) return null;
    const game = await ctx.db
      .query('games')
      .withIndex('by_match', (q) => q.eq('matchId', match._id))
      .unique();
    if (!game || game.roomId !== roomId || game.status !== 'IN_PROGRESS') {
      return null;
    }
    return game;
  }
  return await ctx.db
    .query('games')
    .withIndex('by_room_status', (q) =>
      q.eq('roomId', roomId).eq('status', 'IN_PROGRESS')
    )
    .first();
}

/** Get the latest normally completed game for the retained reveal view. */
export async function getCompletedGame(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<'rooms'>
): Promise<Doc<'games'> | null> {
  const game = await ctx.db
    .query('games')
    .withIndex('by_room_status', (q) =>
      q.eq('roomId', roomId).eq('status', 'COMPLETED')
    )
    .order('desc')
    .first();
  return isRevealReady(game) ? game : null;
}

/** Application metadata describes idle presentation, never native match authority. */
export async function getRoomActivity(
  ctx: QueryCtx | MutationCtx,
  room: RoomActivityInput
): Promise<{ activeGame: Doc<'games'> | null; status: RoomStatus }> {
  const activeGame = await getActiveGame(ctx, room);
  return {
    activeGame,
    status: activeGame
      ? 'IN_PROGRESS'
      : room.status === 'COMPLETED'
        ? 'COMPLETED'
        : 'LOBBY',
  };
}

export async function deriveRoomStatus(
  ctx: QueryCtx | MutationCtx,
  room: RoomActivityInput
): Promise<RoomStatus> {
  const { status } = await getRoomActivity(ctx, room);
  return status;
}

export async function requireRoomByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<RoomView> {
  const room = await getRoomByCode(ctx, code);
  if (!room) throw new ConvexError('Room not found');
  return room;
}

/**
 * Reveal-fallback host choice among present participants. Live room host
 * transfer is Parlor's; this only ranks writers for an absent assigned reader.
 */
export function selectNextHostId(
  players: HostCandidate[],
  now: number,
  staleMs: number
): Id<'users'> | null {
  const present = players.filter(
    (player) => !isPresenceStale(player.lastSeenAt, now, staleMs)
  );
  if (present.length === 0) return null;

  present.sort((left, right) => {
    const leftSeat = left.seatIndex ?? Number.MAX_SAFE_INTEGER;
    const rightSeat = right.seatIndex ?? Number.MAX_SAFE_INTEGER;
    if (leftSeat !== rightSeat) return leftSeat - rightSeat;
    return left.userId < right.userId ? -1 : left.userId > right.userId ? 1 : 0;
  });
  return present[0].userId;
}
/** Old invitations are drained, never silently converted into new live rooms. */
export async function requireLiveRoomByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<RoomView & { hostPlayerId: Id<'players'> }> {
  const room = await requireRoomByCode(ctx, code);
  if (!room.hostPlayerId || room.closedAt !== undefined) {
    throw new ConvexError('Room is closed');
  }
  return { ...room, hostPlayerId: room.hostPlayerId };
}
