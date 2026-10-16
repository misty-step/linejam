import { describe, expect, it } from "vitest";
import type { JSONValue } from "convex/values";
import {
  beginImport,
  commitImport,
  exportPage,
  importDocuments,
  setWritesFrozen,
  tableStats,
} from "../src/snapshot.js";
import { decodeId } from "../src/ids.js";
import { newRuntime, sqliteDriver } from "./helpers.js";

function value(outcome: { success: boolean; value?: JSONValue; message?: string }): JSONValue {
  if (!outcome.success) throw new Error(`expected success, got ${outcome.message}`);
  return outcome.value ?? null;
}

describe("Runtime", () => {
  it("commits mutations, queries indexes and keeps Convex ID semantics", async () => {
    const runtime = newRuntime();
    const roomId = value((await runtime.mutation("rooms:create", { code: "ABCD" }, null)).outcome);
    expect(typeof roomId).toBe("string");
    expect(decodeId(roomId as string)?.tableNumber).toBe(10001);

    const room = value(
      (await runtime.query("rooms:byCode", { code: "ABCD" }, null)).outcome,
    ) as Record<string, JSONValue>;
    expect(room["_id"]).toBe(roomId);
    expect(room["code"]).toBe("ABCD");
    expect(typeof room["_creationTime"]).toBe("number");

    const normalized = value(
      (await runtime.query("rooms:normalize", { id: roomId as string }, null)).outcome,
    );
    expect(normalized).toEqual({ room: roomId, message: null });

    await runtime.mutation("rooms:close", { roomId }, null);
    expect(value((await runtime.query("rooms:byCode", { code: "ABCD" }, null)).outcome)).toBeNull();
  });

  it("orders index scans and rolls back a failed mutation completely", async () => {
    const runtime = newRuntime();
    const roomId = value((await runtime.mutation("rooms:create", { code: "R1" }, null)).outcome);
    for (const body of ["one", "two", "three"]) {
      await runtime.mutation("messages:send", { roomId, body }, null);
    }
    expect(value((await runtime.query("messages:list", { roomId }, null)).outcome)).toEqual([
      "three",
      "two",
      "one",
    ]);

    const failed = (await runtime.mutation("rooms:createThenFail", { code: "GONE" }, null)).outcome;
    expect(failed).toMatchObject({ success: false, data: { kind: "Nope", code: "GONE" } });
    expect(failed.success ? "" : failed.message).toContain("ConvexError");
    expect(value((await runtime.query("rooms:byCode", { code: "GONE" }, null)).outcome)).toBeNull();
  });

  it("rejects invalid arguments, schema violations, unknown and internal functions", async () => {
    const runtime = newRuntime();
    const badArgs = (await runtime.mutation("rooms:create", { code: 12 }, null)).outcome;
    expect(badArgs.success ? "" : badArgs.message).toContain("ArgumentValidationError");
    const badDocument = (await runtime.mutation("messages:writeInvalid", {}, null)).outcome;
    expect(badDocument.success ? "" : badDocument.message).toContain("does not match the schema");
    const missing = (await runtime.query("rooms:nothing", {}, null)).outcome;
    expect(missing.success ? "" : missing.message).toContain("Could not find public function");
    const internal = (await runtime.mutation("counters:bump", { name: "x" }, null)).outcome;
    expect(internal.success).toBe(false);
    const wrongTable = (
      await runtime.mutation("messages:send", { roomId: "not-an-id", body: "x" }, null)
    ).outcome;
    expect(wrongTable.success).toBe(false);
  });

  it("paginates with stable cursors until done", async () => {
    const runtime = newRuntime();
    const roomId = value((await runtime.mutation("rooms:create", { code: "P" }, null)).outcome);
    for (let index = 0; index < 7; index += 1) {
      await runtime.mutation("messages:send", { roomId, body: `m${index}` }, null);
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let pages = 0; pages < 10; pages += 1) {
      const page = value(
        (await runtime.query("messages:page", { paginationOpts: { numItems: 3, cursor } }, null))
          .outcome,
      ) as { page: { body: string }[]; isDone: boolean; continueCursor: string };
      seen.push(...page.page.map((message) => message.body));
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    expect(seen).toEqual(["m0", "m1", "m2", "m3", "m4", "m5", "m6"]);
  });

  it("invalidates only subscriptions whose read ranges changed", async () => {
    const runtime = newRuntime();
    const first = value((await runtime.mutation("rooms:create", { code: "A" }, null)).outcome);
    const second = value((await runtime.mutation("rooms:create", { code: "B" }, null)).outcome);
    const { reads } = await runtime.query("messages:list", { roomId: first }, null);
    const commits: boolean[] = [];
    runtime.onCommit((commit) => {
      commits.push(reads.overlaps(commit.changes));
    });
    await runtime.mutation("messages:send", { roomId: second, body: "elsewhere" }, null);
    await runtime.mutation("messages:send", { roomId: first, body: "here" }, null);
    expect(commits).toEqual([false, true]);
  });

  it("replays a retried mutation from its receipt instead of re-running it", async () => {
    const runtime = newRuntime();
    const receipt = { sessionId: "session-1", requestId: 4 };
    const first = await runtime.mutation("rooms:create", { code: "ONCE" }, null, { receipt });
    const retry = await runtime.mutation("rooms:create", { code: "ONCE" }, null, { receipt });
    expect(retry.outcome).toEqual(first.outcome);
    expect(retry.ts).toBe(first.ts);
    expect(runtime.store.countTable("rooms")).toBe(1);
  });

  it("runs scheduled functions and crons, recording outcomes atomically", async () => {
    const runtime = newRuntime();
    await runtime.mutation("counters:bumpLater", { name: "later", delayMs: 0 }, null);
    await runtime.mutation("counters:failLater", {}, null);
    await runtime.mutation("counters:bumpLater", { name: "future", delayMs: 3_600_000 }, null);
    expect(runtime.syncCrons()).toBe(1);

    await runtime.runDue(Date.now() + 1000);
    expect(value((await runtime.query("counters:get", { name: "later" }, null)).outcome)).toBe(1);
    expect(value((await runtime.query("counters:get", { name: "never" }, null)).outcome)).toBe(0);
    expect(value((await runtime.query("counters:get", { name: "future" }, null)).outcome)).toBe(0);
    const states = runtime.store.driver
      .exec("SELECT json FROM cvx_documents WHERE table_name = '_scheduled_functions'")
      .map((row) => JSON.parse(String(row["json"])) as { name: string; state: { kind: string } })
      .map((job) => `${job.name}=${job.state.kind}`)
      .sort();
    expect(states).toEqual([
      "counters:bump=pending",
      "counters:bump=success",
      "counters:explode=failed",
    ]);

    await runtime.runDue(Date.now() + 61_000);
    expect(value((await runtime.query("counters:get", { name: "cron" }, null)).outcome)).toBe(1);
    expect(runtime.nextWakeTime()).not.toBeNull();
  });

  it("serves actions and HTTP actions through internal function calls", async () => {
    const runtime = newRuntime();
    expect(await runtime.action("counters:bumpViaAction", { name: "act" }, null)).toEqual({
      success: true,
      value: 1,
    });
    const response = await runtime.http(new Request("https://example.test/hello"), "/hello");
    expect(await response.json()).toEqual({ count: 0 });
    expect((await runtime.http(new Request("https://example.test/none"), "/none")).status).toBe(
      404,
    );
  });

  it("persists across restarts and round-trips a snapshot with identical IDs and checksums", async () => {
    const driver = sqliteDriver();
    const runtime = newRuntime(driver);
    const roomId = value((await runtime.mutation("rooms:create", { code: "KEEP" }, null)).outcome);
    await runtime.mutation("messages:send", { roomId, body: "hello" }, null);
    const before = await tableStats(runtime);

    const restarted = newRuntime(driver);
    expect(restarted.store.ts).toBe(runtime.store.ts);
    expect(await tableStats(restarted)).toEqual(before);

    const target = newRuntime();
    target.store.setWritesFrozen(true);
    const tables = Object.fromEntries(
      [...restarted.store.tableNumbers()].filter(([name]) => !name.startsWith("_")),
    );
    await beginImport(target, tables);
    for (const table of Object.keys(tables)) {
      await importDocuments(target, table, exportPage(restarted, table, null, 1000).documents);
    }
    expect((await commitImport(target, before)).mismatches).toEqual([]);
    expect(await tableStats(target)).toEqual(before);
    const blocked = (await target.mutation("rooms:create", { code: "FROZEN" }, null)).outcome;
    expect(blocked.success).toBe(false);
    setWritesFrozen(target, false);
    const room = value(
      (await target.query("rooms:byCode", { code: "KEEP" }, null)).outcome,
    ) as Record<string, JSONValue>;
    expect(room["_id"]).toBe(roomId);
  });
});
