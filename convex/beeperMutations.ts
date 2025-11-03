import { internalMutation } from "./_generated/server";
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
      text: args.text,
      timestamp: now,
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

