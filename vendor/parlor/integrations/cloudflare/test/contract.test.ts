import {
  actionGeneric,
  anyApi,
  cronJobs,
  defineSchema,
  defineTable,
  httpActionGeneric,
  httpRouter,
  internalActionGeneric,
  internalMutationGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import {
  compareValues,
  convexToJson,
  v,
  type GenericId,
  type JSONValue,
  type Value,
} from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "../src/auth.js";
import { decodeId, MAX_TABLE_NUMBER } from "../src/ids.js";
import { encodeValue } from "../src/keys.js";
import { planRange } from "../src/query.js";
import { Runtime, type ConvexApp, type FunctionOutcome } from "../src/runtime.js";
import {
  beginImport,
  commitImport,
  documentsChecksum,
  exportPage,
  importDocuments,
  importPending,
  MaintenanceStateError,
  setWritesFrozen,
  tableStats,
  type ExpectedTable,
} from "../src/snapshot.js";
import { SyncSession } from "../src/sync.js";
import type { SqlDriver } from "../src/store.js";
import type { TokenVerifier } from "../src/auth.js";
import { utf8Length } from "../src/utf8.js";
import {
  AUDIENCE,
  ISSUER,
  app,
  durableObject,
  issuer,
  newRuntime,
  nowSeconds,
  sqliteDriver,
} from "./helpers.js";

/**
 * Contract regressions for the independent reviews of the adapter (R1–R15):
 * each block pins one promised behavior with concrete inputs and outputs.
 */

type Frame = { readonly type: string; readonly [key: string]: unknown };

const ref = (module: string, name: string) => anyApi[module]![name]!;
const wait = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms));
const FROZEN = "temporarily read-only for maintenance";

/** Wait until `condition` holds, failing after about two seconds. */
async function until(condition: () => boolean | Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await condition()) return;
    await wait(10);
  }
  throw new Error("condition never held");
}

function value(outcome: FunctionOutcome): JSONValue {
  if (!outcome.success) throw new Error(`expected success, got ${outcome.message}`);
  return outcome.value;
}

function gate() {
  let open!: () => void;
  let started!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  const begun = new Promise<void>((resolve) => {
    started = resolve;
  });
  return { open, opened, started, begun };
}

function socket(runtime: Runtime, verifier: TokenVerifier | null = null) {
  const messages: Frame[] = [];
  let closed = false;
  const session = new SyncSession(runtime, verifier, {
    send: (text) => messages.push(JSON.parse(text) as Frame),
    close: () => {
      closed = true;
    },
  });
  const send = (message: unknown) => session.receive(JSON.stringify(message));
  send({ type: "Connect", sessionId: "contract-test" });
  return { session, messages, send, closed: () => closed };
}

/** The latest value a socket's transitions delivered for `queryId`. */
function latest(messages: readonly Frame[], queryId: number): unknown {
  const updates = messages
    .filter((message) => message.type === "Transition")
    .flatMap((message) => message["modifications"] as { queryId: number; value?: unknown }[])
    .filter((modification) => modification.queryId === queryId);
  return updates.at(-1)?.value;
}

async function freeze(runtime: Runtime, frozen: boolean): Promise<bigint> {
  return runtime.exclusive(async () => {
    setWritesFrozen(runtime, frozen);
    return runtime.store.ts;
  });
}

async function counter(runtime: Runtime, name: string): Promise<JSONValue> {
  return value((await runtime.query("counters:get", { name }, null)).outcome);
}

