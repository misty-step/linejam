import { afterEach, describe, expect, it, vi } from "vitest";
import { memorySqlDriver } from "../src/testing.js";
import { bookmarkAt, durableObject, pitrPlatform } from "./helpers.js";

afterEach(() => {
  vi.useRealTimers();
});

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
    const unavailable = {
      code: "Unavailable",
      message: "Restarting after a point-in-time restore",
    };
    expect(await admin("status")).toEqual({ status: 503, body: unavailable });
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
