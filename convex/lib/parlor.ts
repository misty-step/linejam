import type { PlayerActor } from '@parlor/convex';
import { resolvePlayerForIdentity } from '@parlor/convex/identity';
import { recordHeartbeat } from '@parlor/convex/presence';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/** Translate structured Parlor rejections at Linejam's mutation boundary. */
export function parlorErrorCode(cause: unknown): string | undefined {
  if (!(cause instanceof ConvexError)) return undefined;
  const data = cause.data;
  return data instanceof Object && 'code' in data
    ? String(data.code)
    : undefined;
}

/** Resolve only the user already verified by Linejam's authentication boundary. */
export async function ensureParlorPlayer(
  ctx: MutationCtx,
  user: Doc<'users'>
): Promise<PlayerActor> {
  return await resolvePlayerForIdentity(
    ctx,
    {
      identityKey: `linejam:user:${user._id}`,
      kind: user.clerkUserId ? 'authenticated' : 'guest',
      guestId: user.clerkUserId ? undefined : user.guestId,
    },
    { create: true }
  );
}

/** Indexed live membership lookup without projecting the entire room roster. */
export async function findRoomMember(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  roomId: Id<'rooms'>
) {
  const profile = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room_user', (q) =>
      q.eq('roomId', roomId).eq('userId', userId)
    )
    .first();
  const playerId = profile?.playerId;
  if (!playerId) return null;
  const member = await ctx.db
    .query('roomMembers')
    .withIndex('by_room_player', (q) =>
      q.eq('roomId', roomId).eq('playerId', playerId)
    )
    .unique();
  if (!member || member.closedAt !== undefined) return null;
  return { profile, member };
}

/** Find active membership through the retained identity, including after account linking. */
export async function findRoomActor(
  ctx: QueryCtx | MutationCtx,
  user: Doc<'users'>,
  roomId: Id<'rooms'>
): Promise<PlayerActor | null> {
  const membership = await findRoomMember(ctx, user._id, roomId);
  if (!membership) return null;
  const playerId = membership.member.playerId;
  const player = await ctx.db.get(playerId);
  if (!player) throw new ConvexError('Room player identity not found');
  return {
    playerId: player._id,
    identityKey: player.identityKey,
    kind: player.kind,
    guestId: player.guestId,
  };
}

export async function getRoomActor(
  ctx: QueryCtx | MutationCtx,
  user: Doc<'users'>,
  roomId: Id<'rooms'>
): Promise<PlayerActor> {
  const actor = await findRoomActor(ctx, user, roomId);
  if (!actor) throw new ConvexError('Not a room member');
  return actor;
}

/** Successful commands and periodic heartbeats share one live-presence boundary. */
export async function recordRoomActivity(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  actor: PlayerActor
): Promise<void> {
  const result = await recordHeartbeat(ctx, {
    roomId: room._id,
    actor,
    now: Date.now(),
  });
  if (result.hostPlayerId === room.hostPlayerId) return;
  const host = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room_player', (q) =>
      q.eq('roomId', room._id).eq('playerId', result.hostPlayerId)
    )
    .unique();
  if (!host) throw new ConvexError('Room host profile not found');
  await ctx.db.patch(room._id, { hostUserId: host.userId });
}
