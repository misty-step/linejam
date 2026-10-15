import { AsyncLocalStorage } from "node:async_hooks";
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import { decodeId } from "./ids.js";
import { paginate, plan, QueryStream, type SerializedQuery } from "./query.js";
import {
  schemaModel,
  SCHEDULED_FUNCTIONS_TABLE,
  type ConvexSchemaDefinition,
  type SchemaModel,
} from "./schema.js";
import { encodeKey, prefixEnd } from "./keys.js";
import {
  FROZEN_MESSAGE,
  FrozenError,
  Store,
  Transaction,
  type CommitResult,
  type Document,
  type ReadSet,
  type SqlDriver,
} from "./store.js";
import {
  printValidator,
  validateValue,
  ValidationError,
  type ValidatorJson,
} from "./validators.js";

export type FunctionKind = "query" | "mutation" | "action";
export type Visibility = "public" | "internal";
export type UserIdentity = Readonly<Record<string, JSONValue>> & {
  readonly tokenIdentifier: string;
  readonly subject: string;
  readonly issuer: string;
};

/** A registered Convex function object (from `queryGeneric` and friends). */
interface RegisteredFunction {
  readonly isQuery?: boolean;
  readonly isMutation?: boolean;
  readonly isAction?: boolean;
  readonly isPublic?: boolean;
  readonly isInternal?: boolean;
  invokeQuery?(argsJson: string): Promise<string>;
  invokeMutation?(argsJson: string): Promise<string>;
  invokeAction?(requestId: string, argsJson: string): Promise<string>;
  exportArgs(): string;
  exportReturns(): string;
}

/** A routed `httpAction`; `invokeHttpAction` is Convex-internal, so it is untyped in `HttpRouter`. */
interface HttpEndpoint {
  invokeHttpAction(request: Request): Promise<Response>;
}