function jobs(runtime: Runtime): { name: string; state: Record<string, unknown> }[] {
  return runtime.store.driver
    .exec("SELECT json FROM cvx_documents WHERE table_name = '_scheduled_functions'")
    .map(
      (row) => JSON.parse(String(row["json"])) as { name: string; state: Record<string, unknown> },
    )
    .map(({ name, state }) => ({ name, state }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function userTables(runtime: Runtime): Record<string, number> {
  return Object.fromEntries(
    [...runtime.store.tableNumbers()].filter(([name]) => !name.startsWith("_")),
  );
}

function withModules(modules: ConvexApp["modules"], extra: Partial<ConvexApp> = {}): ConvexApp {
  return { ...app, ...extra, modules: { ...app.modules, ...modules } };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("R1: freezing writes is a single-writer barrier", () => {
  const http = httpRouter();
  http.route({
    path: "/bump",
    method: "POST",
    handler: httpActionGeneric(async (ctx) => {
      await ctx.runMutation(ref("counters", "bump"), { name: "http" });
      return new Response("bumped");
    }),
  });

  it("refuses mutations, actions, HTTP actions, scheduled functions and crons alike", async () => {
    const runtime = new Runtime(sqliteDriver(), withModules({}, { http }));
    value(
      (await runtime.mutation("counters:bumpLater", { name: "job", delayMs: 0 }, null)).outcome,
    );
    runtime.syncCrons();
    const barrier = await freeze(runtime, true);
    const before = await tableStats(runtime);

    const refusals = [
      (await runtime.mutation("rooms:create", { code: "DENIED" }, null)).outcome,
      (await runtime.mutation("counters:bump", { name: "x" }, null, { visibility: "internal" }))
        .outcome,
      await runtime.action("counters:bumpViaAction", { name: "action" }, null),
      await runtime.action("counters:bumpViaAction", { name: "action" }, null, "internal"),
    ];
    for (const outcome of refusals) {
      expect(outcome.success ? "accepted" : outcome.message).toContain(FROZEN);
    }
    const httpResponse = await runtime.http(
      new Request("https://backend.example.test/bump", { method: "POST" }),
      "/bump",
    );
    expect(httpResponse.status).toBe(503);
    expect(await runtime.runDue(Date.now() + 61_000)).toBe(0);

    expect(runtime.store.ts).toBe(barrier);
    expect(await tableStats(runtime)).toEqual(before);
    expect(jobs(runtime)).toEqual([{ name: "counters:bump", state: { kind: "pending" } }]);
    for (const name of ["action", "http", "job", "cron"])
      expect(await counter(runtime, name)).toBe(0);

    // Once writes resume, the job that waited and the cron both run.
    await freeze(runtime, false);
    await runtime.runDue(Date.now() + 61_000);
    expect(await counter(runtime, "job")).toBe(1);
    expect(await counter(runtime, "cron")).toBe(1);
  });

  it("stops an action that was already running from writing, scheduling or canceling after the freeze", async () => {
    const { open, opened, started, begun } = gate();
    const late = actionGeneric({
      args: { jobId: v.string() },
      handler: async (ctx, { jobId }) => {
        started();
        await opened;
        const attempts: string[] = [];
        for (const attempt of [
          () => ctx.runMutation(ref("counters", "bump"), { name: "late" }),
          () => ctx.scheduler.runAfter(0, ref("counters", "bump"), { name: "late" }),
          () => ctx.scheduler.cancel(jobId as GenericId<"_scheduled_functions">),
          () => ctx.runAction(ref("counters", "bumpViaAction"), { name: "late" }),
        ]) {
          try {
            await attempt();
            attempts.push("accepted");
          } catch (error) {
            attempts.push(String(error));
          }
        }
        return attempts;
      },
    });
    const runtime = new Runtime(sqliteDriver(), withModules({ extra: { late } }));
    const jobId = value(
      (await runtime.mutation("counters:bumpLater", { name: "job", delayMs: 60_000 }, null))
        .outcome,
    );
    const running = runtime.action("extra:late", { jobId }, null);
    await begun;
    const barrier = await freeze(runtime, true);
    open();
    const attempts = value(await running) as string[];
    expect(attempts).toHaveLength(4);
    for (const attempt of attempts) expect(attempt).toContain(FROZEN);
    expect(runtime.store.ts).toBe(barrier);
    expect(jobs(runtime)).toEqual([{ name: "counters:bump", state: { kind: "pending" } }]);
    expect(await counter(runtime, "late")).toBe(0);
  });

  it("leaves a scheduled action cut off by the freeze unrecorded, then fails it once writes resume", async () => {
    const { open, opened, started, begun } = gate();
    const slow = internalActionGeneric({
      args: {},
      handler: async (ctx) => {
        started();
        await opened;
        await ctx.runMutation(ref("counters", "bump"), { name: "slow" });
      },
    });
    const enqueue = mutationGeneric({
      args: {},
      handler: async (ctx) => ctx.scheduler.runAfter(0, ref("extra", "slow"), {}),
    });
    const runtime = new Runtime(sqliteDriver(), withModules({ extra: { slow, enqueue } }));
    value((await runtime.mutation("extra:enqueue", {}, null)).outcome);
    expect(await runtime.runDue(Date.now() + 1000)).toBe(1);
    await begun;
    const barrier = await freeze(runtime, true);
    open();
    // The action ends without recording an outcome; its job is then no longer
    // running here, so the scheduler sees it as interrupted.
    await until(() => runtime.runningActions === 0 && runtime.nextWakeTime() !== null);
    expect(runtime.store.ts).toBe(barrier);
    expect(jobs(runtime)).toEqual([{ name: "extra:slow", state: { kind: "inProgress" } }]);
    expect(await counter(runtime, "slow")).toBe(0);

    await freeze(runtime, false);
    expect(runtime.nextWakeTime()).toBeLessThanOrEqual(Date.now());
    await runtime.runDue();
    expect(jobs(runtime)).toEqual([
      {
        name: "extra:slow",
        state: { kind: "failed", error: "Interrupted before its outcome was recorded" },
      },
    ]);
  });

  it("refuses writes through every Durable Object entry point and disarms the alarm", async () => {
    const { admin, call, alarm } = await durableObject({ app: withModules({}, { http }) });
    expect((await admin("freeze", { frozen: false })).status).toBe(200);
    const post = (path: string, body: unknown) =>
      call(path, { method: "POST", body: JSON.stringify(body) });
    expect(
      (
        await post("/api/mutation", {
          path: "counters:bumpLater",
          args: [{ name: "job", delayMs: 0 }],
        })
      ).status,
    ).toBe(200);
    expect(alarm()).not.toBeNull();

    const frozen = await admin("freeze", { frozen: true });
    expect(frozen.body).toMatchObject({ writesFrozen: true });
    expect(alarm()).toBeNull();
    const mutation = await post("/api/mutation", { path: "rooms:create", args: [{ code: "NO" }] });
    expect(mutation.status).toBe(560);
    expect(await mutation.text()).toContain(FROZEN);
    const action = await post("/api/action", {
      path: "counters:bumpViaAction",
      args: [{ name: "a" }],
    });
    expect(action.status).toBe(560);
    expect((await call("/http/bump", { method: "POST" })).status).toBe(503);
    const status = await admin("status");
    expect(status.body).toMatchObject({
      ts: frozen.body["ts"],
      writesFrozen: true,
      runningActions: 0,
    });
  });
});

describe("R2 and R3: replacing the database with a snapshot", () => {
  it("rejects an invalid snapshot before changing any record, index entry or mapping", async () => {
    const runtime = newRuntime();
    value((await runtime.mutation("rooms:create", { code: "KEEP" }, null)).outcome);
    const snapshot = () => ({
      ts: runtime.store.ts,
      numbers: Object.fromEntries(runtime.store.tableNumbers()),
      sql: runtime.store.driver.exec("SELECT name, number FROM cvx_tables ORDER BY name"),
      index: runtime.store.driver.exec("SELECT index_name, key, id FROM cvx_index ORDER BY 1, 2"),
    });
    const before = { ...snapshot(), stats: await tableStats(runtime) };

    expect(() => beginImport(runtime, { rooms: 10001 })).toThrow(MaintenanceStateError);
    await freeze(runtime, true);
    const frozen = snapshot();
    const invalid: Record<string, unknown>[] = [
      { first: 10001, second: 10001 },
      { rooms: 539 },
      { _scheduled_functions: 10001 },
      { "1rooms": 10001 },
      { "": 10001 },
      { rooms: 0 },
      { rooms: -3 },
      { rooms: 1.5 },
      { rooms: "10001" },
    ];
    for (const tables of invalid) {
      expect(() => beginImport(runtime, tables as Record<string, number>)).toThrow();
      expect(snapshot()).toEqual(frozen);
      expect(await tableStats(runtime)).toEqual(before.stats);
    }
    expect(importPending(runtime)).toBe(false);
    expect(frozen.numbers).toEqual(before.numbers);
    await freeze(runtime, false);
    const room = value((await runtime.query("rooms:byCode", { code: "KEEP" }, null)).outcome);
    expect(room).toMatchObject({ code: "KEEP" });
  });

  it("refreshes every live subscription when the data is replaced, removed rows included", async () => {
    const runtime = newRuntime();
    value((await runtime.mutation("rooms:create", { code: "REMOVED" }, null)).outcome);
    const { session, messages, send } = socket(runtime);
    send({
      type: "ModifyQuerySet",
      baseVersion: 0,
      newVersion: 1,
      modifications: [
        { type: "Add", queryId: 0, udfPath: "rooms:byCode", args: [{ code: "REMOVED" }] },
      ],
    });
    await wait();
    expect(latest(messages, 0)).toMatchObject({ code: "REMOVED" });
    await freeze(runtime, true);
    await runtime.exclusive(() =>
      beginImport(runtime, { rooms: 10001, messages: 10002, counters: 10003 }),
    );
    await wait();
    expect(latest(messages, 0)).toBeNull();
    session.close();
  });

  it("keeps writes frozen until the imported checksums equal the snapshot's", async () => {
    const source = newRuntime();
    const roomId = value((await source.mutation("rooms:create", { code: "MOVE" }, null)).outcome);
    for (const body of ["one", "two"]) {
      value((await source.mutation("messages:send", { roomId, body }, null)).outcome);
    }
    const expected = await tableStats(source);
    const target = newRuntime();
    await freeze(target, true);
    await target.exclusive(() => beginImport(target, userTables(source)));
    expect(importPending(target)).toBe(true);
    await target.exclusive(() =>
      importDocuments(target, "rooms", exportPage(source, "rooms", null, 1000).documents),
    );
    const partial = await target.exclusive(() => commitImport(target, expected));
    expect(partial.mismatches.map((mismatch) => mismatch.table)).toEqual(["messages"]);
    await expect(freeze(target, false)).rejects.toThrow(MaintenanceStateError);
    expect(target.writesFrozen).toBe(true);

    await target.exclusive(() =>
      importDocuments(target, "messages", exportPage(source, "messages", null, 1000).documents),
    );
    expect((await target.exclusive(() => commitImport(target, expected))).mismatches).toEqual([]);
    await freeze(target, false);
    value((await target.mutation("messages:send", { roomId, body: "three" }, null)).outcome);
    expect(value((await target.query("messages:list", { roomId }, null)).outcome)).toEqual([
      "three",
      "two",
      "one",
    ]);
  });

  it("serves the import protocol over the admin routes, refusing out-of-order steps", async () => {
    const { admin } = await durableObject();
    expect((await admin("import/documents", { table: "rooms", documents: [] })).status).toBe(409);
    expect((await admin("import/begin", { tables: { a: 10001, b: 10001 } })).status).toBe(400);
    expect((await admin("import/begin", { tables: { rooms: 10001 } })).status).toBe(200);
    const expected: Record<string, ExpectedTable> = {
      rooms: { count: 1, sha256: "0".repeat(64) },
    };
    const mismatch = await admin("import/commit", { tables: expected });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body["committed"]).toBe(false);
    expect((await admin("freeze", { frozen: false })).status).toBe(409);
    const empty = await admin("import/commit", { tables: {} });
    expect(empty.body).toMatchObject({ committed: true, mismatches: [] });
    expect((await admin("freeze", { frozen: false })).body).toMatchObject({ writesFrozen: false });
  });
});

describe("R4: one job or cron that cannot load never starves the others", () => {
  it("fails the job, runs every other due job and cron, and does not retry", async () => {
    let broken = false;
    const poison = { run: internalMutationGeneric({ args: {}, handler: async () => null }) };
    const enqueue = mutationGeneric({
      args: {},
      handler: async (ctx) => ctx.scheduler.runAfter(0, ref("poison", "run"), {}),
    });
    const crons = cronJobs();
    crons.interval("a broken", { minutes: 1 }, ref("poison", "run"), {});
    crons.interval("b healthy", { minutes: 1 }, ref("counters", "bump"), { name: "cron" });
    const customApp = withModules(
      {
        extra: { enqueue },
        poison: async () => {
          if (broken) throw new Error("synthetic missing configuration");
          return poison;
        },
      },
      { crons },
    );
    const driver = sqliteDriver();
    const original = new Runtime(driver, customApp);
    value((await original.mutation("extra:enqueue", {}, null)).outcome);
    value(
      (await original.mutation("counters:bumpLater", { name: "healthy", delayMs: 0 }, null))
        .outcome,
    );
    original.syncCrons();
    broken = true;
    const restarted = new Runtime(driver, customApp);
    const now = Date.now() + 61_000;
    await restarted.runDue(now);
    await restarted.runDue(now);
    expect(await counter(restarted, "healthy")).toBe(1);
    expect(await counter(restarted, "cron")).toBe(1);
    expect(jobs(restarted)).toEqual([
      { name: "counters:bump", state: { kind: "success" } },
      {
        name: "poison:run",
        state: {
          kind: "failed",
          error: "Could not load poison:run: synthetic missing configuration",
        },
      },
    ]);
  });
});

describe("R5: every accepted identity expires", () => {
  const claims = { iss: ISSUER, sub: "synthetic-user", aud: AUDIENCE };

  it("rejects a missing, non-numeric or non-finite exp and malformed nbf or iat", async () => {
    const { sign, verifier } = await issuer();
    const exp = nowSeconds() + 60;
    const invalid = [
      JSON.stringify(claims),
      JSON.stringify({ ...claims, exp: String(exp) }),
      JSON.stringify({ ...claims, exp: null }),
      `{"iss":"${ISSUER}","sub":"synthetic-user","aud":"${AUDIENCE}","exp":1e309}`,
      JSON.stringify({ ...claims, exp, nbf: "0" }),
      JSON.stringify({ ...claims, exp, iat: "now" }),
    ];
    for (const payload of invalid) {
      await expect(verifier.verify(await sign(payload)), payload).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    }
    const valid = await verifier.verify(
      await sign({ ...claims, exp, iat: exp - 60, nbf: exp - 60 }),
    );
    expect(valid.expiresAt).toBe(exp * 1000);
  });

  it("refuses such a token over HTTP and over the sync protocol", async () => {
    const { sign, verifier, fetcher } = await issuer();
    const token = await sign(claims);
    vi.stubGlobal("fetch", fetcher);
    const { call } = await durableObject({
      auth: { providers: [{ domain: ISSUER, applicationID: AUDIENCE }] },
    });
    const response = await call("/api/query", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: "counters:get", args: [{ name: "x" }] }),
    });
    expect(response.status).toBe(401);
    expect(await response.text()).toContain("expiration");

    const { session, messages, send } = socket(newRuntime(), verifier);
    send({ type: "Authenticate", tokenType: "User", value: token, baseVersion: 0 });
    await wait();
    expect(messages.at(-1)).toMatchObject({ type: "AuthError", baseVersion: 0 });
    session.close();
  });
});

