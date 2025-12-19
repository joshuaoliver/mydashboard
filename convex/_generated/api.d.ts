/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiSettings from "../aiSettings.js";
import type * as aiSuggestions from "../aiSuggestions.js";
import type * as auth from "../auth.js";
import type * as beeperActions from "../beeperActions.js";
import type * as beeperActions_improved from "../beeperActions_improved.js";
import type * as beeperClient from "../beeperClient.js";
import type * as beeperMessages from "../beeperMessages.js";
import type * as beeperMutations from "../beeperMutations.js";
import type * as beeperPagination from "../beeperPagination.js";
import type * as beeperQueries from "../beeperQueries.js";
import type * as beeperSync from "../beeperSync.js";
import type * as chatActions from "../chatActions.js";
import type * as cleanupMessages from "../cleanupMessages.js";
import type * as contactDuplicates from "../contactDuplicates.js";
import type * as contactMerge from "../contactMerge.js";
import type * as contactMutations from "../contactMutations.js";
import type * as crons from "../crons.js";
import type * as cursorHelpers from "../cursorHelpers.js";
import type * as dexActions from "../dexActions.js";
import type * as dexAdmin from "../dexAdmin.js";
import type * as dexQueries from "../dexQueries.js";
import type * as dexSync from "../dexSync.js";
import type * as dexUpsert from "../dexUpsert.js";
import type * as dexWriteback from "../dexWriteback.js";
import type * as diagnostics from "../diagnostics.js";
import type * as gmailActions from "../gmailActions.js";
import type * as gmailSync from "../gmailSync.js";
import type * as http from "../http.js";
import type * as httpHelpers from "../httpHelpers.js";
import type * as hubstaffActions from "../hubstaffActions.js";
import type * as hubstaffClient from "../hubstaffClient.js";
import type * as hubstaffSync from "../hubstaffSync.js";
import type * as imageCache from "../imageCache.js";
import type * as linearActions from "../linearActions.js";
import type * as linearClient from "../linearClient.js";
import type * as linearSync from "../linearSync.js";
import type * as locationMutations from "../locationMutations.js";
import type * as locationQueries from "../locationQueries.js";
import type * as messageHelpers from "../messageHelpers.js";
import type * as messageStats from "../messageStats.js";
import type * as myFunctions from "../myFunctions.js";
import type * as projectsStore from "../projectsStore.js";
import type * as prompts from "../prompts.js";
import type * as settingsStore from "../settingsStore.js";
import type * as tagMutations from "../tagMutations.js";
import type * as tagQueries from "../tagQueries.js";
import type * as timezone from "../timezone.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiSettings: typeof aiSettings;
  aiSuggestions: typeof aiSuggestions;
  auth: typeof auth;
  beeperActions: typeof beeperActions;
  beeperActions_improved: typeof beeperActions_improved;
  beeperClient: typeof beeperClient;
  beeperMessages: typeof beeperMessages;
  beeperMutations: typeof beeperMutations;
  beeperPagination: typeof beeperPagination;
  beeperQueries: typeof beeperQueries;
  beeperSync: typeof beeperSync;
  chatActions: typeof chatActions;
  cleanupMessages: typeof cleanupMessages;
  contactDuplicates: typeof contactDuplicates;
  contactMerge: typeof contactMerge;
  contactMutations: typeof contactMutations;
  crons: typeof crons;
  cursorHelpers: typeof cursorHelpers;
  dexActions: typeof dexActions;
  dexAdmin: typeof dexAdmin;
  dexQueries: typeof dexQueries;
  dexSync: typeof dexSync;
  dexUpsert: typeof dexUpsert;
  dexWriteback: typeof dexWriteback;
  diagnostics: typeof diagnostics;
  gmailActions: typeof gmailActions;
  gmailSync: typeof gmailSync;
  http: typeof http;
  httpHelpers: typeof httpHelpers;
  hubstaffActions: typeof hubstaffActions;
  hubstaffClient: typeof hubstaffClient;
  hubstaffSync: typeof hubstaffSync;
  imageCache: typeof imageCache;
  linearActions: typeof linearActions;
  linearClient: typeof linearClient;
  linearSync: typeof linearSync;
  locationMutations: typeof locationMutations;
  locationQueries: typeof locationQueries;
  messageHelpers: typeof messageHelpers;
  messageStats: typeof messageStats;
  myFunctions: typeof myFunctions;
  projectsStore: typeof projectsStore;
  prompts: typeof prompts;
  settingsStore: typeof settingsStore;
  tagMutations: typeof tagMutations;
  tagQueries: typeof tagQueries;
  timezone: typeof timezone;
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
