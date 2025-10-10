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
        style: v.string(),
        reasoning: v.string(),
      })),
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

    // Return cached suggestions
    return {
      suggestions: cached.suggestions,
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
      style: v.string(),
      reasoning: v.string(),
    })),
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
 * Mutation to clear cached suggestions for a chat
 * Useful if user wants to force regeneration
 */
export const clearCachedSuggestions = mutation({
  args: {
    chatId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find all cached suggestions for this chat
    const cached = await ctx.db
      .query("aiReplySuggestions")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .collect();

    // Delete them all
    for (const entry of cached) {
      await ctx.db.delete(entry._id);
    }

    return null;
  },
});

