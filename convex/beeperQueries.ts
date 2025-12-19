import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { extractMessageText } from "./messageHelpers";

/**
 * Query cached chats from database with Convex pagination
 * Fast, reactive, real-time updates
 * Replaces direct API calls from frontend
 * 
 * PERFORMANCE OPTIMIZED:
 * - Uses compound index for type+isArchived+lastActivity (filter AND sort in DB)
 * - Uses pre-computed contactId from sync time (no N+1 queries)
 * - Batches contact lookups for matched chats
 * - Batches cached image lookups
 */
export const listCachedChats = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filter: v.optional(v.union(
      v.literal("unreplied"),
      v.literal("unread"),
      v.literal("all"),
      v.literal("archived")
    )),
  },
  handler: async (ctx, args) => {
    const filter = args.filter || "all";
    
    // Use compound index for type+isArchived+lastActivity (filter AND sort in database)
    // The index "by_type_archived_activity" has fields: ["type", "isArchived", "lastActivity"]
    // This allows us to filter by type/isArchived and sort by lastActivity in a single index scan
    let queryBuilder;
    
    if (filter === "archived") {
      // Use compound index for type=single, isArchived=true, sorted by lastActivity DESC
      queryBuilder = ctx.db
        .query("beeperChats")
        .withIndex("by_type_archived_activity", (q) => 
          q.eq("type", "single").eq("isArchived", true)
        )
        .order("desc"); // Sort by lastActivity (last field in index) descending
    } else {
      // All other filters: type=single, isArchived=false, sorted by lastActivity DESC
      queryBuilder = ctx.db
        .query("beeperChats")
        .withIndex("by_type_archived_activity", (q) => 
          q.eq("type", "single").eq("isArchived", false)
        )
        .order("desc"); // Sort by lastActivity (last field in index) descending
    }
    
    // Apply additional filters for unreplied/unread (post-filter on indexed results)
    if (filter === "unreplied") {
      queryBuilder = queryBuilder.filter((q) =>
        q.eq(q.field("needsReply"), true)
      );
    } else if (filter === "unread") {
      queryBuilder = queryBuilder.filter((q) =>
        q.gt(q.field("unreadCount"), 0)
      );
    }
    
    // Paginate - results are already sorted by lastActivity DESC from the database
    const result = await queryBuilder.paginate(args.paginationOpts);
    
    // No in-memory sort needed - database returns results in correct order
    const sortedPage = result.page;

    // Batch fetch all contacts for chats that have a pre-computed contactId
    // This is O(1) per contact lookup (using direct get by ID)
    const contactIds = sortedPage
      .map(chat => chat.contactId)
      .filter((id): id is NonNullable<typeof id> => id !== undefined);
    
    // Fetch all contacts in parallel (much faster than sequential)
    const contacts = await Promise.all(
      contactIds.map(id => ctx.db.get(id))
    );
    
    // Build a map for O(1) lookup
    const contactMap = new Map(
      contacts
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map(c => [c._id, c])
    );

    // Batch fetch cached images for chats with participantImgURL
    const imageUrls = sortedPage
      .map(chat => chat.participantImgURL)
      .filter((url): url is string => url !== undefined);
    
    // Fetch all cached images in parallel
    const cachedImages = await Promise.all(
      imageUrls.map(url => 
        ctx.db
          .query("cachedImages")
          .withIndex("by_source_url", (q) => q.eq("sourceUrl", url))
          .first()
      )
    );
    
    // Build a map for O(1) lookup
    const imageMap = new Map(
      cachedImages
        .filter((img): img is NonNullable<typeof img> => img !== null)
        .map(img => [img.sourceUrl, img.convexUrl])
    );

    // Transform chats with pre-fetched data (no additional queries!)
    const pageWithContacts = sortedPage.map((chat) => {
      // Get contact from pre-fetched map
      const contact = chat.contactId ? contactMap.get(chat.contactId) : undefined;
      
      // Extract contact data if found
      let contactImageUrl: string | undefined = undefined;
      let contactName: string | undefined = undefined;
      
      if (contact) {
        contactImageUrl = contact.imageUrl;
        const nameParts = [contact.firstName, contact.lastName].filter(Boolean);
        if (nameParts.length > 0) {
          contactName = nameParts.join(" ");
        }
      }
      
      // Profile image priority:
      // 1. Cached image from cachedImages table (file:// URLs cached to Convex)
      // 2. Dex contact image (synced from CRM)
      // 3. undefined (will show initials fallback)
      let profileImageUrl: string | undefined = undefined;
      
      if (chat.participantImgURL) {
        profileImageUrl = imageMap.get(chat.participantImgURL);
      }
      
      // Fall back to Dex contact image if no Beeper cache
      if (!profileImageUrl) {
        profileImageUrl = contactImageUrl;
      }
      
      return {
        id: chat.chatId,
        roomId: chat.localChatID,
        name: contactName || chat.participantFullName || chat.title, // Priority: Dex contact > Beeper participant > raw title
        network: chat.network,
        accountID: chat.accountID,
        type: chat.type,
        username: chat.username,
        phoneNumber: chat.phoneNumber,
        lastMessage: chat.lastMessage || "Recent activity",
        lastMessageTime: chat.lastActivity,
        unreadCount: chat.unreadCount,
        lastSyncedAt: chat.lastSyncedAt,
        needsReply: chat.needsReply,
        lastMessageFrom: chat.lastMessageFrom,
        contactImageUrl: profileImageUrl,
        contactId: chat.contactId, // Direct link to contact for ContactSidePanel
      };
    });

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
 * Get a specific chat by ID (raw database record)
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
 * Get a specific chat by ID with contact info (for conversation panel)
 * Returns the same shape as listCachedChats items
 */
export const getChatByIdWithContact = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();

    if (!chat) {
      console.log(`[getChatByIdWithContact] Chat not found: ${args.chatId}`);
      return null;
    }

    // Get contact if linked
    let contactName: string | undefined = undefined;
    let profileImageUrl: string | undefined = undefined;

    if (chat.contactId) {
      const contact = await ctx.db.get(chat.contactId);
      if (contact) {
        const nameParts = [contact.firstName, contact.lastName].filter(Boolean);
        if (nameParts.length > 0) {
          contactName = nameParts.join(" ");
        }
        profileImageUrl = contact.imageUrl;
      }
    }

    // Get cached profile image if available
    if (!profileImageUrl && chat.participantImgURL) {
      const cachedImage = await ctx.db
        .query("cachedImages")
        .withIndex("by_source_url", (q) => q.eq("sourceUrl", chat.participantImgURL!))
        .first();
      if (cachedImage) {
        profileImageUrl = cachedImage.convexUrl;
      }
    }

    return {
      id: chat.chatId,
      roomId: chat.localChatID,
      name: contactName || chat.participantFullName || chat.title, // Priority: Dex contact > Beeper participant > raw title
      network: chat.network,
      accountID: chat.accountID,
      type: chat.type,
      username: chat.username,
      phoneNumber: chat.phoneNumber,
      lastMessage: chat.lastMessage || "Recent activity",
      lastMessageTime: chat.lastActivity,
      unreadCount: chat.unreadCount,
      lastSyncedAt: chat.lastSyncedAt,
      needsReply: chat.needsReply,
      lastMessageFrom: chat.lastMessageFrom,
      contactImageUrl: profileImageUrl,
      contactId: chat.contactId, // Direct link to contact for ContactSidePanel
    };
  },
});

