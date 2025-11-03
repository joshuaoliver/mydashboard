import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Archive a chat (public action)
 * Removes chat from main list without deleting it
 */
export const archiveChat = action({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.beeperMutations.toggleArchiveChat, {
      chatId: args.chatId,
      isArchived: true,
    });
    
    return { success: true };
  },
});

/**
 * Unarchive a chat (public action)
 * Returns chat to main list
 */
export const unarchiveChat = action({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.beeperMutations.toggleArchiveChat, {
      chatId: args.chatId,
      isArchived: false,
    });
    
    return { success: true };
  },
});

