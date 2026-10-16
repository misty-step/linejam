import type { JSONValue } from "convex/values";
import { AuthenticationError, TokenVerifier, type AuthConfig } from "./auth.js";
import { Runtime, type ConvexApp, type FunctionOutcome, type UserIdentity } from "./runtime.js";
import {
  beginImport,
  commitImport,
  exportPage,
  importDocuments,
  importPending,
  MaintenanceStateError,
  setWritesFrozen,
  tableStats,
  type ExpectedTable,
} from "./snapshot.js";
import type { SqlDriver, SqlRow, SqlValue } from "./store.js";
import { SyncSession, type ClientFrame } from "./sync.js";

/**
 * Cloudflare glue: one SQLite-backed Durable Object hosts the whole Convex
 * deployment (database, scheduler, crons, sync sessions), and a Worker
 * forwards a URL prefix to it. Only the platform surface used here is typed,
 * so the package needs no Cloudflare type dependency.
 */

interface SqlCursor {
  toArray(): SqlRow[];
}

export interface DurableObjectStorageLike {
  readonly sql: { exec(query: string, ...bindings: SqlValue[]): SqlCursor };
  transactionSync<T>(callback: () => T): T;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAlarm(): Promise<void>;
  /**
   * Point-in-time recovery over the last 30 days. Deployed SQLite-backed
   * objects have it; local workerd keeps no change log, so it fails there.
   */
  getCurrentBookmark?(): Promise<string>;
  getBookmarkForTime?(timestamp: number): Promise<string>;
  onNextSessionRestoreBookmark?(bookmark: string): Promise<string>;
}

export interface DurableObjectStateLike {
  readonly storage: DurableObjectStorageLike;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  /** Reset the object; the next request starts a fresh instance from storage. */
  abort?(reason?: string): void;
}

interface WebSocketLike {
  accept(): void;
  send(message: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "close" | "error", listener: () => void): void;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

export type BackendEnv = Readonly<Record<string, unknown>>;

export interface ConvexBackendOptions {
  readonly app: ConvexApp;
  /** The app's `convex/auth.config.ts` default export. */
  readonly auth?: AuthConfig | null;
  /** URL prefix the Worker forwards, for example `/backend`. */
  readonly basePath: string;
  /** Env binding with the admin key for snapshot import/export (unset disables admin routes). */
  readonly adminKeyBinding?: string;
  /** Replace uncaught error messages with "Server Error", as Convex production does. */
  readonly redactErrors?: (env: BackendEnv) => boolean;
  readonly deploymentName?: string;
}

const PING_INTERVAL_MS = 15_000;
const MAX_BODY_BYTES = 8 << 20;
/**
 * Discarding an unwanted request body is best effort and bounded: it stops,
 * cancelling the body, once this many bytes have arrived in all, when no
 * chunk arrives for DISCARD_IDLE_MS, or after DISCARD_TOTAL_MS.
 */
const MAX_DISCARD_BYTES = 4 * MAX_BODY_BYTES;
const DISCARD_IDLE_MS = 1_000;
const DISCARD_TOTAL_MS = 5_000;
const MAX_SOCKETS = 5000;
const STATUS_UDF_FAILED = 560;
const DO_NAME = "convex";
/** How long a restore waits, refusing every request, before restarting the object. */
const RESTART_DELAY_MS = 1_000;
const RESTARTING = "Restarting after a point-in-time restore";
/** Bookmarks are hex groups such as `0000007b-0000b26e-...`; the CLI checks the same shape. */
const BOOKMARK = /^[0-9A-Za-z]{1,64}(-[0-9A-Za-z]{1,64}){0,7}$/;
const PITR_UNAVAILABLE = "Point-in-time recovery is not available on this storage";

export function durableSqlDriver(storage: DurableObjectStorageLike): SqlDriver {
  return {
    exec: (query, ...bindings) => storage.sql.exec(query, ...bindings).toArray(),
    transaction: (callback) => storage.transactionSync(callback),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await readBounded(request, MAX_BODY_BYTES);
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new RequestError(400, "Request body must be a JSON object");
  }
}

/**
 * The body's bytes, counted as they arrive whatever Content-Length says. A
 * body over `limit` is refused with 413 without being buffered, after the
 * rest of it is discarded (within the discard bounds) so that the response
 * reaches the client.
 */
async function readBounded(request: Request, limit: number): Promise<Uint8Array> {
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await discardRest(reader, total);
      throw new RequestError(413, "Request body too large");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Discard a body nobody read: an early 401 or 404, or an HTTP action that
 * ignored it. workerd reliably delivers a response sent before the body is
 * consumed only once the body has been read; cancelling it is not enough.
 * A body another reader still holds is left alone.
 */
async function drainUnreadBody(request: Request): Promise<void> {
  const body = request.body;
  if (body === null || body.locked) return;
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    return;
  }
  await discardRest(reader, 0);
}

const TIMED_OUT = Symbol("timed out");

/** `promise`, or TIMED_OUT if it has not settled within `ms`. */
async function within<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read and drop the rest of a body of which `read` bytes have arrived, then
 * cancel it if it has not ended within the discard bounds. A body already
 * past MAX_DISCARD_BYTES is cancelled without reading again, and a client
 * that stalls holds its own response back for at most DISCARD_IDLE_MS
 * without sending, or DISCARD_TOTAL_MS in all.
 */
async function discardRest(reader: ReadableStreamDefaultReader<Uint8Array>, read: number) {
  let total = read;
  const deadline = Date.now() + DISCARD_TOTAL_MS;
  try {
    while (total <= MAX_DISCARD_BYTES) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const next = await within(reader.read(), Math.min(DISCARD_IDLE_MS, remaining));
      if (next === TIMED_OUT) break;
      if (next.done) return;
      total += next.value.byteLength;
    }
    // Not awaited: cancelling must not wait on the client either.
    reader.cancel().catch(() => undefined);
  } catch {
    // The client went away; nobody is left to answer.
  }
}

