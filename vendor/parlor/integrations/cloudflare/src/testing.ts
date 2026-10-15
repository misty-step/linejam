import { DatabaseSync } from "node:sqlite";
import {
  getFunctionName,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  type FunctionReference,
} from "convex/server";
import { convexToJson, jsonToConvex, v, type JSONValue, type Value } from "convex/values";
import type {
  ConvexApp,
  ConvexHttpRouter,
  ConvexModule,
  FunctionOutcome,
  ModuleSource,
  UserIdentity,
} from "./runtime.js";
import { canonicalizeUdfPath, Runtime } from "./runtime.js";
import type { ConvexSchemaDefinition } from "./schema.js";
import type { SqlDriver, SqlRow, SqlValue } from "./store.js";

/**
 * A `convex-test`-compatible harness backed by this package's runtime, so an
 * app's existing Convex test suite can run unchanged against the Cloudflare
 * adapter (alias `convex-test` to `@parlor/cloudflare/testing`). Node only.
 */

type ModuleLoaders = Record<string, () => Promise<unknown>>;
type Handler = (ctx: unknown) => unknown;
type Kind = "query" | "mutation" | "action";
/** Inline handlers and their raw (unserialized) results, by token. */
type InlineRegistry = Map<string, { handler: Handler; result?: unknown }>;
type Reference<K extends Kind> =
  | FunctionReference<K, "public" | "internal">
  | ((ctx: never) => unknown);

/** A synchronous in-memory SQLite driver with Durable Object transaction semantics. */
export function memorySqlDriver(): SqlDriver {
  const database = new DatabaseSync(":memory:");
  let depth = 0;
  return {
    exec: (query: string, ...bindings: SqlValue[]) =>
      database.prepare(query).all(...bindings) as SqlRow[],
    transaction<T>(callback: () => T): T {
      const name = `sp${depth}`;
      depth += 1;
      database.exec(`SAVEPOINT ${name}`);
      try {
        const result = callback();
        database.exec(`RELEASE ${name}`);
        return result;
      } catch (error) {
        database.exec(`ROLLBACK TO ${name}`);
        database.exec(`RELEASE ${name}`);
        throw error;
      } finally {
        depth -= 1;
      }
    },
  };
}

const INLINE_MODULE = "__parlor_test__";
const DEFAULT_ISSUER = "https://convex.test";
const IGNORED = new Set(["schema", "crons", "auth.config"]);

function inlineModule(inline: InlineRegistry): ConvexModule {
  const run = async (ctx: unknown, { token }: { token: string }) => {
    const entry = inline.get(token);
    if (entry === undefined) throw new Error("Inline test function is missing its handler");
    entry.result = await entry.handler(ctx);
    return null;
  };
  const args = { token: v.string() };
  return {
    query: internalQueryGeneric({ args, handler: run }),
    mutation: internalMutationGeneric({ args, handler: run }),
    action: internalActionGeneric({ args, handler: run }),
  };
}

/** Map `import.meta.glob` loaders to lazily loaded Convex modules, keyed like udf paths. */
function appFromGlob(
  schema: ConvexSchemaDefinition | null,
  loaders: ModuleLoaders,
  inline: InlineRegistry,
): ConvexApp {
  const generated = Object.keys(loaders).find((path) => path.includes("/_generated/"));
  if (generated === undefined)
    throw new Error("Module map must include the convex/_generated directory");
  const root = generated.slice(0, generated.indexOf("/_generated/") + 1);
  const modules: Record<string, ModuleSource> = { [INLINE_MODULE]: inlineModule(inline) };
  let http: (() => Promise<ConvexHttpRouter | null>) | null = null;
  for (const [path, load] of Object.entries(loaders)) {
    if (
      !path.startsWith(root) ||
      path.includes("/_generated/") ||
      /\.(test|spec)\.[cm]?[jt]s$/.test(path)
    )
      continue;
    const name = path.slice(root.length).replace(/\.[cm]?[jt]sx?$/, "");
    if (IGNORED.has(name) || name.endsWith(".d")) continue;
    if (name === "http") {
      http = async () => ((await load()) as { default?: ConvexHttpRouter }).default ?? null;
      continue;
    }
    modules[name] = async () => (await load()) as ConvexModule;
  }
  return { schema, modules, crons: null, http };
}

