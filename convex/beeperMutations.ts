import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Save a user-sent message locally to the cache.
 * This enables immediate UI updates while send is processed.
 * 
 * Called internally from beeperActions.sendMessage
 */
export const saveUserMessage = internalMutation({
  args: {
    chatId: v.string(),
    text: v.string(),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.timestamp ?? Date.now();

    // Create a synthetic messageId for local cache purposes
    const syntheticId = `local_${now}`;

    await ctx.db.insert("beeperMessages", {
      chatId: args.chatId,
      messageId: syntheticId,
      accountID: "local",  // Synthetic account ID for user-sent messages
      text: args.text,
      timestamp: now,
      sortKey: now.toString(), // Use timestamp as sortKey for proper ordering
      senderId: "user",
      senderName: "You",
      isFromUser: true,
    });

    // Update chat with last activity and reply tracking
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();
    if (chat) {
      await ctx.db.patch(chat._id, { 
        lastActivity: now,
        lastMessageFrom: "user",
        needsReply: false, // User just replied, so no longer needs reply
        lastMessage: args.text,
      });
    }

    return { success: true, messageId: syntheticId, timestamp: now };
  },
});

/**
 * Archive or unarchive a chat
 * This removes it from the main chat list without deleting it
 */
export const toggleArchiveChat = internalMutation({
  args: {
    chatId: v.string(),
    isArchived: v.boolean(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();
    
    if (!chat) {
      throw new Error(`Chat ${args.chatId} not found`);
    }

    await ctx.db.patch(chat._id, {
      isArchived: args.isArchived,
    });

    return { success: true, chatId: args.chatId, isArchived: args.isArchived };
  },
});

/**
 * Block or unblock a chat
 */
export const toggleBlockChat = internalMutation({
  args: {
    chatId: v.string(),
    isBlocked: v.boolean(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();
    
    if (!chat) {
      throw new Error(`Chat ${args.chatId} not found`);
    }

    await ctx.db.patch(chat._id, {
      isBlocked: args.isBlocked,
    });

    return { success: true, chatId: args.chatId, isBlocked: args.isBlocked };
  },
});

/**
 * Mark a chat as read
 * Sets the unread count to 0
 */
export const markChatAsRead = internalMutation({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();
    
    if (!chat) {
      throw new Error(`Chat ${args.chatId} not found`);
    }

    await ctx.db.patch(chat._id, {
      unreadCount: 0,
    });

    return { success: true, chatId: args.chatId };
  },
});

/**
 * Mark a chat as unread
 * Sets the unread count to 1 (to show as unread in UI)
 */
export const markChatAsUnread = internalMutation({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();
    
    if (!chat) {
      throw new Error(`Chat ${args.chatId} not found`);
    }

    await ctx.db.patch(chat._id, {
      unreadCount: 1,
    });

    return { success: true, chatId: args.chatId };
  },
});

/**
 * Fix chats that incorrectly show Meta AI as the participant
 * This finds the real participant from beeperParticipants and updates the chat
 */
export const fixMetaAIChats = mutation({
  args: {},
  handler: async (ctx) => {
    // Helper to check if a name/username is Meta AI
    const isMetaAI = (name?: string, username?: string) => {
      const n = (name || '').toLowerCase();
      const u = (username || '').toLowerCase();
      return n.includes('meta ai') || u === 'meta.ai';
    };

    // Find all chats that show Meta AI as the participant
    const allChats = await ctx.db.query("beeperChats").collect();
    const metaAIChats = allChats.filter(chat => 
      isMetaAI(chat.participantFullName, chat.username) || 
      isMetaAI(chat.title, chat.username)
    );

    console.log(`[fixMetaAIChats] Found ${metaAIChats.length} chats showing Meta AI`);

    let fixedCount = 0;

    for (const chat of metaAIChats) {
      // Get all participants for this chat
      const participants = await ctx.db
        .query("beeperParticipants")
        .withIndex("by_chat", (q) => q.eq("chatId", chat.chatId))
        .collect();

      // Find the real person (not self, not Meta AI)
      const realPerson = participants.find(p => 
        !p.isSelf && !isMetaAI(p.fullName, p.username)
      );

      if (realPerson) {
        console.log(`[fixMetaAIChats] Fixing chat ${chat.chatId}: ${chat.title} -> ${realPerson.fullName}`);
        
        await ctx.db.patch(chat._id, {
          title: realPerson.fullName || realPerson.username || chat.title,
          participantFullName: realPerson.fullName,
          participantId: realPerson.participantId,
          participantImgURL: realPerson.imgURL,
          username: realPerson.username,
        });
        
        fixedCount++;
      } else {
        console.log(`[fixMetaAIChats] No real person found for chat ${chat.chatId}, participants:`, 
          participants.map(p => ({ name: p.fullName, username: p.username, isSelf: p.isSelf }))
        );
      }
    }

    return { 
      success: true, 
      chatsChecked: metaAIChats.length,
      chatsFixed: fixedCount 
    };
  },
});

/**
 * Update the AI-assessed reply importance for a chat
 * Called by generateReplySuggestions after AI generates importance rating
 * 
 * @param chatId - The chat to update
 * @param importance - Importance rating 1-5 (1=Low, 2=Normal, 3=Moderate, 4=High, 5=Urgent)
 */
export const updateReplyImportance = internalMutation({
  args: {
    chatId: v.string(),
    importance: v.number(), // 1-5 scale
  },
  handler: async (ctx, args) => {
    // Validate importance is in valid range
    if (args.importance < 1 || args.importance > 5) {
      console.warn(`[updateReplyImportance] Invalid importance ${args.importance} for chat ${args.chatId}, clamping to 1-5`);
    }
    const clampedImportance = Math.max(1, Math.min(5, Math.round(args.importance)));

    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();
    
    if (!chat) {
      console.warn(`[updateReplyImportance] Chat ${args.chatId} not found`);
      return { success: false, error: "Chat not found" };
    }

    const now = Date.now();
    await ctx.db.patch(chat._id, {
      replyImportance: clampedImportance,
      replyImportanceUpdatedAt: now,
    });

    console.log(`[updateReplyImportance] Set importance=${clampedImportance} for chat ${args.chatId} (${chat.title})`);

    return { success: true, chatId: args.chatId, importance: clampedImportance };
  },
});

/**
 * Link a chat to a different contact
 * Used when user wants to manually set which contact a conversation belongs to
 */
export const linkChatToContact = internalMutation({
  args: {
    chatId: v.string(),
    contactId: v.optional(v.id("contacts")),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();

    if (!chat) {
      throw new Error(`Chat ${args.chatId} not found`);
    }

    // If a contactId is provided, verify the contact exists
    if (args.contactId) {
      const contact = await ctx.db.get(args.contactId);
      if (!contact) {
        throw new Error(`Contact ${args.contactId} not found`);
      }
    }

    await ctx.db.patch(chat._id, {
      contactId: args.contactId,
      contactMatchedAt: Date.now(),
    });

    console.log(`[linkChatToContact] Linked chat ${args.chatId} to contact ${args.contactId ?? 'none'}`);

    return { success: true, chatId: args.chatId, contactId: args.contactId };
  },
});

