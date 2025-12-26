import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
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

/**
 * Send a message to a Beeper chat
 * 
 * This mutation:
 * 1. Inserts the message into the database with status="sending" (instant UI update)
 * 2. Updates the chat's lastActivity and lastMessage
 * 3. Schedules the backend action to actually send to Beeper API
 * 
 * The frontend gets an instant response and the message appears immediately
 * via Convex reactivity. The actual send happens asynchronously.
 */
export const sendMessage = mutation({
  args: {
    chatId: v.string(),
    text: v.string(),
    replyToMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create a synthetic messageId for this pending message
    const syntheticId = `pending_${now}_${Math.random().toString(36).slice(2, 8)}`;

    // Insert message with status="sending"
    const messageDocId = await ctx.db.insert("beeperMessages", {
      chatId: args.chatId,
      messageId: syntheticId,
      accountID: "local",
      text: args.text,
      timestamp: now,
      sortKey: now.toString(),
      senderId: "user",
      senderName: "You",
      isFromUser: true,
      status: "sending",
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
        needsReply: false,
        lastMessage: args.text,
      });
    }

    // Schedule the backend action to send to Beeper API
    await ctx.scheduler.runAfter(0, internal.beeperMessages.sendToBeeper, {
      messageDocId,
      chatId: args.chatId,
      text: args.text,
      replyToMessageId: args.replyToMessageId,
    });

    console.log(`[sendMessage] Inserted pending message ${syntheticId}, scheduled sendToBeeper`);

    return { 
      success: true, 
      messageDocId,
      messageId: syntheticId,
    };
  },
});

/**
 * Retry sending a failed message
 * 
 * This mutation:
 * 1. Verifies the message exists and is in a retriable state (failed or stuck sending)
 * 2. Resets status to "sending" and clears error
 * 3. Reschedules the sendToBeeper action
 */
export const retryMessage = mutation({
  args: {
    messageDocId: v.id("beeperMessages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageDocId);
    
    if (!message) {
      throw new Error("Message not found");
    }

    // Check if message is retriable
    const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
    const isStuck = message.status === "sending" && 
      (Date.now() - message.timestamp) > STUCK_THRESHOLD_MS;
    
    if (message.status !== "failed" && !isStuck) {
      throw new Error(`Message is not in a retriable state (status: ${message.status})`);
    }

    // Reset status and clear error
    await ctx.db.patch(args.messageDocId, {
      status: "sending",
      errorMessage: undefined,
    });

    // Reschedule the send action
    await ctx.scheduler.runAfter(0, internal.beeperMessages.sendToBeeper, {
      messageDocId: args.messageDocId,
      chatId: message.chatId,
      text: message.text,
      replyToMessageId: undefined, // We don't store this, so can't retry with reply
    });

    console.log(`[retryMessage] Retrying message ${message.messageId}`);

    return { success: true };
  },
});

/**
 * Update message status after send attempt
 * Called by the sendToBeeper action
 * 
 * When status is "sent", we update the messageId to the pendingMessageId
 * returned by Beeper. This prevents duplicates when sync runs later,
 * since sync checks for existing messages by messageId.
 */
export const updateMessageStatus = internalMutation({
  args: {
    messageDocId: v.id("beeperMessages"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    pendingMessageId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageDocId);
    
    if (!message) {
      console.warn(`[updateMessageStatus] Message ${args.messageDocId} not found`);
      return { success: false };
    }

    // Build update object
    const update: {
      status: "sent" | "failed";
      pendingMessageId?: string;
      errorMessage?: string;
      messageId?: string;
    } = {
      status: args.status,
      pendingMessageId: args.pendingMessageId,
      errorMessage: args.errorMessage,
    };

    // When sent successfully, update messageId to the Beeper-assigned ID
    // This prevents duplicates when sync runs (sync checks by messageId)
    if (args.status === "sent" && args.pendingMessageId) {
      // Check if sync already inserted a message with this ID (race condition)
      // If so, delete the sync'd duplicate - we keep ours since it has status tracking
      const existingFromSync = await ctx.db
        .query("beeperMessages")
        .withIndex("by_message_id", (q) => q.eq("messageId", args.pendingMessageId))
        .first();
      
      if (existingFromSync && existingFromSync._id !== args.messageDocId) {
        console.log(`[updateMessageStatus] Deleting duplicate from sync: ${existingFromSync._id}`);
        await ctx.db.delete(existingFromSync._id);
      }
      
      update.messageId = args.pendingMessageId;
      console.log(`[updateMessageStatus] Updated messageId: ${message.messageId} -> ${args.pendingMessageId}`);
    }

    await ctx.db.patch(args.messageDocId, update);

    console.log(`[updateMessageStatus] Updated message to status=${args.status}`);

    return { success: true };
  },
});

