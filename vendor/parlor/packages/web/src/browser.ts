export type MaybePromise<T> = T | PromiseLike<T>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Clock {
  now(): number;
}

export interface Scheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface VisibilityDocument {
  readonly hidden?: boolean;
  readonly visibilityState?: "visible" | "hidden";
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

/** Alias used by consumers that model the DOM document explicitly. */
export type DocumentLike = VisibilityDocument;

export type GuestCredential = string & {
  readonly __guestCredentialBrand: unique symbol;
};

export interface GuestCredentialRecord {
  readonly token: GuestCredential;
  readonly expiresAt: number;
}

/** Input supplied to an issuer. The token is omitted for an initial acquisition. */
export interface GuestCredentialIssueInput {
  readonly mode: "acquire" | "refresh";
  readonly token?: GuestCredential;
}

export interface GuestCredentialIssueResult {
  readonly token: string;
  readonly expiresAt: number;
}
export type GuestCredentialIssuer = (
  input?: GuestCredentialIssueInput,
) => Promise<GuestCredentialIssueResult>;

export type GuestCredentialStoreErrorCode =
  | "missing-issuer"
  | "invalid-issued-credential"
  | "storage-failure"
  | "cancelled";

export class GuestCredentialStoreError extends Error {
  readonly code: GuestCredentialStoreErrorCode;