describe("R6: scheduled arguments keep their Convex values", () => {
  it("round-trips bigint, bytes and special floats through storage, a restart and the call", async () => {
    const received: Record<string, Value>[] = [];
    const record = internalMutationGeneric({
      args: {
        n: v.int64(),
        bytes: v.bytes(),
        nan: v.float64(),
        negativeZero: v.float64(),
        infinity: v.float64(),
      },
      handler: async (_ctx, args) => {
        received.push(args);
        return null;
      },
    });
    const schedule = mutationGeneric({
      args: {},
      handler: async (ctx) =>
        ctx.scheduler.runAfter(0, ref("extra", "record"), {
          n: 5n,
          bytes: new Uint8Array([0, 1, 255]).buffer,
          nan: Number.NaN,
          negativeZero: -0,
          infinity: Number.POSITIVE_INFINITY,
        }),
    });
    const customApp = withModules({ extra: { record, schedule } });
    const driver = sqliteDriver();
    value((await new Runtime(driver, customApp).mutation("extra:schedule", {}, null)).outcome);
    const restarted = new Runtime(driver, customApp);
    await restarted.runDue(Date.now() + 1000);
    expect(jobs(restarted)).toEqual([{ name: "extra:record", state: { kind: "success" } }]);
    expect(received).toHaveLength(1);
    const args = received[0]!;
    expect(args["n"]).toBe(5n);
    expect([...new Uint8Array(args["bytes"] as ArrayBuffer)]).toEqual([0, 1, 255]);
    expect(Number.isNaN(args["nan"])).toBe(true);
    expect(Object.is(args["negativeZero"], -0)).toBe(true);
    expect(args["infinity"]).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("R7: a running action never holds up its connection", () => {
  it("handles mutation, query-set and auth frames meanwhile, keeping the action's admitted identity", async () => {
    const { open, opened, started, begun } = gate();
    const slow = actionGeneric({
      args: {},
      handler: async (ctx) => {
        started();
        await opened;
        return (await ctx.auth.getUserIdentity())?.subject ?? null;
      },
    });
    const runtime = new Runtime(sqliteDriver(), withModules({ extra: { slow } }));
    const { sign, verifier } = await issuer();
    const { session, messages, send } = socket(runtime, verifier);
    send({ type: "Action", requestId: 1, udfPath: "extra:slow", args: [{}] });
    await begun;
    send({ type: "Mutation", requestId: 2, udfPath: "rooms:create", args: [{ code: "LIVE" }] });
    send({
      type: "ModifyQuerySet",
      baseVersion: 0,
      newVersion: 1,
      modifications: [
        { type: "Add", queryId: 0, udfPath: "rooms:byCode", args: [{ code: "LIVE" }] },
      ],
    });
    const token = await sign({ iss: ISSUER, sub: "later", aud: AUDIENCE, exp: nowSeconds() + 600 });
    send({ type: "Authenticate", tokenType: "User", value: token, baseVersion: 0 });
    await wait(50);
    expect(messages.find((message) => message.type === "MutationResponse")).toMatchObject({
      requestId: 2,
      success: true,
    });
    expect(latest(messages, 0)).toMatchObject({ code: "LIVE" });
    const transitions = messages.filter((message) => message.type === "Transition");
    expect(transitions.at(-1)?.["endVersion"]).toMatchObject({ querySet: 1, identity: 1 });
    expect(messages.some((message) => message.type === "ActionResponse")).toBe(false);

    open();
    await wait();
    expect(messages.find((message) => message.type === "ActionResponse")).toMatchObject({
      requestId: 1,
      success: true,
      result: null,
    });
    session.close();
  });

  it("refuses actions beyond the per-connection limit instead of queueing them", async () => {
    const { open, opened } = gate();
    const held = actionGeneric({ args: {}, handler: async () => opened.then(() => "done") });
    const runtime = new Runtime(sqliteDriver(), withModules({ extra: { held } }));
    const { session, messages, send } = socket(runtime);
    for (let requestId = 1; requestId <= 33; requestId += 1) {
      send({ type: "Action", requestId, udfPath: "extra:held", args: [{}] });
    }
    await wait();
    expect(messages.filter((message) => message.type === "ActionResponse")).toEqual([
      expect.objectContaining({ requestId: 33, success: false }),
    ]);
    open();
    await wait();
    const responses = messages.filter((message) => message.type === "ActionResponse");
    expect(responses.filter((message) => message["success"] === true)).toHaveLength(32);
    session.close();
  });
});

const floatFromBits = (bits: bigint) => {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, bits);
  return view.getFloat64(0);
};
const bitsOf = (number: number) => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, number);
  return view.getBigUint64(0).toString(16).padStart(16, "0");
};
const SIGN = 0x8000_0000_0000_0000n;
const EXPONENT = 0x7ff0_0000_0000_0000n;
const FRACTION = 0x000f_ffff_ffff_ffffn;
const isNaNBits = (bits: bigint) => (bits & EXPONENT) === EXPONENT && (bits & FRACTION) !== 0n;

/**
 * The pinned SDK's `compareValues` rule for numbers (convex/values
 * compare.js), applied to raw IEEE bits: NaNs sort below or above every
 * number by sign, and NaNs of one sign by their signed bits. Comparing JS
 * numbers directly cannot pin NaN payloads: V8 may canonicalize a NaN it
 * stores in an array of doubles, which `compareValues` does internally, so
 * the patterns stay BigInts until the moment they are encoded.
 */
function compareNumberBits(a: bigint, b: bigint): number {
  const [nanA, nanB] = [isNaNBits(a), isNaNBits(b)];
  const [negativeA, negativeB] = [(a & SIGN) !== 0n, (b & SIGN) !== 0n];
  if (!nanA && !nanB) return Math.sign(compareValues(floatFromBits(a), floatFromBits(b)));
  if (nanA !== nanB) return nanA ? (negativeA ? -1 : 1) : negativeB ? 1 : -1;
  if (negativeA !== negativeB) return negativeA ? -1 : 1;
  const [signedA, signedB] = [BigInt.asIntN(64, a), BigInt.asIntN(64, b)];
  return signedA < signedB ? -1 : signedA === signedB ? 0 : 1;
}

const SPECIAL_BITS = [
  0xfff8_0000_0000_0002n,
  0xfff8_0000_0000_0001n,
  0xfff0_0000_0000_0001n,
  0xffff_ffff_ffff_ffffn,
  0x7ff8_0000_0000_0000n,
  0x7ff8_0000_0000_0001n,
  0x7ff0_0000_0000_0001n,
  0x7fff_ffff_ffff_ffffn,
  0xfff0_0000_0000_0000n, // -Infinity
  0xffef_ffff_ffff_ffffn, // -MAX_VALUE
  0xbff8_0000_0000_0000n, // -1.5
  0x8000_0000_0000_0001n, // -MIN_VALUE
  0x8000_0000_0000_0000n, // -0
  0x0000_0000_0000_0000n, // +0
  0x0000_0000_0000_0001n, // MIN_VALUE
  0x3ff0_0000_0000_0000n, // 1
  0x7fef_ffff_ffff_ffffn, // MAX_VALUE
  0x7ff0_0000_0000_0000n, // +Infinity
];

/** Deterministic pseudo-random bit patterns; about half are NaNs of either sign. */
function randomBits(count: number): bigint[] {
  let state = 0x2545_f491_4f6c_dd1dn;
  const next = () => {
    state ^= (state << 13n) & 0xffff_ffff_ffff_ffffn;
    state ^= state >> 7n;
    state ^= (state << 17n) & 0xffff_ffff_ffff_ffffn;
    return state;
  };
  return Array.from({ length: count }, (_, index) =>
    index % 2 === 0 ? next() | EXPONENT : next(),
  );
}

const keyOfBits = (bits: bigint) => encodeValue(floatFromBits(bits));

describe("R8: index keys order every float like compareValues", () => {
  it("encodes every bit pattern, NaN signs and payloads included, in compareValues order", () => {
    for (const bits of SPECIAL_BITS)
      expect(bitsOf(floatFromBits(bits))).toBe(bits.toString(16).padStart(16, "0"));
    for (const a of SPECIAL_BITS) {
      for (const b of SPECIAL_BITS) {
        const [keyA, keyB] = [keyOfBits(a), keyOfBits(b)];
        const actual = keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
        expect(actual, `${a.toString(16)} vs ${b.toString(16)}`).toBe(compareNumberBits(a, b));
      }
    }
    const sorted = [...SPECIAL_BITS, ...randomBits(2000)]
      .map((bits) => ({ bits, key: keyOfBits(bits) }))
      .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
    for (let index = 1; index < sorted.length; index += 1) {
      const [previous, current] = [sorted[index - 1]!, sorted[index]!];
      const expected = previous.key === current.key ? 0 : -1;
      expect(compareNumberBits(previous.bits, current.bits), current.bits.toString(16)).toBe(
        expected,
      );
    }
  });

  it("plans index equality and ranges over those floats to exactly the matching keys", () => {
    const index = {
      name: "samples.by_x",
      table: "samples",
      fields: ["x"],
      keyFields: ["x", "_creationTime", "_id"],
    };
    const stored = SPECIAL_BITS.map((bits) => ({
      bits,
      key: keyOfBits(bits) + encodeValue(1) + encodeValue("id"),
    }));
    const within = (range: { low: string; high: string | null }) =>
      stored
        .filter(({ key }) => key >= range.low && (range.high === null || key < range.high))
        .map(({ bits }) => bits.toString(16));
    const matching = (keep: (order: number) => boolean, probe: bigint) =>
      stored
        .filter(({ bits }) => keep(compareNumberBits(bits, probe)))
        .map(({ bits }) => bits.toString(16));
    for (const probe of SPECIAL_BITS) {
      const bound = convexToJson(floatFromBits(probe));
      const label = probe.toString(16);
      const planned = (type: "Eq" | "Gt" | "Lte") =>
        within(planRange(index, [{ type, fieldPath: "x", value: bound }]));
      expect(planned("Eq"), label).toEqual(matching((order) => order === 0, probe));
      expect(planned("Gt"), label).toEqual(matching((order) => order > 0, probe));
      expect(planned("Lte"), label).toEqual(matching((order) => order <= 0, probe));
    }
  });

  it("answers stored index queries over special floats in compareValues order", async () => {
    const schema = defineSchema({
      samples: defineTable({ x: v.float64() }).index("by_x", ["x"]),
    });
    const values = [
      Number.NaN,
      Number.NEGATIVE_INFINITY,
      -1.5,
      -0,
      0,
      Number.MIN_VALUE,
      Number.POSITIVE_INFINITY,
    ];
    const insertAll = mutationGeneric({
      args: {},
      handler: async (ctx) => {
        for (const x of values) await ctx.db.insert("samples", { x });
      },
    });
    const above = queryGeneric({
      args: { x: v.float64() },
      handler: async (ctx, { x }) =>
        (
          await ctx.db
            .query("samples")
            .withIndex("by_x", (q) => q.gt("x", x))
            .collect()
        ).map((document) => document["x"] as number),
    });
    const runtime = new Runtime(sqliteDriver(), {
      schema,
      modules: { samples: { insertAll, above } },
    });
    value((await runtime.mutation("samples:insertAll", {}, null)).outcome);
    const ordered = [...values].sort(compareValues);
    for (const probe of values) {
      const result = value(
        (await runtime.query("samples:above", convexToJson({ x: probe }), null)).outcome,
      );
      const expected = ordered
        .filter((x) => compareValues(x, probe) > 0)
        .map((x) => convexToJson(x));
      expect(result, bitsOf(probe)).toEqual(expected);
    }
  });
});

describe("R9: filter and limit stages run in query order", () => {
  /** `limit()` is internal to the SDK's query builder, but it serializes a real stage. */
  interface PipelineQuery {
    filter(predicate: (q: FilterBuilder) => unknown): PipelineQuery;
    limit(n: number): PipelineQuery;
    take(n: number): Promise<unknown[]>;
    collect(): Promise<unknown[]>;
    paginate(options: { cursor: string | null; numItems: number }): Promise<unknown>;
  }
  interface FilterBuilder {
    eq(left: unknown, right: unknown): unknown;
    field(name: string): unknown;
  }
  const rooms = (ctx: { db: { query(table: "rooms"): unknown } }) =>
    ctx.db.query("rooms") as PipelineQuery;
  const isMatch = (q: FilterBuilder) => q.eq(q.field("code"), "MATCH");
  const extra = {
    limitThenFilter: queryGeneric({
      args: {},
      handler: async (ctx) => rooms(ctx).limit(1).filter(isMatch).collect(),
    }),
    filterThenTake: queryGeneric({
      args: {},
      handler: async (ctx) => rooms(ctx).filter(isMatch).take(1),
    }),
    limitThenPaginate: queryGeneric({
      args: {},
      handler: async (ctx) => rooms(ctx).limit(1).paginate({ cursor: null, numItems: 10 }),
    }),
    filterLimitThenPaginate: queryGeneric({
      args: {},
      handler: async (ctx) =>
        rooms(ctx).filter(isMatch).limit(1).paginate({ cursor: null, numItems: 10 }),
    }),
  };

  it("applies limit before a later filter, and bounds each paginated page", async () => {
    const runtime = new Runtime(sqliteDriver(), withModules({ extra }));
    for (const code of ["OTHER", "MATCH", "MATCH"]) {
      value((await runtime.mutation("rooms:create", { code }, null)).outcome);
    }
    const codes = (documents: JSONValue) =>
      (documents as { code: string }[]).map((document) => document.code);
    expect(codes(value((await runtime.query("extra:limitThenFilter", {}, null)).outcome))).toEqual(
      [],
    );
    expect(codes(value((await runtime.query("extra:filterThenTake", {}, null)).outcome))).toEqual([
      "MATCH",
    ]);
    const limited = value((await runtime.query("extra:limitThenPaginate", {}, null)).outcome) as {
      page: JSONValue;
      isDone: boolean;
    };
    expect({ codes: codes(limited.page), isDone: limited.isDone }).toEqual({
      codes: ["OTHER"],
      isDone: true,
    });
    const filtered = value(
      (await runtime.query("extra:filterLimitThenPaginate", {}, null)).outcome,
    ) as {
      page: JSONValue;
      isDone: boolean;
    };
    expect({ codes: codes(filtered.page), isDone: filtered.isDone }).toEqual({
      codes: ["MATCH"],
      isDone: true,
    });
  });
});

describe("R10: size limits count UTF-8 bytes", () => {
  it("measures strings exactly as TextEncoder encodes them", () => {
    for (const text of [
      "",
      "a",
      "é",
      "中",
      "😀",
      "\ud800",
      "\udc00",
      "a\ud800b",
      "😀\ud800x",
      "a".repeat(10),
    ]) {
      expect(utf8Length(text), JSON.stringify(text)).toBe(
        new TextEncoder().encode(text).byteLength,
      );
    }
  });

  it("closes a socket on a text or binary frame over 1 MiB, and accepts one just under", async () => {
    const frames = [
      { frame: JSON.stringify({ type: "Event", padding: "中".repeat(400_000) }), closes: true },
      { frame: new Uint8Array((1 << 20) + 1).buffer, closes: true },
      { frame: new Blob([new Uint8Array((1 << 20) + 1)]), closes: true },
      { frame: JSON.stringify({ type: "Event", padding: "中".repeat(349_000) }), closes: false },
    ];
    for (const { frame, closes } of frames) {
      let closed = false;
      const session = new SyncSession(newRuntime(), null, {
        send: () => undefined,
        close: () => {
          closed = true;
        },
      });
      session.receive(frame);
      await wait();
      expect(closed, typeof frame === "string" ? `${utf8Length(frame)} bytes` : "binary").toBe(
        closes,
      );
      session.close();
    }
  });

  it("decodes binary frames delivered as Blobs, as Workers deliver them", async () => {
    const runtime = newRuntime();
    value((await runtime.mutation("rooms:create", { code: "BLOB" }, null)).outcome);
    const { session, messages, closed } = socket(runtime);
    const subscribe = {
      type: "ModifyQuerySet",
      baseVersion: 0,
      newVersion: 1,
      modifications: [
        { type: "Add", queryId: 0, udfPath: "rooms:byCode", args: [{ code: "BLOB" }] },
      ],
    };
    session.receive(new Blob([JSON.stringify(subscribe)]));
    await wait();
    expect({ closed: closed(), room: latest(messages, 0) }).toMatchObject({
      closed: false,
      room: { code: "BLOB" },
    });
    session.close();
  });

  it("refuses an HTTP body over 8 MiB as it streams in, whatever Content-Length claims", async () => {
    const { call } = await durableObject();
    const request = (padding: string, headers: Record<string, string> = {}) =>
      call("/api/query", {
        method: "POST",
        headers,
        body: JSON.stringify({ path: "counters:get", args: [{ name: "size" }], padding }),
      });
    expect((await request("中".repeat(3_000_000))).status).toBe(413);
    expect((await request("中".repeat(3_000_000), { "Content-Length": "100" })).status).toBe(413);
    expect((await request("中".repeat(2_000_000))).status).toBe(200);
  });

  it("reads an unwanted body to its end, up to 32 MiB, so the runtime can deliver the response", async () => {
    const { call } = await durableObject();
    /** A streamed body that records whether it was read to its end or cancelled. */
    const tracked = (bytes: number) => {
      const chunk = new Uint8Array(64 * 1024).fill(0x61);
      let sent = 0;
      let outcome = "unread";
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent >= bytes) {
            outcome = "drained";
            controller.close();
            return;
          }
          sent += chunk.byteLength;
          controller.enqueue(chunk);
        },
        cancel() {
          outcome = "cancelled";
        },
      });
      return { body, outcome: () => outcome };
    };
    const post = async (path: string, bytes: number, headers: Record<string, string> = {}) => {
      const { body, outcome } = tracked(bytes);
      // Node requires `duplex` for a streamed body; the DOM RequestInit type omits it.
      const init = { method: "POST", body, headers, duplex: "half" };
      const response = await call(path, init);
      return { status: response.status, body: outcome() };
    };
    const tooLarge = 9 * 1024 * 1024;
    expect(await post("/api/query", tooLarge, { "Content-Length": String(tooLarge) })).toEqual({
      status: 413,
      body: "drained",
    });
    expect(await post("/api/query", tooLarge)).toEqual({ status: 413, body: "drained" });
    expect(await post("/admin/freeze", 1024)).toEqual({ status: 401, body: "drained" });
    expect(await post("/api/query", 40 * 1024 * 1024)).toEqual({ status: 413, body: "cancelled" });
  });

  it("measures documents in UTF-8 bytes", async () => {
    const runtime = newRuntime();
    const tooLarge = (await runtime.mutation("rooms:create", { code: "中".repeat(400_000) }, null))
      .outcome;
    expect(tooLarge.success ? "accepted" : tooLarge.message).toContain("too large");
    value((await runtime.mutation("rooms:create", { code: "a".repeat(400_000) }, null)).outcome);
  });
});

