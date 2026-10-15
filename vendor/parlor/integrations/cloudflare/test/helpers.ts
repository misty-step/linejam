import {
  anyApi,
  cronJobs,
  defineSchema,
  defineTable,
  httpActionGeneric,
  httpRouter,
  internalMutationGeneric,
  mutationGeneric,
  paginationOptsValidator,
  queryGeneric,
  actionGeneric,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { Runtime, type ConvexApp, type SqlDriver } from "../src/index.js";
import { memorySqlDriver } from "../src/testing.js";

export { memorySqlDriver as sqliteDriver };

export const schema = defineSchema({
  rooms: defineTable({ code: v.string(), closedAt: v.optional(v.number()) }).index("by_code", [
    "code",
  ]),
  messages: defineTable({
    roomId: v.id("rooms"),
    body: v.string(),
    author: v.optional(v.string()),
  }).index("by_room", ["roomId"]),
  counters: defineTable({ name: v.string(), value: v.number() }).index("by_name", ["name"]),
});

const rooms = {
  create: mutationGeneric({
    args: { code: v.string() },
    returns: v.id("rooms"),
    handler: async (ctx, { code }) => ctx.db.insert("rooms", { code }),
  }),
  byCode: queryGeneric({
    args: { code: v.string() },
    handler: async (ctx, { code }) =>
      ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .filter((q) => q.eq(q.field("closedAt"), undefined))
        .unique(),
  }),
  close: mutationGeneric({
    args: { roomId: v.id("rooms") },
    handler: async (ctx, { roomId }) => {
      await ctx.db.patch(roomId, { closedAt: 1 });
    },
  }),
  createThenFail: mutationGeneric({
    args: { code: v.string() },
    handler: async (ctx, { code }) => {
      await ctx.db.insert("rooms", { code });
      throw new ConvexError({ kind: "Nope", code });
    },
  }),
  normalize: queryGeneric({
    args: { id: v.string() },
    handler: async (ctx, { id }) => ({
      room: ctx.db.normalizeId("rooms", id),
      message: ctx.db.normalizeId("messages", id),
    }),
  }),
};

const messages = {
  send: mutationGeneric({
    args: { roomId: v.id("rooms"), body: v.string() },
    handler: async (ctx, { roomId, body }) => {
      const identity = await ctx.auth.getUserIdentity();
      const author = identity?.subject;
      return ctx.db.insert(
        "messages",
        author === undefined ? { roomId, body } : { roomId, body, author },
      );
    },
  }),
  list: queryGeneric({
    args: { roomId: v.id("rooms") },
    handler: async (ctx, { roomId }) =>
      (
        await ctx.db
          .query("messages")
          .withIndex("by_room", (q) => q.eq("roomId", roomId))
          .order("desc")
          .collect()
      ).map((message) => message.body),
  }),
  page: queryGeneric({
    args: { paginationOpts: paginationOptsValidator },
    handler: async (ctx, { paginationOpts }) =>
      ctx.db.query("messages").order("asc").paginate(paginationOpts),
  }),
  writeInvalid: mutationGeneric({
    args: {},
    handler: async (ctx) => {
      // Deliberately violates the schema to prove validation runs.
      await ctx.db.insert("rooms", { code: 7 });
    },
  }),
};

const counters = {
  bump: internalMutationGeneric({
    args: { name: v.string() },
    handler: async (ctx, { name }) => {
      const existing = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();
      if (existing === null) await ctx.db.insert("counters", { name, value: 1 });
      else await ctx.db.patch(existing._id, { value: existing.value + 1 });
    },
  }),
  bumpLater: mutationGeneric({
    args: { name: v.string(), delayMs: v.number() },
    handler: async (ctx, { name, delayMs }) =>
      ctx.scheduler.runAfter(delayMs, anyApi["counters"]!["bump"]!, { name }),
  }),
  failLater: mutationGeneric({
    args: {},
    handler: async (ctx) => ctx.scheduler.runAfter(0, anyApi["counters"]!["explode"]!, {}),
  }),
  explode: internalMutationGeneric({
    args: {},
    handler: async (ctx) => {
      await ctx.db.insert("counters", { name: "never", value: 1 });
      throw new Error("boom");
    },
  }),
  get: queryGeneric({
    args: { name: v.string() },
    handler: async (ctx, { name }) =>
      (
        await ctx.db
          .query("counters")
          .withIndex("by_name", (q) => q.eq("name", name))
          .unique()
      )?.value ?? 0,
  }),
  bumpViaAction: actionGeneric({
    args: { name: v.string() },
    handler: async (ctx, { name }) => {
      await ctx.runMutation(anyApi["counters"]!["bump"]!, { name });
      return ctx.runQuery(anyApi["counters"]!["get"]!, { name });
    },
  }),
};

const crons = cronJobs();
crons.interval("tick", { minutes: 1 }, anyApi["counters"]!["bump"]!, { name: "cron" });

const http = httpRouter();
http.route({
  path: "/hello",
  method: "GET",
  handler: httpActionGeneric(async (ctx) => {
    const count = await ctx.runQuery(anyApi["counters"]!["get"]!, { name: "cron" });
    return Response.json({ count });
  }),
});

export const app: ConvexApp = {
  schema,
  modules: { rooms, messages, counters },
  crons,
  http,
};

export function newRuntime(driver: SqlDriver = memorySqlDriver()) {
  return new Runtime(driver, app);
}
