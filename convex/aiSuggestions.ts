import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal query to get cached AI suggestions for a chat
 * Returns cached suggestions if they match the current last message
 * Otherwise returns null, triggering a regeneration
 * 
 * This is internal because only the generateReplySuggestions action needs it
 */
export const getCachedSuggestions = internalQuery({
  args: {
    chatId: v.string(),
    lastMessageId: v.string(), // ID of current last message
  },
  returns: v.union(
    v.object({
      suggestions: v.array(v.object({
        reply: v.string(),
      })),
      actionItem: v.optional(v.string()),
      conversationContext: v.object({
        lastMessage: v.string(),
        messageCount: v.number(),
      }),
      isCached: v.boolean(), // Always true for cached results
      generatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Look for cached suggestions matching this chat and last message
    const cached = await ctx.db
      .query("aiReplySuggestions")
      .withIndex("by_chat_and_message", (q) =>
        q.eq("chatId", args.chatId).eq("lastMessageId", args.lastMessageId)
      )
      .first();

    if (!cached) {
      // No cache found - return null to trigger generation
      return null;
    }

    // Return cached suggestions (map to ensure correct type)
    return {
      suggestions: cached.suggestions.map(s => ({ reply: s.reply })),
      actionItem: cached.actionItem,
      conversationContext: cached.conversationContext,
      isCached: true,
      generatedAt: cached.generatedAt,
    };
  },
});

/**
 * Internal mutation to save AI suggestions to cache
 * Called by the generateReplySuggestions action after generating new suggestions
 */
export const saveSuggestionsToCache = internalMutation({
  args: {
    chatId: v.string(),
    lastMessageId: v.string(),
    lastMessageTimestamp: v.number(),
    suggestions: v.array(v.object({
      reply: v.string(),
    })),
    actionItem: v.optional(v.string()),
    conversationContext: v.object({
      lastMessage: v.string(),
      messageCount: v.number(),
    }),
    modelUsed: v.string(),
  },
  returns: v.id("aiReplySuggestions"),
  handler: async (ctx, args) => {
    // Check if there's already a cache entry for this chat and message
    const existing = await ctx.db
      .query("aiReplySuggestions")
      .withIndex("by_chat_and_message", (q) =>
        q.eq("chatId", args.chatId).eq("lastMessageId", args.lastMessageId)
      )
      .first();

    if (existing) {
      // Update existing cache entry
      await ctx.db.patch(existing._id, {
        suggestions: args.suggestions,
        actionItem: args.actionItem,
        conversationContext: args.conversationContext,
        lastMessageTimestamp: args.lastMessageTimestamp,
        generatedAt: Date.now(),
        modelUsed: args.modelUsed,
      });
      return existing._id;
    }

    // Create new cache entry
    const cacheId = await ctx.db.insert("aiReplySuggestions", {
      chatId: args.chatId,
      lastMessageId: args.lastMessageId,
      lastMessageTimestamp: args.lastMessageTimestamp,
      suggestions: args.suggestions,
      actionItem: args.actionItem,
      conversationContext: args.conversationContext,
      generatedAt: Date.now(),
      modelUsed: args.modelUsed,
    });

    return cacheId;
  },
});

/**
 * Query to check if cached suggestions exist for a chat
 * Useful for UI to show "generating" vs "using cache" states
 */
export const hasCachedSuggestions = query({
  args: {
    chatId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("aiReplySuggestions")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();

    return cached !== null;
  },
});

/**
 * Public query to get cached suggestions for a chat
 * Returns the most recent cached suggestions without requiring lastMessageId
 * This is used by the frontend to display pre-generated suggestions
 */
export const getSuggestionsForChat = query({
  args: {
    chatId: v.string(),
  },
  returns: v.union(
    v.object({
      suggestions: v.array(v.object({
        reply: v.string(),
      })),
      actionItem: v.optional(v.string()),
      conversationContext: v.object({
        lastMessage: v.string(),
        messageCount: v.number(),
      }),
      generatedAt: v.number(),
      lastMessageId: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Get all cached suggestions for this chat, then pick the most recent
    // (index doesn't support ordering by generatedAt, so we collect and sort)
    const allCached = await ctx.db
      .query("aiReplySuggestions")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .collect();

    if (allCached.length === 0) {
      return null;
    }

    // Sort by generatedAt descending to get the most recent
    const cached = allCached.sort((a, b) => b.generatedAt - a.generatedAt)[0];

    return {
      suggestions: cached.suggestions.map(s => ({ reply: s.reply })),
      actionItem: cached.actionItem,
      conversationContext: cached.conversationContext,
      generatedAt: cached.generatedAt,
      lastMessageId: cached.lastMessageId,
    };
  },
});

/**
 * Mutation to clear cached suggestions for a chat
 * Useful if user wants to force regeneration
 * If chatId is not provided, clears ALL cached suggestions (for schema migrations)
 */
export const clearCachedSuggestions = mutation({
  args: {
    chatId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let cached;
    
    if (args.chatId !== undefined) {
      // Clear suggestions for specific chat
      const chatId = args.chatId; // TypeScript type narrowing
      cached = await ctx.db
        .query("aiReplySuggestions")
        .withIndex("by_chat_id", (q) => q.eq("chatId", chatId))
        .collect();
    } else {
      // Clear ALL cached suggestions (for migrations/schema changes)
      cached = await ctx.db
        .query("aiReplySuggestions")
        .collect();
    }

    // Delete them all
    let deleteCount = 0;
    for (const entry of cached) {
      await ctx.db.delete(entry._id);
      deleteCount++;
    }

    console.log(`✅ Cleared ${deleteCount} cached AI suggestions${args.chatId ? ` for chat ${args.chatId}` : ' (all chats)'}`);

    return null;
  },
});

/**
 * Migration mutation to clear ALL cached suggestions
 * Use this to clear old cached data after schema changes
 */
export const clearAllSuggestionsCache = mutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const cached = await ctx.db
      .query("aiReplySuggestions")
      .collect();

    let deleteCount = 0;
    for (const entry of cached) {
      await ctx.db.delete(entry._id);
      deleteCount++;
    }

    const message = `✅ Cleared ${deleteCount} cached AI suggestions (all chats)`;
    console.log(message);

    return {
      deletedCount: deleteCount,
      message: message,
    };
  },
});

