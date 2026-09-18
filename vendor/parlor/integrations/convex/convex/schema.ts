import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const playerKind = v.union(v.literal("authenticated"), v.literal("guest"));
const abandonmentReason = v.union(
  v.literal("everyone-away"),
  v.literal("hard-deadline"),
  v.literal("host-ended"),
);

const activeMatch = v.object({
  roomId: v.id("rooms"),
  cycle: v.number(),
  status: v.literal("active"),
  startedAt: v.number(),
  hardDeadline: v.optional(v.boolean()),
});
const completedMatch = v.object({
  roomId: v.id("rooms"),
  cycle: v.number(),
  status: v.literal("completed"),
  startedAt: v.number(),
  hardDeadline: v.optional(v.boolean()),
  completedAt: v.number(),
});
const abandonedMatch = v.object({
  roomId: v.id("rooms"),
  cycle: v.number(),
  status: v.literal("abandoned"),
  startedAt: v.number(),
  hardDeadline: v.optional(v.boolean()),
  abandonedAt: v.number(),
  reason: abandonmentReason,
});

/**
 * The reference integration's complete application-local table set.
 *
 * This is deliberately an ordinary app schema. It is not a Convex Component
 * schema and does not try to stand in for generated application code.
 */
export const parlorTables = {
  players: defineTable({
    identityKey: v.string(),
    kind: playerKind,
    guestId: v.optional(v.string()),
    createdAt: v.number(),
    joinAttemptWindowStartedAt: v.optional(v.number()),
    joinAttemptCount: v.optional(v.number()),
  })
    .index("by_identity", ["identityKey"])
    .index("by_kind", ["kind"]),

  rooms: defineTable({
    code: v.string(),
    hostPlayerId: v.id("players"),
    createdAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index("by_code_open", ["code", "closedAt"])
    .index("by_host_open", ["hostPlayerId", "closedAt"]),

  roomMembers: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    displayName: v.string(),
    seatIndex: v.number(),
    joinedAt: v.number(),
    eligibleFromCycle: v.number(),
    lastSeenAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_player", ["roomId", "playerId"])
    .index("by_room_seat", ["roomId", "seatIndex"])
    .index("by_player", ["playerId"])
    .index("by_player_open", ["playerId", "closedAt"]),

  matches: defineTable(v.union(activeMatch, completedMatch, abandonedMatch))
    .index("by_room_status", ["roomId", "status"])
    .index("by_room_cycle", ["roomId", "cycle"])
    .index("by_status_started_at", ["status", "startedAt"]),

  matchParticipants: defineTable({
    matchId: v.id("matches"),
    playerId: v.id("players"),
    seatIndex: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_player", ["playerId"])
    .index("by_match_player", ["matchId", "playerId"])
    .index("by_match_seat", ["matchId", "seatIndex"]),
} as const;

export default defineSchema(parlorTables);