describe("R11: rollback keeps every accepted write", () => {
  it("freezes, exports one consistent snapshot, restores it with equal checksums, and keeps one writer", async () => {
    const http = httpRouter();
    http.route({
      path: "/bump",
      method: "POST",
      handler: httpActionGeneric(async (ctx) => {
        await ctx.runMutation(ref("counters", "bump"), { name: "http" });
        return new Response("bumped");
      }),
    });
    const source = new Runtime(sqliteDriver(), withModules({}, { http }));
    const roomId = value((await source.mutation("rooms:create", { code: "ROLL" }, null)).outcome);
    for (let index = 0; index < 5; index += 1) {
      value((await source.mutation("messages:send", { roomId, body: `m${index}` }, null)).outcome);
    }
    value(await source.action("counters:bumpViaAction", { name: "before" }, null));
    value(
      (await source.mutation("counters:bumpLater", { name: "later", delayMs: 0 }, null)).outcome,
    );
    source.syncCrons();

    // 1. Freeze: the barrier timestamp is the last accepted write.
    const barrier = await freeze(source, true);
    // 2. Writes attempted during the rollback are refused, not lost later.
    expect(
      (await source.mutation("messages:send", { roomId, body: "late" }, null)).outcome.success,
    ).toBe(false);
    expect((await source.action("counters:bumpViaAction", { name: "late" }, null)).success).toBe(
      false,
    );
    expect(
      (await source.http(new Request("https://b.test/bump", { method: "POST" }), "/bump")).status,
    ).toBe(503);
    expect(await source.runDue(Date.now() + 61_000)).toBe(0);
    expect(source.runningActions).toBe(0);

    // 3. Export page by page; every page must come from the barrier.
    const exported: Record<string, JSONValue[]> = {};
    for (const table of Object.keys(userTables(source))) {
      const documents: JSONValue[] = [];
      exported[table] = documents;
      let after: string | null = null;
      for (;;) {
        const page = await source.exclusive(async () => exportPage(source, table, after, 2));
        expect({ ts: page.ts, writesFrozen: page.writesFrozen }).toEqual({
          ts: barrier.toString(),
          writesFrozen: true,
        });
        documents.push(...page.documents);
        if (page.next === null) break;
        after = page.next;
      }
    }
    const expected: Record<string, ExpectedTable> = {};
    for (const [table, documents] of Object.entries(exported)) {
      expected[table] = { count: documents.length, sha256: await documentsChecksum(documents) };
    }
    const sourceStats = await source.exclusive(() => tableStats(source));
    for (const [table, stats] of Object.entries(sourceStats)) {
      expect({ count: stats.count, sha256: stats.sha256 }).toEqual(expected[table]);
    }

    // 4. Restore into the other backend and require equal checksums.
    const target = newRuntime();
    await freeze(target, true);
    await target.exclusive(() => beginImport(target, userTables(source)));
    for (const [table, documents] of Object.entries(exported)) {
      await target.exclusive(() => importDocuments(target, table, documents));
    }
    expect((await target.exclusive(() => commitImport(target, expected))).mismatches).toEqual([]);

    // 5. Hand over: the target becomes the only writer; the source stays frozen.
    await freeze(target, false);
    value((await target.mutation("messages:send", { roomId, body: "after" }, null)).outcome);
    expect(
      (await source.mutation("messages:send", { roomId, body: "stray" }, null)).outcome.success,
    ).toBe(false);
    expect(source.store.ts).toBe(barrier);
    expect(value((await target.query("messages:list", { roomId }, null)).outcome)).toEqual([
      "after",
      "m4",
      "m3",
      "m2",
      "m1",
      "m0",
    ]);
    expect(await counter(target, "before")).toBe(1);
  });
});

