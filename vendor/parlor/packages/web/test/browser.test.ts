import { describe, expect, it, vi } from "vitest";
import {
  GUEST_CREDENTIAL_STORAGE_KEY,
  GuestCredentialStore,
  HeartbeatController,
  WakeLockController,
  type Clock,
  type Scheduler,
  type StorageLike,
  type VisibilityDocument,
  type WakeLockSentinelLike,
} from "../src/index.js";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class FakeDocument implements VisibilityDocument {
  hidden = false;
  visibilityState: "visible" | "hidden" = "visible";
  private readonly listeners = new Set<() => void>();

  addEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners.delete(listener);
  }

  setVisibility(hidden: boolean): void {
    this.hidden = hidden;
    this.visibilityState = hidden ? "hidden" : "visible";
    for (const listener of this.listeners) {
      listener();
    }
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

class FakeScheduler implements Scheduler {
  private nextId = 1;
  private readonly timers = new Map<number, () => void>();
  readonly delays: number[] = [];

  setTimeout(callback: () => void, delayMs: number): number {
    const id = this.nextId;
    this.nextId += 1;
    this.delays.push(delayMs);
    this.timers.set(id, callback);
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  fireNext(): void {
    const first = this.timers.keys().next();
    if (first.done) {
      return;
    }
    const callback = this.timers.get(first.value);
    this.timers.delete(first.value);
    callback?.();
  }

  get pendingCount(): number {
    return this.timers.size;
  }
}

function mutableClock(initial: number): Clock & { value: number } {
  return {
    value: initial,
    now() {
      return this.value;
    },
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("GuestCredentialStore", () => {
  it("treats corrupt records as unavailable but retains expired proof for trusted recovery", async () => {
    const storage = new MemoryStorage();
    const clock = mutableClock(1_000);
    expect(new GuestCredentialStore({ storage, clock }).get()).toBeNull();

    storage.setItem(GUEST_CREDENTIAL_STORAGE_KEY, "not-json");
    expect(new GuestCredentialStore({ storage, clock }).get()).toBeNull();

    const proof = JSON.stringify({ token: "expired", expiresAt: 1_000 });
    storage.setItem(GUEST_CREDENTIAL_STORAGE_KEY, proof);
    const issuer = vi.fn(async () => ({ token: "renewed", expiresAt: 10_000 }));
    const store = new GuestCredentialStore({ storage, clock, issuer });
    expect(store.get()).toBeNull();
    expect(store.getRecord()).toBeNull();
    expect(store.getSnapshot()).toMatchObject({ credential: null, expiresAt: 1_000 });
    expect(storage.getItem(GUEST_CREDENTIAL_STORAGE_KEY)).toBe(proof);

    await expect(store.acquire()).resolves.toBe("renewed");
    expect(issuer).toHaveBeenCalledWith({ mode: "refresh", token: "expired" });
  });

  it("deduplicates concurrent acquisition and persists the opaque token", async () => {
    const storage = new MemoryStorage();
    const pending = deferred<{ token: string; expiresAt: number }>();
    const issuer = vi.fn(() => pending.promise);
    const store = new GuestCredentialStore({ storage, issuer });

    const first = store.acquire();
    const second = store.acquire();
    expect(first).toBe(second);
    await Promise.resolve();
    expect(issuer).toHaveBeenCalledTimes(1);

    pending.resolve({ token: "opaque-token", expiresAt: Date.now() + 60_000 });
    await expect(first).resolves.toBe("opaque-token");
    expect(store.get()).toBe("opaque-token");
  });

  it("cancels stale acquisition after clear and allows replacement acquisition", async () => {
    const storage = new MemoryStorage();
    const stale = deferred<{ token: string; expiresAt: number }>();
    const replacement = deferred<{ token: string; expiresAt: number }>();
    const issuer = vi
      .fn<() => Promise<{ token: string; expiresAt: number }>>()
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => replacement.promise);
    const store = new GuestCredentialStore({ storage, issuer });

    const staleAcquisition = store.acquire();
    await Promise.resolve();
    store.clear();
    expect(store.get()).toBeNull();
    const replacementAcquisition = store.acquire();
    await Promise.resolve();
    expect(issuer).toHaveBeenCalledTimes(2);

    replacement.resolve({ token: "fresh-token", expiresAt: Date.now() + 60_000 });
    await expect(replacementAcquisition).resolves.toBe("fresh-token");
    expect(store.get()).toBe("fresh-token");

    stale.resolve({ token: "stale-token", expiresAt: Date.now() + 60_000 });
    await expect(staleAcquisition).rejects.toMatchObject({ code: "cancelled" });
    expect(store.get()).toBe("fresh-token");
    expect(storage.getItem(GUEST_CREDENTIAL_STORAGE_KEY)).toContain("fresh-token");
  });

  it("cancels stale refresh after clear", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      GUEST_CREDENTIAL_STORAGE_KEY,
      JSON.stringify({ token: "old-token", expiresAt: Date.now() + 60_000 }),
    );
    const pending = deferred<{ token: string; expiresAt: number }>();
    const issuer = vi.fn(() => pending.promise);
    const store = new GuestCredentialStore({ storage, issuer });

    const staleRefresh = store.refresh();
    await Promise.resolve();
    store.clear();
    pending.resolve({ token: "stale-token", expiresAt: Date.now() + 60_000 });

    await expect(staleRefresh).rejects.toMatchObject({ code: "cancelled" });
    expect(store.get()).toBeNull();
    expect(storage.getItem(GUEST_CREDENTIAL_STORAGE_KEY)).toBeNull();
  });

  it("propagates issuer failure and allows a later retry", async () => {
    const issuer = vi
      .fn<() => Promise<{ token: string; expiresAt: number }>>()
      .mockRejectedValueOnce(new Error("issuer unavailable"))
      .mockResolvedValueOnce({ token: "retry-token", expiresAt: Date.now() + 60_000 });
    const store = new GuestCredentialStore({ storage: new MemoryStorage(), issuer });

    await expect(store.acquire()).rejects.toThrow("issuer unavailable");
    await expect(store.acquire()).resolves.toBe("retry-token");
    expect(issuer).toHaveBeenCalledTimes(2);
  });

  it("invalidates a stored token before the next acquisition", async () => {
    const storage = new MemoryStorage();
    const issuer = vi.fn().mockResolvedValue({
      token: "new-token",
      expiresAt: Date.now() + 60_000,
    });
    const store = new GuestCredentialStore({ storage, issuer });

    await store.acquire();
    store.clear();
    expect(store.get()).toBeNull();
    await store.acquire();
    expect(issuer).toHaveBeenCalledTimes(2);
  });

  it("keeps one identity without storage and refreshes expired in-memory proof", async () => {
    const clock = mutableClock(1_000);
    const issuer = vi
      .fn()
      .mockResolvedValueOnce({ token: "memory-only", expiresAt: 2_000 })
      .mockResolvedValueOnce({ token: "renewed-memory", expiresAt: 3_000 });
    const store = new GuestCredentialStore({ storage: null, clock, issuer });

    await expect(store.acquire()).resolves.toBe("memory-only");
    await expect(store.acquire()).resolves.toBe("memory-only");
    expect(issuer).toHaveBeenCalledTimes(1);
    clock.value = 2_000;
    expect(store.get()).toBeNull();
    await expect(store.acquire()).resolves.toBe("renewed-memory");
    expect(issuer).toHaveBeenLastCalledWith({ mode: "refresh", token: "memory-only" });
  });

  it("does not discard a valid identity when browser persistence fails", async () => {
    const unavailable = () => {
      throw new Error("storage blocked");
    };
    const issuer = vi.fn(async () => ({ token: "memory-only", expiresAt: 10_000 }));
    const store = new GuestCredentialStore({
      storage: { getItem: unavailable, setItem: unavailable, removeItem: unavailable },
      clock: () => 1_000,
      issuer,
    });
    await expect(store.acquire()).resolves.toBe("memory-only");
    await expect(store.acquire()).resolves.toBe("memory-only");
    expect(store.getSnapshot()).toMatchObject({
      credential: "memory-only",
      error: { code: "storage-failure" },
    });
    expect(issuer).toHaveBeenCalledTimes(1);
    store.clear();
    expect(store.get()).toBeNull();
  });

  it("publishes expiry while renewal is pending and does not revive cleared identity", async () => {
    const clock = mutableClock(1_000);
    const scheduler = new FakeScheduler();
    const renewal = deferred<{ token: string; expiresAt: number }>();
    const issuer = vi
      .fn()
      .mockResolvedValueOnce({ token: "first", expiresAt: 61_000 })
      .mockImplementationOnce(() => renewal.promise);
    const store = new GuestCredentialStore({ storage: null, clock, scheduler, issuer });
    const observed: Array<string | null> = [];
    store.subscribe(() => observed.push(store.getSnapshot().credential));
    store.start({ autoAcquire: true });
    await store.acquire();
    expect(store.get()).toBe("first");

    clock.value = 31_000;
    scheduler.fireNext();
    const pending = store.refresh();
    await Promise.resolve();
    expect(issuer).toHaveBeenLastCalledWith({ mode: "refresh", token: "first" });
    expect(store.getSnapshot().loading).toBe(true);
    clock.value = 61_000;
    scheduler.fireNext();
    expect(observed.at(-1)).toBeNull();
    expect(store.getSnapshot().expiresAt).toBe(61_000);

    store.clear();
    renewal.resolve({ token: "too-late", expiresAt: 120_000 });
    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
    expect(store.get()).toBeNull();
    scheduler.fireNext();
    expect(issuer).toHaveBeenCalledTimes(2);
    expect(scheduler.pendingCount).toBe(0);
    store.stop();
  });

  it("suspends failed automatic renewal without dropping proof or retrying on a timer", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      GUEST_CREDENTIAL_STORAGE_KEY,
      JSON.stringify({ token: "expired-proof", expiresAt: 1_000 }),
    );
    const scheduler = new FakeScheduler();
    const issuer = vi
      .fn()
      .mockRejectedValueOnce(new Error("session revoked"))
      .mockResolvedValueOnce({ token: "trusted-retry", expiresAt: 10_000 });
    const store = new GuestCredentialStore({ storage, issuer, scheduler, clock: () => 1_000 });
    store.start({ autoAcquire: true });
    await expect(store.acquire()).rejects.toThrow("session revoked");
    expect(store.get()).toBeNull();
    expect(scheduler.pendingCount).toBe(0);
    store.start({ autoAcquire: true });
    scheduler.fireNext();
    expect(issuer).toHaveBeenCalledTimes(1);
    await expect(store.refresh()).resolves.toBe("trusted-retry");
    expect(issuer).toHaveBeenLastCalledWith({ mode: "refresh", token: "expired-proof" });
    store.stop();
  });

  it("recovers failed pre-expiry renewal through acquire and resumes automatic renewal", async () => {
    const clock = mutableClock(1_000);
    const scheduler = new FakeScheduler();
    const issuer = vi
      .fn()
      .mockResolvedValueOnce({ token: "first", expiresAt: 61_000 })
      .mockRejectedValueOnce(new Error("issuer unavailable"))
      .mockResolvedValueOnce({ token: "recovered", expiresAt: 121_000 })
      .mockResolvedValueOnce({ token: "automatic-again", expiresAt: 181_000 });
    const store = new GuestCredentialStore({ storage: null, clock, scheduler, issuer });
    store.start({ autoAcquire: true });
    await store.acquire();

    clock.value = 31_000;
    scheduler.fireNext();
    await expect(store.refresh()).rejects.toThrow("issuer unavailable");
    expect(store.get()).toBe("first");
    await expect(store.acquire()).resolves.toBe("recovered");
    expect(store.getSnapshot().error).toBeNull();

    clock.value = 91_000;
    scheduler.fireNext();
    await expect(store.acquire()).resolves.toBe("automatic-again");
    store.stop();
  });

  it("bounds renewal frequency even when an issuer returns millisecond credentials", async () => {
    const scheduler = new FakeScheduler();
    const clock = mutableClock(1_000);
    const issuer = vi.fn(async () => ({ token: "short-lived", expiresAt: clock.value + 1 }));
    const store = new GuestCredentialStore({ storage: null, issuer, clock, scheduler });
    store.start({ autoAcquire: true });
    await store.acquire();

    clock.value = 1_001;
    scheduler.fireNext();
    expect(store.get()).toBeNull();
    expect(issuer).toHaveBeenCalledTimes(1);
    clock.value = 2_000;
    scheduler.fireNext();
    await store.refresh();
    expect(issuer).toHaveBeenCalledTimes(2);
    store.stop();
  });

  it("caps long expiry timers at the browser timeout limit", async () => {
    const scheduler = new FakeScheduler();
    const clock = mutableClock(1_000);
    const issuer = vi.fn(async () => ({ token: "long-lived", expiresAt: 10_000_000_000 }));
    const store = new GuestCredentialStore({ storage: null, issuer, clock, scheduler });
    store.start({ autoAcquire: true });
    await store.acquire();
    expect(scheduler.delays.at(-1)).toBe(2_147_483_647);
    clock.value += 2_147_483_647;
    scheduler.fireNext();
    expect(store.get()).toBe("long-lived");
    expect(issuer).toHaveBeenCalledTimes(1);
    expect(scheduler.delays.at(-1)).toBe(2_147_483_647);
    store.stop();
  });
});