function completeIdentity(attributes: Record<string, JSONValue>): UserIdentity {
  const subject =
    typeof attributes["subject"] === "string" ? attributes["subject"] : crypto.randomUUID();
  const issuer = typeof attributes["issuer"] === "string" ? attributes["issuer"] : DEFAULT_ISSUER;
  const tokenIdentifier =
    typeof attributes["tokenIdentifier"] === "string"
      ? attributes["tokenIdentifier"]
      : `${issuer}|${subject}`;
  return { ...attributes, subject, issuer, tokenIdentifier };
}

export interface TestConvex {
  query(reference: Reference<"query">, args?: Record<string, unknown>): Promise<unknown>;
  mutation(reference: Reference<"mutation">, args?: Record<string, unknown>): Promise<unknown>;
  action(reference: Reference<"action">, args?: Record<string, unknown>): Promise<unknown>;
  run<T>(handler: (ctx: never) => Promise<T> | T): Promise<T>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  withIdentity(identity: Record<string, JSONValue>): TestConvex;
  finishInProgressScheduledFunctions(): Promise<void>;
  finishAllScheduledFunctions(advanceTimers: () => void, maxIterations?: number): Promise<void>;
}

export function convexTest(
  schema?: ConvexSchemaDefinition | null,
  modules?: ModuleLoaders,
): TestConvex {
  if (modules === undefined)
    throw new Error("Pass the module map: convexTest(schema, import.meta.glob(...))");
  const inline: InlineRegistry = new Map();
  const runtime = new Runtime(memorySqlDriver(), appFromGlob(schema ?? null, modules, inline));

  // Run due scheduled functions on timers, as convex-test does, so fake
  // timers drive them too.
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const next = runtime.nextWakeTime();
    if (next === null) return;
    timer = setTimeout(
      () => {
        timer = null;
        void runtime.runDue(Date.now()).then(arm, arm);
      },
      Math.max(0, next - Date.now()),
    );
  };
  runtime.onCommit(() => arm());

  // convex-test rethrows the original error object, so tests can inspect it.
  const unwrap = (outcome: FunctionOutcome): unknown => {
    if (outcome.success) return jsonToConvex(outcome.value);
    throw outcome.cause ?? new Error(outcome.message);
  };

  const invoke = async (
    kind: Kind,
    path: string,
    args: JSONValue,
    identity: UserIdentity | null,
  ) => {
    if (kind === "query") return (await runtime.query(path, args, identity, "internal")).outcome;
    if (kind === "mutation")
      return (await runtime.mutation(path, args, identity, { visibility: "internal" })).outcome;
    return runtime.action(path, args, identity, "internal");
  };

  const call = async (
    kind: Kind,
    reference: Reference<Kind>,
    args: Record<string, unknown>,
    identity: UserIdentity | null,
  ) => {
    if (typeof reference === "function") {
      const token = crypto.randomUUID();
      const entry: { handler: Handler; result?: unknown } = { handler: reference as Handler };
      inline.set(token, entry);
      try {
        unwrap(await invoke(kind, `${INLINE_MODULE}:${kind}`, { token }, identity));
        return entry.result;
      } finally {
        inline.delete(token);
      }
    }
    const path = canonicalizeUdfPath(getFunctionName(reference));
    if ((await runtime.resolve(path)) === null) {
      const [modulePath, exportName] = path.split(":");
      throw new Error(
        `Expected a Convex function exported from module "${modulePath}" as \`${exportName}\`, but there is no such export.`,
      );
    }
    return unwrap(await invoke(kind, path, convexToJson(args as Value), identity));
  };

  const accessor = (identity: UserIdentity | null): TestConvex => ({
    query: (reference, args = {}) => call("query", reference, args, identity),
    mutation: (reference, args = {}) => call("mutation", reference, args, identity),
    action: (reference, args = {}) => call("action", reference, args, identity),
    run: async <T>(handler: (ctx: never) => Promise<T> | T) =>
      (await call("mutation", handler, {}, identity)) as T,
    async fetch(path, init) {
      const url = new URL(path, "https://test.convex.site");
      return runtime.http(new Request(url, init), url.pathname);
    },
    withIdentity: (attributes) => accessor(completeIdentity(attributes)),
    async finishInProgressScheduledFunctions() {
      await runtime.runDue(Date.now());
    },
    async finishAllScheduledFunctions(advanceTimers, maxIterations = 100) {
      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        advanceTimers();
        await runtime.runDue(Number.MAX_SAFE_INTEGER);
        if (runtime.nextWakeTime() === null) return;
      }
      throw new Error("finishAllScheduledFunctions: scheduled functions keep rescheduling");
    },
  });
  return accessor(null);
}
