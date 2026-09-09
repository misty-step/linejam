/// <reference types="vite/client" />

import { defineSchema, defineTable, makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import { ConvexError, v } from "convex/values";
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import { ensurePlayer, resolvePlayer } from "../convex/identity.js";
import { beginMatch } from "../convex/matches.js";
import { closeRoomForPlayer, createRoomForPlayer, joinRoomForPlayer } from "../convex/rooms.js";
import schema, { parlorTables } from "../convex/schema.js";

type RoomId = GenericId<"rooms">;
type PlayerId = GenericId<"players">;

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

type CreateRoomArgs = { displayName: string; guestToken?: string };
type JoinRoomArgs = { code: string; displayName: string; guestToken?: string };

const createRoomRef = makeFunctionReference<"mutation", CreateRoomArgs, RoomResult>(
  "rooms:createRoom",
);
const joinRoomRef = makeFunctionReference<"mutation", JoinRoomArgs, JoinRoomResult>(
  "rooms:joinRoom",
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

const joinRoom = async (
  t: TestContext,
  code: string,
  subject: string,
  displayName = subject,
): Promise<JoinRoomSuccess & { readonly authT: AuthenticatedTestContext }> => {
  const authT = t.withIdentity(identity(subject));
  const result = await authT.mutation(joinRoomRef, { code, displayName });
  if (!result.ok) throw new Error(result.code);
  return { authT, ...result };
};

describe("transaction-local room operations", () => {
  it("admits eight seats then lets an existing member retry while rejecting newcomers", async () => {
    const t = testContext();
    const host = await createRoom(t, "host");
    const member = await joinRoom(t, host.room.code, "member");
    for (let index = 2; index <= 7; index += 1) {
      const joined = await t.withIdentity(identity(`player-${index}`)).mutation(async (ctx) => {
        const actor = await ensurePlayer(ctx);
        return joinRoomForPlayer(ctx, {
          actor,
          code: host.room.code,
          displayName: `player-${index}`,
          capacity: 8,
        });
      });
      expect(joined).toMatchObject({ ok: true, seatIndex: index });
    }
    await expect(
      t.withIdentity(identity("overflow")).mutation(async (ctx) => {
        const actor = await ensurePlayer(ctx);
        return joinRoomForPlayer(ctx, {
          actor,
          code: host.room.code,
          displayName: "Overflow",
          capacity: 8,
        });
      }),
    ).resolves.toEqual({ ok: false, code: "ROOM_FULL" });
    await expect(
      member.authT.mutation(async (ctx) => {
        const actor = await resolvePlayer(ctx);
        return joinRoomForPlayer(ctx, {
          actor,
          code: host.room.code,
          displayName: "Renamed",
          capacity: 8,
        });
      }),
    ).resolves.toMatchObject({
      ok: true,
      roomId: member.roomId,
      playerId: member.playerId,
      seatIndex: member.seatIndex,
    });
  });

  it("reserves retained codes even after an open-room code could otherwise be reused", async () => {
    const runtime = globalThis as unknown as {
      crypto: { getRandomValues(array: Uint8Array): Uint8Array };
    };
    const random = vi.spyOn(runtime.crypto, "getRandomValues").mockImplementation((array) => {
      array.fill(0);
      return array;
    });
    try {
      const t = testContext();
      const original = await t.withIdentity(identity("original-host")).mutation(async (ctx) => {
        const actor = await ensurePlayer(ctx);
        return createRoomForPlayer(ctx, { actor, displayName: "Original" });
      });
      await t.withIdentity(identity("original-host")).mutation(async (ctx) => {
        const actor = await resolvePlayer(ctx);
        return closeRoomForPlayer(ctx, { actor, roomId: original.roomId });
      });
      await expect(
        t.withIdentity(identity("replacement-host")).mutation(async (ctx) => {
          const actor = await ensurePlayer(ctx);
          return createRoomForPlayer(ctx, {
            actor,
            displayName: "Replacement",
            isCodeAvailable: (code) => code !== original.code,
          });
        }),
      ).rejects.toThrow("ROOM_CODE_EXHAUSTED");
    } finally {
      random.mockRestore();
    }
  });

  it("rolls back host-ended abandonment when the same-transaction callback fails", async () => {
    const gameSchema = defineSchema({
      ...parlorTables,
      gameArchives: defineTable({
        matchId: v.id("matches"),
        note: v.string(),
      }),
    });
    const t = convexTest(gameSchema, modules);
    const host = t.withIdentity(identity("host"));
    const room = await host.mutation(createRoomRef, { displayName: "Host" });
    await t.withIdentity(identity("player")).mutation(joinRoomRef, {
      code: room.code,
      displayName: "Player",
    });
    const active = await host.mutation(async (ctx) => {
      const actor = await resolvePlayer(ctx);
      return beginMatch(ctx, { roomId: room.roomId, actor });
    });
    await expect(
      host.mutation(async (ctx) => {
        const actor = await resolvePlayer(ctx);
        await closeRoomForPlayer(ctx, {
          actor,
          roomId: room.roomId,
          onAbandoned: async (envelope) => {
            await ctx.db.insert("gameArchives", { matchId: envelope.id, note: "host-ended" });
            throw new ConvexError({ code: "APP_ARCHIVE_FAILED" });
          },
        });
      }),
    ).rejects.toThrow("APP_ARCHIVE_FAILED");
    const match = await t.run((ctx) => ctx.db.get(active.id));
    expect(match).toMatchObject({ status: "active" });
    expect(match && "abandonedAt" in match ? match.abandonedAt : undefined).toBeUndefined();
    const roomRow = await t.run((ctx) => ctx.db.get(room.roomId));
    expect(roomRow?.closedAt).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("gameArchives").collect())).toEqual([]);
  });
});
