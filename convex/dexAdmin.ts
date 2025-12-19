import { internalAction, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Action to kick off a full sync from Dex, split to avoid circular refs
 */
export const startDexSync = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runAction(internal.dexSync.syncContactsFromDex, {});
    return { started: true };
  },
});

/**
 * Public mutation to schedule an immediate sync
 */
export const triggerManualSync = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.dexSync.syncContactsFromDex, {});
    return { success: true };
  },
});

/**
 * Force resync all contacts - bypasses "unchanged" check
 * Useful when phone normalization logic changes and we need to re-process all
 */
export const forceResyncAllContacts = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.dexSync.syncContactsFromDexForced, {});
    return { success: true };
  },
});