  constructor(code: GuestCredentialStoreErrorCode, message: string) {
    super(message);
    this.name = "GuestCredentialStoreError";
    this.code = code;
  }
}

export interface GuestCredentialStoreOptions {
  readonly storage?: StorageLike | null;
  readonly key?: string;
  readonly issuer?: GuestCredentialIssuer;
  readonly clock?: Clock | (() => number);
  readonly scheduler?: Scheduler;
}

export interface GuestCredentialSnapshot {
  /** Only a non-expired credential may be used for authenticated requests. */
  readonly credential: GuestCredential | null;
  /** Expiry of the retained proof, including an expired proof awaiting trusted refresh. */
  readonly expiresAt: number | null;
  readonly loading: boolean;
  /** Issuance failures, or a storage failure while the credential remains in memory. */
  readonly error: unknown;
}

export const GUEST_CREDENTIAL_STORAGE_KEY = "parlor:guest-credential";

function asClock(clock: Clock | (() => number) | undefined): Clock {
  if (typeof clock === "function") {
    return { now: clock };
  }
  if (clock !== undefined) {
    return clock;
  }
  return {
    now: () => Date.now(),
  };
}

function runtimeValue(name: string): unknown {
  if (typeof globalThis === "undefined") {
    return undefined;
  }
  try {
    return (globalThis as unknown as Record<string, unknown>)[name];
  } catch {
    return undefined;
  }
}

export function defaultStorage(): StorageLike | null {
  return (runtimeValue("localStorage") as StorageLike | undefined) ?? null;
}

function defaultScheduler(): Scheduler {
  if (typeof globalThis === "undefined") {
    return {
      setTimeout: () => undefined,
      clearTimeout: () => undefined,
    };
  }
  const runtime = globalThis as unknown as {
    setTimeout?: (callback: () => void, delayMs: number) => unknown;
    clearTimeout?: (handle: unknown) => void;
  };
  return {
    setTimeout: runtime.setTimeout?.bind(runtime) ?? (() => undefined),
    clearTimeout: runtime.clearTimeout?.bind(runtime) ?? (() => undefined),
  };
}

function defaultDocument(): VisibilityDocument | null {
  return (runtimeValue("document") as VisibilityDocument | undefined) ?? null;
}

function defaultNavigator(): NavigatorLike | null {
  return (runtimeValue("navigator") as NavigatorLike | undefined) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCredential(value: unknown): value is GuestCredential {
  return typeof value === "string" && value.length > 0;
}

function isExpiry(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function toCredential(value: string): GuestCredential {
  return value as GuestCredential;
}

function parseRecord(value: unknown): GuestCredentialRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const token = value["token"];
  if (!isCredential(token) || !isExpiry(value["expiresAt"])) {
    return null;
  }
  return {
    token: toCredential(token),
    expiresAt: value["expiresAt"],
  };
}

function serializeRecord(record: GuestCredentialRecord): string {
  return JSON.stringify({
    token: record.token,
    expiresAt: record.expiresAt,
  });
}

function issuerResultRecord(result: GuestCredentialIssueResult): GuestCredentialRecord {
  if (isRecord(result) && isCredential(result["token"]) && isExpiry(result["expiresAt"])) {
    return {
      token: toCredential(result["token"]),
      expiresAt: result["expiresAt"],
    };
  }

  throw new GuestCredentialStoreError(
    "invalid-issued-credential",
    "The guest credential issuer returned an invalid credential.",
  );
}

function cancelledCredentialOperation(): GuestCredentialStoreError {
  return new GuestCredentialStoreError(
    "cancelled",
    "The guest credential operation was cancelled.",
  );
}

/**
 * Owns one in-memory guest identity, with optional best-effort persistence.
 * Tokens stay opaque: only the application's trusted issuer may renew identity.
 */
export class GuestCredentialStore {
  private readonly storage: StorageLike | null;
  private readonly key: string;
  private issuer: GuestCredentialIssuer | undefined;
  private readonly clock: Clock;
  private readonly scheduler: Scheduler;
  private readonly listeners = new Set<() => void>();
  private record: GuestCredentialRecord | null | undefined;
  private snapshot: GuestCredentialSnapshot | undefined;
  private storageError: GuestCredentialStoreError | null = null;
  private issueError: unknown = null;
  private generation = 0;
  private inFlight: Promise<GuestCredential> | undefined;
  private running = false;
  private autoAcquire = false;
  private automaticBlocked = false;
  private renewAt: number | null = null;
  private timerScheduled = false;
  private timerHandle: unknown;

  constructor(options: GuestCredentialStoreOptions = {}) {
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.key = options.key ?? GUEST_CREDENTIAL_STORAGE_KEY;
    this.issuer = options.issuer;
    this.clock = asClock(options.clock);
    this.scheduler = options.scheduler ?? defaultScheduler();
  }

  /** Replaces issuer behavior without replacing the owned identity or pending request. */
  setIssuer(issuer: GuestCredentialIssuer | undefined): void {
    this.issuer = issuer;
  }

  /** Returns only a non-expired record. Expired proof stays private for trusted refresh. */
  getRecord(): GuestCredentialRecord | null {
    const record = this.readRecord();
    return record !== null && record.expiresAt > this.clock.now() ? record : null;
  }

  /** Returns the opaque credential value, or null when absent/corrupt/expired. */
  get(): GuestCredential | null {
    return this.getRecord()?.token ?? null;
  }

  getSnapshot(): GuestCredentialSnapshot {
    const record = this.readRecord();
    const credential = record !== null && record.expiresAt > this.clock.now() ? record.token : null;
    const expiresAt = record?.expiresAt ?? null;
    const loading = this.inFlight !== undefined;
    const error = this.issueError ?? this.storageError;
    if (
      this.snapshot === undefined ||
      this.snapshot.credential !== credential ||
      this.snapshot.expiresAt !== expiresAt ||
      this.snapshot.loading !== loading ||
      this.snapshot.error !== error
    ) {
      this.snapshot = { credential, expiresAt, loading, error };
    }
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Starts expiry notifications and, optionally, acquisition and pre-expiry renewal.
   * A failed issuer call suspends automatic work until a successful explicit retry.
   */
  start(options: { autoAcquire?: boolean } = {}): void {
    this.running = true;
    this.autoAcquire = options.autoAcquire ?? false;
    if (this.renewAt === null && !this.automaticBlocked) {
      this.setRenewalTime();
    }
    this.advance();
  }

  /** Stops timers and ignores pending issuance without deleting retained identity proof. */
  stop(): void {
    this.running = false;
    this.cancelPending();
    this.emit();
  }

  /**
   * Erases identity and ignores pending issuance. Automatic acquisition stays suspended
   * until an explicit acquire/refresh succeeds, so clear cannot silently log back in.
   */
  clear(): void {
    this.cancelPending();
    this.record = null;
    this.issueError = null;
    this.automaticBlocked = true;
    this.renewAt = null;
    this.persist(null);
    this.emit();
  }

  /**
   * Returns a valid credential or performs one deduplicated issuance. An expired
   * record is always refreshed using its old proof, never replaced by a new identity.
   */
  acquire(issuerOverride?: GuestCredentialIssuer): Promise<GuestCredential> {
    if (this.inFlight !== undefined) {
      return this.inFlight;
    }
    const stored = this.getRecord();
    if (stored !== null && !this.automaticBlocked) {
      return Promise.resolve(stored.token);
    }
    return this.issue(this.readRecord() === null ? "acquire" : "refresh", issuerOverride);
  }

  /** Passes retained opaque proof, even when expired, to the application's trusted issuer. */
  refresh(issuerOverride?: GuestCredentialIssuer): Promise<GuestCredential> {
    return this.inFlight ?? this.issue("refresh", issuerOverride);
  }

  private readRecord(): GuestCredentialRecord | null {
    if (this.record !== undefined) {
      return this.record;
    }
    this.record = null;
    if (this.storage !== null) {
      try {
        const raw = this.storage.getItem(this.key);
        if (raw !== null) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
          this.record = parseRecord(parsed);
        }
      } catch (error) {
        this.storageError = this.persistenceFailure(error);
      }
    }
    return this.record;
  }

  private issue(
    mode: "acquire" | "refresh",
    issuerOverride?: GuestCredentialIssuer,
  ): Promise<GuestCredential> {
    const issuer = issuerOverride ?? this.issuer;
    const current = this.readRecord();
    const input: GuestCredentialIssueInput = {
      mode,
      ...(current === null ? {} : { token: current.token }),
    };
    const operationGeneration = this.generation;
    const ownsOperation = () =>
      operationGeneration === this.generation && this.inFlight === operation;
    this.issueError = null;
    // Install ownership before dispatch, including synchronous/reentrant issuers.
    const operation: Promise<GuestCredential> = Promise.resolve()
      .then(() => {
        if (!ownsOperation()) {
          throw cancelledCredentialOperation();
        }
        if (issuer === undefined) {
          throw new GuestCredentialStoreError(
            "missing-issuer",
            "A guest credential issuer is required to acquire a credential.",
          );
        }
        return issuer(input);
      })
      .then((result) => {
        if (!ownsOperation()) {
          throw cancelledCredentialOperation();
        }
        const record = issuerResultRecord(result);
        if (record.expiresAt <= this.clock.now()) {
          throw new GuestCredentialStoreError(
            "invalid-issued-credential",
            "The guest credential issuer returned an expired credential.",
          );
        }
        this.record = record;
        this.persist(record);
        if (!ownsOperation()) {
          throw cancelledCredentialOperation();
        }
        this.automaticBlocked = false;
        this.setRenewalTime();
        return record.token;
      })
      .catch((error: unknown) => {
        if (!ownsOperation()) {
          throw cancelledCredentialOperation();
        }
        this.issueError = error;
        this.automaticBlocked = true;
        throw error;
      });
    this.inFlight = operation;
    this.emit();
    this.schedule();
    const settled = () => {
      if (!ownsOperation()) {
        return;
      }
      this.inFlight = undefined;
      this.advance();
    };
    void operation.then(settled, settled);
    return operation;
  }

  private persistenceFailure(error: unknown): GuestCredentialStoreError {
    return new GuestCredentialStoreError(
      "storage-failure",
      error instanceof Error ? error.message : "Guest credential persistence is unavailable.",
    );
  }

  private persist(record: GuestCredentialRecord | null): void {
    this.storageError = null;
    if (this.storage === null) {
      return;
    }
    try {
      if (record === null) {
        this.storage.removeItem(this.key);
      } else {
        this.storage.setItem(this.key, serializeRecord(record));
      }
    } catch (error) {
      // Durability is optional; a browser storage failure must not discard identity.
      this.storageError = this.persistenceFailure(error);
    }
  }

  private cancelPending(): void {
    this.generation += 1;
    this.inFlight = undefined;
    this.clearTimer();
  }

  private setRenewalTime(): void {
    const record = this.readRecord();
    const now = this.clock.now();
    const remaining = record === null ? 0 : record.expiresAt - now;
    // Renew at most 30 seconds early and at most once per second for very short TTLs.
    this.renewAt =
      remaining <= 0 ? now : now + Math.max(1_000, remaining - Math.min(30_000, remaining / 2));
  }

  private advance(): void {
    this.emit();
    if (
      this.running &&
      this.autoAcquire &&
      !this.automaticBlocked &&
      this.inFlight === undefined &&
      this.renewAt !== null &&
      this.clock.now() >= this.renewAt
    ) {
      const operation = this.readRecord() === null ? this.acquire() : this.refresh();
      void operation.catch(() => {
        // The snapshot exposes the failure; only an explicit retry resumes renewal.
      });
      return;
    }
    this.schedule();
  }

  private schedule(): void {
    this.clearTimer();
    if (!this.running) {
      return;
    }
    const now = this.clock.now();
    const record = this.readRecord();
    let target = record !== null && record.expiresAt > now ? record.expiresAt : Infinity;
    if (this.autoAcquire && !this.automaticBlocked && this.inFlight === undefined) {
      target = Math.min(target, this.renewAt ?? Infinity);
    }
    if (!Number.isFinite(target)) {
      return;
    }
    this.timerScheduled = true;
    this.timerHandle = this.scheduler.setTimeout(
      () => {
        this.timerScheduled = false;
        this.timerHandle = undefined;
        this.advance();
      },
      Math.min(2_147_483_647, Math.max(1, Math.ceil(target - now))),
    );
  }

  private clearTimer(): void {
    if (this.timerScheduled) {
      this.scheduler.clearTimeout(this.timerHandle);
      this.timerScheduled = false;
      this.timerHandle = undefined;
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      notifySafely(listener);
    }
  }
}

export function createGuestCredentialStore(
  options: GuestCredentialStoreOptions = {},
): GuestCredentialStore {
  return new GuestCredentialStore(options);
}

export type HeartbeatSender = () => MaybePromise<void>;
export type HeartbeatStatus = "stopped" | "running" | "paused" | "degraded";

export interface HeartbeatSnapshot {
  readonly status: HeartbeatStatus;
  readonly inFlight: boolean;
  readonly lastBeatAt: number | null;
  readonly lastFailureAt: number | null;
}

export interface HeartbeatControllerOptions {
  readonly send: HeartbeatSender;
  readonly document?: VisibilityDocument | null;
  readonly scheduler?: Scheduler;
  readonly clock?: Clock | (() => number);
  readonly intervalMs?: number;
}

function notifySafely(listener: () => void): void {
  try {
    listener();
  } catch {
    // Observers must not break controller lifecycle work.
  }
}

/** Runs presence heartbeats only while visible, with one in-flight send at a time. */
export class HeartbeatController {
  private send: HeartbeatSender;
  private readonly document: VisibilityDocument | null;
  private readonly scheduler: Scheduler;
  private readonly clock: Clock;
  private readonly intervalMs: number;
  private readonly listeners = new Set<() => void>();
  private running = false;
  private visibilityAttached = false;
  private timerScheduled = false;
  private timerHandle: unknown;
  private inFlight: Promise<void> | undefined;
  private generation = 0;
  private pendingBeat = false;
  private lastBeatAt: number | null = null;
  private lastFailureAt: number | null = null;
  private statusValue: HeartbeatStatus = "stopped";
  private readonly onVisibilityChange = (): void => {
    if (!this.running) {
      return;
    }
    if (this.isHidden()) {
      this.clearScheduledTimer();
      this.setStatus("paused");
      return;
    }
    this.setStatus("running");
    void this.triggerBeat();
    this.scheduleNextBeat();
  };

  constructor(options: HeartbeatControllerOptions) {
    this.send = options.send;
    this.document = options.document === undefined ? defaultDocument() : options.document;
    this.scheduler = options.scheduler ?? defaultScheduler();
    this.clock = asClock(options.clock);
    const intervalMs = options.intervalMs ?? 15_000;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new RangeError("intervalMs must be a positive finite number.");
    }
    this.intervalMs = intervalMs;
  }

  /** Updates transport behavior without restarting presence or its in-flight send. */
  setSender(send: HeartbeatSender): void {
    this.send = send;
  }

  get status(): HeartbeatStatus {
    return this.statusValue;
  }

  getSnapshot(): HeartbeatSnapshot {
    return {
      status: this.statusValue,
      inFlight: this.inFlight !== undefined,
      lastBeatAt: this.lastBeatAt,
      lastFailureAt: this.lastFailureAt,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Starts the controller once; a repeated call does not add listeners or timers. */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.attachVisibilityListener();
    if (this.isHidden()) {
      this.setStatus("paused");
      return;
    }
    this.setStatus("running");
    void this.triggerBeat();
    this.scheduleNextBeat();
  }

  /** Stops future sends and removes every timer/listener owned by this controller. */
  stop(): void {
    if (!this.running && !this.visibilityAttached && !this.timerScheduled) {
      return;
    }
    this.running = false;
    this.generation += 1;
    this.pendingBeat = false;
    this.clearScheduledTimer();
    this.detachVisibilityListener();
    this.setStatus("stopped");
  }

  /** Requests an immediate beat; it is queued behind an in-flight send. */
  beat(): Promise<void> {
    return this.triggerBeat();
  }

  private isHidden(): boolean {
    return this.document?.hidden === true || this.document?.visibilityState === "hidden";
  }

  private attachVisibilityListener(): void {
    if (this.document === null || this.visibilityAttached) {
      return;
    }
    this.document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.visibilityAttached = true;
  }

  private detachVisibilityListener(): void {
    if (this.document === null || !this.visibilityAttached) {
      return;
    }
    this.document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.visibilityAttached = false;
  }

  private scheduleNextBeat(): void {
    if (!this.running || this.isHidden() || this.timerScheduled) {
      return;
    }
    this.timerScheduled = true;
    this.timerHandle = this.scheduler.setTimeout(() => {
      this.timerScheduled = false;
      this.timerHandle = undefined;
      if (!this.running || this.isHidden()) {
        return;
      }
      void this.triggerBeat();
      this.scheduleNextBeat();
    }, this.intervalMs);
  }
  private clearScheduledTimer(): void {
    if (!this.timerScheduled) {
      return;
    }
    this.scheduler.clearTimeout(this.timerHandle);
    this.timerScheduled = false;
    this.timerHandle = undefined;
  }

  private triggerBeat(): Promise<void> {
    if (!this.running || this.isHidden()) {
      return Promise.resolve();
    }
    if (this.inFlight !== undefined) {
      this.pendingBeat = true;
      return this.inFlight;
    }

    const operationGeneration = this.generation;
    let sendResult: MaybePromise<void>;
    try {
      sendResult = this.send();
    } catch (error) {
      sendResult = Promise.reject(error);
    }
    const operation = Promise.resolve(sendResult).then(
      () => {
        if (this.generation !== operationGeneration) {
          return;
        }
        this.lastBeatAt = this.clock.now();
        this.lastFailureAt = null;
        if (this.running && !this.isHidden()) {
          this.setStatus("running");
        }
      },
      () => {
        if (this.generation !== operationGeneration) {
          return;
        }
        this.lastFailureAt = this.clock.now();
        if (this.running && !this.isHidden()) {
          this.setStatus("degraded");
        }
      },
    );
    this.inFlight = operation;
    this.emit();
    void operation.then(() => {
      if (this.inFlight !== operation) {
        return;
      }
      this.inFlight = undefined;
      if (this.pendingBeat) {
        this.pendingBeat = false;
        if (this.running && !this.isHidden()) {
          void this.triggerBeat();
        }
      }
      this.emit();
    });
    return operation;
  }

  private setStatus(status: HeartbeatStatus): void {
    if (this.statusValue === status) {
      return;
    }
    this.statusValue = status;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      notifySafely(listener);
    }
  }
}

export function createHeartbeatController(
  options: HeartbeatControllerOptions,
): HeartbeatController {
  return new HeartbeatController(options);
}

export interface WakeLockSentinelLike {
  readonly released?: boolean;
  addEventListener?(type: "release", listener: () => void): void;
  removeEventListener?(type: "release", listener: () => void): void;
  release(): MaybePromise<void>;
}

export interface WakeLockLike {
  request(type: "screen"): MaybePromise<WakeLockSentinelLike>;
}

export interface NavigatorLike {
  readonly wakeLock?: WakeLockLike;
}

export type WakeLockStatus =
  | "inactive"
  | "acquiring"
  | "active"
  | "paused"
  | "released"
  | "unsupported"
  | "unavailable";

export type WakeLockFailureReason = "request-failed" | "release-failed";

export interface WakeLockSnapshot {
  readonly status: WakeLockStatus;
  readonly reason?: WakeLockFailureReason;
}

export interface WakeLockControllerOptions {
  readonly navigator?: NavigatorLike | null;
  readonly document?: VisibilityDocument | null;
}

/**
 * Progressively uses the Screen Wake Lock API. Unsupported and denied
 * environments are represented by status instead of exceptions.
 */
export class WakeLockController {
  private readonly navigator: NavigatorLike | null;
  private readonly document: VisibilityDocument | null;
  private readonly listeners = new Set<() => void>();
  private desired = false;
  private visibilityAttached = false;
  private sentinel: WakeLockSentinelLike | undefined;
  private requestInFlight: Promise<void> | undefined;
  private statusValue: WakeLockStatus;
  private reasonValue: WakeLockFailureReason | undefined;
  private wasHidden = false;
  private readonly onVisibilityChange = (): void => {
    if (!this.desired) {
      return;
    }
    if (this.isHidden()) {
      this.wasHidden = true;
      this.setStatus("paused");
      return;
    }
    if (this.wasHidden) {
      this.wasHidden = false;
      // A browser normally releases a screen lock as a document is hidden.
      // Release a still-live sentinel too, so the visible transition always
      // performs a fresh, observable acquisition.
      void this.reacquireAfterVisibility();
      return;
    }
    if (this.sentinel === undefined || this.sentinel.released === true) {
      void this.acquire();
    }
  };

