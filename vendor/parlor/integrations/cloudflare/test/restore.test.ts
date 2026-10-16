import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "../src/ids.js";
import { FROZEN_MESSAGE } from "../src/store.js";
import { memorySqlDriver } from "../src/testing.js";
import { ADMIN_KEY, bookmarkAt, durableObject, pitrPlatform } from "./helpers.js";

afterEach(() => {
  vi.useRealTimers();
});

const UNAVAILABLE = { code: "Unavailable", message: "Restarting after a point-in-time restore" };

/**
 * A POST whose body ends only when `finish` is called, like a slow upload.
 * `reading` settles once the backend has begun reading the body, so the
 * request is past every check made on arrival (the restart check and the
 * admin key) and will reach the database lock only after `finish`.
 */
function slowPost(
  backend: { fetch(request: Request): Promise<Response> },
  path: string,
  body: unknown,
  withAdminKey = false,
) {
  let finish!: () => void;
  let started!: () => void;
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));
      finish = () => controller.close();
    },
    pull() {
      started();
    },
  });
  const response = backend.fetch(
    new Request(`https://backend.example.test/backend${path}`, {
      method: "POST",
      body: stream,
      duplex: "half",
      headers: withAdminKey ? { Authorization: `Bearer ${ADMIN_KEY}` } : {},
    } as RequestInit),
  );
  return { response, reading, finish };
}