describe("HeartbeatController", () => {
  it("beats immediately, pauses while hidden, and recovers when visible", async () => {
    const document = new FakeDocument();
    const scheduler = new FakeScheduler();
    const sender = vi.fn().mockResolvedValue(undefined);
    const controller = new HeartbeatController({
      send: sender,
      document,
      scheduler,
    });

    controller.start();
    controller.start();
    expect(sender).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(scheduler.delays).toEqual([15_000]);

    document.setVisibility(true);
    expect(controller.status).toBe("paused");
    expect(scheduler.pendingCount).toBe(0);
    scheduler.fireNext();
    expect(sender).toHaveBeenCalledTimes(1);

    document.setVisibility(false);
    expect(controller.status).toBe("running");
    expect(sender).toHaveBeenCalledTimes(2);
    await Promise.resolve();
  });

  it("exposes a failed send and clears degradation after recovery", async () => {
    const clock = mutableClock(2_000);
    const sender = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const controller = new HeartbeatController({
      send: sender,
      clock,
    });

    controller.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getSnapshot()).toMatchObject({
      status: "degraded",
      lastBeatAt: null,
      lastFailureAt: 2_000,
    });

    clock.value = 3_000;
    await controller.beat();
    expect(controller.getSnapshot()).toMatchObject({
      status: "running",
      lastBeatAt: 3_000,
      lastFailureAt: null,
    });
    controller.stop();
  });

  it("does not overlap sends and cleans up timers/listeners on stop", async () => {
    const document = new FakeDocument();
    const scheduler = new FakeScheduler();
    const first = deferred<void>();
    const sender = vi.fn(() => first.promise);
    const controller = new HeartbeatController({
      send: sender,
      document,
      scheduler,
    });

    controller.start();
    scheduler.fireNext();
    expect(sender).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().inFlight).toBe(true);

    first.resolve();
    await Promise.resolve();
    controller.stop();
    expect(controller.status).toBe("stopped");
    expect(document.listenerCount).toBe(0);
    expect(scheduler.pendingCount).toBe(0);

    document.setVisibility(false);
    scheduler.fireNext();
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers when a send becomes in flight and when it settles", async () => {
    const pending = deferred<void>();
    const controller = new HeartbeatController({
      send: () => pending.promise,
      scheduler: new FakeScheduler(),
      document: null,
    });
    const observed: boolean[] = [];
    controller.subscribe(() => observed.push(controller.getSnapshot().inFlight));
    controller.start();
    expect(observed.at(-1)).toBe(true);
    pending.resolve();
    await pending.promise;
    await Promise.resolve();
    expect(observed.at(-1)).toBe(false);
    controller.stop();
  });

  it("ignores the result of a send from a stopped lifecycle", async () => {
    const stale = deferred<void>();
    const current = deferred<void>();
    const sender = vi
      .fn()
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => current.promise);
    const controller = new HeartbeatController({
      send: sender,
      scheduler: new FakeScheduler(),
      document: null,
      clock: () => 2_000,
    });
    controller.start();
    controller.stop();
    controller.start();
    expect(sender).toHaveBeenCalledTimes(1);
    stale.reject(new Error("old send failed"));
    await Promise.resolve();
    await Promise.resolve();
    expect(sender).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({
      status: "running",
      lastBeatAt: null,
      lastFailureAt: null,
      inFlight: true,
    });
    current.resolve();
    await current.promise;
    await Promise.resolve();
    expect(controller.getSnapshot().lastBeatAt).toBe(2_000);
    controller.stop();
  });
});

