import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Cursor Helper Functions
 * 
 * Manages cursor-based pagination state for Beeper sync operations.
 * Tracks boundaries of our data windows to prevent gaps and enable
 * incremental syncing.
 */

/**
 * Get the global chat list sync state
 * Returns the cursor boundaries for the chat list
 */
export const getChatListSync = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("chatListSync")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();
  },
});

/**
 * Update or create the global chat list sync state
 * Stores cursor boundaries after each chat list sync
 */
export const updateChatListSync = internalMutation({
  args: {
    newestCursor: v.optional(v.string()),
    oldestCursor: v.optional(v.string()),
    syncSource: v.string(),
    totalChats: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chatListSync")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();

    const data = {
      key: "global",
      newestCursor: args.newestCursor,
      oldestCursor: args.oldestCursor,
      lastSyncedAt: Date.now(),
      syncSource: args.syncSource,
      totalChats: args.totalChats,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      console.log(
        `[Cursor] Updated chat list sync: ` +
        `newest=${args.newestCursor?.slice(0, 13)}..., ` +
        `oldest=${args.oldestCursor?.slice(0, 13)}..., ` +
        `total=${args.totalChats}`
      );
    } else {
      await ctx.db.insert("chatListSync", data);
      console.log(
        `[Cursor] Created chat list sync state: ` +
        `newest=${args.newestCursor?.slice(0, 13)}..., ` +
        `oldest=${args.oldestCursor?.slice(0, 13)}...`
      );
    }
  },
});

/**
 * Update message cursor boundaries for a specific chat
 * Called after syncing messages to track our message window
 */
export const updateChatMessageCursors = internalMutation({
  args: {
    chatDocId: v.id("beeperChats"),
    newestMessageSortKey: v.optional(v.string()),
    oldestMessageSortKey: v.optional(v.string()),
    messageCount: v.optional(v.number()),
    hasCompleteHistory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    
    if (args.newestMessageSortKey !== undefined) {
      updates.newestMessageSortKey = args.newestMessageSortKey;
    }
    if (args.oldestMessageSortKey !== undefined) {
      updates.oldestMessageSortKey = args.oldestMessageSortKey;
    }
    if (args.messageCount !== undefined) {
      updates.messageCount = args.messageCount;
    }
    if (args.hasCompleteHistory !== undefined) {
      updates.hasCompleteHistory = args.hasCompleteHistory;
      if (args.hasCompleteHistory) {
        updates.lastFullSyncAt = Date.now();
      }
    }
    
    await ctx.db.patch(args.chatDocId, updates);
    
    console.log(
      `[Cursor] Updated message cursors for chat: ` +
      `newest=${args.newestMessageSortKey?.slice(0, 10)}..., ` +
      `oldest=${args.oldestMessageSortKey?.slice(0, 10)}..., ` +
      `count=${args.messageCount}, ` +
      `complete=${args.hasCompleteHistory}`
    );
  },
});

/**
 * Get the latest chat activity timestamp from database
 * Used as fallback if no stored cursor exists
 */
export const getLatestChatActivity = internalQuery({
  args: {},
  handler: async (ctx) => {
    const latestChat = await ctx.db
      .query("beeperChats")
      .withIndex("by_activity")
      .order("desc")
      .first();
    
    if (latestChat) {
      return {
        lastActivity: latestChat.lastActivity,
        chatId: latestChat.chatId,
      };
    }
    
    return null;
  },
});

/**
 * Reset all cursor state - clears sync boundaries
 * Used when wanting to force a full re-sync
 */
export const resetAllCursors = mutation({
  args: {},
  handler: async (ctx) => {
    // Reset chat list sync state
    const syncState = await ctx.db
      .query("chatListSync")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();
    
    if (syncState) {
      await ctx.db.patch(syncState._id, {
        newestCursor: undefined,
        oldestCursor: undefined,
        totalChats: 0,
        lastSyncedAt: Date.now(),
        syncSource: "cursor_reset",
      });
    }
    
    // Reset message cursors on all chats
    const allChats = await ctx.db.query("beeperChats").collect();
    let chatsReset = 0;
    
    for (const chat of allChats) {
      await ctx.db.patch(chat._id, {
        newestMessageSortKey: undefined,
        oldestMessageSortKey: undefined,
        messageCount: undefined,
        hasCompleteHistory: undefined,
        lastFullSyncAt: undefined,
        lastMessagesSyncedAt: undefined,
      });
      chatsReset++;
    }
    
    console.log(`[Reset Cursors] Reset sync state and ${chatsReset} chat cursors`);
    
    return {
      success: true,
      chatsReset,
      timestamp: Date.now(),
    };
  },
});

