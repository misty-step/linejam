/**
 * `@parlor/cloudflare`: run an unchanged Convex app (schema, function modules,
 * crons, HTTP router, auth config) on one SQLite-backed Cloudflare Durable
 * Object that speaks the Convex client protocol. See
 * docs/adr/0003-cloudflare-durable-object-adapter.md for the supported
 * protocol surface and its limits.
 */
export { createConvexBackend, durableSqlDriver, forwardToBackend } from "./durable.js";
export type {
  BackendEnv,
  ConvexBackendOptions,
  DurableObjectNamespaceLike,
  DurableObjectStateLike,
  DurableObjectStorageLike,
} from "./durable.js";
export { AuthenticationError, TokenVerifier, identityFromClaims } from "./auth.js";
export type { AuthConfig, AuthProvider, VerifiedToken } from "./auth.js";
export { Runtime, canonicalizeUdfPath, nextCronRun } from "./runtime.js";
export type {
  ConvexApp,
  ConvexCrons,
  ConvexHttpRouter,
  ConvexModule,
  CronSchedule,
  ModuleSource,
  FunctionOutcome,
  RuntimeOptions,
  UserIdentity,
} from "./runtime.js";
export type { SqlDriver, SqlRow, SqlValue } from "./store.js";
export { SyncSession, encodeTs } from "./sync.js";
export { canonicalJson, documentsChecksum } from "./snapshot.js";
export { decodeId, encodeId } from "./ids.js";