describe("point-in-time restore", () => {
  it("stages a restore only while frozen, answers with the undo bookmark, then refuses everything until it restarts", async () => {
    const pitr = pitrPlatform();
    const { admin, call } = await durableObject({}, memorySqlDriver(), pitr);
    expect((await admin("freeze", { frozen: false })).status).toBe(200);
    const target = bookmarkAt(7);

    const live = await admin("restore", { bookmark: target });
    expect(live).toEqual({
      status: 409,
      body: { code: "Conflict", message: "Freeze writes before restoring a bookmark" },
    });
    expect(pitr.seen.staged).toEqual([]);

    expect((await admin("freeze", { frozen: true })).status).toBe(200);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const staged = await admin("restore", { bookmark: target });
    expect(staged.status).toBe(202);
    expect(staged.body).toEqual({ bookmark: target, undo: staged.body["undo"], restarting: true });
    expect(staged.body["undo"]).toMatch(/^[0-9a-f]{8}-/);
    expect(pitr.seen.staged).toEqual([target]);

    // Nothing is served by the instance whose storage is about to be replaced.
    expect(await admin("status")).toEqual({ status: 503, body: UNAVAILABLE });
    const query = await call("/api/query", {
      method: "POST",
      body: JSON.stringify({ path: "rooms:byCode", args: [{ code: "AAAA" }] }),
    });
    expect(query.status).toBe(503);
    expect((await admin("freeze", { frozen: false })).status).toBe(503);

    await vi.advanceTimersByTimeAsync(999);
    expect(pitr.seen.aborted).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(pitr.seen.aborted).toEqual(["parlor-cloudflare: point-in-time restore"]);
  });

  it("wakes at once on every start, because a restore brings back the stored alarm unscheduled", async () => {
    const driver = memorySqlDriver();
    const before = await durableObject({}, driver);
    expect((await before.admin("freeze", { frozen: false })).status).toBe(200);
    const due = before.alarm()!;
    expect(due).toBeGreaterThan(Date.now());

    // Deployed storage keeps the stored alarm time apart from the scheduled
    // alarm, and a setAlarm that repeats the stored time writes nothing, so it
    // schedules nothing. A restore brings back the stored time, unscheduled.
    let stored: number | null = due;
    let scheduled: number | null = null;
    const after = await durableObject({}, driver, {
      storage: {
        setAlarm: async (when: number) => {
          if (when !== stored) scheduled = stored = when;
        },
        deleteAlarm: async () => {
          if (stored !== null) scheduled = stored = null;
        },
      },
    });
    expect(scheduled).not.toBeNull();
    expect(scheduled!).toBeLessThan(due);
    await after.backend.alarm();
    expect(scheduled).toBe(due);
  });

  it("restores to a moment by resolving that moment's bookmark", async () => {
    const pitr = pitrPlatform();
    const { admin } = await durableObject({}, memorySqlDriver(), pitr);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const at = 1_792_000_000_000;
    const staged = await admin("restore", { at });
    expect(staged.status).toBe(202);
    expect(pitr.seen.times).toEqual([at]);
    expect(pitr.seen.staged).toEqual([bookmarkAt(at % 0x7fffffff)]);
    expect(staged.body["bookmark"]).toBe(bookmarkAt(at % 0x7fffffff));
  });

  it("reports the bookmark for now with the timestamp it follows, or for a given moment", async () => {
    const pitr = pitrPlatform();
    const { admin } = await durableObject({}, memorySqlDriver(), pitr);
    const status = await admin("status");
    const now = await admin("bookmark");
    expect(now).toEqual({
      status: 200,
      body: { ts: status.body["ts"], writesFrozen: true, bookmark: bookmarkAt(1) },
    });
    const then = await admin("bookmark?at=1792000000000");
    expect(then).toEqual({
      status: 200,
      body: { at: 1_792_000_000_000, bookmark: bookmarkAt(1_792_000_000_000 % 0x7fffffff) },
    });
    for (const at of ["", "yesterday", "-5", "1e12", "0", "99999999999999999"]) {
      expect((await admin(`bookmark?at=${at}`)).status).toBe(400);
    }
  });

  it("refuses a malformed target before staging anything", async () => {
    const pitr = pitrPlatform();
    const { admin } = await durableObject({}, memorySqlDriver(), pitr);
    const expected = {
      status: 400,
      body: {
        code: "BadRequest",
        message: "Expected { bookmark } or { at: <milliseconds since the epoch> }",
      },
    };
    for (const body of [
      {},
      { bookmark: bookmarkAt(1), at: 1_792_000_000_000 },
      { bookmark: "" },
      { bookmark: "not a bookmark" },
      { bookmark: 7 },
      { at: "1792000000000" },
      { at: -1 },
      { at: 1.5 },
      { bookmark: bookmarkAt(1), at: "later" },
    ]) {
      expect(await admin("restore", body)).toEqual(expected);
    }
    expect(pitr.seen).toEqual({ staged: [], aborted: [], times: [] });
    expect((await admin("status")).status).toBe(200);
  });

  it("answers 501 where the storage offers no point-in-time recovery", async () => {
    const { admin } = await durableObject();
    const unavailable = {
      status: 501,
      body: {
        code: "BadRequest",
        message: "Point-in-time recovery is not available on this storage",
      },
    };
    expect(await admin("bookmark")).toEqual(unavailable);
    expect(await admin("restore", { bookmark: bookmarkAt(1) })).toEqual(unavailable);
    expect((await admin("status")).status).toBe(200);
  });

  it("requires the admin key", async () => {
    const pitr = pitrPlatform();
    const { call } = await durableObject({}, memorySqlDriver(), pitr);
    for (const [path, init] of [
      ["/admin/bookmark", {}],
      ["/admin/restore", { method: "POST", body: JSON.stringify({ bookmark: bookmarkAt(1) }) }],
    ] as const) {
      expect((await call(path, init)).status).toBe(401);
    }
    expect(pitr.seen.staged).toEqual([]);
  });
});

/**
 * Staging a restore is terminal for requests that arrived before it, too:
 * they passed the restart check in `fetch` and wait on their body (or the
 * key check, or the lock) while the restore is staged.
 */
