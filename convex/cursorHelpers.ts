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
 * Try to acquire a sync lock
 * Returns true if lock was acquired, false if already locked
 * Lock expires after 60 seconds to prevent deadlocks
 */
export const tryAcquireSyncLock = internalMutation({
  args: {
    syncId: v.string(), // Unique ID for this sync instance
  },
  handler: async (ctx, args) => {
    const LOCK_EXPIRY_MS = 60 * 1000; // 60 seconds
    const now = Date.now();
    
    const syncState = await ctx.db
      .query("chatListSync")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();
    
    // Check if there's an active lock
    if (syncState?.syncLockId && syncState?.syncLockAt) {
      const lockAge = now - syncState.syncLockAt;
      if (lockAge < LOCK_EXPIRY_MS) {
        // Lock is still valid - another sync is running
        console.log(
          `[Sync Lock] Lock held by ${syncState.syncLockId.slice(0, 8)}... ` +
          `(${Math.round(lockAge / 1000)}s old) - rejecting ${args.syncId.slice(0, 8)}...`
        );
        return false;
      }
      // Lock expired - can be taken over
      console.log(
        `[Sync Lock] Expired lock from ${syncState.syncLockId.slice(0, 8)}... ` +
        `- acquiring for ${args.syncId.slice(0, 8)}...`
      );
    }
    
    // Acquire the lock
    if (syncState) {
      await ctx.db.patch(syncState._id, {
        syncLockId: args.syncId,
        syncLockAt: now,
      });
    } else {
      await ctx.db.insert("chatListSync", {
        key: "global",
        syncLockId: args.syncId,
        syncLockAt: now,
        lastSyncedAt: now,
        syncSource: "lock_init",
        totalChats: 0,
      });
    }
    
    console.log(`[Sync Lock] Acquired by ${args.syncId.slice(0, 8)}...`);
    return true;
  },
});

/**
 * Release the sync lock
 * Only releases if the lock is held by the given syncId
 */
export const releaseSyncLock = internalMutation({
  args: {
    syncId: v.string(),
  },
  handler: async (ctx, args) => {
    const syncState = await ctx.db
      .query("chatListSync")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();
    
    if (!syncState) return;
    
    // Only release if we hold the lock
    if (syncState.syncLockId === args.syncId) {
      await ctx.db.patch(syncState._id, {
        syncLockId: undefined,
        syncLockAt: undefined,
      });
      console.log(`[Sync Lock] Released by ${args.syncId.slice(0, 8)}...`);
    }
  },
});

/**
 * Update or create the global chat list sync state
 * Stores cursor boundaries after each chat list sync
 * 
 * SMART UPDATE: Only updates fields that are provided.
 * If newestCursor or oldestCursor is omitted, the existing value is preserved.
 * Also automatically calculates totalChats from database if not provided.
 */
export const updateChatListSync = internalMutation({
  args: {
    newestCursor: v.optional(v.string()),
    oldestCursor: v.optional(v.string()),
    syncSource: v.string(),
    totalChats: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chatListSync")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();

    // Calculate total count if not provided
    let totalChats = args.totalChats;
    if (totalChats === undefined) {
      const allChats = await ctx.db.query("beeperChats").collect();
      totalChats = allChats.length;
    }

    const data: any = {
      key: "global",
      lastSyncedAt: Date.now(),
      syncSource: args.syncSource,
      totalChats: totalChats,
    };

    // Helper to compare cursors - uses numeric comparison if both are numeric,
    // otherwise falls back to string comparison
    const compareCursors = (a: string, b: string): number => {
      const aNum = Number(a);
      const bNum = Number(b);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum; // Numeric comparison (handles different length numbers)
      }
      return a.localeCompare(b); // Lexicographic fallback
    };

    // ONLY update cursors if they are explicitly provided AND better than existing
    // This prevents accidental overwriting with undefined/null or shrinking the window
    if (args.newestCursor !== undefined) {
      if (!existing?.newestCursor || compareCursors(args.newestCursor, existing.newestCursor) > 0) {
        data.newestCursor = args.newestCursor;
      }
    }
    if (args.oldestCursor !== undefined) {
      if (!existing?.oldestCursor || compareCursors(args.oldestCursor, existing.oldestCursor) < 0) {
        data.oldestCursor = args.oldestCursor;
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, data);
      console.log(
        `[Cursor] Updated chat list sync: ` +
        `newest=${(args.newestCursor || existing.newestCursor)?.slice(0, 13)}..., ` +
        `oldest=${(args.oldestCursor || existing.oldestCursor)?.slice(0, 13)}..., ` +
        `total=${totalChats}`
      );
    } else {
      await ctx.db.insert("chatListSync", data);
      console.log(
        `[Cursor] Created chat list sync state: ` +
        `newest=${args.newestCursor?.slice(0, 13)}..., ` +
        `oldest=${args.oldestCursor?.slice(0, 13)}..., ` +
        `total=${totalChats}`
      );
    }
  },
});

/**
 * Update message cursor boundaries for a specific chat
 * Called after syncing messages to track our message window
 * 
 * SMART UPDATE: Only updates fields that are provided.
 * Automatically recalculates messageCount from database if any sync occurred.
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
    const chat = await ctx.db.get(args.chatDocId);
    if (!chat) {
      console.warn(`[Cursor] Cannot update message cursors: Chat ${args.chatDocId} not found`);
      return;
    }

    const updates: any = {};
    
    // Helper to compare sortKeys - uses numeric comparison if both are numeric,
    // otherwise falls back to lexicographic (localeCompare)
    const compareSortKeys = (a: string, b: string): number => {
      const aNum = Number(a);
      const bNum = Number(b);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum; // Numeric comparison
      }
      return a.localeCompare(b); // Lexicographic fallback
    };

    if (args.newestMessageSortKey !== undefined) {
      if (!chat.newestMessageSortKey || compareSortKeys(args.newestMessageSortKey, chat.newestMessageSortKey) > 0) {
        updates.newestMessageSortKey = args.newestMessageSortKey;
      }
    }
    if (args.oldestMessageSortKey !== undefined) {
      if (!chat.oldestMessageSortKey || compareSortKeys(args.oldestMessageSortKey, chat.oldestMessageSortKey) < 0) {
        updates.oldestMessageSortKey = args.oldestMessageSortKey;
      }
    }
    
    // If ANY message sync activity happened (indicated by messageCount or keys being passed)
    // recalculate the total message count for this chat from the database
    if (args.messageCount !== undefined || args.newestMessageSortKey !== undefined || args.oldestMessageSortKey !== undefined) {
      const allMessages = await ctx.db
        .query("beeperMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat.chatId))
        .collect();
      updates.messageCount = allMessages.length;
    }
    
    if (args.hasCompleteHistory !== undefined) {
      updates.hasCompleteHistory = args.hasCompleteHistory;
      if (args.hasCompleteHistory) {
        updates.lastFullSyncAt = Date.now();
      }
    }
    
    await ctx.db.patch(args.chatDocId, updates);
    
    console.log(
      `[Cursor] Updated message cursors for chat ${chat.title}: ` +
      `newest=${(args.newestMessageSortKey || chat.newestMessageSortKey)?.slice(0, 10)}..., ` +
      `oldest=${(args.oldestMessageSortKey || chat.oldestMessageSortKey)?.slice(0, 10)}..., ` +
      `count=${updates.messageCount || chat.messageCount}, ` +
      `complete=${args.hasCompleteHistory ?? chat.hasCompleteHistory}`
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