describe("R12: an import's pending mark commits with the replacement, or neither does", () => {
  it("keeps data, mappings, receipts, timestamp and maintenance state when the mark cannot be written", async () => {
    const driver = sqliteDriver();
    let failMark = false;
    const faulty: SqlDriver = {
      transaction: (callback) => driver.transaction(callback),
      exec: (query, ...bindings) => {
        if (failMark && query.startsWith("INSERT OR REPLACE INTO cvx_meta")) {
          if (bindings[0] === "import_pending") {
            failMark = false;
            throw new Error("injected import marker write failure");
          }
        }
        return driver.exec(query, ...bindings);
      },
    };
    const runtime = new Runtime(faulty, app);
    const receipt = { sessionId: "s", requestId: 1 };
    value((await runtime.mutation("rooms:create", { code: "KEEP" }, null, { receipt })).outcome);
    const { session, messages, send } = socket(runtime);
    send({
      type: "ModifyQuerySet",
      baseVersion: 0,
      newVersion: 1,
      modifications: [
        { type: "Add", queryId: 0, udfPath: "rooms:byCode", args: [{ code: "KEEP" }] },
      ],
    });
    await wait();
    await freeze(runtime, true);
    const state = async () => ({
      stats: await tableStats(runtime),
      ts: runtime.store.ts,
      tables: Object.fromEntries(runtime.store.tableNumbers()),
      stored: driver.exec("SELECT name, number FROM cvx_tables ORDER BY name"),
      receipts: driver.exec("SELECT session_id, request_id FROM cvx_receipts"),
      maintenance: driver.exec(
        "SELECT key, value FROM cvx_meta WHERE key IN ('import_pending', 'writes_frozen')",
      ),
    });
    const before = await state();
    const transitions = messages.length;
    const snapshot = { rooms: 20001, messages: 20002, counters: 20003 };

    failMark = true;
    await expect(runtime.exclusive(() => beginImport(runtime, snapshot))).rejects.toThrow(
      "injected import marker write failure",
    );
    expect(await state()).toEqual(before);
    expect(before.maintenance).toEqual([{ key: "writes_frozen", value: "1" }]);
    await wait();
    expect(messages.length).toBe(transitions);
    expect(latest(messages, 0)).toMatchObject({ code: "KEEP" });

    // The same import begins once the write succeeds, and then holds writes frozen.
    await runtime.exclusive(() => beginImport(runtime, snapshot));
    expect(importPending(runtime)).toBe(true);
    await expect(freeze(runtime, false)).rejects.toThrow(MaintenanceStateError);
    session.close();
  });
});

