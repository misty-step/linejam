import {
  createGuestCredentialStore,
  createHeartbeatController,
  createWakeLockController,
  type Clock,
  type GuestCredential,
  type GuestCredentialIssuer,
  type GuestCredentialSnapshot,
  type GuestCredentialStoreOptions,
  type HeartbeatControllerOptions,
  type HeartbeatSnapshot,
  type WakeLockControllerOptions,
  type WakeLockSnapshot,
} from "@parlor/web";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

export interface UseHeartbeatOptions extends HeartbeatControllerOptions {
  /** Stop the controller when false; defaults to true. */
  enabled?: boolean;
}

export interface UseHeartbeatResult extends HeartbeatSnapshot {
  start: () => void;
  stop: () => void;
  beat: () => Promise<void>;
}

const STOPPED_HEARTBEAT: HeartbeatSnapshot = {
  status: "stopped",
  inFlight: false,
  lastBeatAt: null,
  lastFailureAt: null,
};

const heartbeatSnapshotCache = new WeakMap<object, HeartbeatSnapshot>();
const wakeLockSnapshotCache = new WeakMap<object, WakeLockSnapshot>();

function heartbeatExternalStore(controller: {
  getSnapshot: () => HeartbeatSnapshot;
  subscribe: (listener: () => void) => () => void;
}) {
  heartbeatSnapshotCache.set(controller, controller.getSnapshot());
  return {
    getSnapshot: () => heartbeatSnapshotCache.get(controller) ?? STOPPED_HEARTBEAT,
    subscribe: (listener: () => void) =>
      controller.subscribe(() => {
        heartbeatSnapshotCache.set(controller, controller.getSnapshot());
        listener();
      }),
  };
}

function wakeLockExternalStore(controller: {
  getSnapshot: () => WakeLockSnapshot;
  subscribe: (listener: () => void) => () => void;
}) {
  wakeLockSnapshotCache.set(controller, controller.getSnapshot());
  return {
    getSnapshot: () => wakeLockSnapshotCache.get(controller) ?? UNSUPPORTED_WAKE_LOCK,
    subscribe: (listener: () => void) =>
      controller.subscribe(() => {
        wakeLockSnapshotCache.set(controller, controller.getSnapshot());
        listener();
      }),
  };
}

/** Function clocks are behavior; object clocks remain an explicit ownership boundary. */
function useClock(clock: Clock | (() => number) | undefined) {
  const callback = typeof clock === "function" ? clock : undefined;
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  const now = useCallback(() => callbackRef.current?.() ?? Date.now(), []);
  return typeof clock === "function" ? now : clock;
}

/** Owns a visibility-aware heartbeat controller for the component lifetime. */
export function useHeartbeat(options: UseHeartbeatOptions): UseHeartbeatResult {
  const {
    enabled = true,
    send,
    document: visibilityDocument,
    scheduler,
    clock,
    intervalMs,
  } = options;
  const [initialSend] = useState(() => send);
  const stableClock = useClock(clock);
  const controller = useMemo(
    () =>
      createHeartbeatController({
        send: initialSend,
        ...(visibilityDocument === undefined ? {} : { document: visibilityDocument }),
        ...(scheduler === undefined ? {} : { scheduler }),
        ...(stableClock === undefined ? {} : { clock: stableClock }),
        ...(intervalMs === undefined ? {} : { intervalMs }),
      }),
    [stableClock, initialSend, intervalMs, scheduler, visibilityDocument],
  );
  const externalStore = useMemo(() => heartbeatExternalStore(controller), [controller]);
  const snapshot = useSyncExternalStore(
    externalStore.subscribe,
    externalStore.getSnapshot,
    () => STOPPED_HEARTBEAT,
  );

  useEffect(() => {
    controller.setSender(send);
  }, [controller, send]);

  useEffect(() => {
    if (enabled) {
      controller.start();
    }
    return () => {
      controller.stop();
    };
  }, [controller, enabled]);

  const start = useCallback(() => {
    controller.start();
  }, [controller]);

  const stop = useCallback(() => {
    controller.stop();
  }, [controller]);

  const beat = useCallback(() => controller.beat(), [controller]);

  return { ...snapshot, start, stop, beat };
}

