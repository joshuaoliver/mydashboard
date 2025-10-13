import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Query cached chats from database
 * Fast, reactive, real-time updates
 * Replaces direct API calls from frontend
 * Includes contact images from DEX integration
 */
export const listCachedChats = query({
  handler: async (ctx) => {
    const chats = await ctx.db
      .query("beeperChats")
      .withIndex("by_activity")
      .order("desc")
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "single"), // Direct messages only
          q.eq(q.field("isArchived"), false) // Not archived
        )
      )
      .take(50);

    // Fetch contact images for chats with Instagram usernames
    const chatsWithContacts = await Promise.all(
      chats.map(async (chat) => {
        let contactImageUrl: string | undefined = undefined;
        
        // If chat has Instagram username, look up contact
        if (chat.username) {
          const contact = await ctx.db
            .query("contacts")
            .withIndex("by_instagram", (q) => q.eq("instagram", chat.username))
            .first();
          
          contactImageUrl = contact?.imageUrl;
        }
        
        return {
          id: chat.chatId,
          roomId: chat.localChatID,
          name: chat.title,
          network: chat.network,
          accountID: chat.accountID,
          username: chat.username, // Instagram handle, etc.
          phoneNumber: chat.phoneNumber, // WhatsApp number, etc.
          lastMessage: chat.lastMessage || "Recent activity",
          lastMessageTime: chat.lastActivity,
          unreadCount: chat.unreadCount,
          lastSyncedAt: chat.lastSyncedAt,
          needsReply: chat.needsReply,
          lastMessageFrom: chat.lastMessageFrom,
          contactImageUrl, // From DEX integration
        };
      })
    );

    return {
      chats: chatsWithContacts,
      lastSync: chats[0]?.lastSyncedAt || null,
      count: chats.length,
    };
  },
});

/**
 * Get detailed info about a specific chat
 */
export const getChatInfo = query({
  args: {},
  handler: async (ctx) => {
    const chats = await ctx.db
      .query("beeperChats")
      .withIndex("by_activity")
      .order("desc")
      .take(1);

    const latestChat = chats[0];

    if (!latestChat) {
      return {
        lastSyncedAt: null,
        chatCount: 0,
        syncSource: null,
      };
    }

    const totalCount = await ctx.db
      .query("beeperChats")
      .collect()
      .then((c) => c.length);

    return {
      lastSyncedAt: latestChat.lastSyncedAt,
      chatCount: totalCount,
      syncSource: latestChat.syncSource,
    };
  },
});

/**
 * Get cached messages for a specific chat
 * Fast, reactive, no API call needed!
 */
export const getCachedMessages = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    console.log(`[getCachedMessages] Querying for chatId: ${args.chatId}`);
    
    // Query with compound index - filters by chatId and sorts by timestamp
    const messages = await ctx.db
      .query("beeperMessages")
      .withIndex("by_chat", (q) => 
        q.eq("chatId", args.chatId)
      )
      .collect();

    console.log(`[getCachedMessages] Found ${messages.length} messages for chatId: ${args.chatId}`);
    console.log(`[getCachedMessages] Sample chatIds in results:`, messages.slice(0, 3).map(m => m.chatId));

    // Sort by timestamp manually (oldest to newest)
    const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);

    return {
      messages: sortedMessages.map((msg) => ({
        id: msg.messageId,
        text: msg.text,
        timestamp: msg.timestamp,
        sender: msg.senderId,
        senderName: msg.senderName,
        isFromUser: msg.isFromUser,
      })),
    };
  },
});

/**
 * Search chats by username (Instagram handle, etc.)
 */
export const searchByUsername = query({
  args: {},
  handler: async (ctx) => {
    // Example: Find all Instagram chats
    const instagramChats = await ctx.db
      .query("beeperChats")
      .withIndex("by_network", (q) => q.eq("network", "Instagram"))
      .filter((q) => q.neq(q.field("username"), undefined))
      .collect();

    return {
      chats: instagramChats.map((chat) => ({
        name: chat.title,
        username: chat.username,
        network: chat.network,
        lastActivity: chat.lastActivity,
      })),
    };
  },
});

/**
 * Diagnostic query to check message distribution across chats
 */
export const debugMessageDistribution = query({
  args: {},
  handler: async (ctx) => {
    // Get all messages
    const allMessages = await ctx.db
      .query("beeperMessages")
      .collect();

    // Group by chatId
    const distribution: Record<string, number> = {};
    for (const msg of allMessages) {
      distribution[msg.chatId] = (distribution[msg.chatId] || 0) + 1;
    }

    // Get chat names for each chatId
    const chatDetails: Record<string, { name: string; count: number }> = {};
    for (const chatId of Object.keys(distribution)) {
      const chat = await ctx.db
        .query("beeperChats")
        .withIndex("by_chat_id", (q) => q.eq("chatId", chatId))
        .first();
      
      chatDetails[chatId] = {
        name: chat?.title || "Unknown",
        count: distribution[chatId],
      };
    }

    return {
      totalMessages: allMessages.length,
      uniqueChats: Object.keys(distribution).length,
      distribution: chatDetails,
    };
  },
});

