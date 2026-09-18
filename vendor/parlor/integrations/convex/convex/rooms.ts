import { allocateSeat } from "@parlor/core";
import { mutationGeneric, queryGeneric } from "convex/server";
import type { GenericId } from "convex/values";
import { v } from "convex/values";

import { ensurePlayer, resolvePlayer } from "./identity.js";
import {
  findActiveMatch,
  findMember,
  findOpenRoomByCode,
  findRoom,
  listMatchParticipants,
  listOpenMembershipsForPlayer,
  listOpenRoomsForHost,
  listRoomMembers,
  nextCycleForRoom,
  normalizeDisplayName,
  normalizeRoomCode,
  parlorError,
  type ConvexCtx,
  type ConvexMutationCtx,
  type MatchEnvelope,
  type PlayerActor,
  type PlayerId,
  type RoomDoc,
  type RoomId,
  type RoomMemberDoc,
  MAX_JOIN_ATTEMPTS_PER_WINDOW,
  MAX_OPEN_MEMBERSHIPS_PER_PLAYER,
  MAX_OPEN_ROOMS_PER_PLAYER,
  MAX_ROOM_CODE_ATTEMPTS,
  MAX_ROOM_MEMBERS,
  JOIN_ATTEMPT_WINDOW_MS,
  generateRoomCode,
  safeNow,
} from "./runtime.js";
import { abandonMatch } from "./matches.js";
import { recordHeartbeat, selfHealHost } from "./presence.js";

const guestTokenArg = v.optional(v.string());

const roomResultValidator = v.object({
  roomId: v.id("rooms"),
  playerId: v.id("players"),
  code: v.string(),
  seatIndex: v.number(),
  eligibleFromCycle: v.number(),
});
export interface JoinRoomSuccess {
  readonly ok: true;
  readonly roomId: RoomId;
  readonly playerId: PlayerId;
  readonly code: string;
  readonly seatIndex: number;
  readonly eligibleFromCycle: number;
}

export type JoinRoomErrorCode =
  | "INVALID_DISPLAY_NAME"
  | "INVALID_ROOM_CODE"
  | "ROOM_JOIN_RATE_LIMIT"
  | "ROOM_NOT_OPEN"
  | "ROOM_DATA_INVALID"
  | "ROOM_FULL";

export interface JoinRoomFailure {
  readonly ok: false;
  readonly code: JoinRoomErrorCode;
}

export type JoinRoomResult = JoinRoomSuccess | JoinRoomFailure;

const joinRoomErrorCodeValidator = v.union(
  v.literal("INVALID_DISPLAY_NAME"),
  v.literal("INVALID_ROOM_CODE"),
  v.literal("ROOM_JOIN_RATE_LIMIT"),
  v.literal("ROOM_NOT_OPEN"),
  v.literal("ROOM_DATA_INVALID"),
  v.literal("ROOM_FULL"),
);

const joinRoomResultValidator = v.union(
  v.object({
    ok: v.literal(true),
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    code: v.string(),
    seatIndex: v.number(),
    eligibleFromCycle: v.number(),
  }),
  v.object({
    ok: v.literal(false),
    code: joinRoomErrorCodeValidator,
  }),
);

const joinRoomSuccess = (
  roomId: RoomId,
  actor: PlayerActor,
  code: string,
  seatIndex: number,
  eligibleFromCycle: number,
): JoinRoomSuccess => ({
  ok: true,
  roomId,
  playerId: actor.playerId,
  code,
  seatIndex,
  eligibleFromCycle,
});

const joinRoomFailure = (code: JoinRoomErrorCode): JoinRoomFailure => ({ ok: false, code });

const heartbeatResultValidator = v.object({
  roomId: v.id("rooms"),
  playerId: v.id("players"),
  hostPlayerId: v.id("players"),
  isHost: v.boolean(),
  lastSeenAt: v.number(),
});

const projectedRoomValidator = v.object({
  id: v.id("rooms"),
  code: v.string(),
  hostPlayerId: v.id("players"),
  createdAt: v.number(),
  closedAt: v.optional(v.number()),
});