class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = "BadRequest",
  ) {
    super(message);
  }
}

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** Constant-time comparison of two secrets via their SHA-256 digests. */
async function secretsEqual(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

function httpOutcome(outcome: FunctionOutcome): Response {
  if (outcome.success) return json({ status: "success", value: outcome.value, logLines: [] });
  return json(
    outcome.data === undefined
      ? { status: "error", errorMessage: outcome.message, logLines: [] }
      : { status: "error", errorMessage: outcome.message, errorData: outcome.data, logLines: [] },
    STATUS_UDF_FAILED,
  );
}

export type ConvexBackendClass = new (
  state: DurableObjectStateLike,
  env: BackendEnv,
) => ConvexBackendObject;

/** Build the Durable Object class that hosts one Convex app. */
export function createConvexBackend(options: ConvexBackendOptions): ConvexBackendClass {
  return class extends ConvexBackendObject {
    constructor(state: DurableObjectStateLike, env: BackendEnv) {
      super(state, env, options);
    }
  };
}

/** The Durable Object hosting one Convex deployment; see `createConvexBackend`. */
export class ConvexBackendObject {
  private runtime!: Runtime;
  private verifier!: TokenVerifier;
  private readonly sessions = new Set<SyncSession>();
  private pinger: ReturnType<typeof setInterval> | null = null;
  /**
   * The alarm this instance set, or `undefined` before its first. Each start
   * wakes the object at once rather than trusting the stored alarm: a
   * point-in-time restore brings back the stored alarm time without
   * scheduling it, and storage ignores a setAlarm that repeats the stored
   * time. The wake re-arms from the database.
   */
  private armedAlarm: number | null | undefined = undefined;
  /**
   * Set under the database lock once a point-in-time restore is staged; the
   * object restarts shortly after. Writes were frozen when it was set, and
   * nothing changes data or maintenance state after it (see `maintenance`).
   */
  private restarting = false;
  private readonly basePath: string;

  constructor(
    private readonly state: DurableObjectStateLike,
    private readonly env: BackendEnv,
    private readonly options: ConvexBackendOptions,
  ) {
    this.basePath = options.basePath.replace(/\/+$/, "");
    void state.blockConcurrencyWhile(async () => {
      this.runtime = new Runtime(durableSqlDriver(state.storage), options.app, {
        redactErrors: options.redactErrors?.(env) ?? false,
        ...(options.deploymentName === undefined ? {} : { deploymentName: options.deploymentName }),
      });
      this.verifier = new TokenVerifier(options.auth ?? { providers: [] });
      // A brand-new deployment starts frozen, so a dormant backend never
      // accepts writes; an operator imports data or unfreezes it explicitly.
      if (this.runtime.store.meta("initialized_at") === null) {
        this.runtime.store.setMeta("initialized_at", String(Date.now()));
        this.runtime.store.setWritesFrozen(true);
      }
      this.runtime.syncCrons();
      this.runtime.onCommit(() => this.armAlarm());
      // Jobs a restart interrupted make the alarm due now; once writes are
      // unfrozen, the scheduler's upkeep marks them failed.
      await this.armAlarm();
    });
  }

  /** Keep exactly one alarm at the earliest due job or cron (none when frozen). */
  private async armAlarm() {
    const next = this.runtime.writesFrozen ? null : this.runtime.nextWakeTime();
    if (next === this.armedAlarm) return;
    const starting = this.armedAlarm === undefined;
    this.armedAlarm = next;
    if (next === null) await this.state.storage.deleteAlarm();
    else await this.state.storage.setAlarm(starting ? Date.now() : Math.max(next, Date.now()));
  }

  async alarm() {
    this.armedAlarm = null;
    if (this.restarting) return;
    try {
      await this.runtime.runDue();
    } catch (error) {
      console.error("parlor-cloudflare: scheduled work failed", error);
    }
    await this.armAlarm();
  }

  async fetch(request: Request): Promise<Response> {
    // A staged restore discards every write from here on, so accept none.
    // This turns away later requests; one already past this point is
    // stopped under the lock instead (`maintenance` and the freeze barrier).
    const response = this.restarting
      ? json({ code: "Unavailable", message: RESTARTING }, 503)
      : await this.route(request);
    await drainUnreadBody(request);
    return response;
  }

  private async route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const basePath = this.basePath;
    if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
      return new Response("Not found", { status: 404 });
    }
    const path = url.pathname.slice(basePath.length) || "/";
    try {
      if (/^\/api\/[^/]+\/sync$/.test(path)) return this.connect(request);
      if (
        request.method === "POST" &&
        (path === "/api/query" || path === "/api/mutation" || path === "/api/action")
      ) {
        return await this.callFunction(
          request,
          path.slice("/api/".length) as "query" | "mutation" | "action",
        );
      }
      if (path.startsWith("/http/") || path === "/http") {
        const routed = new URL(request.url);
        routed.pathname = path.slice("/http".length) || "/";
        const forwarded = new Request(routed.toString(), request);
        try {
          return await this.runtime.http(forwarded, routed.pathname);
        } finally {
          await drainUnreadBody(forwarded);
        }
      }
      if (path.startsWith("/admin/"))
        return await this.admin(request, path.slice("/admin/".length), url);
      return new Response("Not found", { status: 404 });
    } catch (error) {
      if (error instanceof RequestError)
        return json({ code: error.code, message: error.message }, error.status);
      console.error("parlor-cloudflare: request failed", error);
      return json({ code: "InternalServerError", message: "Internal server error" }, 500);
    }
  }

  private connect(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    if (this.sessions.size >= MAX_SOCKETS)
      return new Response("Too many connections", { status: 503 });
    const pair = new (
      globalThis as unknown as { WebSocketPair: new () => Record<0 | 1, WebSocketLike> }
    ).WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    const session = new SyncSession(this.runtime, this.verifier, server);
    this.sessions.add(session);
    const end = () => {
      session.close();
      this.sessions.delete(session);
      if (this.sessions.size === 0 && this.pinger !== null) {
        clearInterval(this.pinger);
        this.pinger = null;
      }
    };
    server.addEventListener("message", (event) => {
      session.receive(event.data as ClientFrame);
    });
    server.addEventListener("close", end);
    server.addEventListener("error", end);
    // The client drops connections that stay silent; keep them warm.
    this.pinger ??= setInterval(() => {
      for (const active of this.sessions) {
        active.ping();
        active.checkIdentityExpiry();
      }
    }, PING_INTERVAL_MS);
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  private async identity(request: Request): Promise<UserIdentity | null> {
    const header = request.headers.get("Authorization");
    if (header === null) return null;
    const [scheme, token] = header.split(" ", 2);
    if (scheme !== "Bearer" || token === undefined || token.length === 0) {
      throw new RequestError(401, "Unsupported authorization header");
    }
    try {
      return (await this.verifier.verify(token)).identity;
    } catch (error) {
      throw new RequestError(
        401,
        error instanceof AuthenticationError ? error.message : "Could not verify token",
      );
    }
  }

  private async callFunction(
    request: Request,
    kind: "query" | "mutation" | "action",
  ): Promise<Response> {
    const identity = await this.identity(request);
    const body = await readJson(request);
    const path = body["path"];
    const args = body["args"];
    if (typeof path !== "string" || (args !== undefined && !Array.isArray(args))) {
      throw new RequestError(400, "Expected { path, args: [object] }");
    }
    const first = ((args as JSONValue[] | undefined)?.[0] ?? {}) as JSONValue;
    if (kind === "query")
      return httpOutcome((await this.runtime.query(path, first, identity)).outcome);
    if (kind === "mutation")
      return httpOutcome((await this.runtime.mutation(path, first, identity)).outcome);
    return httpOutcome(await this.runtime.action(path, first, identity));
  }

  private async admin(request: Request, route: string, url: URL): Promise<Response> {
    const binding = this.options.adminKeyBinding;
    const expected = binding === undefined ? undefined : this.env[binding];
    const header = request.headers.get("Authorization") ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (
      typeof expected !== "string" ||
      expected.length < 32 ||
      !(await secretsEqual(provided, expected))
    ) {
      return json({ code: "Unauthorized", message: "Admin key required" }, 401);
    }
    try {
      return await this.adminRoute(request, route, url);
    } catch (error) {
      if (error instanceof MaintenanceStateError)
        return json({ code: "Conflict", message: error.message }, 409);
      if (error instanceof RequestError) throw error;
      // Operator input (snapshot tables, documents) that the store rejected.
      return json({ code: "BadRequest", message: errorMessage(error) }, 400);
    }
  }

  private async adminRoute(request: Request, route: string, url: URL): Promise<Response> {
    const runtime = this.runtime;
    if (request.method === "GET" && route === "status") {
      return json({
        ts: runtime.store.ts.toString(),
        writesFrozen: runtime.writesFrozen,
        importPending: importPending(runtime),
        runningActions: runtime.runningActions,
        tables: Object.fromEntries(runtime.store.tableNumbers()),
        sessions: this.sessions.size,
        nextWakeTime: runtime.nextWakeTime(),
      });
    }
    if (request.method === "GET" && route === "stats") {
      return json(
        await runtime.exclusive(async () => ({
          ts: runtime.store.ts.toString(),
          writesFrozen: runtime.writesFrozen,
          tables: await tableStats(runtime),
        })),
      );
    }
    if (request.method === "GET" && route === "export") {
      const table = url.searchParams.get("table") ?? "";
      const page = await runtime.exclusive(async () =>
        exportPage(
          runtime,
          table,
          url.searchParams.get("after"),
          Number(url.searchParams.get("limit") ?? "500"),
        ),
      );
      return json(page);
    }
    if (request.method === "GET" && route === "bookmark") return this.bookmark(url);
    if (request.method !== "POST")
      return json({ code: "NotFound", message: "Unknown admin route" }, 404);
    const body = await readJson(request);
    if (route === "restore") return this.restore(body);
    if (route === "freeze") {
      const frozen = body["frozen"];
      if (typeof frozen !== "boolean") throw new RequestError(400, "Expected { frozen: boolean }");
      // Under the lock, so the barrier lands between two transactions: every
      // write committed before it is in the store, and none is accepted after.
      const ts = await this.maintenance(async () => {
        setWritesFrozen(runtime, frozen);
        return runtime.store.ts.toString();
      });
      await this.armAlarm();
      return json({ writesFrozen: runtime.writesFrozen, ts });
    }
    if (route === "import/begin") {
      const tables = body["tables"];
      if (typeof tables !== "object" || tables === null || Array.isArray(tables))
        throw new RequestError(400, "Expected { tables: { name: number } }");
      await this.maintenance(() => beginImport(runtime, tables as Record<string, number>));
      return json({ tables: Object.fromEntries(runtime.store.tableNumbers()) });
    }
    if (route === "import/documents") {
      const table = body["table"];
      const documents = body["documents"];
      if (typeof table !== "string" || !Array.isArray(documents)) {
        throw new RequestError(400, "Expected { table, documents: [] }");
      }
      const imported = await this.maintenance(() =>
        importDocuments(runtime, table, documents as JSONValue[]),
      );
      return json({ imported });
    }
    if (route === "import/commit") {
      const tables = body["tables"];
      if (!isExpectedTables(tables)) {
        throw new RequestError(400, "Expected { tables: { name: { count, sha256 } } }");
      }
      const result = await this.maintenance(() => commitImport(runtime, tables));
      return json(
        { committed: result.mismatches.length === 0, ...result },
        result.mismatches.length === 0 ? 200 : 409,
      );
    }
    return json({ code: "NotFound", message: "Unknown admin route" }, 404);
  }

  /**
   * Run a maintenance operation (freeze, import, restore) under the
   * database lock, unless a restore is staged. A request can pass the
   * check in `fetch` and then wait for its key check, its body or the lock
   * while a restore is staged; checking again here, where the restore was
   * staged, keeps it from unfreezing writes, importing, or replacing the
   * restore's target. Everything else that writes is held off by the
   * freeze barrier, which only `freeze` can lift.
   */
  private maintenance<T>(work: () => Promise<T>): Promise<T> {
    return this.runtime.exclusive(async () => {
      if (this.restarting) throw new RequestError(503, RESTARTING, "Unavailable");
      return work();
    });
  }

  /**
   * `GET admin/bookmark`: the point-in-time-recovery bookmark for now, taken
   * under the database lock so it follows exactly the writes up to `ts`, or,
   * with `?at=<ms>`, the bookmark for that moment of the last 30 days.
   */
  private async bookmark(url: URL): Promise<Response> {
    const storage = this.state.storage;
    if (storage.getCurrentBookmark === undefined || storage.getBookmarkForTime === undefined)
      throw new RequestError(501, PITR_UNAVAILABLE);
    const at = url.searchParams.get("at");
    if (at !== null) {
      const time = Number(at);
      if (!/^\d{1,16}$/.test(at) || !Number.isSafeInteger(time) || time <= 0)
        throw new RequestError(400, "Expected ?at=<milliseconds since the epoch>");
      return json({ at: time, bookmark: await storage.getBookmarkForTime(time) });
    }
    const runtime = this.runtime;
    return json(
      await runtime.exclusive(async () => ({
        ts: runtime.store.ts.toString(),
        writesFrozen: runtime.writesFrozen,
        bookmark: await storage.getCurrentBookmark!(),
      })),
    );
  }

  /**
   * `POST admin/restore` with `{ bookmark }` or `{ at: <ms> }`: stage a
   * point-in-time restore of the whole object, data and maintenance state,
   * then restart it. Writes must already be frozen, so nothing is accepted
   * between the decision and the restart. The answer (202) carries the
   * target bookmark and the undo bookmark, which restores the object to just
   * before this restore; every later request then gets 503 until the object
   * restarts RESTART_DELAY_MS later and comes back exactly as at the target.
   * Staging is terminal: a freeze, import or restore request that arrived
   * before it but reaches the lock after it gets 503 too, so writes stay
   * frozen and the acknowledged target is the one the platform restores.
   */
  private async restore(body: Record<string, unknown>): Promise<Response> {
    const storage = this.state.storage;
    if (
      storage.onNextSessionRestoreBookmark === undefined ||
      storage.getBookmarkForTime === undefined ||
      this.state.abort === undefined
    )
      throw new RequestError(501, PITR_UNAVAILABLE);
    const { bookmark, at } = body;
    const byBookmark = bookmark !== undefined;
    if (
      byBookmark === (at !== undefined) ||
      (byBookmark
        ? typeof bookmark !== "string" || !BOOKMARK.test(bookmark)
        : typeof at !== "number" || !Number.isSafeInteger(at) || at <= 0)
    )
      throw new RequestError(
        400,
        "Expected { bookmark } or { at: <milliseconds since the epoch> }",
      );
    const runtime = this.runtime;
    const staged = await this.maintenance(async () => {
      if (!runtime.writesFrozen)
        throw new MaintenanceStateError("Freeze writes before restoring a bookmark");
      const target = byBookmark
        ? (bookmark as string)
        : await storage.getBookmarkForTime!(at as number);
      const undo = await storage.onNextSessionRestoreBookmark!(target);
      this.restarting = true;
      return { bookmark: target, undo };
    });
    setTimeout(
      () => this.state.abort?.("parlor-cloudflare: point-in-time restore"),
      RESTART_DELAY_MS,
    );
    return json({ ...staged, restarting: true }, 202);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isExpectedTables(value: unknown): value is Record<string, ExpectedTable> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((entry) => {
    const table = entry as Partial<Record<keyof ExpectedTable, unknown>> | null;
    return (
      typeof table === "object" &&
      table !== null &&
      Number.isSafeInteger(table.count) &&
      typeof table.sha256 === "string"
    );
  });
}

/**
 * Forward requests under `basePath` to the deployment's single Durable
 * Object; returns null for every other path so the Worker serves them.
 */
export function forwardToBackend(
  request: Request,
  namespace: DurableObjectNamespaceLike,
  basePath: string,
): Promise<Response> | null {
  const prefix = basePath.replace(/\/+$/, "");
  const { pathname } = new URL(request.url);
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;
  return namespace.get(namespace.idFromName(DO_NAME)).fetch(request);
}
