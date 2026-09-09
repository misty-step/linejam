import {
  hasMatchDeadlineElapsed,
  selectMatchParticipants,
  validateMatchEndTime,
} from "@parlor/core";
import { mutationGeneric } from "convex/server";
import { v } from "convex/values";
import { resolvePlayer } from "./identity.js";
import {
  DEFAULT_MAX_ELIGIBLE_PLAYERS,
  DEFAULT_MIN_ELIGIBLE_PLAYERS,
  findActiveMatch,
  findMatch,
  findMember,
  findRoom,
  listRoomMembers,
  nextCycleForRoom,
  parlorError,
  safeNow,
  toMatchEnvelope,
  type AbandonmentReason,
  type ConvexCtx,
  type ConvexMutationCtx,
  type MatchDoc,
  type MatchEnvelope,
  type MatchId,
  type PlayerActor,
  type RoomId,
} from "./runtime.js";

const activeEnvelopeValidator = v.object({
  id: v.id("matches"),
  roomId: v.id("rooms"),
  cycle: v.number(),
  status: v.literal("active"),
  startedAt: v.number(),
  hardDeadline: v.optional(v.boolean()),
});

const matchEnvelopeValidator = v.union(
  activeEnvelopeValidator,
  v.object({
    id: v.id("matches"),
    roomId: v.id("rooms"),
    cycle: v.number(),
    status: v.literal("completed"),
    startedAt: v.number(),
    hardDeadline: v.optional(v.boolean()),
    completedAt: v.number(),
  }),
  v.object({
    id: v.id("matches"),
    roomId: v.id("rooms"),
    cycle: v.number(),
    status: v.literal("abandoned"),
    startedAt: v.number(),
    hardDeadline: v.optional(v.boolean()),
    abandonedAt: v.number(),
    reason: v.union(
      v.literal("everyone-away"),
      v.literal("hard-deadline"),
      v.literal("host-ended"),
    ),
  }),
);

const activeEnvelope = (
  match: MatchDoc,
  now: number,
): Extract<MatchEnvelope, { status: "active" }> => {
  if (match.status !== "active" || hasMatchDeadlineElapsed(match, now)) {
    parlorError("MATCH_NOT_ACTIVE");
  }
  if (!validateMatchEndTime(match.startedAt, now).ok) parlorError("MATCH_TIMESTAMP_INVALID");
  return {
    id: match._id,
    roomId: match.roomId,
    cycle: match.cycle,
    status: "active",
    startedAt: match.startedAt,
    ...(match.hardDeadline === false ? { hardDeadline: false } : {}),
  };
};

/**
 * Begin the next match cycle and snapshot eligible members, present-only by default.
 *
 * This helper deliberately writes the envelope and participant rows directly
 * in its caller's transaction. It never calls another registered function.
 */
export const beginMatch = async (
  ctx: ConvexMutationCtx,
  input: {
    readonly roomId: RoomId;
    readonly actor: PlayerActor;
    readonly minPlayers?: number;
    readonly maxPlayers?: number;
    readonly nowMs?: number;
    /** Opt out of the default 30-minute cap; idle-room cleanup still applies. */
    readonly hardDeadline?: boolean;
    /** Server-owned start policy; the actor must always be a room member. */
    readonly authorization?: "host" | "member";
    /** Include away members without bypassing eligibility or roster validation. */
    readonly participation?: "present" | "eligible";
  },
): Promise<Extract<MatchEnvelope, { status: "active" }>> => {
  const room = (await findRoom(ctx, input.roomId)) ?? parlorError("ROOM_NOT_OPEN");
  if (room.closedAt !== undefined) parlorError("ROOM_NOT_OPEN");
  const membership = await findMember(ctx, input.roomId, input.actor.playerId);
  if (!membership) parlorError("NOT_A_ROOM_MEMBER");
  const authorization = input.authorization ?? "host";
  if (authorization !== "host" && authorization !== "member") {
    parlorError("MATCH_AUTHORIZATION_INVALID");
  }
  if (authorization === "host" && room.hostPlayerId !== input.actor.playerId) {
    parlorError("HOST_REQUIRED");
  }
  const now = input.nowMs ?? safeNow();
  const active = await findActiveMatch(ctx, input.roomId);
  if (active) {
    activeEnvelope(active, now);
    parlorError("MATCH_ALREADY_ACTIVE");
  }
  const cycle = await nextCycleForRoom(ctx, input.roomId);
  const minPlayers = input.minPlayers ?? DEFAULT_MIN_ELIGIBLE_PLAYERS;
  const maxPlayers = input.maxPlayers ?? DEFAULT_MAX_ELIGIBLE_PLAYERS;
  const members = await listRoomMembers(ctx, input.roomId);
  const participation = input.participation ?? "present";
  const selection = selectMatchParticipants({
    members,
    cycle,
    now,
    minPlayers,
    maxPlayers,
    participation,
  });
  if (!selection.ok) {
    const error = selection.error;
    const tooFew =
      participation === "eligible" ? "NOT_ENOUGH_ELIGIBLE_PLAYERS" : "NOT_ENOUGH_PRESENT_PLAYERS";
    if (error._tag === "NoParticipant") return parlorError(tooFew);
    if (error._tag === "PlayerCountOutOfBounds") {
      return parlorError(
        error.direction === "below-minimum"
          ? tooFew
          : participation === "eligible"
            ? "TOO_MANY_ELIGIBLE_PLAYERS"
            : "TOO_MANY_PRESENT_PLAYERS",
      );
    }
    if (error.field === "playerBounds") return parlorError("MATCH_PLAYER_BOUNDS_INVALID");
    if (error.field === "now") return parlorError("MATCH_TIMESTAMP_INVALID");
    if (error.field === "participation") return parlorError("MATCH_PARTICIPATION_INVALID");
    return parlorError("ROOM_DATA_INVALID");
  }
  const matchId = await ctx.db.insert("matches", {
    roomId: input.roomId,
    cycle,
    status: "active",
    startedAt: now,
    ...(input.hardDeadline === false ? { hardDeadline: false } : {}),
  });
  for (const member of selection.value) {
    await ctx.db.insert("matchParticipants", {
      matchId,
      playerId: member.playerId,
      seatIndex: member.seatIndex,
    });
  }
  return {
    id: matchId,
    roomId: input.roomId,
    cycle,
    status: "active",
    startedAt: now,
    ...(input.hardDeadline === false ? { hardDeadline: false } : {}),
  };
};

