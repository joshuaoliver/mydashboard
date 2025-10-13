/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as aiSuggestions from "../aiSuggestions.js";
import type * as auth from "../auth.js";
import type * as beeperActions from "../beeperActions.js";
import type * as beeperActions_improved from "../beeperActions_improved.js";
import type * as beeperMutations from "../beeperMutations.js";
import type * as beeperQueries from "../beeperQueries.js";
import type * as beeperSync from "../beeperSync.js";
import type * as cleanupMessages from "../cleanupMessages.js";
import type * as contactMutations from "../contactMutations.js";
import type * as crons from "../crons.js";
import type * as dexActions from "../dexActions.js";
import type * as dexAdmin from "../dexAdmin.js";
import type * as dexQueries from "../dexQueries.js";
import type * as dexSync from "../dexSync.js";
import type * as dexUpsert from "../dexUpsert.js";
import type * as dexWriteback from "../dexWriteback.js";
import type * as diagnostics from "../diagnostics.js";
import type * as myFunctions from "../myFunctions.js";
import type * as prompts from "../prompts.js";

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
  beeperMutations: typeof beeperMutations;
  beeperQueries: typeof beeperQueries;
  beeperSync: typeof beeperSync;
  cleanupMessages: typeof cleanupMessages;
  contactMutations: typeof contactMutations;
  crons: typeof crons;
  dexActions: typeof dexActions;
  dexAdmin: typeof dexAdmin;
  dexQueries: typeof dexQueries;
  dexSync: typeof dexSync;
  dexUpsert: typeof dexUpsert;
  dexWriteback: typeof dexWriteback;
  diagnostics: typeof diagnostics;
  myFunctions: typeof myFunctions;
  prompts: typeof prompts;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
