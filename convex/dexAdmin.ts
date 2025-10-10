import { internalAction, mutation } from "./_generated/server";
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


