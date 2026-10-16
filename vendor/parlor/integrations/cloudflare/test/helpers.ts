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
import { Runtime, type ConvexApp, type SqlDriver, TokenVerifier } from "../src/index.js";
import {
  ConvexBackendObject,
  type ConvexBackendOptions,
  type DurableObjectStorageLike,
} from "../src/durable.js";
import { memorySqlDriver } from "../src/testing.js";

export { memorySqlDriver as sqliteDriver };

export const ISSUER = "https://clerk.example.test";
export const AUDIENCE = "convex";
export const nowSeconds = () => Math.floor(Date.now() / 1000);

export function base64Url(bytes: Uint8Array | string): string {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return Buffer.from(data).toString("base64url");
}

/** A synthetic OIDC issuer: `sign` mints RS256 tokens that `verifier` trusts. */
export async function issuer() {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", keys.publicKey)),
    kid: "k1",
    alg: "RS256",
    use: "sig",
  };
  const fetcher: typeof fetch = async (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url === `${ISSUER}/.well-known/openid-configuration`)
      return Response.json({ jwks_uri: `${ISSUER}/jwks` });
    if (url === `${ISSUER}/jwks`) return Response.json({ keys: [jwk] });
    return new Response("not found", { status: 404 });
  };
  /** Sign claims, or a raw JSON payload (for values JSON.stringify cannot produce). */
  const sign = async (claims: Record<string, unknown> | string) => {
    const header = base64Url(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }));
    const payload = base64Url(typeof claims === "string" ? claims : JSON.stringify(claims));
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keys.privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    );
    return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
  };
  const verifier = new TokenVerifier(
    { providers: [{ domain: ISSUER, applicationID: AUDIENCE }] },
    fetcher,
  );
  return { sign, verifier, fetcher };
}

export const ADMIN_KEY = "synthetic-admin-key-0123456789abcdef";

/** A bookmark in Cloudflare's shape: lexically ordered hex groups. */
export const bookmarkAt = (position: number) =>
  `${position.toString(16).padStart(8, "0")}-0000b26e-00001538-0c3e87bb37b3db5cc52eedb93cd3b96b`;

/**
 * What a deployed SQLite-backed object adds over local workerd: bookmarks,
 * a restore staged for the next start, and `abort`. The platform itself
 * rewrites storage when the object restarts; that half is proven by the
 * drill on a deployed object, not here.
 */
export function pitrPlatform() {
  let position = 0;
  const seen = { staged: [] as string[], aborted: [] as string[], times: [] as number[] };
  return {
    seen,
    storage: {
      getCurrentBookmark: async () => bookmarkAt(++position),
      getBookmarkForTime: async (time: number) => {
        seen.times.push(time);
        return bookmarkAt(time % 0x7fffffff);
      },
      onNextSessionRestoreBookmark: async (bookmark: string) => {
        seen.staged.push(bookmark);
        return bookmarkAt(++position);
      },
    },
    abort: (reason?: string) => {
      seen.aborted.push(reason ?? "");
    },
  };
}

/**
 * The Durable Object class over in-memory SQLite and a fake alarm, as
 * workerd would host it. `admin` calls an admin route with the admin key.
 * `platform` adds what only deployed objects have: point-in-time recovery
 * methods on the storage, and `abort`.
 */
export async function durableObject(
  options: Partial<ConvexBackendOptions> = {},
  driver: SqlDriver = memorySqlDriver(),
  platform: {
    storage?: Partial<DurableObjectStorageLike>;
    abort?: (reason?: string) => void;
  } = {},
) {
  let ready: Promise<unknown> = Promise.resolve();
  let alarm: number | null = null;
  const storage = {
    sql: {
      exec: (query: string, ...bindings: (string | number | null)[]) => ({
        toArray: () => driver.exec(query, ...bindings),
      }),
    },
    transactionSync: <T>(callback: () => T) => driver.transaction(callback),
    getAlarm: async () => alarm,
    setAlarm: async (when: number) => {
      alarm = when;
    },
    deleteAlarm: async () => {
      alarm = null;
    },
    ...platform.storage,
  };
  const state = {
    storage,
    blockConcurrencyWhile: <T>(callback: () => Promise<T>) => {
      const result = callback();
      ready = result;
      return result;
    },
    ...(platform.abort === undefined ? {} : { abort: platform.abort }),
  };
  const backend = new ConvexBackendObject(
    state,
    { ADMIN: ADMIN_KEY },
    { app, basePath: "/backend", adminKeyBinding: "ADMIN", ...options },
  );
  await ready;
  const call = (path: string, init: RequestInit = {}) =>
    backend.fetch(new Request(`https://backend.example.test/backend${path}`, init));
  const admin = async (route: string, body?: unknown) => {
    const response = await call(`/admin/${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${ADMIN_KEY}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };
  return { backend, call, admin, alarm: () => alarm };
}

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
