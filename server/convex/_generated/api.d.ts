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
import type * as amenities from "../amenities.js";
import type * as auditLogs from "../auditLogs.js";
import type * as bookings from "../bookings.js";
import type * as complaints from "../complaints.js";
import type * as files from "../files.js";
import type * as hostels from "../hostels.js";
import type * as http from "../http.js";
import type * as lib_applySort from "../lib/applySort.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_secureFunction from "../lib/secureFunction.js";
import type * as lib_toApiDoc from "../lib/toApiDoc.js";
import type * as lib_toApiRow from "../lib/toApiRow.js";
import type * as lib_whereMatch from "../lib/whereMatch.js";
import type * as notifications from "../notifications.js";
import type * as reviews from "../reviews.js";
import type * as rooms from "../rooms.js";
import type * as schools from "../schools.js";
import type * as sessions from "../sessions.js";
import type * as settings from "../settings.js";
import type * as stats from "../stats.js";
import type * as tours from "../tours.js";
import type * as users from "../users.js";
import type * as verifications from "../verifications.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  amenities: typeof amenities;
  auditLogs: typeof auditLogs;
  bookings: typeof bookings;
  complaints: typeof complaints;
  files: typeof files;
  hostels: typeof hostels;
  http: typeof http;
  "lib/applySort": typeof lib_applySort;
  "lib/audit": typeof lib_audit;
  "lib/notify": typeof lib_notify;
  "lib/secureFunction": typeof lib_secureFunction;
  "lib/toApiDoc": typeof lib_toApiDoc;
  "lib/toApiRow": typeof lib_toApiRow;
  "lib/whereMatch": typeof lib_whereMatch;
  notifications: typeof notifications;
  reviews: typeof reviews;
  rooms: typeof rooms;
  schools: typeof schools;
  sessions: typeof sessions;
  settings: typeof settings;
  stats: typeof stats;
  tours: typeof tours;
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