const projectedMemberValidator = v.object({
  playerId: v.id("players"),
  displayName: v.string(),
  seatIndex: v.number(),
  joinedAt: v.number(),
  eligibleFromCycle: v.number(),
  lastSeenAt: v.optional(v.number()),
  isHost: v.boolean(),
});

const activeMatchValidator = v.object({
  id: v.id("matches"),
  roomId: v.id("rooms"),
  cycle: v.number(),
  status: v.literal("active"),
  startedAt: v.number(),
  hardDeadline: v.optional(v.boolean()),
  participantIds: v.array(v.id("players")),
});

const roomStateValidator = v.object({
  viewerPlayerId: v.id("players"),
  room: projectedRoomValidator,
  members: v.array(projectedMemberValidator),
  activeMatch: v.union(v.null(), activeMatchValidator),
});

const roomResult = (
  roomId: RoomId,
  actor: PlayerActor,
  code: string,
  seatIndex: number,
  eligibleFromCycle: number,
) => ({
  roomId,
  playerId: actor.playerId,
  code,
  seatIndex,
  eligibleFromCycle,
});

const projectRoom = (room: RoomDoc) => ({
  id: room._id,
  code: room.code,
  hostPlayerId: room.hostPlayerId,
  createdAt: room.createdAt,
  ...(room.closedAt === undefined ? {} : { closedAt: room.closedAt }),
});

const projectMember = (member: RoomMemberDoc, room: RoomDoc) => ({
  playerId: member.playerId,
  displayName: member.displayName,
  seatIndex: member.seatIndex,
  joinedAt: member.joinedAt,
  eligibleFromCycle: member.eligibleFromCycle,
  ...(member.lastSeenAt === undefined ? {} : { lastSeenAt: member.lastSeenAt }),
  isHost: member.playerId === room.hostPlayerId,
});

interface ActiveMatchProjection {
  readonly id: GenericId<"matches">;
  readonly roomId: RoomId;
  readonly cycle: number;
  readonly status: "active";
  readonly startedAt: number;
  readonly hardDeadline?: boolean;
  readonly participantIds: PlayerId[];
}

const activeMatchProjection = async (
  ctx: ConvexCtx,
  roomId: RoomId,
): Promise<ActiveMatchProjection | null> => {
  const active = await findActiveMatch(ctx, roomId);
  if (!active) return null;
  const participants = await listMatchParticipants(ctx, active._id);
  return {
    id: active._id,
    roomId: active.roomId,
    cycle: active.cycle,
    status: "active",
    startedAt: active.startedAt,
    ...(active.hardDeadline === false ? { hardDeadline: false } : {}),
    participantIds: participants.map((participant) => participant.playerId),
  };
};
const recordJoinAttempt = async (
  ctx: ConvexMutationCtx,
  playerId: PlayerId,
  now: number,
): Promise<boolean> => {
  const player = (await ctx.db.get(playerId)) ?? parlorError("PLAYER_NOT_FOUND");
  const startedAt = player.joinAttemptWindowStartedAt;
  const count = player.joinAttemptCount;
  if (
    startedAt === undefined ||
    count === undefined ||
    !Number.isSafeInteger(startedAt) ||
    !Number.isSafeInteger(count)
  ) {
    await ctx.db.patch(playerId, {
      joinAttemptWindowStartedAt: now,
      joinAttemptCount: 1,
    });
    return true;
  }
  if (count < 1 || !(now < startedAt || now - startedAt < JOIN_ATTEMPT_WINDOW_MS)) {
    await ctx.db.patch(playerId, {
      joinAttemptWindowStartedAt: now,
      joinAttemptCount: 1,
    });
    return true;
  }
  if (count >= MAX_JOIN_ATTEMPTS_PER_WINDOW) return false;
  await ctx.db.patch(playerId, { joinAttemptCount: count + 1 });
  return true;
};

