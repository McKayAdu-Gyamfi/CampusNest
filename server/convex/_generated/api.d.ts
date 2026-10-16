/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as lib_applySort from "../lib/applySort.js";
import type * as lib_secureFunction from "../lib/secureFunction.js";
import type * as lib_toApiDoc from "../lib/toApiDoc.js";
import type * as lib_toApiRow from "../lib/toApiRow.js";
import type * as lib_whereMatch from "../lib/whereMatch.js";
import type * as sessions from "../sessions.js";
import type * as users from "../users.js";
import type * as verifications from "../verifications.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  "lib/applySort": typeof lib_applySort;
  "lib/secureFunction": typeof lib_secureFunction;
  "lib/toApiDoc": typeof lib_toApiDoc;
  "lib/toApiRow": typeof lib_toApiRow;
  "lib/whereMatch": typeof lib_whereMatch;
  sessions: typeof sessions;
  users: typeof users;
  verifications: typeof verifications;
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