/**
 * Internal query to get chat by ID (for use in actions)
 */
export const getChatByIdInternal = internalQuery({
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
 * FOR FRONTEND USE ONLY (React components)
 */
export const getCachedMessages = query({
  args: { 
    chatId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const chatIdPreview = args.chatId.length > 40 
      ? `${args.chatId.slice(0, 20)}...${args.chatId.slice(-15)}` 
      : args.chatId;
    
    console.log(`[getCachedMessages] 📨 Querying for chatId: ${chatIdPreview}`);
    
    // First check if the chat exists in our database
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();
    
    if (!chat) {
      console.log(`[getCachedMessages] ⚠️ Chat NOT FOUND in beeperChats table: ${chatIdPreview}`);
    } else {
      console.log(`[getCachedMessages] ✅ Chat found: "${chat.title}" (network: ${chat.network}, messageCount: ${chat.messageCount ?? 'unknown'})`);
    }
    
    // Query with compound index - filters by chatId and sorts by timestamp (DESC to get newest first)
    const result = await ctx.db
      .query("beeperMessages")
      .withIndex("by_chat", (q) => 
        q.eq("chatId", args.chatId)
      )
      .order("desc") // Newest first for pagination
      .paginate(args.paginationOpts);

    console.log(`[getCachedMessages] 📬 Found ${result.page.length} messages for chatId: ${chatIdPreview}`);

    // Transform messages (page is already sorted newest-first from query)
    // Also extract text in case any old data has JSON text objects
    const transformedPage = result.page.map((msg) => ({
      id: msg.messageId,
      text: extractMessageText(msg.text),
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
 * Get ALL cached messages for a specific chat (no pagination)
 * FOR BACKEND USE ONLY (actions, AI context, etc.)
 * Returns all messages sorted oldest-first
 */
export const getAllCachedMessages = query({
  args: { 
    chatId: v.string(),
    limit: v.optional(v.number()), // Optional limit for AI context (e.g., last 100 messages)
  },
  handler: async (ctx, args) => {
    console.log(`[getAllCachedMessages] Querying for chatId: ${args.chatId}`);
    
    // Query with compound index - filters by chatId and sorts by timestamp
    let queryBuilder = ctx.db
      .query("beeperMessages")
      .withIndex("by_chat", (q) => 
        q.eq("chatId", args.chatId)
      )
      .order("desc"); // Newest first

    // Collect messages with optional limit
    const messages = args.limit 
      ? await queryBuilder.take(args.limit)
      : await queryBuilder.collect();

    console.log(`[getAllCachedMessages] Found ${messages.length} messages for chatId: ${args.chatId}`);

    // Sort oldest-first for display
    const sortedMessages = messages.reverse();

    return {
      messages: sortedMessages.map((msg) => ({
        id: msg.messageId,
        text: extractMessageText(msg.text),
        timestamp: msg.timestamp,
        sender: msg.senderId,
        senderName: msg.senderName,
        isFromUser: msg.isFromUser,
        attachments: msg.attachments,
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