describe("R13: every table number must fit a document ID", () => {
  it("rejects an unencodable number, or a mapping that leaves no number for a schema table, before changing anything", async () => {
    const runtime = newRuntime();
    const receipt = { sessionId: "s", requestId: 1 };
    value((await runtime.mutation("rooms:create", { code: "KEEP" }, null, { receipt })).outcome);
    await freeze(runtime, true);
    const state = async () => ({
      stats: await tableStats(runtime),
      ts: runtime.store.ts,
      tables: Object.fromEntries(runtime.store.tableNumbers()),
      receipts: runtime.store.driver.exec("SELECT session_id, request_id FROM cvx_receipts"),
    });
    const before = await state();
    const refused: [Record<string, number>, string][] = [
      [{ rooms: MAX_TABLE_NUMBER + 1 }, "Invalid table number 4294967296 for snapshot table rooms"],
      [{ rooms: MAX_TABLE_NUMBER }, "No table number is left for table messages"],
    ];
    for (const [tables, message] of refused) {
      expect(() => beginImport(runtime, tables)).toThrow(message);
      expect(await state()).toEqual(before);
      expect(importPending(runtime)).toBe(false);
    }

    // The highest numbers that leave room for the schema's tables work end to end.
    await runtime.exclusive(() => beginImport(runtime, { rooms: MAX_TABLE_NUMBER - 2 }));
    expect(userTables(runtime)).toEqual({
      rooms: MAX_TABLE_NUMBER - 2,
      messages: MAX_TABLE_NUMBER - 1,
      counters: MAX_TABLE_NUMBER,
    });
    expect((await runtime.exclusive(() => commitImport(runtime, {}))).mismatches).toEqual([]);
    await freeze(runtime, false);
    const roomId = value(
      (await runtime.mutation("rooms:create", { code: "HIGH" }, null)).outcome,
    ) as string;
    const messageId = value(
      (await runtime.mutation("messages:send", { roomId, body: "hi" }, null)).outcome,
    ) as string;
    expect([decodeId(roomId)?.tableNumber, decodeId(messageId)?.tableNumber]).toEqual([
      MAX_TABLE_NUMBER - 2,
      MAX_TABLE_NUMBER - 1,
    ]);
    expect(value((await runtime.query("rooms:normalize", { id: roomId }, null)).outcome)).toEqual({
      room: roomId,
      message: null,
    });
  });
});

