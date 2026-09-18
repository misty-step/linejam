/// <reference types="vite/client" />

import { ABANDON_AFTER_MS, HARD_DEADLINE_MS, classifyPresence } from "@parlor/core";
import { defineSchema, defineTable, makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import { v } from "convex/values";
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import {
  abandonMatch,
  beginMatch,
  completeMatch,
  requireActiveMatch,
  parlorTables,
  resolvePlayer,
  sweepAbandonedMatches,
} from "../src/index.js";
import { resolvePlayerForIdentity, type IdentityDescriptor } from "../convex/identity.js";
import { recordHeartbeat } from "../convex/presence.js";
import { sweepAbandonedRef } from "../convex/maintenance.js";
import schema from "../convex/schema.js";

type RoomId = GenericId<"rooms">;
type PlayerId = GenericId<"players">;
type MatchId = GenericId<"matches">;

interface RoomResult {
  readonly roomId: RoomId;
  readonly playerId: PlayerId;
  readonly code: string;
  readonly seatIndex: number;
  readonly eligibleFromCycle: number;
}
interface JoinRoomSuccess extends RoomResult {
  readonly ok: true;
}

interface JoinRoomFailure {
  readonly ok: false;
  readonly code: string;
}

type JoinRoomResult = JoinRoomSuccess | JoinRoomFailure;

interface ActiveMatch {
  readonly id: MatchId;
  readonly roomId: RoomId;
  readonly cycle: number;
  readonly status: "active";
  readonly startedAt: number;
}

interface HeartbeatResult {
  readonly roomId: RoomId;
  readonly playerId: PlayerId;
  readonly hostPlayerId: PlayerId;
  readonly isHost: boolean;
  readonly lastSeenAt: number;
}

interface ProjectedRoom {
  readonly id: RoomId;
  readonly code: string;
  readonly hostPlayerId: PlayerId;
  readonly createdAt: number;
  readonly closedAt?: number;
}

interface ProjectedMember {
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly seatIndex: number;
  readonly joinedAt: number;
  readonly eligibleFromCycle: number;
  readonly lastSeenAt?: number;
  readonly isHost: boolean;
}

interface RoomState {
  readonly viewerPlayerId: PlayerId;
  readonly room: ProjectedRoom;
  readonly members: readonly ProjectedMember[];
  readonly activeMatch: {
    readonly id: MatchId;
    readonly roomId: RoomId;
    readonly cycle: number;
    readonly status: "active";
    readonly startedAt: number;
    readonly participantIds: readonly PlayerId[];
  } | null;
}

type CreateRoomArgs = { displayName: string; guestToken?: string };
type JoinRoomArgs = { code: string; displayName: string; guestToken?: string };
type RoomIdentityArgs = { roomId: RoomId; guestToken?: string };
type StartMatchArgs = { roomId: RoomId; guestToken?: string };
type CloseRoomArgs = { roomId: RoomId; guestToken?: string };
type LeaveRoomArgs = { roomId: RoomId; guestToken?: string };
type HeartbeatArgs = { roomId: RoomId; guestToken?: string };

const createRoomRef = makeFunctionReference<"mutation", CreateRoomArgs, RoomResult>(
  "rooms:createRoom",
);
const joinRoomRef = makeFunctionReference<"mutation", JoinRoomArgs, JoinRoomResult>(
  "rooms:joinRoom",
);
const startMatchRef = makeFunctionReference<"mutation", StartMatchArgs, ActiveMatch>(
  "matches:startMatch",
);
const closeRoomRef = makeFunctionReference<"mutation", CloseRoomArgs, null>("rooms:closeRoom");
const leaveRoomRef = makeFunctionReference<"mutation", LeaveRoomArgs, null>("rooms:leaveRoom");
const roomStateRef = makeFunctionReference<"query", RoomIdentityArgs, RoomState>(
  "rooms:getRoomState",
);
const heartbeatRef = makeFunctionReference<"mutation", HeartbeatArgs, HeartbeatResult>(
  "rooms:heartbeat",
);

const modules = {
  ...import.meta.glob("../convex/**/*.ts"),
  "../convex/_generated/index.ts": async () => ({}),
};
type TestContext = TestConvex<typeof schema>;
type AuthenticatedTestContext = Omit<TestContext, "withIdentity" | "registerComponent">;
const testContext = (): TestContext => convexTest(schema, modules);

const identity = (subject: string, issuer = "test") => ({
  subject,
  tokenIdentifier: `${issuer}|${subject}`,
  issuer,
});

interface CreatedRoom {
  readonly authT: AuthenticatedTestContext;
  readonly room: RoomResult;
}

const createRoom = async (
  t: TestContext,
  subject: string,
  displayName = subject,
): Promise<CreatedRoom> => {
  const authT = t.withIdentity(identity(subject));
  const room = await authT.mutation(createRoomRef, { displayName });
  return { authT, room };
};

interface JoinedRoom extends JoinRoomSuccess {
  readonly authT: AuthenticatedTestContext;
}

const joinRoom = async (
  t: TestContext,
  code: string,
  subject: string,
  displayName = subject,
): Promise<JoinedRoom> => {
  const authT = t.withIdentity(identity(subject));
  const result = await authT.mutation(joinRoomRef, {
    code,
    displayName,
  });
  if (!result.ok) throw new Error(result.code);
  return { authT, ...result };
};
const unusedRoomCode = async (t: TestContext): Promise<string> =>
  t.run(async (ctx) => {
    const used = new Set((await ctx.db.query("rooms").collect()).map((room) => room.code));
    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    for (const first of alphabet) {
      for (const second of alphabet) {
        for (const third of alphabet) {
          for (const fourth of alphabet) {
            const code = `${first}${second}${third}${fourth}`;
            if (!used.has(code)) return code;
          }
        }
      }
    }
    throw new Error("room code space exhausted in test setup");
  });

describe("private Convex room and match reference integration", () => {
  it("rejects unauthenticated and malformed/tampered guest credentials", async () => {
    const t = testContext();
    await expect(t.mutation(createRoomRef, { displayName: "Nobody" })).rejects.toThrow();
    await expect(
      t.mutation(createRoomRef, {
        displayName: "Tampered",
        guestToken: "v1.unknown.payload.signature",
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(createRoomRef, {
        displayName: "Oversized",
        guestToken: "x".repeat(4097),
      }),
    ).rejects.toThrow();
    await expect(
      t.withIdentity(identity("authenticated")).mutation(createRoomRef, {
        displayName: "Authenticated",
        guestToken: "v1.unknown.payload.signature",
      }),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  it("keeps authenticated players distinct when issuers reuse a subject", async () => {
    const t = testContext();
    const first = t.withIdentity(identity("same-subject", "issuer-a"));
    const second = t.withIdentity(identity("same-subject", "issuer-b"));
    const firstRoom = await first.mutation(createRoomRef, { displayName: "First" });
    const secondRoom = await second.mutation(createRoomRef, { displayName: "Second" });
    expect(secondRoom.playerId).not.toBe(firstRoom.playerId);
  });
  it("keeps authenticated identity tuples distinct when delimiters collide", async () => {
    const t = testContext();
    const first = t.withIdentity(identity("subject", "issuer:part"));
    const second = t.withIdentity(identity("part:subject", "issuer"));
    const firstRoom = await first.mutation(createRoomRef, { displayName: "First" });
    const secondRoom = await second.mutation(createRoomRef, { displayName: "Second" });
    expect(secondRoom.playerId).not.toBe(firstRoom.playerId);
  });

  it("resolves trusted application identities durably without implicit creation", async () => {
    const t = testContext();
    const descriptor: IdentityDescriptor = {
      identityKey: "linejam:user:trusted",
      kind: "authenticated",
    };
    await expect(t.query((ctx) => resolvePlayerForIdentity(ctx, descriptor))).rejects.toThrow(
      "PLAYER_NOT_FOUND",
    );
    await expect(
      t.query((ctx) => resolvePlayerForIdentity(ctx, descriptor, { create: true })),
    ).rejects.toThrow("PLAYER_NOT_FOUND");
    const actor = await t.mutation((ctx) =>
      resolvePlayerForIdentity(ctx, descriptor, { create: true }),
    );
    const resolved = await t
      .withIdentity(identity("unrelated-auth"))
      .query((ctx) => resolvePlayerForIdentity(ctx, descriptor));
    expect(resolved.playerId).toBe(actor.playerId);
    const other = await t.mutation((ctx) =>
      resolvePlayerForIdentity(
        ctx,
        { identityKey: "linejam:user:other", kind: "guest" },
        { create: true },
      ),
    );
    expect(other.playerId).not.toBe(actor.playerId);
    const guestDescriptor: IdentityDescriptor = {
      identityKey: "app:guest:trusted-guest",
      kind: "guest",
      guestId: "trusted-guest",
    };
    const guest = await t.mutation((ctx) =>
      resolvePlayerForIdentity(ctx, guestDescriptor, { create: true }),
    );
    expect(guest).toMatchObject({
      identityKey: guestDescriptor.identityKey,
      guestId: "trusted-guest",
    });
    await expect(t.query((ctx) => resolvePlayer(ctx))).rejects.toThrow("UNAUTHENTICATED");
  });

  it("rejects malformed trusted descriptors and retains only valid identity rows", async () => {
    const t = testContext();
    for (const descriptor of [
      null,
      { identityKey: " ", kind: "guest" },
      { identityKey: "app:user", kind: "unverified" },
      { identityKey: "app:guest", kind: "guest", guestId: "" },
    ]) {
      await expect(
        t.mutation((ctx) =>
          resolvePlayerForIdentity(ctx, descriptor as IdentityDescriptor, { create: true }),
        ),
      ).rejects.toThrow("PLAYER_IDENTITY_INVALID");
    }
    await t.mutation((ctx) =>
      resolvePlayerForIdentity(
        ctx,
        { identityKey: "linejam:user:trusted", kind: "authenticated" },
        { create: true },
      ),
    );
    await t.mutation((ctx) =>
      resolvePlayerForIdentity(
        ctx,
        { identityKey: "linejam:user:other", kind: "guest" },
        { create: true },
      ),
    );
    await t.mutation((ctx) =>
      resolvePlayerForIdentity(
        ctx,
        { identityKey: "app:guest:trusted-guest", kind: "guest", guestId: "trusted-guest" },
        { create: true },
      ),
    );
    expect(
      (await t.run((ctx) => ctx.db.query("players").collect())).map((p) => p.identityKey),
    ).toEqual(["linejam:user:trusted", "linejam:user:other", "app:guest:trusted-guest"]);
  });

  it("generates unique codes, keeps joins idempotent, and enforces twelve seats", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const codes = new Set([host.room.code]);
    const firstJoin = await joinRoom(t, host.room.code.toLowerCase(), "player-1");
    const repeatedJoin = await t.withIdentity(identity("player-1")).mutation(joinRoomRef, {
      code: host.room.code,
      displayName: "Renamed",
    });
    expect(repeatedJoin).toMatchObject({
      ok: true,
      roomId: firstJoin.roomId,
      playerId: firstJoin.playerId,
      seatIndex: firstJoin.seatIndex,
      eligibleFromCycle: firstJoin.eligibleFromCycle,
    });
    for (let index = 2; index <= 11; index += 1) {
      const joined = await joinRoom(t, host.room.code, `player-${index}`);
      expect(joined.seatIndex).toBe(index);
    }
    await expect(
      t.withIdentity(identity("player-12")).mutation(joinRoomRef, {
        code: host.room.code,
        displayName: "Overflow",
      }),
    ).resolves.toEqual({ ok: false, code: "ROOM_FULL" });
    for (let index = 0; index < 6; index += 1) {
      const other = await createRoom(t, `host-${index}`);
      codes.add(other.room.code);
    }
    expect(codes.size).toBe(7);
  });

  it.each([0, 1.5, 12])(
    "rejects corrupt seat %s at admission and snapshot boundaries",
    async (seatIndex) => {
      const t = testContext();
      const host = await createRoom(t, "host");
      const member = await joinRoom(t, host.room.code, "member");
      await t.mutation(async (ctx) => {
        const row = await ctx.db
          .query("roomMembers")
          .withIndex("by_room_player", (q) =>
            q.eq("roomId", host.room.roomId).eq("playerId", member.playerId),
          )
          .unique();
        if (!row) throw new Error("member missing in test setup");
        await ctx.db.patch(row._id, { seatIndex });
      });
      await expect(
        t.withIdentity(identity("new-member")).mutation(joinRoomRef, {
          code: host.room.code,
          displayName: "New member",
        }),
      ).resolves.toEqual({ ok: false, code: "ROOM_DATA_INVALID" });
      await expect(
        host.authT.mutation(startMatchRef, { roomId: host.room.roomId }),
      ).rejects.toThrow("ROOM_DATA_INVALID");
      const state = await host.authT.query(roomStateRef, { roomId: host.room.roomId });
      expect(state.activeMatch).toBeNull();
    },
  );

  it("projects time facts so an unchanged room response can age locally", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const state = await host.authT.query(roomStateRef, { roomId: host.room.roomId });
    const member = state.members.find((candidate) => candidate.playerId === host.room.playerId);
    if (!member) throw new Error("host missing from projection");
    expect(member).not.toHaveProperty("present");
    expect(classifyPresence(member, member.joinedAt + 15_000)).toBe("present");
    expect(classifyPresence(member, member.joinedAt + 15_001)).toBe("away");
    expect(classifyPresence(member, member.joinedAt + 45_001)).toBe("stale");
  });

  it("rejects rejoining a closed room, including existing members", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    await host.authT.mutation(closeRoomRef, { roomId: host.room.roomId });
    await expect(
      host.authT.mutation(joinRoomRef, {
        code: host.room.code,
        displayName: "Host",
      }),
    ).resolves.toEqual({ ok: false, code: "ROOM_NOT_OPEN" });
  });

  it("requires the host to close a room even when no match is active", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const participant = await joinRoom(t, host.room.code, "participant");
    await expect(
      participant.authT.mutation(closeRoomRef, { roomId: host.room.roomId }),
    ).rejects.toThrow();
    const state = await host.authT.query(roomStateRef, { roomId: host.room.roomId });
    expect(state.room.closedAt).toBeUndefined();
    expect(state.activeMatch).toBeNull();
  });
  it("does not let closed host rooms consume the open-room quota", async () => {
    const t = testContext();
    for (let index = 0; index < 4; index += 1) {
      const room = await createRoom(t, "host");
      await room.authT.mutation(closeRoomRef, { roomId: room.room.roomId });
    }
    const next = await createRoom(t, "host");
    expect(next.room.code).toHaveLength(4);
  });

  it("reuses a closed room code and joins only its new open room", async () => {
    // The Convex compilation target omits Node globals, but Vitest provides Web Crypto.
    const runtime = globalThis as unknown as {
      crypto: { getRandomValues(array: Uint8Array): Uint8Array };
    };
    const random = vi.spyOn(runtime.crypto, "getRandomValues").mockImplementation((array) => {
      array.fill(0);
      return array;
    });
    try {
      const t = testContext();
      const original = await createRoom(t, "original-host");
      await original.authT.mutation(closeRoomRef, { roomId: original.room.roomId });
      const replacement = await createRoom(t, "replacement-host");
      expect(replacement.room.code).toBe(original.room.code);
      expect(replacement.room.roomId).not.toBe(original.room.roomId);
      const joined = await joinRoom(t, original.room.code, "new-player");
      expect(joined.roomId).toBe(replacement.room.roomId);
      const oldRoom = await t.run(async (ctx) => ctx.db.get(original.room.roomId));
      expect(oldRoom?.closedAt).toBeDefined();
    } finally {
      random.mockRestore();
    }
  });

  it("does not let closed memberships consume the open-membership quota", async () => {
    const t = testContext();
    const rooms: CreatedRoom[] = [];
    for (let index = 0; index < 17; index += 1) {
      rooms.push(await createRoom(t, `host-${index}`));
    }
    const first = rooms[0];
    if (!first) throw new Error("first room missing in test setup");
    const member = await joinRoom(t, first.room.code, "member");
    await t.withIdentity(identity("member")).mutation(async (ctx) => {
      const actor = await resolvePlayer(ctx);
      const now = Date.now();
      for (const room of rooms.slice(1)) {
        await ctx.db.insert("roomMembers", {
          roomId: room.room.roomId,
          playerId: actor.playerId,
          displayName: "member",
          seatIndex: 1,
          joinedAt: now,
          eligibleFromCycle: 1,
        });
      }
    });
    for (const room of rooms) {
      await room.authT.mutation(closeRoomRef, { roomId: room.room.roomId });
    }
    const target = await createRoom(t, "target-host");
    const joined = await joinRoom(t, target.room.code, "member");
    expect(joined.seatIndex).toBe(1);
    expect(member.seatIndex).toBe(1);
  });

  it("applies the same membership capacity to create and join while preserving retries", async () => {
    const clock = vi.spyOn(Date, "now");
    let now = 2_000_000_000_000;
    clock.mockImplementation(() => now);
    try {
      const t = testContext();
      const rooms: CreatedRoom[] = [];
      for (let index = 0; index < 17; index += 1) {
        rooms.push(await createRoom(t, `host-${index}`));
      }
      for (const [index, room] of rooms.slice(0, 16).entries()) {
        if (index === 10) now += 60_000;
        await joinRoom(t, room.room.code, "member");
      }
      const first = rooms[0];
      const extra = rooms[16];
      if (!first || !extra) throw new Error("rooms missing in test setup");
      const member = t.withIdentity(identity("member"));
      await expect(member.mutation(createRoomRef, { displayName: "Member" })).rejects.toThrow(
        "ROOM_CREATION_RATE_LIMIT",
      );
      await expect(
        member.mutation(joinRoomRef, { code: extra.room.code, displayName: "Member" }),
      ).resolves.toEqual({ ok: false, code: "ROOM_JOIN_RATE_LIMIT" });
      await expect(
        member.mutation(joinRoomRef, { code: first.room.code, displayName: "Renamed" }),
      ).resolves.toMatchObject({ ok: true, roomId: first.room.roomId });
      await member.mutation(leaveRoomRef, { roomId: first.room.roomId });
      const created = await member.mutation(createRoomRef, { displayName: "Member" });
      const state = await member.query(roomStateRef, { roomId: created.roomId });
      expect(state.room.hostPlayerId).toBe(created.playerId);
      expect(state.members.map((entry) => entry.playerId)).toEqual([created.playerId]);
    } finally {
      clock.mockRestore();
    }
  });

  it("allows emergency host migration above the room creation quota", async () => {
    const t = testContext();
    for (let index = 0; index < 4; index += 1) {
      await createRoom(t, "replacement");
    }
    const host = await createRoom(t, "departing");
    const replacement = await joinRoom(t, host.room.code, "replacement");
    await host.authT.mutation(leaveRoomRef, { roomId: host.room.roomId });
    const state = await replacement.authT.query(roomStateRef, { roomId: host.room.roomId });
    expect(state.room.hostPlayerId).toBe(replacement.playerId);
    await expect(
      replacement.authT.mutation(createRoomRef, { displayName: "Replacement" }),
    ).rejects.toThrow("ROOM_CREATION_RATE_LIMIT");
  });
  it("persists bounded failed joins and lets known idempotent members retry", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    await joinRoom(t, host.room.code, "member");
    const missingCode = await unusedRoomCode(t);
    const memberAuth = t.withIdentity(identity("member"));
    for (let index = 0; index < 9; index += 1) {
      await expect(
        memberAuth.mutation(joinRoomRef, {
          code: missingCode,
          displayName: "Member",
        }),
      ).resolves.toEqual({ ok: false, code: "ROOM_NOT_OPEN" });
    }
    await expect(
      memberAuth.mutation(joinRoomRef, {
        code: missingCode,
        displayName: "Member",
      }),
    ).resolves.toEqual({ ok: false, code: "ROOM_JOIN_RATE_LIMIT" });
    await expect(
      memberAuth.mutation(joinRoomRef, {
        code: host.room.code,
        displayName: "Renamed",
      }),
    ).resolves.toMatchObject({ ok: true, roomId: host.room.roomId });
  });

  it("rejects non-host and duplicate/concurrent begins", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    await joinRoom(t, host.room.code, "player");
    await expect(
      t.withIdentity(identity("player")).mutation(startMatchRef, {
        roomId: host.room.roomId,
      }),
    ).rejects.toThrow();
    const attempts = await Promise.allSettled([
      host.authT.mutation(startMatchRef, { roomId: host.room.roomId }),
      host.authT.mutation(startMatchRef, { roomId: host.room.roomId }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    await expect(
      host.authT.mutation(startMatchRef, { roomId: host.room.roomId }),
    ).rejects.toThrow();
  });

  it("allows server-authorized member rematches without weakening membership or lifecycle guards", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const member = await joinRoom(t, host.room.code, "member");
    const outsider = await createRoom(t, "outsider");
    const first = await host.authT.mutation(startMatchRef, { roomId: host.room.roomId });
    await host.authT.mutation(async (ctx) =>
      completeMatch(ctx, { matchId: first.id, actor: await resolvePlayer(ctx) }),
    );
    await expect(
      member.authT.mutation(startMatchRef, { roomId: host.room.roomId }),
    ).rejects.toThrow("HOST_REQUIRED");
    await expect(
      outsider.authT.mutation(async (ctx) =>
        beginMatch(ctx, {
          roomId: host.room.roomId,
          actor: await resolvePlayer(ctx),
          authorization: "member",
        }),
      ),
    ).rejects.toThrow("NOT_A_ROOM_MEMBER");
    const next = await member.authT.mutation(async (ctx) =>
      beginMatch(ctx, {
        roomId: host.room.roomId,
        actor: await resolvePlayer(ctx),
        authorization: "member",
      }),
    );
    expect(next.cycle).toBe(first.cycle + 1);
    expect(await member.authT.query(roomStateRef, { roomId: host.room.roomId })).toMatchObject({
      activeMatch: { id: next.id },
    });
    await expect(
      member.authT.mutation(async (ctx) =>
        beginMatch(ctx, {
          roomId: host.room.roomId,
          actor: await resolvePlayer(ctx),
          authorization: "member",
        }),
      ),
    ).rejects.toThrow("MATCH_ALREADY_ACTIVE");
    await host.authT.mutation(closeRoomRef, { roomId: host.room.roomId });
    await expect(
      member.authT.mutation(async (ctx) =>
        beginMatch(ctx, {
          roomId: host.room.roomId,
          actor: await resolvePlayer(ctx),
          authorization: "member",
        }),
      ),
    ).rejects.toThrow("ROOM_NOT_OPEN");
  });

  it("freezes all eligible members only when the server opts out of presence filtering", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const away = await joinRoom(t, host.room.code, "away");
    const queued = await joinRoom(t, host.room.code, "queued");
    const now = Date.now() + ABANDON_AFTER_MS + 1;
    await t.mutation(async (ctx) => {
      const members = await ctx.db
        .query("roomMembers")
        .withIndex("by_room", (q) => q.eq("roomId", host.room.roomId))
        .collect();
      for (const member of members) {
        if (member.playerId === host.room.playerId) {
          await ctx.db.patch(member._id, { lastSeenAt: now });
        } else if (member.playerId === queued.playerId) {
          await ctx.db.patch(member._id, { eligibleFromCycle: 2 });
        }
      }
    });
    await expect(
      host.authT.mutation(async (ctx) =>
        beginMatch(ctx, {
          roomId: host.room.roomId,
          actor: await resolvePlayer(ctx),
          minPlayers: 2,
          nowMs: now,
        }),
      ),
    ).rejects.toThrow("NOT_ENOUGH_PRESENT_PLAYERS");
    await expect(
      host.authT.mutation(async (ctx) =>
        beginMatch(ctx, {
          roomId: host.room.roomId,
          actor: await resolvePlayer(ctx),
          minPlayers: 1,
          maxPlayers: 1,
          participation: "eligible",
          nowMs: now,
        }),
      ),
    ).rejects.toThrow("TOO_MANY_ELIGIBLE_PLAYERS");
    const match = await host.authT.mutation(async (ctx) =>
      beginMatch(ctx, {
        roomId: host.room.roomId,
        actor: await resolvePlayer(ctx),
        minPlayers: 2,
        maxPlayers: 2,
        participation: "eligible",
        nowMs: now,
      }),
    );
    const participants = await t.query((ctx) =>
      ctx.db
        .query("matchParticipants")
        .withIndex("by_match", (q) => q.eq("matchId", match.id))
        .collect(),
    );
    expect(participants.map(({ playerId, seatIndex }) => ({ playerId, seatIndex }))).toEqual([
      { playerId: host.room.playerId, seatIndex: host.room.seatIndex },
      { playerId: away.playerId, seatIndex: away.seatIndex },
    ]);
  });

  it("excludes a late joiner from the active snapshot and includes them next cycle", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    await joinRoom(t, host.room.code, "player");
    const active = await host.authT.mutation(startMatchRef, {
      roomId: host.room.roomId,
    });
    const late = await joinRoom(t, host.room.code, "late");
    const activeState = await t
      .withIdentity(identity("late"))
      .query(roomStateRef, { roomId: host.room.roomId });
    expect(activeState.activeMatch?.participantIds).not.toContain(late.playerId);
    await host.authT.run(async (ctx) => {
      const actor = await resolvePlayer(ctx);
      await completeMatch(ctx, { matchId: active.id, actor });
    });
    const next = await host.authT.mutation(startMatchRef, {
      roomId: host.room.roomId,
    });
    const nextState = await t
      .withIdentity(identity("late"))
      .query(roomStateRef, { roomId: host.room.roomId });
    expect(next.cycle).toBe(active.cycle + 1);
    expect(nextState.activeMatch?.participantIds).toContain(late.playerId);
  });

  it("restricts active-match host migration to participants", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const participant = await joinRoom(t, host.room.code, "participant");
    const active = await host.authT.mutation(startMatchRef, {
      roomId: host.room.roomId,
    });
    const late = await joinRoom(t, host.room.code, "late");
    const staleAt = Date.now() - 120_000;
    await t.mutation(async (ctx) => {
      const member = await ctx.db
        .query("roomMembers")
        .withIndex("by_room_player", (q) =>
          q.eq("roomId", host.room.roomId).eq("playerId", host.room.playerId),
        )
        .unique();
      if (!member) throw new Error("host member missing in test setup");
      await ctx.db.patch(member._id, { lastSeenAt: staleAt });
    });
    const lateHeartbeat = await t
      .withIdentity(identity("late"))
      .mutation(heartbeatRef, { roomId: host.room.roomId });
    expect(lateHeartbeat.hostPlayerId).toBe(participant.playerId);
    const migrated = await t
      .withIdentity(identity("participant"))
      .mutation(heartbeatRef, { roomId: host.room.roomId });
    expect(migrated.hostPlayerId).toBe(participant.playerId);
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("matchParticipants")
        .withIndex("by_match", (q) => q.eq("matchId", active.id))
        .collect();
      expect(rows.map((row) => row.playerId)).not.toContain(late.playerId);
    });
  });
  it("abandons an active match before unrestricted host migration", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const participant = await joinRoom(t, host.room.code, "participant");
    const active = await host.authT.mutation(startMatchRef, {
      roomId: host.room.roomId,
    });
    const late = await joinRoom(t, host.room.code, "late");
    await host.authT.mutation(leaveRoomRef, { roomId: host.room.roomId });
    await participant.authT.mutation(leaveRoomRef, { roomId: host.room.roomId });
    const state = await late.authT.query(roomStateRef, { roomId: host.room.roomId });
    expect(state.room.hostPlayerId).toBe(late.playerId);
    expect(state.activeMatch).toBeNull();
    await t.run(async (ctx) => {
      const match = await ctx.db.get(active.id);
      expect(match).toMatchObject({
        status: "abandoned",
        reason: "everyone-away",
      });
    });
  });

  it("terminalizes an active match before closing after the last member leaves", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const participant = await joinRoom(t, host.room.code, "participant");
    const active = await host.authT.mutation(startMatchRef, {
      roomId: host.room.roomId,
    });
    await participant.authT.mutation(leaveRoomRef, { roomId: host.room.roomId });
    await host.authT.mutation(leaveRoomRef, { roomId: host.room.roomId });
    await t.run(async (ctx) => {
      const room = await ctx.db.get(host.room.roomId);
      const match = await ctx.db.get(active.id);
      expect(room?.closedAt).toBeDefined();
      expect(match).toMatchObject({
        status: "abandoned",
        reason: "everyone-away",
      });
    });
  });
  it("rejects terminal timestamps that precede match start", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    await joinRoom(t, host.room.code, "participant");
    const active = await host.authT.mutation(startMatchRef, {
      roomId: host.room.roomId,
    });
    await expect(
      host.authT.run(async (ctx) => {
        const actor = await resolvePlayer(ctx);
        return completeMatch(ctx, {
          matchId: active.id,
          actor,
          nowMs: active.startedAt - 1,
        });
      }),
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      const match = await ctx.db.get(active.id);
      expect(match?.status).toBe("active");
    });
    await host.authT.run(async (ctx) => {
      const actor = await resolvePlayer(ctx);
      await completeMatch(ctx, { matchId: active.id, actor });
    });
    const next = await host.authT.mutation(startMatchRef, { roomId: host.room.roomId });
    await expect(
      host.authT.run(async (ctx) => {
        const actor = await resolvePlayer(ctx);
        return abandonMatch(ctx, {
          matchId: next.id,
          actor,
          reason: "host-ended",
          nowMs: next.startedAt - 1,
        });
      }),
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      const match = await ctx.db.get(next.id);
      expect(match?.status).toBe("active");
    });
  });

  it("rejects heartbeat timestamps that move a member clock backwards", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const joinedAt = await host.authT.run(async (ctx) => {
      const member = await ctx.db
        .query("roomMembers")
        .withIndex("by_room_player", (q) =>
          q.eq("roomId", host.room.roomId).eq("playerId", host.room.playerId),
        )
        .unique();
      if (!member) throw new Error("host member missing in test setup");
      return member.joinedAt;
    });
    await host.authT.run(async (ctx) => {
      const actor = await resolvePlayer(ctx);
      return recordHeartbeat(ctx, {
        roomId: host.room.roomId,
        actor,
        now: joinedAt,
      });
    });
    await expect(
      host.authT.run(async (ctx) => {
        const actor = await resolvePlayer(ctx);
        return recordHeartbeat(ctx, {
          roomId: host.room.roomId,
          actor,
          now: joinedAt - 1,
        });
      }),
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query("roomMembers")
        .withIndex("by_room_player", (q) =>
          q.eq("roomId", host.room.roomId).eq("playerId", host.room.playerId),
        )
        .unique();
      expect(member?.lastSeenAt).toBe(joinedAt);
    });
  });
  it("does not expose room presence through a nonmember heartbeat", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const outsider = await createRoom(t, "outsider");
    await expect(
      outsider.authT.mutation(heartbeatRef, { roomId: host.room.roomId }),
    ).rejects.toThrow();
  });
  it("rejects impossible terminal match documents at the schema boundary", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    await expect(
      t.mutation(async (ctx) =>
        ctx.db.insert("matches", {
          roomId: host.room.roomId,
          cycle: 1,
          status: "completed",
          startedAt: Date.now(),
        } as never),
      ),
    ).rejects.toThrow();
  });
  it("makes completion and abandonment terminal and gates stale game commands", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    await joinRoom(t, host.room.code, "player");
    const active = await host.authT.mutation(startMatchRef, {
      roomId: host.room.roomId,
    });
    await host.authT.run(async (ctx) => {
      const actor = await resolvePlayer(ctx);
      await completeMatch(ctx, { matchId: active.id, actor });
    });
    await expect(
      host.authT.run(async (ctx) => requireActiveMatch(ctx, active.id)),
    ).rejects.toThrow();
    await expect(
      host.authT.run(async (ctx) => {
        const actor = await resolvePlayer(ctx);
        return completeMatch(ctx, { matchId: active.id, actor });
      }),
    ).rejects.toThrow();

    const next = await host.authT.mutation(startMatchRef, {
      roomId: host.room.roomId,
    });
    await host.authT.run(async (ctx) => {
      const actor = await resolvePlayer(ctx);
      await abandonMatch(ctx, {
        matchId: next.id,
        actor,
        reason: "host-ended",
      });
    });
    await expect(host.authT.run(async (ctx) => requireActiveMatch(ctx, next.id))).rejects.toThrow();
    await expect(
      host.authT.run(async (ctx) => abandonMatch(ctx, { matchId: next.id, reason: "host-ended" })),
    ).rejects.toThrow();
  });

  it("rejects game commands at the hard deadline before the sweep runs", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(2_000_000_000_000);
    try {
      const t = testContext();
      const host = await createRoom(t, "host");
      const player = await joinRoom(t, host.room.code, "player");
      const active = await host.authT.mutation(startMatchRef, { roomId: host.room.roomId });
      const deadline = active.startedAt + HARD_DEADLINE_MS;
      clock.mockReturnValue(deadline - 1);
      await expect(t.run((ctx) => requireActiveMatch(ctx, active.id))).resolves.toMatchObject({
        id: active.id,
        status: "active",
      });
      clock.mockReturnValue(deadline);
      await expect(t.run((ctx) => requireActiveMatch(ctx, active.id))).rejects.toThrow(
        "MATCH_NOT_ACTIVE",
      );
      await expect(
        host.authT.mutation(async (ctx) =>
          completeMatch(ctx, { matchId: active.id, actor: await resolvePlayer(ctx) }),
        ),
      ).rejects.toThrow("MATCH_NOT_ACTIVE");
      await expect(
        host.authT.mutation(startMatchRef, { roomId: host.room.roomId }),
      ).rejects.toThrow("MATCH_NOT_ACTIVE");
      expect(await t.run((ctx) => ctx.db.get(active.id))).toMatchObject({ status: "active" });
      await host.authT.mutation(heartbeatRef, { roomId: host.room.roomId });
      await player.authT.mutation(heartbeatRef, { roomId: host.room.roomId });
      await t.mutation((ctx) => sweepAbandonedMatches(ctx));
      expect(await t.run((ctx) => ctx.db.get(active.id))).toMatchObject({
        status: "abandoned",
        reason: "hard-deadline",
        abandonedAt: deadline,
      });
      const next = await host.authT.mutation(startMatchRef, { roomId: host.room.roomId });
      expect(next.cycle).toBe(active.cycle + 1);
    } finally {
      clock.mockRestore();
    }
  });

  it("keeps untimed matches playable past the default cap while still cleaning up empty tables", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(2_000_000_000_000);
    try {
      const t = testContext();
      const host = await createRoom(t, "host");
      const player = await joinRoom(t, host.room.code, "player");
      const active = await host.authT.mutation(async (ctx) =>
        beginMatch(ctx, {
          roomId: host.room.roomId,
          actor: await resolvePlayer(ctx),
          hardDeadline: false,
        }),
      );
      clock.mockReturnValue(active.startedAt + 2 * HARD_DEADLINE_MS);
      for (const client of [host.authT, player.authT])
        await client.mutation(heartbeatRef, { roomId: host.room.roomId });
      expect(await t.mutation((ctx) => sweepAbandonedMatches(ctx))).toMatchObject({
        abandoned: 0,
      });
      await expect(t.run((ctx) => requireActiveMatch(ctx, active.id))).resolves.toMatchObject({
        id: active.id,
        status: "active",
      });
      await expect(
        host.authT.mutation(startMatchRef, { roomId: host.room.roomId }),
      ).rejects.toThrow("MATCH_ALREADY_ACTIVE");
      const state = await host.authT.query(roomStateRef, { roomId: host.room.roomId });
      expect(state.activeMatch).toMatchObject({ id: active.id, hardDeadline: false });
      await expect(
        host.authT.mutation(async (ctx) =>
          completeMatch(ctx, { matchId: active.id, actor: await resolvePlayer(ctx) }),
        ),
      ).resolves.toMatchObject({ status: "completed", completedAt: Date.now() });
      const next = await host.authT.mutation(async (ctx) =>
        beginMatch(ctx, {
          roomId: host.room.roomId,
          actor: await resolvePlayer(ctx),
          hardDeadline: false,
        }),
      );
      clock.mockReturnValue(Date.now() + ABANDON_AFTER_MS + 1);
      await t.mutation((ctx) => sweepAbandonedMatches(ctx));
      expect(await t.run((ctx) => ctx.db.get(next.id))).toMatchObject({
        status: "abandoned",
        reason: "everyone-away",
      });
    } finally {
      clock.mockRestore();
    }
  });

  it("allows completion one millisecond before the hard deadline", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    await joinRoom(t, host.room.code, "player");
    const active = await host.authT.mutation(startMatchRef, { roomId: host.room.roomId });
    const completedAt = active.startedAt + HARD_DEADLINE_MS - 1;
    await expect(
      host.authT.mutation(async (ctx) =>
        completeMatch(ctx, {
          matchId: active.id,
          actor: await resolvePlayer(ctx),
          nowMs: completedAt,
        }),
      ),
    ).resolves.toMatchObject({ id: active.id, status: "completed", completedAt });
  });

  it("runs bounded scheduled continuations even as abandoned rows leave the active index", async () => {
    vi.useFakeTimers();
    try {
      const t = testContext();
      const matches: ActiveMatch[] = [];
      for (const subject of ["host-a", "host-b", "host-c"]) {
        const host = await createRoom(t, subject);
        await joinRoom(t, host.room.code, `${subject}-player`);
        matches.push(await host.authT.mutation(startMatchRef, { roomId: host.room.roomId }));
      }
      vi.setSystemTime(Date.now() + HARD_DEADLINE_MS);
      const first = await t.mutation(sweepAbandonedRef, { limit: 1 });
      expect(first).toMatchObject({ scanned: 1, abandoned: 1, hasMore: true });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const terminal = await t.run((ctx) =>
        Promise.all(matches.map((match) => ctx.db.get(match.id))),
      );
      expect(terminal.map((match) => match?.status)).toEqual([
        "abandoned",
        "abandoned",
        "abandoned",
      ]);
      expect(
        terminal.map((match) => (match?.status === "abandoned" ? match.reason : undefined)),
      ).toEqual(["hard-deadline", "hard-deadline", "hard-deadline"]);
      expect(await t.mutation(sweepAbandonedRef, { limit: 1 })).toEqual({
        scanned: 0,
        abandoned: 0,
        hasMore: false,
        continueCursor: null,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("composes with game tables and rolls back expired game commands before sweeping", async () => {
    const gameSchema = defineSchema({
      ...parlorTables,
      gameTurns: defineTable({ matchId: v.id("matches"), turn: v.number() }),
    });
    const t = convexTest(gameSchema, modules);
    const host = t.withIdentity(identity("game-host"));
    const room = await host.mutation(createRoomRef, { displayName: "Host" });
    await t.withIdentity(identity("game-player")).mutation(joinRoomRef, {
      code: room.code,
      displayName: "Player",
    });
    const first = await host.mutation(async (ctx) => {
      const actor = await resolvePlayer(ctx);
      return beginMatch(ctx, { roomId: room.roomId, actor });
    });
    await host.mutation(async (ctx) => {
      await requireActiveMatch(ctx, first.id, room.roomId);
      await ctx.db.insert("gameTurns", { matchId: first.id, turn: 1 });
      await completeMatch(ctx, { matchId: first.id, actor: await resolvePlayer(ctx) });
    });
    const second = await host.mutation(async (ctx) =>
      beginMatch(ctx, { roomId: room.roomId, actor: await resolvePlayer(ctx) }),
    );
    const gameId = await t.mutation((ctx) =>
      ctx.db.insert("gameTurns", { matchId: second.id, turn: 0 }),
    );
    const clock = vi.spyOn(Date, "now").mockReturnValue(second.startedAt + HARD_DEADLINE_MS);
    try {
      await expect(
        host.mutation(async (ctx) => {
          await ctx.db.patch(gameId, { turn: 1 });
          await requireActiveMatch(ctx, second.id, room.roomId);
        }),
      ).rejects.toThrow("MATCH_NOT_ACTIVE");
      expect(await t.run((ctx) => ctx.db.get(gameId))).toMatchObject({ turn: 0 });
      expect(await t.run((ctx) => ctx.db.get(second.id))).toMatchObject({ status: "active" });
      await t.mutation((ctx) => sweepAbandonedMatches(ctx));
      expect(await t.run((ctx) => ctx.db.get(second.id))).toMatchObject({
        status: "abandoned",
        reason: "hard-deadline",
      });
    } finally {
      clock.mockRestore();
    }
  });

  it("rolls back the whole sweep page on cleanup failure and composes every continuation", async () => {
    const gameSchema = defineSchema({
      ...parlorTables,
      gameOutcomes: defineTable({
        matchId: v.id("matches"),
        status: v.union(v.literal("active"), v.literal("abandoned")),
        endedAt: v.optional(v.number()),
      }).index("by_match", ["matchId"]),
    });
    const t = convexTest(gameSchema, modules);
    const matches: ActiveMatch[] = [];
    const startedAt = Date.now();
    for (const [index, subject] of ["host-a", "host-b"].entries()) {
      const host = t.withIdentity(identity(subject));
      const room = await host.mutation(createRoomRef, { displayName: subject });
      await t.withIdentity(identity(`${subject}-player`)).mutation(joinRoomRef, {
        code: room.code,
        displayName: "Player",
      });
      const match = await host.mutation(async (ctx) => {
        const envelope = await beginMatch(ctx, {
          roomId: room.roomId,
          actor: await resolvePlayer(ctx),
          nowMs: startedAt + index,
        });
        await ctx.db.insert("gameOutcomes", { matchId: envelope.id, status: "active" });
        return envelope;
      });
      matches.push(match);
    }
    const now = startedAt + HARD_DEADLINE_MS + matches.length;
    const sweep = (limit: number, cursor?: string, failOnMatch?: MatchId) =>
      t.mutation((ctx) =>
        sweepAbandonedMatches(ctx, {
          limit,
          ...(cursor === undefined ? {} : { cursor }),
          nowMs: now,
          onAbandoned: async (envelope) => {
            if (envelope.status !== "abandoned") throw new Error("Expected terminal envelope");
            const game = await ctx.db
              .query("gameOutcomes")
              .withIndex("by_match", (q) => q.eq("matchId", envelope.id))
              .unique();
            if (!game) throw new Error("Game outcome missing");
            await ctx.db.patch(game._id, {
              status: "abandoned",
              endedAt: envelope.abandonedAt,
            });
            if (envelope.id === failOnMatch) throw new Error("Game cleanup rejected");
          },
        }),
      );
    const secondMatch = matches[1];
    if (!secondMatch) throw new Error("Second match missing");
    await expect(sweep(2, undefined, secondMatch.id)).rejects.toThrow("Game cleanup rejected");
    expect(
      await t.query(async (ctx) => (await ctx.db.query("matches").collect()).map((m) => m.status)),
    ).toEqual(["active", "active"]);
    expect(await t.query((ctx) => ctx.db.query("gameOutcomes").collect())).toEqual([
      expect.objectContaining({ status: "active", matchId: matches[0]?.id }),
      expect.objectContaining({ status: "active", matchId: secondMatch.id }),
    ]);
    const first = await sweep(1);
    expect(first).toMatchObject({ scanned: 1, abandoned: 1, hasMore: true });
    if (!first.continueCursor) throw new Error("Sweep cursor missing");
    expect(
      await t.query(async (ctx) =>
        (await ctx.db.query("gameOutcomes").collect()).map((game) => game.status),
      ),
    ).toEqual(["abandoned", "active"]);
    const last = await sweep(1, first.continueCursor);
    expect(last).toEqual({
      scanned: 1,
      abandoned: 1,
      hasMore: false,
      continueCursor: null,
    });
    expect(
      await t.query(async (ctx) => (await ctx.db.query("matches").collect()).map((m) => m.status)),
    ).toEqual(["abandoned", "abandoned"]);
    expect(await t.query((ctx) => ctx.db.query("gameOutcomes").collect())).toEqual([
      expect.objectContaining({ status: "abandoned", endedAt: now, matchId: matches[0]?.id }),
      expect.objectContaining({ status: "abandoned", endedAt: now, matchId: secondMatch.id }),
    ]);
  });

  it("sweeps bounded pages and continues past present active envelopes", async () => {
    const t = testContext();
    const rooms: Array<{ host: CreatedRoom; match: ActiveMatch }> = [];
    for (const subject of ["host-a", "host-b"]) {
      const host = await createRoom(t, subject);
      await joinRoom(t, host.room.code, `${subject}-player`);
      const match = await host.authT.mutation(startMatchRef, {
        roomId: host.room.roomId,
      });
      rooms.push({ host, match });
    }
    const now = Date.now() + 12 * 60_000;
    await t.mutation(async (ctx) => {
      for (const [index, { host, match }] of rooms.entries()) {
        const members = await ctx.db
          .query("roomMembers")
          .withIndex("by_room", (q) => q.eq("roomId", host.room.roomId))
          .collect();
        for (const member of members) {
          await ctx.db.patch(member._id, {
            lastSeenAt: index === 0 ? now : now - 11 * 60_000,
          });
        }
        const active = await ctx.db.get(match.id);
        if (!active) throw new Error("active match missing in test setup");
        await ctx.db.patch(active._id, {
          startedAt: now - 11 * 60_000 - (index === 0 ? 1 : 0),
        });
      }
    });
    const firstSweep = await t.mutation(async (ctx) =>
      sweepAbandonedMatches(ctx, { limit: 1, nowMs: now }),
    );
    expect(firstSweep.scanned).toBe(1);
    expect(firstSweep.abandoned).toBe(0);
    expect(firstSweep.hasMore).toBe(true);
    if (!firstSweep.continueCursor) throw new Error("sweep cursor missing");
    const continueCursor = firstSweep.continueCursor;
    const statusesAfterFirst = await t.run(async (ctx) =>
      Promise.all(
        rooms.map(async ({ match }) => {
          const row = await ctx.db.get(match.id);
          return row?.status;
        }),
      ),
    );
    expect(statusesAfterFirst).toEqual(["active", "active"]);
    const secondSweep = await t.mutation(async (ctx) =>
      sweepAbandonedMatches(ctx, {
        limit: 1,
        cursor: continueCursor,
        nowMs: now,
      }),
    );
    expect(secondSweep.scanned).toBe(1);
    expect(secondSweep.abandoned).toBe(1);
    expect(secondSweep.hasMore).toBe(false);
    const statusesAfterSecond = await t.run(async (ctx) =>
      Promise.all(
        rooms.map(async ({ match }) => {
          const row = await ctx.db.get(match.id);
          return row?.status;
        }),
      ),
    );
    expect(statusesAfterSecond).toEqual(["active", "abandoned"]);
  });
});