export interface UseWakeLockOptions extends WakeLockControllerOptions {
  /** Acquire the screen lock while true; defaults to true. */
  enabled?: boolean;
}

export interface UseWakeLockResult extends WakeLockSnapshot {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const UNSUPPORTED_WAKE_LOCK: WakeLockSnapshot = { status: "unsupported" };

/** Owns progressive screen wake-lock acquisition and releases it on unmount. */
export function useWakeLock(options: UseWakeLockOptions = {}): UseWakeLockResult {
  const { enabled = true, navigator: navigatorValue, document: visibilityDocument } = options;
  const controller = useMemo(
    () =>
      createWakeLockController({
        ...(navigatorValue === undefined ? {} : { navigator: navigatorValue }),
        ...(visibilityDocument === undefined ? {} : { document: visibilityDocument }),
      }),
    [navigatorValue, visibilityDocument],
  );
  const externalStore = useMemo(() => wakeLockExternalStore(controller), [controller]);
  const snapshot = useSyncExternalStore(
    externalStore.subscribe,
    externalStore.getSnapshot,
    () => UNSUPPORTED_WAKE_LOCK,
  );

  useEffect(() => {
    if (enabled) {
      void controller.start();
    }
    return () => {
      void controller.stop();
    };
  }, [controller, enabled]);

  const start = useCallback(() => controller.start(), [controller]);
  const stop = useCallback(() => controller.stop(), [controller]);

  return { ...snapshot, start, stop };
}

export interface UseGuestCredentialOptions extends GuestCredentialStoreOptions {
  /** Acquire and renew through the trusted issuer; defaults to false. Failures require retry. */
  autoAcquire?: boolean;
}

export interface UseGuestCredentialResult extends GuestCredentialSnapshot {
  acquire: (issuerOverride?: GuestCredentialIssuer) => Promise<GuestCredential>;
  refresh: (issuerOverride?: GuestCredentialIssuer) => Promise<GuestCredential>;
  clear: () => void;
}

const EMPTY_GUEST_CREDENTIAL: GuestCredentialSnapshot = {
  credential: null,
  expiresAt: null,
  loading: false,
  error: null,
};

/** Own one instance at the application boundary, then share its result with game components. */
export function useGuestCredential(
  options: UseGuestCredentialOptions = {},
): UseGuestCredentialResult {
  const { autoAcquire = false, storage, key, issuer, clock, scheduler } = options;
  const stableClock = useClock(clock);
  const store = useMemo(
    () =>
      createGuestCredentialStore({
        ...(storage === undefined ? {} : { storage }),
        ...(key === undefined ? {} : { key }),
        ...(stableClock === undefined ? {} : { clock: stableClock }),
        ...(scheduler === undefined ? {} : { scheduler }),
      }),
    [stableClock, key, storage, scheduler],
  );
  const externalStore = useMemo(
    () => ({
      getSnapshot: () => store.getSnapshot(),
      subscribe: (listener: () => void) => store.subscribe(listener),
    }),
    [store],
  );
  const snapshot = useSyncExternalStore(
    externalStore.subscribe,
    externalStore.getSnapshot,
    () => EMPTY_GUEST_CREDENTIAL,
  );

  // Updating issuer behavior must not restart auto-acquisition or discard memory-only identity.
  useEffect(() => {
    store.setIssuer(issuer);
  }, [issuer, store]);
  useEffect(() => {
    store.start({ autoAcquire });
    return () => {
      store.stop();
    };
  }, [autoAcquire, store]);

  const acquire = useCallback(
    (issuerOverride?: GuestCredentialIssuer) => store.acquire(issuerOverride),
    [store],
  );
  const refresh = useCallback(
    (issuerOverride?: GuestCredentialIssuer) => store.refresh(issuerOverride),
    [store],
  );
  const clear = useCallback(() => {
    store.clear();
  }, [store]);

  return { ...snapshot, acquire, refresh, clear };
}