describe("R14: a running scheduled action never holds up other scheduled work", () => {
  it("runs later jobs and crons while a scheduled action is held, then records its outcome", async () => {
    const { open, opened, started, begun } = gate();
    const slow = internalActionGeneric({
      args: {},
      handler: async (ctx) => {
        started();
        await opened;
        await ctx.runMutation(ref("counters", "bump"), { name: "slow" });
      },
    });
    const enqueue = mutationGeneric({
      args: {},
      handler: async (ctx) => ctx.scheduler.runAfter(0, ref("extra", "slow"), {}),
    });
    const runtime = new Runtime(sqliteDriver(), withModules({ extra: { slow, enqueue } }));
    value((await runtime.mutation("extra:enqueue", {}, null)).outcome);
    value(
      (await runtime.mutation("counters:bumpLater", { name: "healthy", delayMs: 0 }, null)).outcome,
    );
    runtime.syncCrons();
    const now = Date.now() + 61_000;

    // The pass ends with the action still held: its job, the later job and the cron.
    expect(await runtime.runDue(now)).toBe(3);
    await begun;
    const counts = async () => ({
      healthy: await counter(runtime, "healthy"),
      cron: await counter(runtime, "cron"),
      slow: await counter(runtime, "slow"),
    });
    expect(await counts()).toEqual({ healthy: 1, cron: 1, slow: 0 });
    expect(jobs(runtime)).toEqual([
      { name: "counters:bump", state: { kind: "success" } },
      { name: "extra:slow", state: { kind: "inProgress" } },
    ]);
    // Another pass meanwhile neither reruns the held action nor marks it interrupted.
    expect(await runtime.runDue(now)).toBe(0);
    expect(jobs(runtime)[1]).toEqual({ name: "extra:slow", state: { kind: "inProgress" } });

    open();
    await until(() => jobs(runtime)[1]?.state["kind"] === "success");
    expect(await counts()).toEqual({ healthy: 1, cron: 1, slow: 1 });
  });

  it("runs other crons while a cron action is held, skipping that cron's runs until it ends", async () => {
    const { open, opened, started, begun } = gate();
    let sweeps = 0;
    const sweep = internalActionGeneric({
      args: {},
      handler: async () => {
        sweeps += 1;
        started();
        await opened;
      },
    });
    const crons = cronJobs();
    crons.interval("a sweep", { minutes: 1 }, ref("extra", "sweep"), {});
    crons.interval("b tick", { minutes: 1 }, ref("counters", "bump"), { name: "cron" });
    const runtime = new Runtime(sqliteDriver(), withModules({ extra: { sweep } }, { crons }));
    runtime.syncCrons();
    const start = Date.now();

    expect(await runtime.runDue(start + 61_000)).toBe(2);
    await begun;
    expect(await counter(runtime, "cron")).toBe(1);
    // A minute later the sweep is still going: its run is skipped, the tick runs.
    expect(await runtime.runDue(start + 122_000)).toBe(1);
    expect({ sweeps, cron: await counter(runtime, "cron") }).toEqual({ sweeps: 1, cron: 2 });

    open();
    await until(() => runtime.runningActions === 0);
    expect(await runtime.runDue(start + 183_000)).toBe(2);
    await until(() => sweeps === 2 && runtime.runningActions === 0);
    expect(await counter(runtime, "cron")).toBe(3);
  });

  it("runs at most 16 scheduled actions at once; the next waits, pending, and starts when one ends", async () => {
    const { open, opened } = gate();
    let running = 0;
    let peak = 0;
    const held = internalActionGeneric({
      args: { n: v.number() },
      handler: async () => {
        running += 1;
        peak = Math.max(peak, running);
        await opened;
        running -= 1;
      },
    });
    const enqueue = mutationGeneric({
      args: { count: v.number() },
      handler: async (ctx, { count }) => {
        for (let n = 0; n < count; n += 1) {
          await ctx.scheduler.runAfter(0, ref("extra", "held"), { n });
        }
      },
    });
    const runtime = new Runtime(sqliteDriver(), withModules({ extra: { held, enqueue } }));
    value((await runtime.mutation("extra:enqueue", { count: 17 }, null)).outcome);
    value(
      (await runtime.mutation("counters:bumpLater", { name: "healthy", delayMs: 0 }, null)).outcome,
    );
    const states = () =>
      jobs(runtime)
        .filter((job) => job.name === "extra:held")
        .map((job) => String(job.state["kind"]))
        .sort();

    // Sixteen actions start and the later mutation job runs; the 17th action waits.
    expect(await runtime.runDue(Date.now() + 1000)).toBe(17);
    await until(() => running === 16);
    expect(states()).toEqual([...Array.from({ length: 16 }, () => "inProgress"), "pending"]);
    expect(await counter(runtime, "healthy")).toBe(1);
    // The waiting job does not wake the scheduler; the action that frees a slot does.
    expect(runtime.nextWakeTime()).toBeNull();

    open();
    await until(() => states().every((kind) => kind === "success"));
    expect({ peak, jobs: states().length }).toEqual({ peak: 16, jobs: 17 });
  });
});