/** Trusted canonical closure for already-authorized abandonment callbacks. */
export const closeRoomAt = async (
  ctx: ConvexMutationCtx,
  room: Pick<RoomDoc, "_id">,
  closedAt: number,
): Promise<void> => {
  const members = await listRoomMembers(ctx, room._id);
  if (members.length > MAX_ROOM_MEMBERS) parlorError("ROOM_DATA_INVALID");
  for (const member of members) {
    await ctx.db.patch(member._id, { closedAt });
  }
  await ctx.db.patch(room._id, { closedAt });
};

/** Create an open room and its host membership in one transaction. */
export const createRoomForPlayer = async (
  ctx: ConvexMutationCtx,
  input: {
    readonly actor: PlayerActor;
    readonly displayName: string;
    readonly normalizeName?: (value: string) => string | null;
    readonly isCodeAvailable?: (code: string) => boolean | PromiseLike<boolean>;
  },
): Promise<Omit<JoinRoomSuccess, "ok">> => {
  const displayName =
    (input.normalizeName ?? normalizeDisplayName)(input.displayName) ??
    parlorError("INVALID_DISPLAY_NAME");
  const { actor } = input;
  const openRooms = await listOpenRoomsForHost(ctx, actor.playerId, MAX_OPEN_ROOMS_PER_PLAYER + 1);
  if (openRooms.length >= MAX_OPEN_ROOMS_PER_PLAYER) {
    parlorError("ROOM_CREATION_RATE_LIMIT");
  }
  const memberships = await listOpenMembershipsForPlayer(
    ctx,
    actor.playerId,
    MAX_OPEN_MEMBERSHIPS_PER_PLAYER,
  );
  if (memberships.length >= MAX_OPEN_MEMBERSHIPS_PER_PLAYER) {
    parlorError("ROOM_CREATION_RATE_LIMIT");
  }
  const now = safeNow();
  for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode();
    const existing = await findOpenRoomByCode(ctx, code);
    if (existing || (input.isCodeAvailable && !(await input.isCodeAvailable(code)))) continue;
    const roomId = await ctx.db.insert("rooms", {
      code,
      hostPlayerId: actor.playerId,
      createdAt: now,
    });
    await ctx.db.insert("roomMembers", {
      roomId,
      playerId: actor.playerId,
      displayName,
      seatIndex: 0,
      joinedAt: now,
      eligibleFromCycle: 1,
    });
    return roomResult(roomId, actor, code, 0, 1);
  }
  return parlorError("ROOM_CODE_EXHAUSTED");
};

/** Registered room creation with server-resolved identity. */
export const createRoom = mutationGeneric({
  args: {
    displayName: v.string(),
    guestToken: guestTokenArg,
  },
  returns: roomResultValidator,
  handler: async (ctx, args) => {
    const displayName =
      normalizeDisplayName(args.displayName) ?? parlorError("INVALID_DISPLAY_NAME");
    const actor = await ensurePlayer(ctx, args.guestToken);
    return createRoomForPlayer(ctx, { actor, displayName });
  },
});

