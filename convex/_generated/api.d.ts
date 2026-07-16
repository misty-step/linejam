/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as abandonment from "../abandonment.js";
import type * as ai from "../ai.js";
import type * as archive from "../archive.js";
import type * as crons from "../crons.js";
import type * as errors from "../errors.js";
import type * as favorites from "../favorites.js";
import type * as game from "../game.js";
import type * as guestSessions from "../guestSessions.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as lib_abuseRateLimit from "../lib/abuseRateLimit.js";
import type * as lib_ai_fallbackMetrics from "../lib/ai/fallbackMetrics.js";
import type * as lib_ai_fallbacks from "../lib/ai/fallbacks.js";
import type * as lib_ai_llm from "../lib/ai/llm.js";
import type * as lib_ai_personas from "../lib/ai/personas.js";
import type * as lib_ai_providers_openrouter from "../lib/ai/providers/openrouter.js";
import type * as lib_ai_providers_types from "../lib/ai/providers/types.js";
import type * as lib_ai_wordCountGuard from "../lib/ai/wordCountGuard.js";
import type * as lib_assignPoemReaders from "../lib/assignPoemReaders.js";
import type * as lib_assignmentMatrix from "../lib/assignmentMatrix.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_canary from "../lib/canary.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_gameRules from "../lib/gameRules.js";
import type * as lib_guestToken from "../lib/guestToken.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_retentionPolicy from "../lib/retentionPolicy.js";
import type * as lib_revealAuthorization from "../lib/revealAuthorization.js";
import type * as lib_room from "../lib/room.js";
import type * as lib_sessionLifecycle from "../lib/sessionLifecycle.js";
import type * as lib_sharing from "../lib/sharing.js";
import type * as lib_wordCount from "../lib/wordCount.js";
import type * as migrations from "../migrations.js";
import type * as poems from "../poems.js";
import type * as presence from "../presence.js";
import type * as rateLimits from "../rateLimits.js";
import type * as retention from "../retention.js";
import type * as rooms from "../rooms.js";
import type * as shares from "../shares.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  abandonment: typeof abandonment;
  ai: typeof ai;
  archive: typeof archive;
  crons: typeof crons;
  errors: typeof errors;
  favorites: typeof favorites;
  game: typeof game;
  guestSessions: typeof guestSessions;
  health: typeof health;
  http: typeof http;
  "lib/abuseRateLimit": typeof lib_abuseRateLimit;
  "lib/ai/fallbackMetrics": typeof lib_ai_fallbackMetrics;
  "lib/ai/fallbacks": typeof lib_ai_fallbacks;
  "lib/ai/llm": typeof lib_ai_llm;
  "lib/ai/personas": typeof lib_ai_personas;
  "lib/ai/providers/openrouter": typeof lib_ai_providers_openrouter;
  "lib/ai/providers/types": typeof lib_ai_providers_types;
  "lib/ai/wordCountGuard": typeof lib_ai_wordCountGuard;
  "lib/assignPoemReaders": typeof lib_assignPoemReaders;
  "lib/assignmentMatrix": typeof lib_assignmentMatrix;
  "lib/auth": typeof lib_auth;
  "lib/canary": typeof lib_canary;
  "lib/env": typeof lib_env;
  "lib/errors": typeof lib_errors;
  "lib/gameRules": typeof lib_gameRules;
  "lib/guestToken": typeof lib_guestToken;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/retentionPolicy": typeof lib_retentionPolicy;
  "lib/revealAuthorization": typeof lib_revealAuthorization;
  "lib/room": typeof lib_room;
  "lib/sessionLifecycle": typeof lib_sessionLifecycle;
  "lib/sharing": typeof lib_sharing;
  "lib/wordCount": typeof lib_wordCount;
  migrations: typeof migrations;
  poems: typeof poems;
  presence: typeof presence;
  rateLimits: typeof rateLimits;
  retention: typeof retention;
  rooms: typeof rooms;
  shares: typeof shares;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
