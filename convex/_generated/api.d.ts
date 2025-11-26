/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as favorites from "../favorites.js";
import type * as game from "../game.js";
import type * as health from "../health.js";
import type * as lib_assignmentMatrix from "../lib/assignmentMatrix.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_guestToken from "../lib/guestToken.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_wordCount from "../lib/wordCount.js";
import type * as migrations from "../migrations.js";
import type * as poems from "../poems.js";
import type * as rooms from "../rooms.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  favorites: typeof favorites;
  game: typeof game;
  health: typeof health;
  "lib/assignmentMatrix": typeof lib_assignmentMatrix;
  "lib/auth": typeof lib_auth;
  "lib/guestToken": typeof lib_guestToken;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/wordCount": typeof lib_wordCount;
  migrations: typeof migrations;
  poems: typeof poems;
  rooms: typeof rooms;
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