/**
 * Get sync diagnostics for the settings UI
 * Shows cursor boundaries and sync health
 */
export const getSyncDiagnostics = query({
  args: {},
  handler: async (ctx) => {
    // Get chat list sync state
    const syncState = await ctx.db
      .query("chatListSync")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();
    
    // Count chats and messages
    const allChats = await ctx.db.query("beeperChats").collect();
    const allMessages = await ctx.db.query("beeperMessages").collect();
    
    // Count chats with message cursors
    const chatsWithCursors = allChats.filter(
      (chat) => chat.newestMessageSortKey !== undefined
    ).length;
    
    // Count chats with complete history
    const chatsWithCompleteHistory = allChats.filter(
      (chat) => chat.hasCompleteHistory === true
    ).length;
    
    // Find oldest and newest messages synced
    let oldestMessageTime: number | null = null;
    let newestMessageTime: number | null = null;
    
    for (const msg of allMessages) {
      if (oldestMessageTime === null || msg.timestamp < oldestMessageTime) {
        oldestMessageTime = msg.timestamp;
      }
      if (newestMessageTime === null || msg.timestamp > newestMessageTime) {
        newestMessageTime = msg.timestamp;
      }
    }
    
    return {
      chatListSync: syncState ? {
        newestCursor: syncState.newestCursor ? `${syncState.newestCursor.slice(0, 20)}...` : null,
        oldestCursor: syncState.oldestCursor ? `${syncState.oldestCursor.slice(0, 20)}...` : null,
        totalChats: syncState.totalChats,
        lastSyncedAt: syncState.lastSyncedAt,
        syncSource: syncState.syncSource,
      } : null,
      stats: {
        totalChats: allChats.length,
        totalMessages: allMessages.length,
        chatsWithCursors,
        chatsWithCompleteHistory,
        oldestMessageTime,
        newestMessageTime,
      },
    };
  },
});

/**
 * Check if we might have gaps in our data
 * Diagnostic function to detect potential issues
 */
export const detectGaps = query({
  args: {},
  handler: async (ctx) => {
    // Check chat list sync state
    const syncState = await ctx.db
      .query("chatListSync")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();
    
    // Count chats in database
    const chats = await ctx.db.query("beeperChats").collect();
    const chatCount = chats.length;
    
    const issues: string[] = [];
    
    // Check for missing cursors
    if (chatCount > 0 && !syncState) {
      issues.push("Have chats but no sync state - potential gap");
    }
    
    if (syncState && chatCount > 0) {
      if (!syncState.newestCursor) {
        issues.push("Missing newestCursor - may miss new chats");
      }
      if (!syncState.oldestCursor) {
        issues.push("Missing oldestCursor - may miss old chats");
      }
      if (syncState.totalChats !== chatCount) {
        issues.push(
          `Sync state shows ${syncState.totalChats} chats but database has ${chatCount} - possible gap`
        );
      }
    }
    
    // Check per-chat message cursors
    const chatsWithoutCursors = chats.filter(
      (chat) => 
        chat.messageCount && 
        chat.messageCount > 0 && 
        !chat.newestMessageSortKey
    );
    
    if (chatsWithoutCursors.length > 0) {
      issues.push(
        `${chatsWithoutCursors.length} chats have messages but no cursor tracking`
      );
    }
    
    return {
      hasIssues: issues.length > 0,
      issues,
      syncState: syncState ? {
        newestCursor: syncState.newestCursor?.slice(0, 20) + "...",
        oldestCursor: syncState.oldestCursor?.slice(0, 20) + "...",
        totalChats: syncState.totalChats,
        lastSyncedAt: new Date(syncState.lastSyncedAt).toISOString(),
      } : null,
      databaseChatCount: chatCount,
    };
  },
});

