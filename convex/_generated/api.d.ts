/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiSuggestions from "../aiSuggestions.js";
import type * as auth from "../auth.js";
import type * as beeperActions from "../beeperActions.js";
import type * as beeperActions_improved from "../beeperActions_improved.js";
import type * as beeperFullSync from "../beeperFullSync.js";
import type * as beeperGlobalSync from "../beeperGlobalSync.js";
import type * as beeperMessages from "../beeperMessages.js";
import type * as beeperMutations from "../beeperMutations.js";
import type * as beeperQueries from "../beeperQueries.js";
import type * as beeperSync from "../beeperSync.js";
import type * as chatActions from "../chatActions.js";
import type * as cleanupMessages from "../cleanupMessages.js";
import type * as contactDuplicates from "../contactDuplicates.js";
import type * as contactMerge from "../contactMerge.js";
import type * as contactMutations from "../contactMutations.js";
import type * as crons from "../crons.js";
import type * as dexActions from "../dexActions.js";
import type * as dexAdmin from "../dexAdmin.js";
import type * as dexQueries from "../dexQueries.js";
import type * as dexSync from "../dexSync.js";
import type * as dexUpsert from "../dexUpsert.js";
import type * as dexWriteback from "../dexWriteback.js";
import type * as diagnostics from "../diagnostics.js";
import type * as http from "../http.js";
import type * as locationMutations from "../locationMutations.js";
import type * as locationQueries from "../locationQueries.js";
import type * as myFunctions from "../myFunctions.js";
import type * as prompts from "../prompts.js";
import type * as tagMutations from "../tagMutations.js";
import type * as tagQueries from "../tagQueries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  aiSuggestions: typeof aiSuggestions;
  auth: typeof auth;
  beeperActions: typeof beeperActions;
  beeperActions_improved: typeof beeperActions_improved;
  beeperFullSync: typeof beeperFullSync;
  beeperGlobalSync: typeof beeperGlobalSync;
  beeperMessages: typeof beeperMessages;
  beeperMutations: typeof beeperMutations;
  beeperQueries: typeof beeperQueries;
  beeperSync: typeof beeperSync;
  chatActions: typeof chatActions;
  cleanupMessages: typeof cleanupMessages;
  contactDuplicates: typeof contactDuplicates;
  contactMerge: typeof contactMerge;
  contactMutations: typeof contactMutations;
  crons: typeof crons;
  dexActions: typeof dexActions;
  dexAdmin: typeof dexAdmin;
  dexQueries: typeof dexQueries;
  dexSync: typeof dexSync;
  dexUpsert: typeof dexUpsert;
  dexWriteback: typeof dexWriteback;
  diagnostics: typeof diagnostics;
  http: typeof http;
  locationMutations: typeof locationMutations;
  locationQueries: typeof locationQueries;
  myFunctions: typeof myFunctions;
  prompts: typeof prompts;
  tagMutations: typeof tagMutations;
  tagQueries: typeof tagQueries;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
