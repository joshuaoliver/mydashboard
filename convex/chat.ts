import { query, mutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { chatAgent } from "./agentChat";
import { getAuthUserId } from "@convex-dev/auth/server";

// =============================================================================
// Thread Management
// =============================================================================

/**
 * List all threads for the current user
 */
export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Get threads from our custom table
    const threads = await ctx.db
      .query("agentThreads")
      .withIndex("by_user_recent", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return threads.map((t) => ({
      id: t._id,
      title: t.title || "New conversation",
      lastMessageAt: t.lastMessageAt,
      messageCount: t.messageCount,
      createdAt: t.createdAt,
    }));
  },
});

/**
 * Get a single thread by ID
 */
export const getThread = query({
  args: { threadId: v.id("agentThreads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;

    return {
      id: thread._id,
      title: thread.title || "New conversation",
      lastMessageAt: thread.lastMessageAt,
      messageCount: thread.messageCount,
      createdAt: thread.createdAt,
    };
  },
});

/**
 * Create a new thread
 */
export const createThread = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Create our custom thread record
    const threadId = await ctx.db.insert("agentThreads", {
      title: args.title,
      userId,
      messageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Also create the agent thread using the same ID as string
    const agentThreadId = threadId.toString();
    await chatAgent.createThread(ctx, {
      threadId: agentThreadId,
      userId,
    });

    return { threadId: threadId.toString(), agentThreadId };
  },
});

/**
 * Update thread title
 */
export const updateThreadTitle = mutation({
  args: {
    threadId: v.id("agentThreads"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a thread
 */
export const deleteThread = mutation({
  args: { threadId: v.id("agentThreads") },
  handler: async (ctx, args) => {
    // Delete all pending actions for this thread
    const actions = await ctx.db
      .query("agentPendingActions")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId.toString()))
      .collect();

    for (const action of actions) {
      await ctx.db.delete(action._id);
    }

    // Delete all voice notes for this thread
    const voiceNotes = await ctx.db
      .query("voiceNotes")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId.toString()))
      .collect();

    for (const note of voiceNotes) {
      await ctx.storage.delete(note.storageId);
      await ctx.db.delete(note._id);
    }

    // Delete the thread
    await ctx.db.delete(args.threadId);
  },
});

// =============================================================================
// Send Message Mutations
// =============================================================================

/**
 * Send a text message and trigger async AI response
 */
export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Schedule async response generation
    await ctx.scheduler.runAfter(0, internal.chat.generateResponseAsync, {
      threadId: args.threadId,
      prompt: args.prompt,
    });

    // Update our thread record
    const threads = await ctx.db
      .query("agentThreads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const thread = threads.find((t) => t._id.toString() === args.threadId);

    if (thread) {
      await ctx.db.patch(thread._id, {
        lastMessageAt: Date.now(),
        messageCount: (thread.messageCount || 0) + 1,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Generate AI response asynchronously with streaming
 */
export const generateResponseAsync = internalAction({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    // Stream the AI response
    await chatAgent.streamText(
      ctx,
      { threadId: args.threadId },
      { prompt: args.prompt },
      {
        saveStreamDeltas: {
          chunking: "word",
          throttleMs: 100,
        },
      }
    );
  },
});

// =============================================================================
// Quick Thread Creation with Message
// =============================================================================

/**
 * Create a new thread and send the first message in one operation
 */
export const startConversation = mutation({
  args: {
    prompt: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Create our custom thread record
    const threadId = await ctx.db.insert("agentThreads", {
      title: args.title || args.prompt.slice(0, 50) + (args.prompt.length > 50 ? "..." : ""),
      userId,
      messageCount: 1,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const agentThreadId = threadId.toString();

    // Create agent thread
    await chatAgent.createThread(ctx, {
      threadId: agentThreadId,
      userId,
    });

    // Schedule async response generation with the first message
    await ctx.scheduler.runAfter(0, internal.chat.generateResponseAsync, {
      threadId: agentThreadId,
      prompt: args.prompt,
    });

    return {
      threadId: threadId.toString(),
      agentThreadId,
    };
  },
});