describe("R20: requests already admitted cannot outlive a staged restore", () => {
  it("keeps an earlier unfreeze from reopening writes, so an earlier mutation is refused", async () => {
    const pitr = pitrPlatform();
    const driver = memorySqlDriver();
    const { backend, admin } = await durableObject({}, driver, pitr);
    const unfreeze = slowPost(backend, "/admin/freeze", { frozen: false }, true);
    const freeze = slowPost(backend, "/admin/freeze", { frozen: true }, true);
    const write = slowPost(backend, "/api/mutation", {
      path: "rooms:create",
      args: [{ code: "LATE" }],
    });
    await Promise.all([unfreeze.reading, freeze.reading, write.reading]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    expect((await admin("restore", { bookmark: bookmarkAt(7) })).status).toBe(202);

    unfreeze.finish();
    freeze.finish();
    write.finish();
    for (const late of [unfreeze, freeze]) {
      const response = await late.response;
      expect({ status: response.status, body: await response.json() }).toEqual({
        status: 503,
        body: UNAVAILABLE,
      });
    }
    const mutation = await write.response;
    expect(mutation.status).toBe(560);
    expect(await mutation.json()).toMatchObject({
      status: "error",
      errorMessage: expect.stringContaining(FROZEN_MESSAGE),
    });

    // The store as the restarted object would find it if the restore did
    // nothing: still frozen, and without the refused room.
    const next = await durableObject({}, driver);
    expect((await next.admin("status")).body).toMatchObject({ writesFrozen: true });
    const room = await next.call("/api/query", {
      method: "POST",
      body: JSON.stringify({ path: "rooms:byCode", args: [{ code: "LATE" }] }),
    });
    expect(await room.json()).toMatchObject({ status: "success", value: null });
  });

  it("keeps the acknowledged target when an earlier restore reaches the lock later", async () => {
    const pitr = pitrPlatform();
    const { backend, admin } = await durableObject({}, memorySqlDriver(), pitr);
    const earlier = slowPost(backend, "/admin/restore", { bookmark: bookmarkAt(8) }, true);
    await earlier.reading;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const staged = await admin("restore", { bookmark: bookmarkAt(7) });
    expect(staged.status).toBe(202);
    expect(staged.body["bookmark"]).toBe(bookmarkAt(7));

    earlier.finish();
    const refused = await earlier.response;
    expect({ status: refused.status, body: await refused.json() }).toEqual({
      status: 503,
      body: UNAVAILABLE,
    });
    expect(pitr.seen.staged).toEqual([bookmarkAt(7)]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(pitr.seen.aborted).toEqual(["parlor-cloudflare: point-in-time restore"]);
  });

  it("refuses import steps that arrived before the restore", async () => {
    const pitr = pitrPlatform();
    const driver = memorySqlDriver();
    const { backend, admin } = await durableObject({}, driver, pitr);
    expect((await admin("import/begin", { tables: { rooms: 10001 } })).status).toBe(200);
    const room = { _id: newId(10001), _creationTime: 1, code: "LATE" };
    const steps = [
      slowPost(backend, "/admin/import/begin", { tables: { rooms: 10002 } }, true),
      slowPost(backend, "/admin/import/documents", { table: "rooms", documents: [room] }, true),
      slowPost(backend, "/admin/import/commit", { tables: {} }, true),
    ];
    await Promise.all(steps.map((step) => step.reading));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    expect((await admin("restore", { bookmark: bookmarkAt(7) })).status).toBe(202);

    for (const step of steps) step.finish();
    for (const step of steps) {
      const response = await step.response;
      expect({ status: response.status, body: await response.json() }).toEqual({
        status: 503,
        body: UNAVAILABLE,
      });
    }

    // Still the import begun before the restore: pending, same mapping, no rows.
    const next = await durableObject({}, driver);
    const status = (await next.admin("status")).body;
    expect(status).toMatchObject({ writesFrozen: true, importPending: true });
    expect(status["tables"]).toMatchObject({ rooms: 10001 });
    expect((await next.admin("export?table=rooms")).body["documents"]).toEqual([]);
  });
});
