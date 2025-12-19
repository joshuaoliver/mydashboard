import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createBeeperClient } from "./beeperClient";

/**
 * Archive a chat (public action)
 * Archives in both local database AND Beeper
 */
export const archiveChat = action({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; beeperSynced: boolean; error?: string }> => {
    // First, update local database
    await ctx.runMutation(internal.beeperMutations.toggleArchiveChat, {
      chatId: args.chatId,
      isArchived: true,
    });
    
    // Then, try to archive in Beeper as well
    let beeperSynced = false;
    try {
      const client = createBeeperClient();
      await client.chats.archive(args.chatId, { archived: true });
      beeperSynced = true;
      console.log(`[archiveChat] ✅ Archived chat ${args.chatId} in Beeper`);
    } catch (err) {
      // Log but don't fail - local archive still succeeded
      console.warn(`[archiveChat] ⚠️ Failed to archive in Beeper (local still archived):`, err);
    }
    
    return { success: true, beeperSynced };
  },
});

/**
 * Unarchive a chat (public action)
 * Unarchives in both local database AND Beeper
 */
export const unarchiveChat = action({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; beeperSynced: boolean; error?: string }> => {
    // First, update local database
    await ctx.runMutation(internal.beeperMutations.toggleArchiveChat, {
      chatId: args.chatId,
      isArchived: false,
    });
    
    // Then, try to unarchive in Beeper as well
    let beeperSynced = false;
    try {
      const client = createBeeperClient();
      await client.chats.archive(args.chatId, { archived: false });
      beeperSynced = true;
      console.log(`[unarchiveChat] ✅ Unarchived chat ${args.chatId} in Beeper`);
    } catch (err) {
      // Log but don't fail - local unarchive still succeeded
      console.warn(`[unarchiveChat] ⚠️ Failed to unarchive in Beeper (local still unarchived):`, err);
    }
    
    return { success: true, beeperSynced };
  },
});

/**
 * Mark a chat as read (public action)
 * Sets the unread count to 0
 */
export const markChatAsRead = action({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.beeperMutations.markChatAsRead, {
      chatId: args.chatId,
    });
    
    return { success: true };
  },
});

/**
 * Mark a chat as unread (public action)
 * Sets the unread count to 1
 */
export const markChatAsUnread = action({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.beeperMutations.markChatAsUnread, {
      chatId: args.chatId,
    });
    
    return { success: true };
  },
});

