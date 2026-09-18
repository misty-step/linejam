import { isHostStale, selectNextHost } from "@parlor/core";
import type { ConvexMutationCtx, PlayerActor, RoomDoc, RoomId } from "./policy.js";
import {
  listMatchParticipants,
  listRoomMembers,
  findActiveMatch,
  findMember,
  findRoom,
  parlorError,
  type MatchParticipantDoc,
  type RoomMemberDoc,
} from "./runtime.js";

export interface HeartbeatResult {
  readonly room: RoomDoc;
  readonly member: RoomMemberDoc;
  readonly hostPlayerId: PlayerActor["playerId"];
}

/** Choose and persist the deterministic replacement when a host is stale. */
export const selfHealHost = async (
  ctx: ConvexMutationCtx,
  input: {
    readonly room: RoomDoc;
    readonly members: readonly RoomMemberDoc[];
    readonly now: number;
    readonly activeParticipants?: readonly MatchParticipantDoc[];
  },
): Promise<RoomDoc> => {
  const currentHost = input.members.find((member) => member.playerId === input.room.hostPlayerId);
  if (currentHost && !isHostStale(currentHost, input.now)) {
    return input.room;
  }
  const selection = selectNextHost({
    members: input.members,
    now: input.now,
    ...(input.activeParticipants === undefined ? {} : { participants: input.activeParticipants }),
  });
  if (!selection.ok || selection.value.playerId === input.room.hostPlayerId) {
    return input.room;
  }
  const candidate = selection.value;
  await ctx.db.patch(input.room._id, { hostPlayerId: candidate.playerId });
  return {
    ...input.room,
    hostPlayerId: candidate.playerId,
  };
};

/** Heartbeat a member and apply host self-healing in the same transaction. */
export const recordHeartbeat = async (
  ctx: ConvexMutationCtx,
  input: {
    readonly roomId: RoomId;
    readonly actor: PlayerActor;
    readonly now: number;
  },
): Promise<HeartbeatResult> => {
  const room = (await findRoom(ctx, input.roomId)) ?? parlorError("ROOM_NOT_OPEN");
  if (room.closedAt !== undefined) parlorError("ROOM_NOT_OPEN");
  const member =
    (await findMember(ctx, input.roomId, input.actor.playerId)) ?? parlorError("NOT_A_ROOM_MEMBER");
  if (!Number.isSafeInteger(input.now) || input.now < 0) {
    parlorError("PRESENCE_TIME_INVALID");
  }
  const previousMemberSeenAt = member.lastSeenAt ?? member.joinedAt;
  if (input.now < previousMemberSeenAt) {
    parlorError("PRESENCE_TIME_INVALID");
  }
  await ctx.db.patch(member._id, { lastSeenAt: input.now });
  const members = await listRoomMembers(ctx, input.roomId);
  const activeMatch = await findActiveMatch(ctx, input.roomId);
  const activeParticipants = activeMatch
    ? await listMatchParticipants(ctx, activeMatch._id)
    : undefined;
  const healedRoom =
    activeParticipants === undefined
      ? await selfHealHost(ctx, {
          room,
          members,
          now: input.now,
        })
      : await selfHealHost(ctx, {
          room,
          members,
          now: input.now,
          activeParticipants,
        });
  const refreshedMember =
    (await findMember(ctx, input.roomId, input.actor.playerId)) ?? parlorError("NOT_A_ROOM_MEMBER");
  return {
    room: healedRoom,
    member: refreshedMember,
    hostPlayerId: healedRoom.hostPlayerId,
  };
};