/** Join a room, preserving an existing membership and seat on retries. */
export const joinRoomForPlayer = async (
  ctx: ConvexMutationCtx,
  input: {
    readonly actor: PlayerActor;
    readonly code: string;
    readonly displayName: string;
    readonly normalizeName?: (value: string) => string | null;
    readonly capacity?: number;
  },
): Promise<JoinRoomResult> => {
  const displayName = (input.normalizeName ?? normalizeDisplayName)(input.displayName);
  if (displayName === null) return joinRoomFailure("INVALID_DISPLAY_NAME");
  const { actor } = input;
  const code = normalizeRoomCode(input.code);
  if (code === null) {
    const allowed = await recordJoinAttempt(ctx, actor.playerId, safeNow());
    return joinRoomFailure(allowed ? "INVALID_ROOM_CODE" : "ROOM_JOIN_RATE_LIMIT");
  }
  const room = await findOpenRoomByCode(ctx, code);
  const existing = room ? await findMember(ctx, room._id, actor.playerId) : null;
  if (existing && room) {
    if (existing.displayName !== displayName) {
      await ctx.db.patch(existing._id, { displayName });
    }
    return joinRoomSuccess(
      room._id,
      actor,
      room.code,
      existing.seatIndex,
      existing.eligibleFromCycle,
    );
  }
  const capacity = input.capacity ?? MAX_ROOM_MEMBERS;
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_ROOM_MEMBERS) {
    parlorError("ROOM_CAPACITY_INVALID");
  }
  const allowed = await recordJoinAttempt(ctx, actor.playerId, safeNow());
  if (!allowed) return joinRoomFailure("ROOM_JOIN_RATE_LIMIT");
  if (!room) return joinRoomFailure("ROOM_NOT_OPEN");
  const memberships = await listOpenMembershipsForPlayer(
    ctx,
    actor.playerId,
    MAX_OPEN_MEMBERSHIPS_PER_PLAYER,
  );
  if (memberships.length >= MAX_OPEN_MEMBERSHIPS_PER_PLAYER) {
    return joinRoomFailure("ROOM_JOIN_RATE_LIMIT");
  }
  const members = await listRoomMembers(ctx, room._id);
  if (members.length > MAX_ROOM_MEMBERS) return joinRoomFailure("ROOM_DATA_INVALID");
  const allocation = allocateSeat(members.map((member) => member.seatIndex));
  if (!allocation.ok) {
    return joinRoomFailure(
      allocation.error._tag === "RoomFull" ? "ROOM_FULL" : "ROOM_DATA_INVALID",
    );
  }
  if (members.length >= capacity) return joinRoomFailure("ROOM_FULL");
  const seatIndex = allocation.value;
  const eligibleFromCycle = await nextCycleForRoom(ctx, room._id);
  await ctx.db.insert("roomMembers", {
    roomId: room._id,
    playerId: actor.playerId,
    displayName,
    seatIndex,
    joinedAt: safeNow(),
    eligibleFromCycle,
  });
  return joinRoomSuccess(room._id, actor, room.code, seatIndex, eligibleFromCycle);
};

/** Registered room admission; failure receipts commit join-attempt accounting. */
export const joinRoom = mutationGeneric({
  args: {
    code: v.string(),
    displayName: v.string(),
    guestToken: guestTokenArg,
  },
  returns: joinRoomResultValidator,
  handler: async (ctx, args): Promise<JoinRoomResult> => {
    const displayName = normalizeDisplayName(args.displayName);
    if (displayName === null) return joinRoomFailure("INVALID_DISPLAY_NAME");
    const actor = await ensurePlayer(ctx, args.guestToken);
    return joinRoomForPlayer(ctx, { actor, code: args.code, displayName });
  },
});

/** Leave a room and deterministically migrate a stale/departed host. */
export const leaveRoomForPlayer = async (
  ctx: ConvexMutationCtx,
  input: {
    readonly actor: PlayerActor;
    readonly roomId: RoomId;
    readonly onAbandoned?: (envelope: MatchEnvelope) => void | PromiseLike<void>;
  },
): Promise<null> => {
  const { actor, roomId } = input;
  const room = (await findRoom(ctx, roomId)) ?? parlorError("ROOM_NOT_FOUND");
  const member =
    (await findMember(ctx, roomId, actor.playerId)) ?? parlorError("NOT_A_ROOM_MEMBER");
  await ctx.db.delete(member._id);
  const members = await listRoomMembers(ctx, roomId);
  if (room.closedAt !== undefined) return null;
  const now = safeNow();
  const active = await findActiveMatch(ctx, roomId);
  const activeParticipants = active ? await listMatchParticipants(ctx, active._id) : undefined;
  if (members.length === 0) {
    if (active) {
      const abandoned = await abandonMatch(ctx, {
        matchId: active._id,
        reason: "everyone-away",
        nowMs: now,
      });
      await input.onAbandoned?.(abandoned);
    }
    await closeRoomAt(ctx, room, now);
    return null;
  }
  if (
    active &&
    activeParticipants &&
    !activeParticipants.some((participant) =>
      members.some((candidate) => candidate.playerId === participant.playerId),
    )
  ) {
    const abandoned = await abandonMatch(ctx, {
      matchId: active._id,
      reason: "everyone-away",
      nowMs: now,
    });
    await input.onAbandoned?.(abandoned);
    await selfHealHost(ctx, { room, members, now });
    return null;
  }
  await selfHealHost(ctx, {
    room,
    members,
    now,
    ...(activeParticipants === undefined ? {} : { activeParticipants }),
  });
  return null;
};

