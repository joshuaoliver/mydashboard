import { query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

/**
 * Query cached chats from database with Convex pagination
 * Fast, reactive, real-time updates
 * Replaces direct API calls from frontend
 * Includes contact images from DEX integration
 * Uses built-in Convex pagination for smooth infinite scroll
 */
export const listCachedChats = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // Query chats with pagination
    const result = await ctx.db
      .query("beeperChats")
      .withIndex("by_activity")
      .order("desc")
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "single"), // Direct messages only
          q.eq(q.field("isArchived"), false) // Not archived
        )
      )
      .paginate(args.paginationOpts);

    // Fetch contact images and names for chats with Instagram usernames
    const pageWithContacts = await Promise.all(
      result.page.map(async (chat) => {
        let contactImageUrl: string | undefined = undefined;
        let contactName: string | undefined = undefined;
        let contact = null;
        
        // Match contact by Instagram username
        if (chat.username) {
          contact = await ctx.db
            .query("contacts")
            .withIndex("by_instagram", (q) => q.eq("instagram", chat.username))
            .first();
        }
        
        // Match contact by WhatsApp phone number (if Instagram didn't match)
        if (!contact && chat.phoneNumber) {
          // Try whatsapp field first
          contact = await ctx.db
            .query("contacts")
            .withIndex("by_whatsapp", (q) => q.eq("whatsapp", chat.phoneNumber))
            .first();
          
          // If not found, search in phones array
          if (!contact) {
            const normalizePhone = (phone: string) => phone.replace(/[\s\-\(\)]/g, '');
            const searchPhone = normalizePhone(chat.phoneNumber);
            
            const allContactsWithPhones = await ctx.db
              .query("contacts")
              .filter((q) => q.neq(q.field("phones"), undefined))
              .collect();

            contact = allContactsWithPhones.find((c) => {
              if (!c.phones) return false;
              return c.phones.some((p) => normalizePhone(p.phone) === searchPhone);
            }) || null;
          }
        }
        
        // Extract contact data if found
        if (contact) {
          contactImageUrl = contact.imageUrl;
          const nameParts = [contact.firstName, contact.lastName].filter(Boolean);
          if (nameParts.length > 0) {
            contactName = nameParts.join(" ");
          }
        }
        
        return {
          id: chat.chatId,
          roomId: chat.localChatID,
          name: contactName || chat.title, // Use contact name from Dex if available, otherwise fall back to Beeper title
          network: chat.network,
          accountID: chat.accountID,
          type: chat.type, // 'single' or 'group'
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

    // Return paginated result with transformed data
    return {
      ...result,
      page: pageWithContacts,
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
 * Get a specific chat by ID
 */
export const getChatById = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();

    return chat;
  },
});

/**
 * Get cached messages for a specific chat with Convex pagination
 * Fast, reactive, no API call needed!
 * Loads recent messages first, then older messages as user scrolls up
 */
export const getCachedMessages = query({
  args: { 
    chatId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    console.log(`[getCachedMessages] Querying for chatId: ${args.chatId}`);
    
    // Query with compound index - filters by chatId and sorts by timestamp (DESC to get newest first)
    const result = await ctx.db
      .query("beeperMessages")
      .withIndex("by_chat", (q) => 
        q.eq("chatId", args.chatId)
      )
      .order("desc") // Newest first for pagination
      .paginate(args.paginationOpts);

    console.log(`[getCachedMessages] Found ${result.page.length} messages for chatId: ${args.chatId}`);

    // Transform messages (page is already sorted newest-first from query)
    const transformedPage = result.page.map((msg) => ({
      id: msg.messageId,
      text: msg.text,
      timestamp: msg.timestamp,
      sender: msg.senderId,
      senderName: msg.senderName,
      isFromUser: msg.isFromUser,
      attachments: msg.attachments,
    }));

    // Return with page in reverse order (oldest-first) for display
    return {
      ...result,
      page: transformedPage.reverse(),
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