describe("R15: discarding an unwanted body is bounded in time and bytes", () => {
  /** A request body the test feeds by hand, recording whether the backend cancelled it. */
  function upload() {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController;
      },
      cancel() {
        cancelled = true;
      },
    });
    return { body, controller, cancelled: () => cancelled };
  }
  /** An early 401 that never touches the body: an unsupported Authorization scheme. */
  const refused = (
    call: (path: string, init?: RequestInit) => Promise<Response>,
    body: ReadableStream<Uint8Array>,
  ) => {
    // Node requires `duplex` for a streamed body; the DOM RequestInit type omits it.
    const init = { method: "POST", body, headers: { Authorization: "Basic x" }, duplex: "half" };
    return call("/api/query", init);
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers a refusal one second after a stalled client last sent a byte", async () => {
    const { call } = await durableObject();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const client = upload();
    client.controller.enqueue(new Uint8Array([1]));
    let status: number | "pending" = "pending";
    const response = refused(call, client.body).then((answer) => {
      status = answer.status;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect({ status, cancelled: client.cancelled() }).toEqual({
      status: "pending",
      cancelled: false,
    });
    await vi.advanceTimersByTimeAsync(1);
    await response;
    expect({ status, cancelled: client.cancelled() }).toEqual({ status: 401, cancelled: true });
  });

  it("stops discarding a trickle five seconds after it began", async () => {
    const { call } = await durableObject();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const client = upload();
    const drip = () => {
      if (client.cancelled()) return;
      client.controller.enqueue(new Uint8Array([1]));
      setTimeout(drip, 900);
    };
    drip();
    let status: number | "pending" = "pending";
    const response = refused(call, client.body).then((answer) => {
      status = answer.status;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(status).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    await response;
    expect({ status, cancelled: client.cancelled() }).toEqual({ status: 401, cancelled: true });
  });

  it("cancels a body already past 32 MiB without reading it again", async () => {
    const { call } = await durableObject();
    const client = upload();
    client.controller.enqueue(new Uint8Array(33 * 1024 * 1024));
    const init = { method: "POST", body: client.body, duplex: "half" };
    const response = await call("/api/query", init);
    expect({ status: response.status, cancelled: client.cancelled() }).toEqual({
      status: 413,
      cancelled: true,
    });
  });

  it("answers at once when the client aborts its upload", async () => {
    const { call } = await durableObject();
    const client = upload();
    client.controller.enqueue(new Uint8Array([1]));
    const started = Date.now();
    const response = refused(call, client.body);
    await wait();
    client.controller.error(new Error("client went away"));
    expect((await response).status).toBe(401);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("drains what an HTTP action left unread after reading part of the body", async () => {
    const http = httpRouter();
    http.route({
      path: "/partial",
      method: "POST",
      handler: httpActionGeneric(async (_ctx, request) => {
        const reader = request.body!.getReader();
        const first = await reader.read();
        reader.releaseLock();
        return new Response(`read ${first.value?.byteLength ?? 0}`);
      }),
    });
    const { call, admin } = await durableObject({ app: withModules({}, { http }) });
    await admin("freeze", { frozen: false });
    const chunks = [new Uint8Array(3), new Uint8Array(5)];
    let outcome = "unread";
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const next = chunks.shift();
        if (next === undefined) {
          outcome = "drained";
          controller.close();
        } else controller.enqueue(next);
      },
      cancel() {
        outcome = "cancelled";
      },
    });
    const response = await call("/http/partial", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    expect({ status: response.status, text: await response.text(), body: outcome }).toEqual({
      status: 200,
      text: "read 3",
      body: "drained",
    });
  });
});