/** The subset of a Convex `HttpRouter` this runtime uses. */
export interface ConvexHttpRouter {
  readonly isRouter: true;
  lookup(path: string, method: HttpMethod): readonly [object, string, string] | null;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS" | "PATCH";
const HTTP_METHODS = new Set<string>(["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]);

/** The subset of a Convex `Crons` object this runtime uses. */
export interface ConvexCrons {
  readonly crons: Readonly<
    Record<
      string,
      {
        readonly name: string;
        /** `[args]`, as `cronJobs()` records it. */
        readonly args: JSONValue;
        readonly schedule: CronSchedule;
      }
    >
  >;
}

export type CronSchedule =
  | {
      readonly type: "interval";
      readonly seconds?: number;
      readonly minutes?: number;
      readonly hours?: number;
    }
  | { readonly type: "hourly"; readonly minuteUTC?: number }
  | { readonly type: "daily"; readonly hourUTC: number; readonly minuteUTC?: number }
  | {
      readonly type: "weekly";
      readonly dayOfWeek: number | string;
      readonly hourUTC: number;
      readonly minuteUTC?: number;
    }
  | {
      readonly type: "monthly";
      readonly day: number;
      readonly hourUTC: number;
      readonly minuteUTC?: number;
    }
  | { readonly type: "cron"; readonly cron: string };

export type ConvexModule = Readonly<Record<string, unknown>>;

/**
 * A module namespace, or a loader evaluated on first use. Loaders keep a
 * module that throws at import (for example on missing configuration) from
 * taking down unrelated functions, as on Convex.
 */
export type ModuleSource = ConvexModule | (() => Promise<ConvexModule>);

/** Everything a Convex app contributes: its schema and function modules. */
export interface ConvexApp {
  readonly schema: ConvexSchemaDefinition | null;
  /** Module path without extension (for example `rooms` or `lib/room`) to module namespace. */
  readonly modules: Readonly<Record<string, ModuleSource>>;
  readonly crons?: ConvexCrons | null;
  readonly http?: ConvexHttpRouter | (() => Promise<ConvexHttpRouter | null>) | null;
}

export interface FunctionError {
  readonly message: string;
  readonly data?: JSONValue;
}

export type FunctionOutcome =
  | { readonly success: true; readonly value: JSONValue }
  | ({ readonly success: false; readonly cause?: unknown } & FunctionError);

export interface RuntimeOptions {
  /** Replace uncaught error messages with an opaque "Server Error" (production). */
  readonly redactErrors?: boolean;
  /** Deployment name reported by `ctx.meta.getDeploymentMetadata()`. */
  readonly deploymentName?: string;
}

export type CommitListener = (commit: CommitResult) => Promise<void> | void;

export interface MutationOptions {
  readonly visibility?: Visibility;
  readonly receipt?: { readonly sessionId: string; readonly requestId: number };
  /**
   * Bookkeeping that commits atomically with the mutation (scheduler
   * state). Returning false skips the mutation without running it.
   */
  readonly before?: (transaction: Transaction) => boolean;
}

interface QueryState {
  readonly stream: QueryStream;
}

interface Execution {
  readonly runtime: Runtime;
  readonly kind: FunctionKind | "http";
  readonly udfPath: string;
  readonly transaction: Transaction | null;
  readonly identity: UserIdentity | null;
  readonly requestId: string;
  readonly queries: Map<number, QueryState>;
  /** Pins a subscribed paginated query's page end across re-executions. */
  readonly journal: Journal | null;
  nextQueryId: number;
  paginatedQueries: number;
}

interface Journal {
  readonly input: string | null;
  output: string | null;
}

const JOURNAL_VERSION = 1;

function journalEndCursor(journal: string | null): string | null {
  if (journal === null) return null;
  try {
    const parsed = JSON.parse(journal) as { v?: unknown; endCursor?: unknown };
    return parsed.v === JOURNAL_VERSION && typeof parsed.endCursor === "string"
      ? parsed.endCursor
      : null;
  } catch {
    return null;
  }
}

const executions = new AsyncLocalStorage<Execution>();
/** Mutation receipts and finished scheduler records are kept for a week. */
const RETAIN_FINISHED_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Scheduled actions that may run at once. They run outside the scheduler
 * pass; a due action finding every slot busy stays pending until one ends.
 */
const MAX_SCHEDULED_ACTIONS = 16;
/** What every refused admission returns while writes are frozen. */
const FROZEN_OUTCOME: FunctionOutcome = {
  success: false,
  message: `Uncaught Error: ${FROZEN_MESSAGE}`,
};

interface ConvexGlobal {
  syscall(op: string, args: string): string;
  asyncSyscall(op: string, args: string): Promise<string>;
  jsSyscall(op: string, args: Record<string, unknown>): unknown;
}

function installConvexGlobal() {
  const holder = globalThis as unknown as { Convex?: ConvexGlobal & { parlorCloudflare?: true } };
  if (holder.Convex?.parlorCloudflare === true) return;
  const previous = holder.Convex;
  const current = () => executions.getStore();
  holder.Convex = {
    parlorCloudflare: true,
    syscall(op, args) {
      const execution = current();
      if (execution !== undefined) return execution.runtime.syscall(execution, op, args);
      if (previous !== undefined) return previous.syscall(op, args);
      throw new Error("Convex syscall outside of a function execution");
    },
    async asyncSyscall(op, args) {
      const execution = current();
      if (execution !== undefined) return execution.runtime.asyncSyscall(execution, op, args);
      if (previous !== undefined) return previous.asyncSyscall(op, args);
      throw new Error("Convex syscall outside of a function execution");
    },
    jsSyscall(op, args) {
      if (current() === undefined && previous !== undefined) return previous.jsSyscall(op, args);
      throw new Error(`Unsupported Convex JS syscall ${op}`);
    },
  };
}

/** Serializes all database transactions; actions run outside it. */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work, work);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

export function canonicalizeUdfPath(udfPath: string): string {
  const separator = udfPath.lastIndexOf(":");
  let modulePath = separator === -1 ? udfPath : udfPath.slice(0, separator);
  const exportName = separator === -1 ? "default" : udfPath.slice(separator + 1);
  if (modulePath.endsWith(".js")) modulePath = modulePath.slice(0, -3);
  return `${modulePath}:${exportName}`;
}

function errorFromThrown(thrown: unknown): FunctionError & { readonly convex: boolean } {
  if (typeof thrown === "object" && thrown !== null && Symbol.for("ConvexError") in thrown) {
    const error = thrown as { message: string; data?: unknown };
    let data: JSONValue = null;
    if (typeof error.data === "string") {
      try {
        data = JSON.parse(error.data) as JSONValue;
      } catch {
        data = error.data;
      }
    } else if (error.data !== undefined) {
      data = convexToJson(error.data as Value);
    }
    return { message: error.message, data, convex: true };
  }
  if (thrown instanceof Error) return { message: thrown.message, convex: false };
  return { message: String(thrown), convex: false };
}

function syscallError(message: string, data?: JSONValue): Error & { data?: JSONValue } {
  const error = new Error(message) as Error & { data?: JSONValue };
  if (data !== undefined) error.data = data;
  return error;
}

function newRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class Runtime {
  readonly store: Store;
  readonly schema: SchemaModel;
  private readonly mutex = new Mutex();
  /** Serializes scheduler passes, which release the database lock between jobs. */
  private readonly schedulerPass = new Mutex();
  private readonly loadedModules = new Map<string, ConvexModule>();
  private router: ConvexHttpRouter | null | undefined = undefined;
  private readonly listeners = new Set<CommitListener>();
  /** Scheduled jobs this instance is executing; any other `inProgress` job was interrupted. */
  private readonly runningJobs = new Set<string>();
  /** Due scheduled actions left pending because every action slot was busy. */
  private readonly waitingForSlot = new Set<string>();
  /** Crons whose action is still running; Convex runs one run of a cron at a time. */
  private readonly runningCrons = new Set<string>();
  private actionsRunning = 0;

  constructor(
    driver: SqlDriver,
    readonly app: ConvexApp,
    readonly options: RuntimeOptions = {},
  ) {
    installConvexGlobal();
    this.schema = schemaModel(app.schema);
    this.store = new Store(driver, this.schema);
  }

  onCommit(listener: CommitListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Run `work` while holding the database lock (no other transaction runs). */
  exclusive<T>(work: () => Promise<T>): Promise<T> {
    return this.mutex.run(work);
  }

  /**
   * While frozen, the backend admits no mutation, action, HTTP action,
   * scheduled function or cron, and commits no write but a snapshot import;
   * queries and subscriptions keep working.
   */
  get writesFrozen(): boolean {
    return this.store.writesFrozen;
  }

  /** Actions and HTTP actions executing now. Frozen, they can no longer write. */
  get runningActions(): number {
    return this.actionsRunning;
  }

  private async loadModule(path: string): Promise<ConvexModule | undefined> {
    const cached = this.loadedModules.get(path);
    if (cached !== undefined) return cached;
    if (!Object.hasOwn(this.app.modules, path)) return undefined;
    const source = this.app.modules[path];
    if (source === undefined) return undefined;
    const module = typeof source === "function" ? await source() : source;
    this.loadedModules.set(path, module);
    return module;
  }

  /** The registered function at `udfPath`, or null when there is none. */
  async resolve(
    udfPath: string,
  ): Promise<{ fn: RegisteredFunction; kind: FunctionKind; visibility: Visibility } | null> {
    const canonical = canonicalizeUdfPath(udfPath);
    const separator = canonical.lastIndexOf(":");
    const module = await this.loadModule(canonical.slice(0, separator));
    const exportName = canonical.slice(separator + 1);
    const exported: unknown =
      module !== undefined && Object.hasOwn(module, exportName) ? module[exportName] : undefined;
    if (typeof exported !== "function") return null;
    const candidate = exported as unknown as RegisteredFunction;
    const kind: FunctionKind | null = candidate.isQuery
      ? "query"
      : candidate.isMutation
        ? "mutation"
        : candidate.isAction
          ? "action"
          : null;
    if (kind === null) return null;
    return { fn: candidate, kind, visibility: candidate.isPublic === true ? "public" : "internal" };
  }

  private async lookup(
    udfPath: string,
    kind: FunctionKind,
    visibility: Visibility,
  ): Promise<RegisteredFunction> {
    const resolved = await this.resolve(udfPath);
    if (
      resolved === null ||
      resolved.kind !== kind ||
      (visibility === "public" && resolved.visibility !== "public")
    ) {
      const label = visibility === "public" ? "public " : "";
      throw syscallError(
        `Could not find ${label}function for '${canonicalizeUdfPath(udfPath)}'. Did you forget to run \`npx convex dev\` or \`npx convex deploy\`?`,
      );
    }
    return resolved.fn;
  }

  private validateArgs(fn: RegisteredFunction, args: JSONValue) {
    const validator = JSON.parse(fn.exportArgs()) as ValidatorJson;
    try {
      validateValue(validator, jsonToConvex(args), (number) => this.store.tableName(number));
    } catch (error) {
      if (error instanceof ValidationError)
        throw new Error(`ArgumentValidationError: ${error.message}`, { cause: error });
      throw error;
    }
  }

  private validateReturns(fn: RegisteredFunction, value: JSONValue) {
    const validator = JSON.parse(fn.exportReturns()) as ValidatorJson | null;
    if (validator === null) return;
    try {
      validateValue(validator, jsonToConvex(value), (number) => this.store.tableName(number));
    } catch (error) {
      if (error instanceof ValidationError)
        throw new Error(`ReturnsValidationError: ${error.message}`, { cause: error });
      throw error;
    }
  }

  private async invoke(
    kind: FunctionKind,
    udfPath: string,
    fn: RegisteredFunction,
    args: JSONValue,
    transaction: Transaction | null,
    identity: UserIdentity | null,
    journal: Journal | null = null,
  ): Promise<JSONValue> {
    this.validateArgs(fn, args);
    const execution: Execution = {
      runtime: this,
      kind,
      udfPath: canonicalizeUdfPath(udfPath),
      transaction,
      identity,
      requestId: newRequestId(),
      queries: new Map(),
      journal,
      nextQueryId: 1,
      paginatedQueries: 0,
    };
    const argsJson = JSON.stringify([args]);
    const resultJson = await executions.run(execution, async () => {
      try {
        if (kind === "query" && fn.invokeQuery) return await fn.invokeQuery(argsJson);
        if (kind === "mutation" && fn.invokeMutation) return await fn.invokeMutation(argsJson);
        if (kind === "action" && fn.invokeAction)
          return await fn.invokeAction(execution.requestId, argsJson);
        throw new Error(`Function ${udfPath} is not a ${kind}`);
      } finally {
        for (const state of execution.queries.values()) state.stream.close();
      }
    });
    const value = JSON.parse(resultJson) as JSONValue;
    this.validateReturns(fn, value);
    return value;
  }

  outcome(thrown: unknown): FunctionOutcome {
    const error = errorFromThrown(thrown);
    // Like Convex production, hide unexpected errors but keep ConvexError
    // payloads, which apps throw on purpose for their clients.
    const redacted = this.options.redactErrors === true && !error.convex;
    const message = redacted
      ? "Server Error"
      : `Uncaught ${error.convex ? "ConvexError" : "Error"}: ${error.message}`;
    // `cause` keeps the original error for in-process callers; it is never serialized.
    return error.data === undefined
      ? { success: false, message, cause: thrown }
      : { success: false, message, data: error.data, cause: thrown };
  }

  /** Execute a query; the read set tells subscribers when to re-run it. */
  async query(
    udfPath: string,
    args: JSONValue,
    identity: UserIdentity | null,
    visibility: Visibility = "public",
  ): Promise<{ outcome: FunctionOutcome; reads: ReadSet; ts: bigint }> {
    return this.exclusive(() => this.queryLocked(udfPath, args, identity, visibility));
  }

  /** Same as `query`, for callers that already hold the database lock. */
  async queryLocked(
    udfPath: string,
    args: JSONValue,
    identity: UserIdentity | null,
    visibility: Visibility = "public",
    journal: string | null = null,
  ): Promise<{ outcome: FunctionOutcome; reads: ReadSet; ts: bigint; journal: string | null }> {
    const transaction = new Transaction(this.store, false);
    const pinned: Journal = { input: journal, output: null };
    try {
      const fn = await this.lookup(udfPath, "query", visibility);
      const value = await this.invoke("query", udfPath, fn, args, transaction, identity, pinned);
      return {
        outcome: { success: true, value },
        reads: transaction.reads,
        ts: this.store.ts,
        journal: pinned.output,
      };
    } catch (thrown) {
      return {
        outcome: this.outcome(thrown),
        reads: transaction.reads,
        ts: this.store.ts,
        journal: pinned.output,
      };
    }
  }

  /**
   * Execute a mutation atomically. `receipt` makes the write idempotent per
   * client request: replays return the original result without re-running.
   */
  async mutation(
    udfPath: string,
    args: JSONValue,
    identity: UserIdentity | null,
    options: MutationOptions = {},
  ): Promise<{ outcome: FunctionOutcome; ts: bigint; skipped?: true; frozen?: true }> {
    return this.exclusive(async () => {
      const result = await this.mutationLocked(udfPath, args, identity, options);
      if (result.commit !== null) await this.notifyLocked(result.commit);
      const { outcome, ts } = result;
      if (result.frozen === true) return { outcome, ts, frozen: true };
      return result.skipped === true ? { outcome, ts, skipped: true } : { outcome, ts };
    });
  }

  /**
   * `mutation` for callers that hold the database lock. Subscribers are not
   * notified; the caller must pass a non-null `commit` to `notifyLocked`.
   * `frozen` marks a mutation refused, unrun, by the freeze barrier.
   */
  async mutationLocked(
    udfPath: string,
    args: JSONValue,
    identity: UserIdentity | null,
    options: MutationOptions = {},
  ): Promise<{
    outcome: FunctionOutcome;
    ts: bigint;
    commit: CommitResult | null;
    skipped?: true;
    frozen?: true;
  }> {
    const receipt = options.receipt;
    if (receipt !== undefined) {
      const replay = this.store.driver.exec(
        "SELECT ts, result FROM cvx_receipts WHERE session_id = ? AND request_id = ?",
        receipt.sessionId,
        receipt.requestId,
      )[0];
      if (replay !== undefined) {
        return {
          outcome: { success: true, value: JSON.parse(String(replay["result"])) as JSONValue },
          ts: BigInt(String(replay["ts"])),
          commit: null,
        };
      }
    }
    // The barrier holds for every caller: clients, actions, the scheduler
    // and crons alike. `Store.commit` enforces it again at commit time.
    const refused = {
      outcome: FROZEN_OUTCOME,
      ts: this.store.ts,
      commit: null,
      frozen: true,
    } as const;
    if (this.writesFrozen) return refused;
    const transaction = new Transaction(this.store, true);
    let value: JSONValue;
    try {
      const fn = await this.lookup(udfPath, "mutation", options.visibility ?? "public");
      if (options.before !== undefined && !options.before(transaction)) {
        return {
          outcome: { success: true, value: null },
          ts: this.store.ts,
          commit: null,
          skipped: true,
        };
      }
      value = await this.invoke("mutation", udfPath, fn, args, transaction, identity);
    } catch (thrown) {
      return { outcome: this.outcome(thrown), ts: this.store.ts, commit: null };
    }
    let commit: CommitResult;
    try {
      commit = this.store.commit(transaction.writes, {
        receipt: (ts) => {
          if (receipt === undefined) return;
          this.store.driver.exec(
            "INSERT INTO cvx_receipts (session_id, request_id, ts, result, created_at) VALUES (?, ?, ?, ?, ?)",
            receipt.sessionId,
            receipt.requestId,
            ts.toString(),
            JSON.stringify(value),
            Date.now(),
          );
        },
      });
    } catch (error) {
      if (error instanceof FrozenError) return refused;
      throw error;
    }
    return { outcome: { success: true, value }, ts: commit.ts, commit };
  }

  /** Commit writes produced outside a user function (imports, scheduler state). */
  async commitWritesLocked(writes: ReadonlyMap<string, Document | null>): Promise<CommitResult> {
    const commit = this.store.commit(writes);
    await this.notifyLocked(commit);
    return commit;
  }

  /** Tell subscribers about a commit; the caller holds the database lock. */
  async notifyLocked(commit: CommitResult) {
    for (const listener of this.listeners) {
      try {
        await listener(commit);
      } catch (error) {
        console.error("parlor-cloudflare: commit listener failed", error);
      }
    }
  }

  async action(
    udfPath: string,
    args: JSONValue,
    identity: UserIdentity | null,
    visibility: Visibility = "public",
  ): Promise<FunctionOutcome> {
    if (this.writesFrozen) return FROZEN_OUTCOME;
    this.actionsRunning += 1;
    try {
      const fn = await this.lookup(udfPath, "action", visibility);
      const value = await this.invoke("action", udfPath, fn, args, null, identity);
      return { success: true, value };
    } catch (thrown) {
      return this.outcome(thrown);
    } finally {
      this.actionsRunning -= 1;
    }
  }

  private async httpRouter(): Promise<ConvexHttpRouter | null> {
    if (this.router === undefined) {
      const source = this.app.http ?? null;
      this.router = typeof source === "function" ? await source() : source;
    }
    return this.router;
  }

  /** Route a request to the app's `httpRouter`, if it has one. */
  async http(request: Request, path: string): Promise<Response> {
    const method = request.method.toUpperCase();
    const match = HTTP_METHODS.has(method)
      ? ((await this.httpRouter())?.lookup(path, method as HttpMethod) ?? null)
      : null;
    if (match === null) return new Response(`No HttpAction routed for ${path}`, { status: 404 });
    if (this.writesFrozen) {
      return new Response(JSON.stringify({ code: "Frozen", message: FROZEN_MESSAGE }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    const endpoint = match[0] as HttpEndpoint;
    const execution: Execution = {
      runtime: this,
      kind: "http",
      udfPath: `http:${path}`,
      transaction: null,
      identity: null,
      requestId: newRequestId(),
      queries: new Map(),
      journal: null,
      nextQueryId: 1,
      paginatedQueries: 0,
    };
    this.actionsRunning += 1;
    try {
      return await executions.run(execution, () => endpoint.invokeHttpAction(request));
    } finally {
      this.actionsRunning -= 1;
    }
  }

  // ---------------------------------------------------------------- syscalls

  private db(execution: Execution): Transaction {
    if (execution.transaction === null) {
      throw syscallError(
        "The database is only available in queries and mutations; use ctx.runQuery or ctx.runMutation.",
      );
    }
    return execution.transaction;
  }

  syscall(execution: Execution, op: string, argsJson: string): string {
    const args = JSON.parse(argsJson) as Record<string, unknown>;
    switch (op) {
      case "1.0/queryStream": {
        const transaction = this.db(execution);
        const queryId = execution.nextQueryId;
        execution.nextQueryId += 1;
        execution.queries.set(queryId, {
          stream: new QueryStream(plan(transaction, args["query"] as SerializedQuery), transaction),
        });
        return JSON.stringify({ queryId });
      }
      case "1.0/queryCleanup": {
        const queryId = Number(args["queryId"]);
        execution.queries.get(queryId)?.stream.close();
        execution.queries.delete(queryId);
        return JSON.stringify({});
      }
      case "1.0/db/normalizeId": {
        const idString = args["idString"];
        const decoded = typeof idString === "string" ? decodeId(idString) : null;
        const table = decoded === null ? undefined : this.store.tableName(decoded.tableNumber);
        return JSON.stringify({
          id: table !== undefined && table === args["table"] ? idString : null,
        });
      }
      default:
        throw new Error(`Unsupported Convex syscall ${op}`);
    }
  }

  async asyncSyscall(execution: Execution, op: string, argsJson: string): Promise<string> {
    const args = JSON.parse(argsJson) as Record<string, unknown>;
    const table = typeof args["table"] === "string" ? args["table"] : undefined;
    switch (op) {
      case "1.0/get": {
        this.checkTableAccess(String(args["id"]), args["isSystem"] === true, "get");
        const document = this.db(execution).get(String(args["id"]), table);
        return JSON.stringify(document === null ? null : convexToJson(document));
      }
      case "1.0/queryStreamNext": {
        const state = execution.queries.get(Number(args["queryId"]));
        if (state === undefined) throw syscallError("Query is closed");
        const document = state.stream.next();
        return JSON.stringify(
          document === null
            ? { value: null, done: true }
            : { value: convexToJson(document), done: false },
        );
      }
      case "1.0/queryPage": {
        execution.paginatedQueries += 1;
        if (execution.paginatedQueries > 1) {
          throw syscallError(
            "This query or mutation function ran multiple paginated queries. Convex only supports a single paginated query in each function.",
          );
        }
        const transaction = this.db(execution);
        const requestedEnd = typeof args["endCursor"] === "string" ? args["endCursor"] : null;
        const result = paginate(transaction, plan(transaction, args["query"] as SerializedQuery), {
          cursor: typeof args["cursor"] === "string" ? args["cursor"] : null,
          endCursor: requestedEnd ?? journalEndCursor(execution.journal?.input ?? null),
          pageSize: Number(args["pageSize"]),
          maximumRowsRead:
            typeof args["maximumRowsRead"] === "number" ? args["maximumRowsRead"] : null,
        });
        if (execution.journal !== null) {
          execution.journal.output = JSON.stringify({
            v: JOURNAL_VERSION,
            endCursor: result.continueCursor,
          });
        }
        return JSON.stringify({
          ...result,
          page: result.page.map((document) => convexToJson(document)),
        });
      }
      case "1.0/insert": {
        if (String(args["table"]).startsWith("_"))
          throw syscallError("System tables (prefixed with `_`) are read-only.");
        const id = this.db(execution).insert(
          String(args["table"]),
          jsonToConvex(args["value"] as JSONValue) as Record<string, Value>,
        );
        return JSON.stringify({ _id: id });
      }
      case "1.0/shallowMerge": {
        const value = args["value"] as Record<string, unknown>;
        const decoded: Record<string, Value | undefined> = {};
        for (const [field, fieldValue] of Object.entries(value)) {
          decoded[field] =
            typeof fieldValue === "object" && fieldValue !== null && "$undefined" in fieldValue
              ? undefined
              : jsonToConvex(fieldValue as JSONValue);
        }
        this.checkUserWrite(String(args["id"]));
        this.db(execution).patch(String(args["id"]), decoded, table);
        return JSON.stringify({});
      }
      case "1.0/replace": {
        this.checkUserWrite(String(args["id"]));
        this.db(execution).replace(
          String(args["id"]),
          jsonToConvex(args["value"] as JSONValue) as Record<string, Value>,
          table,
        );
        return JSON.stringify({});
      }
      case "1.0/remove": {
        this.checkUserWrite(String(args["id"]));
        this.db(execution).delete(String(args["id"]), table);
        return JSON.stringify({});
      }
      case "1.0/count": {
        return JSON.stringify(this.db(execution).count(String(args["table"])));
      }
      case "1.0/getUserIdentity":
        return JSON.stringify(execution.identity);
      case "1.0/schedule": {
        const name = await this.schedulable(args);
        return JSON.stringify(this.scheduleIn(this.db(execution), name, args));
      }
      case "1.0/cancel_job":
        this.cancelIn(this.db(execution), String(args["id"]));
        return JSON.stringify({});
      case "1.0/actions/schedule": {
        let jobId = "";
        const name = await this.schedulable(args);
        await this.mutationWithin((transaction) => {
          jobId = this.scheduleIn(transaction, name, args);
        });
        return JSON.stringify(jobId);
      }
      case "1.0/actions/cancel_job":
        await this.mutationWithin((transaction) => this.cancelIn(transaction, String(args["id"])));
        return JSON.stringify({});
      case "1.0/actions/query":
      case "1.0/actions/mutation":
      case "1.0/actions/action":
        return this.callFromAction(execution, op, args);
      case "1.0/runUdf":
        return this.runNested(execution, args);
      case "1.0/getFunctionMetadata":
        return JSON.stringify({ name: execution.udfPath, componentPath: "" });
      case "1.0/getDeploymentMetadata":
        return JSON.stringify({
          name: this.options.deploymentName ?? "parlor-cloudflare",
          region: null,
          class: "durable-object",
        });
      case "1.0/getRequestMetadata":
        return JSON.stringify({
          ip: null,
          userAgent: null,
          requestId: execution.requestId,
          scheduledFunctionId: null,
          authToken: null,
        });
      case "1.0/getTransactionMetrics":
        return JSON.stringify({
          bytesRead: { used: 0, remaining: 0 },
          bytesWritten: { used: 0, remaining: 0 },
          databaseQueries: { used: 0, remaining: 0 },
          documentsRead: { used: 0, remaining: 0 },
          documentsWritten: { used: 0, remaining: 0 },
          functionsScheduled: { used: 0, remaining: 0 },
          scheduledFunctionArgsBytes: { used: 0, remaining: 0 },
        });
      default:
        throw syscallError(`Unsupported Convex async syscall ${op}`);
    }
  }

  private checkTableAccess(id: string, isSystem: boolean, operation: string) {
    const table = this.store.tableOfId(id);
    if (table !== null && table.startsWith("_") !== isSystem) {
      throw syscallError(
        `${isSystem ? "User" : "System"} tables can only be accessed from db.${isSystem ? "" : "system."}${operation}().`,
      );
    }
  }

  private checkUserWrite(id: string) {
    if (this.store.tableOfId(id)?.startsWith("_") === true) {
      throw syscallError("System tables (prefixed with `_`) are read-only.");
    }
  }

  private functionName(args: Record<string, unknown>): string {
    const name = args["name"];
    if (typeof name !== "string")
      throw syscallError("Only named function references are supported");
    return canonicalizeUdfPath(name);
  }

  private async callFromAction(
    execution: Execution,
    op: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const name = this.functionName(args);
    const callArgs = args["args"] as JSONValue;
    const visibility: Visibility = "internal";
    const outcome =
      op === "1.0/actions/query"
        ? (await this.query(name, callArgs, execution.identity, visibility)).outcome
        : op === "1.0/actions/mutation"
          ? (await this.mutation(name, callArgs, execution.identity, { visibility })).outcome
          : await this.action(name, callArgs, execution.identity, visibility);
    if (outcome.success) return JSON.stringify(outcome.value);
    throw syscallError(outcome.message, outcome.data);
  }

  /** `ctx.runQuery` / `ctx.runMutation` inside a query or mutation share its transaction. */
  private async runNested(execution: Execution, args: Record<string, unknown>): Promise<string> {
    const transaction = this.db(execution);
    const udfType = args["udfType"];
    const kind: FunctionKind = udfType === "mutation" ? "mutation" : "query";
    if (kind === "mutation" && !transaction.writable)
      throw syscallError("Mutations cannot be run from queries");
    const name = this.functionName(args);
    const fn = await this.lookup(name, kind, "internal");
    const saved = new Map(transaction.writes);
    try {
      const value = await this.invoke(
        kind,
        name,
        fn,
        args["args"] as JSONValue,
        transaction,
        execution.identity,
      );
      return JSON.stringify(value);
    } catch (thrown) {
      transaction.writes.clear();
      for (const [id, document] of saved) transaction.writes.set(id, document);
      const error = errorFromThrown(thrown);
      throw syscallError(error.message, error.data);
    }
  }

  // --------------------------------------------------------------- scheduler

  private async schedulable(args: Record<string, unknown>): Promise<string> {
    const name = this.functionName(args);
    const resolved = await this.resolve(name);
    if (resolved === null || resolved.kind === "query") {
      throw syscallError(`Attempted to schedule function at nonexistent path: ${name}`);
    }
    return name;
  }

  private scheduleIn(
    transaction: Transaction,
    name: string,
    args: Record<string, unknown>,
  ): string {
    const scheduledTime = Math.max(Date.now(), Math.round(Number(args["ts"]) * 1000));
    // The SDK sends Convex JSON; store the values it encodes, as Convex does.
    return transaction.insert(SCHEDULED_FUNCTIONS_TABLE, {
      name,
      args: [jsonToConvex((args["args"] ?? {}) as JSONValue)],
      scheduledTime,
      state: { kind: "pending" },
    });
  }

  private cancelIn(transaction: Transaction, id: string) {
    const job = transaction.get(id, SCHEDULED_FUNCTIONS_TABLE);
    if (job === null) throw syscallError(`Scheduled function ${id} not found`);
    const state = jobState(job);
    if (state === "pending" || state === "inProgress") {
      transaction.patch(id, { state: { kind: "canceled" }, completedTime: Date.now() });
    }
  }

  /**
   * Run internal bookkeeping writes as their own committed transaction.
   * Throws `FrozenError` when there is something to write while frozen.
   */
  private async mutationWithin(work: (transaction: Transaction) => void): Promise<void> {
    await this.exclusive(async () => {
      const transaction = new Transaction(this.store, true);
      work(transaction);
      if (transaction.writes.size > 0) await this.commitWritesLocked(transaction.writes);
    });
  }

  /**
   * When the scheduler next has work, in epoch milliseconds: now when a job
   * was interrupted, else the earliest pending job or cron run. Due actions
   * waiting for a slot do not count; the action that frees one wakes them.
   */
  nextWakeTime(): number | null {
    if (this.interruptedJobs(1).length > 0) return Date.now();
    const pending = this.firstJob("pending", Number.MAX_SAFE_INTEGER, this.waitingForSlot);
    const cronNext = [...this.cronStates().values()].reduce<number | null>(
      (earliest, next) => (earliest === null || next < earliest ? next : earliest),
      null,
    );
    const jobTime = pending === undefined ? null : Number(pending["scheduledTime"]);
    if (jobTime === null) return cronNext;
    if (cronNext === null) return jobTime;
    return Math.min(jobTime, cronNext);
  }

  /** The earliest job in state `kind` scheduled before `before` and not in `skip`. */
  private firstJob(kind: string, before: number, skip: ReadonlySet<string>): Document | undefined {
    const row = this.jobRows(kind, before, null, skip.size + 1).find((job) => !skip.has(job.id));
    return row === undefined ? undefined : (this.store.readDocument(row.id) ?? undefined);
  }

  /** `inProgress` jobs this instance is not running: a restart or freeze cut them off. */
  private interruptedJobs(limit: number): Document[] {
    return this.jobsInState("inProgress", Number.MAX_SAFE_INTEGER, limit + this.runningJobs.size)
      .filter((job) => !this.runningJobs.has(job._id))
      .slice(0, limit);
  }

  private jobsInState(kind: string, before: number, limit: number): Document[] {
    return this.jobRows(kind, before, null, limit)
      .map((row) => this.store.readDocument(row.id))
      .filter((document): document is Document => document !== null);
  }

  /** Index rows of jobs in state `kind` scheduled before `before`, in order after key `after`. */
  private jobRows(kind: string, before: number, after: string | null, limit: number) {
    const index = this.schema.tables
      .get(SCHEDULED_FUNCTIONS_TABLE)
      ?.indexes.find((candidate) => candidate.name.endsWith(".by_state_time"));
    if (index === undefined) return [];
    const prefix = encodeKey([kind]);
    const high = prefixEnd(prefix + encodeKey([before]));
    return this.store.scanPage(index.name, prefix, high, "asc", after, limit);
  }

  /**
   * Scheduler upkeep (lock held, writes not frozen). Actions cut off by a
   * restart or a freeze cannot resume, so mark them failed, as Convex does,
   * instead of leaving them in progress forever. Then drop expired mutation
   * receipts and week-old finished scheduler records.
   */
  private async maintenanceLocked(now: number) {
    const transaction = new Transaction(this.store, true);
    for (const job of this.interruptedJobs(1000)) {
      transaction.patch(job._id, {
        state: { kind: "failed", error: "Interrupted before its outcome was recorded" },
        completedTime: Date.now(),
      });
    }
    const cutoff = now - RETAIN_FINISHED_MS;
    this.store.driver.exec("DELETE FROM cvx_receipts WHERE created_at < ?", cutoff);
    for (const kind of ["success", "failed", "canceled"]) {
      for (const job of this.jobsInState(kind, cutoff, 100)) transaction.delete(job._id);
    }
    if (transaction.writes.size > 0) await this.commitWritesLocked(transaction.writes);
  }

  /**
   * Run every scheduled function and cron due at `now`. Each job and cron is
   * isolated: one that cannot load or fails is recorded as failed and the
   * pass moves on. Actions start here but run outside the pass, so a slow
   * one never holds up later jobs or crons. A freeze ends the pass before
   * its next job or cron.
   */
  async runDue(now = Date.now()): Promise<number> {
    return this.schedulerPass.run(async () => {
      const admitted = await this.exclusive(async () => {
        if (this.writesFrozen) return false;
        await this.maintenanceLocked(now);
        return true;
      });
      if (!admitted) return 0;
      let ran = 0;
      // Jobs are taken in index order, each after the last one taken, so a
      // job still pending after its attempt (it could not record an outcome,
      // or waits for an action slot) is not taken again in this pass, and a
      // backlog costs one index step per job.
      let after: string | null = null;
      for (;;) {
        const next = await this.exclusive(async () => {
          if (this.writesFrozen) return undefined;
          const [row] = this.jobRows("pending", now, after, 1);
          return row && { key: row.key, job: this.store.readDocument(row.id) };
        });
        if (next === undefined) break;
        after = next.key;
        if (next.job !== null && (await this.runJob(next.job))) ran += 1;
      }
      return ran + (await this.runDueCrons(now));
    });
  }

  /** Run one due job, or start it if it is an action; false when it must wait for a slot. */
  private async runJob(job: Document): Promise<boolean> {
    const name = typeof job["name"] === "string" ? job["name"] : "";
    try {
      const args = convexToJson((job["args"] as Value[] | undefined)?.[0] ?? {});
      let resolved: Awaited<ReturnType<Runtime["resolve"]>>;
      try {
        resolved = await this.resolve(name);
      } catch (error) {
        // A module that throws at import fails its own jobs, not the queue.
        await this.settleJob(
          job,
          "pending",
          failedState(`Could not load ${name}: ${messageOf(error)}`),
        );
        return true;
      }
      if (resolved === null || resolved.kind === "query") {
        await this.settleJob(job, "pending", failedState(`Function ${name} not found`));
        return true;
      }
      if (resolved.kind === "mutation") {
        // The job's state change commits atomically with the mutation's writes.
        const { outcome, skipped, frozen } = await this.mutation(name, args, null, {
          visibility: "internal",
          before: (transaction) => {
            if (jobState(transaction.get(job._id, SCHEDULED_FUNCTIONS_TABLE)) !== "pending")
              return false;
            transaction.patch(job._id, { state: { kind: "success" }, completedTime: Date.now() });
            return true;
          },
        });
        // Refused by a freeze, the job stays pending for whichever backend writes next.
        if (skipped === true || frozen === true || outcome.success) return true;
        console.error(`parlor-cloudflare: scheduled mutation ${name} failed: ${outcome.message}`);
        await this.settleJob(job, "pending", failedState(outcome.message));
        return true;
      }
      if (this.runningJobs.size >= MAX_SCHEDULED_ACTIONS) {
        this.waitingForSlot.add(job._id);
        return false;
      }
      this.runningJobs.add(job._id);
      let started = false;
      try {
        started = await this.settleJob(job, "pending", { kind: "inProgress" });
      } finally {
        if (!started) this.runningJobs.delete(job._id);
      }
      if (started) void this.runScheduledAction(job, name, args);
    } catch (error) {
      console.error(`parlor-cloudflare: scheduled function ${name} could not run`, error);
    }
    return true;
  }

  /**
   * Run a scheduled action the pass started, then record its outcome. If
   * writes froze meanwhile, the job stays inProgress until upkeep, after the
   * freeze, marks it interrupted; it is never retried. Ending frees its slot
   * and starts a pass for any due action that was waiting for one.
   */
  private async runScheduledAction(job: Document, name: string, args: JSONValue) {
    const release = () => {
      this.runningJobs.delete(job._id);
      const waiting = this.waitingForSlot.size > 0;
      this.waitingForSlot.clear();
      return waiting;
    };
    let waiting = false;
    try {
      const outcome = await this.action(name, args, null, "internal");
      if (!outcome.success)
        console.error(`parlor-cloudflare: scheduled action ${name} failed: ${outcome.message}`);
      // The slot frees under the same lock as the outcome's commit, so the
      // commit's listeners already see it.
      await this.settleJob(
        job,
        "inProgress",
        outcome.success ? { kind: "success" } : failedState(outcome.message),
        () => {
          waiting = release();
        },
      );
    } catch (error) {
      console.error(
        `parlor-cloudflare: scheduled action ${name} could not record its outcome`,
        error,
      );
    } finally {
      if (this.runningJobs.has(job._id)) waiting = release() || waiting;
    }
    if (waiting) {
      void this.runDue().catch((error: unknown) => {
        console.error("parlor-cloudflare: scheduled work failed", error);
      });
    }
  }

  /**
   * Move a job from state `from` to `state` in its own commit. False when it
   * is no longer in `from`, or when writes are frozen. `locked` runs first,
   * under the same database lock.
   */
  private async settleJob(
    job: Document,
    from: string,
    state: { readonly kind: string; readonly error?: string },
    locked?: () => void,
  ): Promise<boolean> {
    let moved = false;
    try {
      await this.mutationWithin((transaction) => {
        locked?.();
        if (jobState(transaction.get(job._id, SCHEDULED_FUNCTIONS_TABLE)) !== from) return;
        transaction.patch(
          job._id,
          state.kind === "inProgress" ? { state } : { state, completedTime: Date.now() },
        );
        moved = true;
      });
    } catch (error) {
      if (error instanceof FrozenError) return false;
      throw error;
    }
    return moved;
  }

  // ------------------------------------------------------------------- crons

  private cronStates(): Map<string, number> {
    const states = new Map<string, number>();
    const crons = this.app.crons?.crons ?? {};
    for (const row of this.store.driver.exec(
      "SELECT key, value FROM cvx_meta WHERE key LIKE 'cron:%'",
    )) {
      const name = String(row["key"]).slice("cron:".length);
      if (Object.hasOwn(crons, name)) states.set(name, Number(row["value"]));
    }
    return states;
  }

  /** Register new crons and forget removed ones; returns the cron count. */
  syncCrons(now = Date.now()): number {
    const crons = this.app.crons?.crons ?? {};
    const states = this.cronStates();
    this.store.driver.transaction(() => {
      for (const row of this.store.driver.exec(
        "SELECT key FROM cvx_meta WHERE key LIKE 'cron:%'",
      )) {
        const name = String(row["key"]).slice("cron:".length);
        if (!Object.hasOwn(crons, name)) this.store.setMeta(`cron:${name}`, null);
      }
      for (const [name, definition] of Object.entries(crons)) {
        if (!states.has(name))
          this.store.setMeta(`cron:${name}`, String(nextCronRun(definition.schedule, now)));
      }
    });
    return Object.keys(crons).length;
  }

  private async runDueCrons(now: number): Promise<number> {
    const crons = this.app.crons?.crons ?? {};
    let ran = 0;
    for (const [name, nextRun] of this.cronStates()) {
      const definition = crons[name];
      if (definition === undefined || nextRun > now) continue;
      // Advance first, so a failing cron is not retried in a loop; a freeze
      // ends the pass before the next cron.
      const admitted = await this.exclusive(async () => {
        if (this.writesFrozen) return false;
        this.store.setMeta(`cron:${name}`, String(nextCronRun(definition.schedule, now)));
        return true;
      });
      if (!admitted) break;
      if (this.runningCrons.has(name)) {
        // At most one run of a cron executes at a time, as on Convex: a run
        // that comes due while the previous one is still going is skipped.
        console.warn(`parlor-cloudflare: cron ${name} skipped; its previous run is still going`);
        continue;
      }
      ran += 1;
      const target = canonicalizeUdfPath(definition.name);
      const args = (Array.isArray(definition.args) ? definition.args[0] : undefined) ?? {};
      try {
        const resolved = await this.resolve(target);
        if (resolved?.kind === "mutation") {
          const { outcome } = await this.mutation(target, args, null, { visibility: "internal" });
          if (!outcome.success)
            console.error(`parlor-cloudflare: cron ${name} failed: ${outcome.message}`);
        } else if (resolved?.kind === "action") {
          // The action runs outside the pass, so it never holds up other work.
          this.runningCrons.add(name);
          void this.action(target, args, null, "internal")
            .then((outcome) => {
              if (!outcome.success)
                console.error(`parlor-cloudflare: cron ${name} failed: ${outcome.message}`);
            })
            .finally(() => this.runningCrons.delete(name));
        } else {
          console.error(`parlor-cloudflare: cron ${name} targets missing function ${target}`);
        }
      } catch (error) {
        // One cron that cannot load never keeps the others from running.
        console.error(`parlor-cloudflare: cron ${name} could not run: ${messageOf(error)}`);
      }
    }
    return ran;
  }
}

function jobState(job: Document | null): unknown {
  return (job?.["state"] as { kind?: unknown } | undefined)?.kind;
}

function failedState(error: string): { readonly kind: "failed"; readonly error: string } {
  return { kind: "failed", error };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function intervalMs(schedule: Extract<CronSchedule, { type: "interval" }>): number {
  return (
    ((schedule.hours ?? 0) * 3600 + (schedule.minutes ?? 0) * 60 + (schedule.seconds ?? 0)) * 1000
  );
}

/** The next run strictly after `after` for a Convex cron schedule (UTC). */
export function nextCronRun(schedule: CronSchedule, after: number): number {
  if (schedule.type === "interval") return after + Math.max(1000, intervalMs(schedule));
  if (schedule.type === "cron") return nextCronExpression(schedule.cron, after);
  const minute = schedule.minuteUTC ?? 0;
  if (schedule.type === "hourly") return nextCronExpression(`${minute} * * * *`, after);
  if (schedule.type === "daily")
    return nextCronExpression(`${minute} ${schedule.hourUTC} * * *`, after);
  if (schedule.type === "monthly") {
    return nextCronExpression(`${minute} ${schedule.hourUTC} ${schedule.day} * *`, after);
  }
  const day =
    typeof schedule.dayOfWeek === "number"
      ? schedule.dayOfWeek
      : WEEKDAYS.indexOf(schedule.dayOfWeek.toLowerCase());
  if (day < 0) throw new Error(`Invalid cron day of week ${String(schedule.dayOfWeek)}`);
  return nextCronExpression(`${minute} ${schedule.hourUTC} * * ${day}`, after);
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function cronField(text: string, minimum: number, maximum: number): Set<number> {
  const values = new Set<number>();
  for (const part of text.split(",")) {
    const [rangeText, stepText] = part.split("/");
    const step = stepText === undefined ? 1 : Number(stepText);
    let start = minimum;
    let end = maximum;
    if (rangeText !== "*" && rangeText !== undefined) {
      const [first, last] = rangeText.split("-");
      start = Number(first);
      end = last === undefined ? (stepText === undefined ? start : maximum) : Number(last);
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(step) || step < 1) {
      throw new Error(`Invalid cron field ${text}`);
    }
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return values;
}

function nextCronExpression(expression: string, after: number): number {
  const [minute, hour, day, month, weekday] = expression.trim().split(/\s+/);
  if (weekday === undefined) throw new Error(`Invalid cron expression ${expression}`);
  const minutes = cronField(minute ?? "*", 0, 59);
  const hours = cronField(hour ?? "*", 0, 23);
  const days = cronField(day ?? "*", 1, 31);
  const months = cronField(month ?? "*", 1, 12);
  const weekdays = new Set([...cronField(weekday, 0, 7)].map((value) => value % 7));
  const candidate = new Date(Math.floor(after / 60_000) * 60_000 + 60_000);
  for (let step = 0; step < 366 * 24 * 60; step += 1) {
    if (
      minutes.has(candidate.getUTCMinutes()) &&
      hours.has(candidate.getUTCHours()) &&
      days.has(candidate.getUTCDate()) &&
      months.has(candidate.getUTCMonth() + 1) &&
      weekdays.has(candidate.getUTCDay())
    ) {
      return candidate.getTime();
    }
    candidate.setTime(candidate.getTime() + 60_000);
  }
  throw new Error(`Cron expression ${expression} never fires`);
}

export { printValidator };