describe("WakeLockController", () => {
  it("degrades to a typed unsupported status without throwing", async () => {
    const controller = new WakeLockController({
      navigator: {},
      document: new FakeDocument(),
    });

    await expect(controller.start()).resolves.toBeUndefined();
    expect(controller.status).toBe("unsupported");
    expect(controller.getSnapshot()).toEqual({ status: "unsupported" });
  });

  it("releases and reacquires a wake lock across visibility changes", async () => {
    const document = new FakeDocument();
    const sentinels: Array<WakeLockSentinelLike & { fireRelease(): void }> = [];
    const request = vi.fn(async () => {
      const listeners = new Set<() => void>();
      const sentinel = {
        released: false,
        addEventListener(_type: "release", listener: () => void) {
          listeners.add(listener);
        },
        removeEventListener(_type: "release", listener: () => void) {
          listeners.delete(listener);
        },
        async release() {
          this.released = true;
        },
        fireRelease() {
          this.released = true;
          for (const listener of listeners) {
            listener();
          }
        },
      } satisfies WakeLockSentinelLike & { fireRelease(): void };
      sentinels.push(sentinel);
      return sentinel;
    });
    const controller = new WakeLockController({
      navigator: { wakeLock: { request } },
      document,
    });
    const changes: string[] = [];
    controller.subscribe(() => changes.push(controller.status));

    await controller.start();
    await controller.start();
    expect(request).toHaveBeenCalledTimes(1);
    expect(controller.status).toBe("active");

    document.setVisibility(true);
    document.setVisibility(false);
    await controller.start();
    expect(sentinels[0]?.released).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(controller.status).toBe("active");
    expect(changes).toContain("paused");

    sentinels[1]?.fireRelease();
    expect(controller.status).toBe("released");
    await controller.stop();
    expect(controller.status).toBe("inactive");
  });
});
