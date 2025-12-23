import { query, mutation, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { chatAgent } from "./agentChat";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { DEFAULT_SETTINGS } from "./aiSettings";

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
      modelId: thread.modelId,
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
 * Update thread model
 */
export const updateThreadModel = mutation({
  args: {
    threadId: v.id("agentThreads"),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      modelId: args.modelId,
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
// Message Queries with Streaming Support
// =============================================================================

/**
 * List messages for a thread with streaming support
 * This is the main query for the chat UI - returns paginated messages + active streams
 */
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    // Get paginated messages from the agent component
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });

    // Get active stream deltas for real-time streaming
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });

    return { ...paginated, streams };
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
 * Internal query to get thread model
 */
export const getThreadModel = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    // Find the thread by string ID
    const threads = await ctx.db.query("agentThreads").collect();
    const thread = threads.find((t) => t._id.toString() === args.threadId);
    return thread?.modelId || null;
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
    // Get the thread's selected model (for future use)
    const modelId = await ctx.runQuery(internal.chat.getThreadModel, {
      threadId: args.threadId,
    });

    // Stream the AI response
    // Note: The model is stored for future implementation when we add
    // dynamic model switching. Currently using the agent's default model.
    await chatAgent.streamText(
      ctx,
      { threadId: args.threadId },
      { prompt: args.prompt },
      {
        // Model ID is available as `modelId` for future dynamic model selection
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

    // Schedule title generation after response
    await ctx.scheduler.runAfter(3000, internal.chat.generateThreadTitle, {
      threadId: agentThreadId,
      firstMessage: args.prompt,
    });

    return {
      threadId: threadId.toString(),
      agentThreadId,
    };
  },
});

// =============================================================================
// Thread Title Generation
// =============================================================================

/**
 * Internal mutation to update thread title
 */
export const updateThreadTitleInternal = internalMutation({
  args: {
    threadId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the thread by string ID
    const threads = await ctx.db.query("agentThreads").collect();
    const thread = threads.find((t) => t._id.toString() === args.threadId);

    if (thread) {
      await ctx.db.patch(thread._id, {
        title: args.title,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Helper to create a model instance from a model ID string
 */
function createModelFromId(modelId: string) {
  const [provider, modelName] = modelId.split("/");

  switch (provider) {
    case "google":
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google(modelName);
    case "openai":
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return openai(modelName);
    case "anthropic":
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(modelName);
    default:
      // Default to Google for unknown providers
      const defaultGoogle = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return defaultGoogle("gemini-2.0-flash");
  }
}

/**
 * Generate a title for a thread based on the first message
 */
export const generateThreadTitle = internalAction({
  args: {
    threadId: v.string(),
    firstMessage: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the AI setting for title generation
    const setting = await ctx.runQuery(internal.aiSettings.getSettingInternal, {
      key: "thread-title-generation",
    });

    // Check if enabled
    const isEnabled = setting?.isEnabled ?? DEFAULT_SETTINGS["thread-title-generation"].isEnabled;
    if (!isEnabled) return;

    // Get model ID from setting or default
    const modelId = setting?.modelId ?? DEFAULT_SETTINGS["thread-title-generation"].modelId;
    const temperature = setting?.temperature ?? DEFAULT_SETTINGS["thread-title-generation"].temperature;

    try {
      const model = createModelFromId(modelId);

      const { text } = await generateText({
        model,
        prompt: `Generate a very short (3-5 word) title for this conversation. Just respond with the title, nothing else. No quotes, no punctuation at the end.

First message: "${args.firstMessage.slice(0, 500)}"`,
        maxTokens: 30,
        temperature,
      });

      const title = text.trim().replace(/^["']|["']$/g, ""); // Remove quotes if present

      await ctx.runMutation(internal.chat.updateThreadTitleInternal, {
        threadId: args.threadId,
        title,
      });
    } catch (error) {
      console.error("Failed to generate thread title:", error);
      // Silently fail - the thread will keep its default title
    }
  },
});