/** Registered room departure with server-resolved identity. */
export const leaveRoom = mutationGeneric({
  args: {
    roomId: v.id("rooms"),
    guestToken: guestTokenArg,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await resolvePlayer(ctx, args.guestToken);
    return leaveRoomForPlayer(ctx, { actor, roomId: args.roomId });
  },
});

/** Close a room; a host-ended active match is abandoned atomically first. */
export const closeRoomForPlayer = async (
  ctx: ConvexMutationCtx,
  input: {
    readonly actor: PlayerActor;
    readonly roomId: RoomId;
    readonly onAbandoned?: (envelope: MatchEnvelope) => void | PromiseLike<void>;
  },
): Promise<null> => {
  const { actor, roomId } = input;
  const room = (await findRoom(ctx, roomId)) ?? parlorError("ROOM_NOT_FOUND");
  if (room.hostPlayerId !== actor.playerId) parlorError("HOST_REQUIRED");
  if (!(await findMember(ctx, roomId, actor.playerId))) parlorError("NOT_A_ROOM_MEMBER");
  if (room.closedAt !== undefined) parlorError("ROOM_CLOSED");
  const now = safeNow();
  const active = await findActiveMatch(ctx, room._id);
  if (active) {
    const abandoned = await abandonMatch(ctx, {
      matchId: active._id,
      actor,
      reason: "host-ended",
      nowMs: now,
    });
    await input.onAbandoned?.(abandoned);
  }
  await closeRoomAt(ctx, room, now);
  return null;
};

/** Registered host-only closure with server-resolved identity. */
export const closeRoom = mutationGeneric({
  args: {
    roomId: v.id("rooms"),
    guestToken: guestTokenArg,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await resolvePlayer(ctx, args.guestToken);
    return closeRoomForPlayer(ctx, { actor, roomId: args.roomId });
  },
});

/** Return only room/member/match state safe for the authenticated caller. */
export const getRoomState = queryGeneric({
  args: {
    roomId: v.id("rooms"),
    guestToken: guestTokenArg,
  },
  returns: roomStateValidator,
  handler: async (ctx, args) => {
    const actor = await resolvePlayer(ctx, args.guestToken);
    const room = (await findRoom(ctx, args.roomId)) ?? parlorError("ROOM_NOT_FOUND");
    const viewer =
      (await findMember(ctx, args.roomId, actor.playerId)) ?? parlorError("NOT_A_ROOM_MEMBER");
    void viewer;
    const members = await listRoomMembers(ctx, args.roomId);
    if (members.length > MAX_ROOM_MEMBERS) parlorError("ROOM_DATA_INVALID");
    const activeMatch = await activeMatchProjection(ctx, args.roomId);
    return {
      viewerPlayerId: actor.playerId,
      room: projectRoom(room),
      members: members.map((member) => projectMember(member, room)),
      activeMatch,
    };
  },
});

/** Record presence by room id and apply deterministic host self-healing. */
export const heartbeat = mutationGeneric({
  args: {
    roomId: v.id("rooms"),
    guestToken: guestTokenArg,
  },
  returns: heartbeatResultValidator,
  handler: async (ctx, args) => {
    const actor = await resolvePlayer(ctx, args.guestToken);
    const room = (await findRoom(ctx, args.roomId)) ?? parlorError("ROOM_NOT_FOUND");
    const result = await recordHeartbeat(ctx, {
      roomId: room._id,
      actor,
      now: safeNow(),
    });
    return {
      roomId: result.room._id,
      playerId: actor.playerId,
      hostPlayerId: result.hostPlayerId,
      isHost: result.hostPlayerId === actor.playerId,
      lastSeenAt: result.member.lastSeenAt ?? safeNow(),
    };
  },
});