  constructor(options: WakeLockControllerOptions = {}) {
    this.navigator = options.navigator ?? defaultNavigator();
    this.document = options.document ?? defaultDocument();
    this.statusValue = this.hasWakeLockCapability() ? "inactive" : "unsupported";
  }

  get status(): WakeLockStatus {
    return this.statusValue;
  }

  get reason(): WakeLockFailureReason | undefined {
    return this.reasonValue;
  }

  getSnapshot(): WakeLockSnapshot {
    if (this.reasonValue === undefined) {
      return { status: this.statusValue };
    }
    return { status: this.statusValue, reason: this.reasonValue };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Requests a lock once while visible. Repeated calls are idempotent. */
  start(): Promise<void> {
    this.desired = true;
    this.attachVisibilityListener();
    if (!this.hasWakeLockCapability()) {
      this.setStatus("unsupported");
      return Promise.resolve();
    }
    if (this.isHidden()) {
      this.wasHidden = true;
      this.setStatus("paused");
      return Promise.resolve();
    }
    return this.acquire();
  }

  /** Releases the current lock and disables future reacquisition. */
  stop(): Promise<void> {
    this.desired = false;
    this.wasHidden = false;
    this.detachVisibilityListener();
    const pending = this.requestInFlight;
    const sentinel = this.sentinel;
    this.sentinel = undefined;
    if (sentinel !== undefined) {
      this.detachSentinelListener(sentinel);
    }
    this.setStatus(this.statusValue === "unsupported" ? "unsupported" : "inactive");

    const release = sentinel === undefined ? Promise.resolve() : this.releaseSentinel(sentinel);
    if (pending === undefined) {
      return release;
    }
    return Promise.allSettled([pending, release]).then(() => undefined);
  }

  private hasWakeLockCapability(): boolean {
    return typeof this.navigator?.wakeLock?.request === "function";
  }

  private isHidden(): boolean {
    return this.document?.hidden === true || this.document?.visibilityState === "hidden";
  }

  private attachVisibilityListener(): void {
    if (this.document === null || this.visibilityAttached) {
      return;
    }
    this.document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.visibilityAttached = true;
  }

  private detachVisibilityListener(): void {
    if (this.document === null || !this.visibilityAttached) {
      return;
    }
    this.document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.visibilityAttached = false;
  }

  private acquire(): Promise<void> {
    if (!this.desired || this.isHidden() || !this.hasWakeLockCapability()) {
      if (!this.hasWakeLockCapability()) {
        this.setStatus("unsupported");
      }
      return Promise.resolve();
    }
    if (this.requestInFlight !== undefined) {
      return this.requestInFlight;
    }
    if (this.sentinel !== undefined && this.sentinel.released !== true) {
      this.setStatus("active");
      return Promise.resolve();
    }

    const wakeLock = this.navigator?.wakeLock;
    if (wakeLock === undefined) {
      this.setStatus("unsupported");
      return Promise.resolve();
    }
    this.reasonValue = undefined;
    this.setStatus("acquiring");
    let requestResult: MaybePromise<WakeLockSentinelLike>;
    try {
      requestResult = wakeLock.request("screen");
    } catch {
      this.setUnavailable("request-failed");
      return Promise.resolve();
    }

    const operation = Promise.resolve(requestResult).then(
      (sentinel) => {
        if (!this.desired) {
          return this.releaseSentinel(sentinel);
        }
        this.sentinel = sentinel;
        this.attachSentinelListener(sentinel);
        if (this.isHidden()) {
          this.wasHidden = true;
          this.setStatus("paused");
        } else {
          this.reasonValue = undefined;
          this.setStatus("active");
        }
        return undefined;
      },
      () => {
        this.setUnavailable("request-failed");
      },
    );
    this.requestInFlight = operation;
    void operation.then(() => {
      if (this.requestInFlight === operation) {
        this.requestInFlight = undefined;
      }
    });
    return operation;
  }

  private async reacquireAfterVisibility(): Promise<void> {
    const sentinel = this.sentinel;
    if (sentinel !== undefined && sentinel.released !== true) {
      this.sentinel = undefined;
      this.detachSentinelListener(sentinel);
      await this.releaseSentinel(sentinel);
    } else {
      this.sentinel = undefined;
    }
    if (this.desired && !this.isHidden()) {
      await this.acquire();
    }
  }

  private attachSentinelListener(sentinel: WakeLockSentinelLike): void {
    sentinel.addEventListener?.("release", this.onSentinelRelease);
  }

  private detachSentinelListener(sentinel: WakeLockSentinelLike): void {
    sentinel.removeEventListener?.("release", this.onSentinelRelease);
  }

  private readonly onSentinelRelease = (): void => {
    const sentinel = this.sentinel;
    if (sentinel !== undefined) {
      this.detachSentinelListener(sentinel);
    }
    this.sentinel = undefined;
    if (!this.desired) {
      this.setStatus(this.statusValue === "unsupported" ? "unsupported" : "inactive");
    } else if (this.isHidden()) {
      this.wasHidden = true;
      this.setStatus("paused");
    } else {
      this.setStatus("released");
    }
  };

  private releaseSentinel(sentinel: WakeLockSentinelLike): Promise<void> {
    let result: MaybePromise<void>;
    try {
      result = sentinel.release();
    } catch {
      this.setUnavailable("release-failed");
      return Promise.resolve();
    }
    return Promise.resolve(result).then(
      () => undefined,
      () => {
        this.setUnavailable("release-failed");
      },
    );
  }

  private setUnavailable(reason: WakeLockFailureReason): void {
    this.reasonValue = reason;
    this.setStatus("unavailable");
  }
  private setStatus(status: WakeLockStatus): void {
    if (status !== "unavailable") {
      this.reasonValue = undefined;
    }
    if (this.statusValue === status && status !== "unavailable") {
      return;
    }
    this.statusValue = status;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      notifySafely(listener);
    }
  }
}

export function createWakeLockController(
  options: WakeLockControllerOptions = {},
): WakeLockController {
  return new WakeLockController(options);
}