/** Registered reference mutation for starting a match from an app client. */
export const startMatch = mutationGeneric({
  args: {
    roomId: v.id("rooms"),
    guestToken: v.optional(v.string()),
  },
  returns: activeEnvelopeValidator,
  handler: async (ctx, args) => {
    const actor = await resolvePlayer(ctx, args.guestToken);
    return beginMatch(ctx, { roomId: args.roomId, actor });
  },
});

/** Gate every game command against status and the hard deadline; sweeping only persists cleanup. */
export const requireActiveMatch = async (
  ctx: ConvexCtx,
  matchId: MatchId,
  roomId?: RoomId,
): Promise<Extract<MatchEnvelope, { status: "active" }>> => {
  const match = (await findMatch(ctx, matchId)) ?? parlorError("MATCH_NOT_ACTIVE");
  if (roomId !== undefined && match.roomId !== roomId) {
    parlorError("MATCH_ROOM_MISMATCH");
  }
  return activeEnvelope(match, safeNow());
};

const requireParticipant = async (
  ctx: ConvexCtx,
  match: MatchDoc,
  actor: PlayerActor,
): Promise<void> => {
  const participant = await ctx.db
    .query("matchParticipants")
    .withIndex("by_match_player", (q) => q.eq("matchId", match._id).eq("playerId", actor.playerId))
    .unique();
  if (!participant) {
    parlorError("MATCH_PARTICIPANT_REQUIRED");
  }
};

/** Complete an active envelope from the composing game mutation. */
export const completeMatch = async (
  ctx: ConvexMutationCtx,
  input: {
    readonly matchId: MatchId;
    readonly actor?: PlayerActor;
    readonly nowMs?: number;
  },
): Promise<MatchEnvelope> => {
  const match = (await findMatch(ctx, input.matchId)) ?? parlorError("MATCH_NOT_ACTIVE");
  const completedAt = input.nowMs ?? safeNow();
  activeEnvelope(match, completedAt);
  if (input.actor) await requireParticipant(ctx, match, input.actor);
  await ctx.db.replace(match._id, {
    roomId: match.roomId,
    cycle: match.cycle,
    status: "completed",
    startedAt: match.startedAt,
    ...(match.hardDeadline === false ? { hardDeadline: false } : {}),
    completedAt,
  });
  return toMatchEnvelope({ ...match, status: "completed", completedAt });
};

/** Abandon an active envelope without mutating game-specific rows. */
export const abandonMatch = async (
  ctx: ConvexMutationCtx,
  input: {
    readonly matchId: MatchId;
    readonly reason: AbandonmentReason;
    readonly actor?: PlayerActor;
    readonly nowMs?: number;
  },
): Promise<MatchEnvelope> => {
  const match = (await findMatch(ctx, input.matchId)) ?? parlorError("MATCH_NOT_ACTIVE");
  if (match.status !== "active") parlorError("MATCH_NOT_ACTIVE");
  if (input.reason === "host-ended") {
    const actor = input.actor ?? parlorError("HOST_REQUIRED");
    const room = (await findRoom(ctx, match.roomId)) ?? parlorError("HOST_REQUIRED");
    if (!(await findMember(ctx, match.roomId, actor.playerId))) parlorError("HOST_REQUIRED");
    if (room.hostPlayerId !== actor.playerId) parlorError("HOST_REQUIRED");
  }
  const abandonedAt = input.nowMs ?? safeNow();
  const time = validateMatchEndTime(match.startedAt, abandonedAt, "abandonedAt");
  if (!time.ok) parlorError("MATCH_TIMESTAMP_INVALID");
  await ctx.db.replace(match._id, {
    roomId: match.roomId,
    cycle: match.cycle,
    status: "abandoned",
    startedAt: match.startedAt,
    ...(match.hardDeadline === false ? { hardDeadline: false } : {}),
    abandonedAt,
    reason: input.reason,
  });
  return toMatchEnvelope({ ...match, status: "abandoned", abandonedAt, reason: input.reason });
};

export { matchEnvelopeValidator };
