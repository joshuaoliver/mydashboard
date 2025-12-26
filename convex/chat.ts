import {
  query,
  mutation,
  internalAction,
  internalQuery,
  internalMutation,
} from './_generated/server'
import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { listUIMessages, syncStreams, vStreamArgs } from '@convex-dev/agent'
import { components, internal } from './_generated/api'
import {
  createAgentWithModel,
  createModelFromId,
  getDefaultModelId,
} from './agentChat'
import { getAuthUserId } from '@convex-dev/auth/server'
import { generateText } from 'ai'
import { DEFAULT_SETTINGS } from './aiSettings'
import { trackAICost } from './costs'

// Type assertion for internal references that may not be in generated types yet
// Run `npx convex dev` to regenerate types after adding new files
const internalRef = internal as any
const componentsRef = components as any

// =============================================================================
// Thread Management
// =============================================================================

/**
 * List all threads for the current user
 */
export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    // Get threads from our custom table
    const threads = await ctx.db
      .query('agentThreads')
      .withIndex('by_user_recent', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()

    return threads.map((t) => ({
      id: t._id,
      title: t.title || 'New conversation',
      lastMessageAt: t.lastMessageAt,
      messageCount: t.messageCount,
      createdAt: t.createdAt,
    }))
  },
})

/**
 * Get a single thread by ID
 */
export const getThread = query({
  args: { threadId: v.id('agentThreads') },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    if (!thread) return null

    return {
      id: thread._id,
      title: thread.title || 'New conversation',
      lastMessageAt: thread.lastMessageAt,
      messageCount: thread.messageCount,
      modelId: thread.modelId,
      createdAt: thread.createdAt,
      hasAgentThread: !!thread.agentThreadId,
      agentThreadId: thread.agentThreadId,
    }
  },
})

/**
 * Check if a thread has an initialized agent thread (for conditional message loading)
 */
export const hasAgentThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    // Search for the thread by string ID
    const threads = await ctx.db.query('agentThreads').collect()
    const thread = threads.find((t) => t._id.toString() === args.threadId)

    if (!thread) return { exists: false, hasAgentThread: false }

    return {
      exists: true,
      hasAgentThread: !!thread.agentThreadId,
      agentThreadId: thread.agentThreadId,
    }
  },
})

/**
 * Create a new thread
 * Note: The agent thread is created lazily when the first message is sent
 */
export const createThread = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    // Create our custom thread record immediately for UI responsiveness
    // The agent thread will be created when the first message is sent
    const threadId = await ctx.db.insert('agentThreads', {
      title: args.title,
      userId,
      messageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Return our thread ID (the agentThreadId will be set on first message)
    return { threadId: threadId.toString() }
  },
})

/**
 * Update thread title
 */
export const updateThreadTitle = mutation({
  args: {
    threadId: v.id('agentThreads'),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      title: args.title,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Update thread model
 */
export const updateThreadModel = mutation({
  args: {
    threadId: v.id('agentThreads'),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      modelId: args.modelId,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Delete a thread
 */
export const deleteThread = mutation({
  args: { threadId: v.id('agentThreads') },
  handler: async (ctx, args) => {
    // Delete all pending actions for this thread
    const actions = await ctx.db
      .query('agentPendingActions')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId.toString()))
      .collect()

    for (const action of actions) {
      await ctx.db.delete(action._id)
    }

    // Delete all voice notes for this thread
    const voiceNotes = await ctx.db
      .query('voiceNotes')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId.toString()))
      .collect()

    for (const note of voiceNotes) {
      await ctx.storage.delete(note.storageId)
      await ctx.db.delete(note._id)
    }

    // Delete the thread
    await ctx.db.delete(args.threadId)
  },
})

// =============================================================================
// Message Queries with Streaming Support
// =============================================================================

/**
 * Internal query to get the agent thread ID for a given thread
 */
export const getAgentThreadId = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    // Search agentThreads table by string ID match
    const threads = await ctx.db.query('agentThreads').collect()
    const thread = threads.find((t) => t._id.toString() === args.threadId)
    return thread?.agentThreadId || null
  },
})

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
    // Look up our thread to get the agent thread ID
    const threads = await ctx.db.query('agentThreads').collect()
    const thread = threads.find((t) => t._id.toString() === args.threadId)
    const agentThreadId = thread?.agentThreadId || null

    // If no agent thread exists yet, we cannot call the agent's listUIMessages
    // The frontend should check hasAgentThread() and skip this query if false
    if (!agentThreadId) {
      throw new Error(
        'Agent thread not initialized. Call hasAgentThread() to check before querying messages.',
      )
    }

    // Get paginated messages from the agent component
    const paginated = await listUIMessages(ctx, componentsRef.agent, {
      threadId: agentThreadId,
      paginationOpts: args.paginationOpts,
    })

    // Get active stream deltas for real-time streaming
    const streams = await syncStreams(ctx, componentsRef.agent, {
      threadId: agentThreadId,
      streamArgs: args.streamArgs,
    })

    return { ...paginated, streams }
  },
})

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
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    // Schedule async response generation
    await ctx.scheduler.runAfter(0, internalRef.chat.generateResponseAsync, {
      threadId: args.threadId,
      prompt: args.prompt,
    })

    // Update our thread record
    const threads = await ctx.db
      .query('agentThreads')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    const thread = threads.find((t) => t._id.toString() === args.threadId)

    if (thread) {
      await ctx.db.patch(thread._id, {
        lastMessageAt: Date.now(),
        messageCount: (thread.messageCount || 0) + 1,
        updatedAt: Date.now(),
      })
    }

    return { success: true }
  },
})

// =============================================================================
// Attachment Support
// =============================================================================

/**
 * Generate upload URL for chat attachments
 */
export const generateAttachmentUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Send a message with an attachment
 */
export const sendMessageWithAttachment = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    storageId: v.id('_storage'),
    mimeType: v.string(),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    // Schedule async response generation with attachment info
    await ctx.scheduler.runAfter(
      0,
      internalRef.chat.generateResponseWithAttachment,
      {
        threadId: args.threadId,
        prompt: args.prompt,
        storageId: args.storageId,
        mimeType: args.mimeType,
        fileName: args.fileName,
      },
    )

    // Update thread record
    const threads = await ctx.db
      .query('agentThreads')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    const thread = threads.find((t) => t._id.toString() === args.threadId)

    if (thread) {
      await ctx.db.patch(thread._id, {
        lastMessageAt: Date.now(),
        messageCount: (thread.messageCount || 0) + 1,
        updatedAt: Date.now(),
      })
    }

    return { success: true }
  },
})

/**
 * Generate AI response for message with attachment
 */
export const generateResponseWithAttachment = internalAction({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    storageId: v.id('_storage'),
    mimeType: v.string(),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the file URL from storage
    const fileUrl = await ctx.storage.getUrl(args.storageId)
    if (!fileUrl) {
      throw new Error('Attachment not found in storage')
    }

    // Determine if it's an image for special handling
    const isImage = args.mimeType.startsWith('image/')

    // Build the prompt with attachment context
    let promptWithAttachment = args.prompt
    if (isImage) {
      promptWithAttachment = `[Image attached: ${args.fileName || 'image'}]\n\n${args.prompt}`
    } else {
      promptWithAttachment = `[File attached: ${args.fileName || 'file'} (${args.mimeType})]\n\n${args.prompt}`
    }

    // Get thread info to check if we already have an agent thread
    const threadInfo = await ctx.runQuery(internalRef.chat.getThreadInfo, {
      threadId: args.threadId,
    })

    // Get the thread's selected model or fall back to settings default
    let modelId = threadInfo?.modelId
    if (!modelId) {
      const setting = await ctx.runQuery(
        internalRef.chat.getChatAgentSetting,
        {},
      )
      modelId = setting?.modelId || getDefaultModelId()
    }

    // Create agent with the selected model
    const agent = createAgentWithModel(modelId)

    // Determine the agent thread ID - create one if needed
    let agentThreadId = threadInfo?.agentThreadId

    if (!agentThreadId) {
      // Create a new agent thread
      const { threadId: newAgentThreadId } = await agent.createThread(ctx, {
        userId: threadInfo?.userId,
      })
      agentThreadId = newAgentThreadId

      // Store the agent thread ID in our table
      if (threadInfo?._id) {
        await ctx.runMutation(internalRef.chat.updateAgentThreadId, {
          threadId: threadInfo._id,
          agentThreadId,
        })
      }
    }

    // Stream the response using the agent thread ID
    const result = await agent.streamText(
      ctx,
      { threadId: agentThreadId },
      { prompt: promptWithAttachment },
      {
        saveStreamDeltas: {
          chunking: 'word',
          throttleMs: 100,
        },
      },
    )

    // Consume the stream to ensure completion
    await result.consumeStream()
  },
})

/**
 * Internal query to get thread info including agent thread ID
 */
export const getThreadInfo = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    // Search agentThreads table by string ID match
    const threads = await ctx.db.query('agentThreads').collect()
    const thread = threads.find((t) => t._id.toString() === args.threadId)
    if (thread) {
      return {
        _id: thread._id,
        agentThreadId: thread.agentThreadId,
        modelId: thread.modelId,
        userId: thread.userId,
      }
    }
    return null
  },
})

/**
 * Internal query to get thread model
 */
export const getThreadModel = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    // Find the thread by string ID
    const threads = await ctx.db.query('agentThreads').collect()
    const thread = threads.find((t) => t._id.toString() === args.threadId)
    return thread?.modelId || null
  },
})

/**
 * Internal query to get chat-agent setting
 */
export const getChatAgentSetting = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('aiSettings')
      .withIndex('by_key', (q) => q.eq('key', 'chat-agent'))
      .first()
  },
})

/**
 * Internal mutation to update the agent thread ID on our thread record
 */
export const updateAgentThreadId = internalMutation({
  args: {
    threadId: v.id('agentThreads'),
    agentThreadId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      agentThreadId: args.agentThreadId,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Generate AI response asynchronously with streaming
 */
export const generateResponseAsync = internalAction({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(
      `[chat:generateResponseAsync] Starting for thread ${args.threadId}`,
    )
    console.log(
      `[chat:generateResponseAsync] Prompt: "${args.prompt.slice(0, 100)}${args.prompt.length > 100 ? '...' : ''}"`,
    )

    // Get thread info to check if we already have an agent thread
    const threadInfo = await ctx.runQuery(internalRef.chat.getThreadInfo, {
      threadId: args.threadId,
    })
    console.log(`[chat:generateResponseAsync] Thread info:`, {
      hasThreadInfo: !!threadInfo,
      agentThreadId: threadInfo?.agentThreadId,
      modelId: threadInfo?.modelId,
    })

    // Get the thread's selected model or fall back to settings default
    let modelId = threadInfo?.modelId
    if (!modelId) {
      const setting = await ctx.runQuery(
        internalRef.chat.getChatAgentSetting,
        {},
      )
      modelId = setting?.modelId || getDefaultModelId()
      console.log(
        `[chat:generateResponseAsync] Using default/setting model: ${modelId}`,
      )
    } else {
      console.log(`[chat:generateResponseAsync] Using thread model: ${modelId}`)
    }

    // Create agent with the selected model
    console.log(
      `[chat:generateResponseAsync] Creating agent with model: ${modelId}`,
    )
    const agent = createAgentWithModel(modelId)
    console.log(`[chat:generateResponseAsync] Agent created successfully`)

    // Determine the agent thread ID - create one if needed
    let agentThreadId = threadInfo?.agentThreadId

    if (!agentThreadId) {
      console.log(`[chat:generateResponseAsync] Creating new agent thread...`)
      // Create a new agent thread
      const { threadId: newAgentThreadId } = await agent.createThread(ctx, {
        userId: threadInfo?.userId,
      })
      agentThreadId = newAgentThreadId
      console.log(
        `[chat:generateResponseAsync] Created agent thread: ${agentThreadId}`,
      )

      // Store the agent thread ID in our table
      if (threadInfo?._id) {
        await ctx.runMutation(internalRef.chat.updateAgentThreadId, {
          threadId: threadInfo._id,
          agentThreadId,
        })
        console.log(
          `[chat:generateResponseAsync] Saved agent thread ID to database`,
        )
      }
    } else {
      console.log(
        `[chat:generateResponseAsync] Using existing agent thread: ${agentThreadId}`,
      )
    }

    // Stream the response
    console.log(`[chat:generateResponseAsync] Starting streamText...`)
    try {
      const result = await agent.streamText(
        ctx,
        { threadId: agentThreadId },
        { prompt: args.prompt },
        {
          saveStreamDeltas: {
            chunking: 'word',
            throttleMs: 100,
          },
        },
      )

      // Consume the stream to ensure completion
      // This is required for async streaming in Convex actions
      console.log(`[chat:generateResponseAsync] Consuming stream...`)
      await result.consumeStream()
      console.log(
        `[chat:generateResponseAsync] streamText completed successfully`,
      )

      // Track AI cost after stream completion
      // Note: The agent's streamText may not expose usage directly
      // If usage is available, track it
      const usage = (result as any).usage
      if (usage && usage.totalTokens) {
        await trackAICost(ctx, {
          featureKey: 'chat-agent',
          fullModelId: modelId,
          usage: {
            promptTokens: usage.promptTokens ?? 0,
            completionTokens: usage.completionTokens ?? 0,
            totalTokens: usage.totalTokens,
          },
          threadId: agentThreadId,
        })
      }
    } catch (error) {
      console.error(`[chat:generateResponseAsync] streamText failed:`, error)
      throw error
    }
  },
})

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
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    // Create our custom thread record
    const threadId = await ctx.db.insert('agentThreads', {
      title:
        args.title ||
        args.prompt.slice(0, 50) + (args.prompt.length > 50 ? '...' : ''),
      userId,
      messageCount: 1,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const agentThreadId = threadId.toString()

    // Note: Agent thread creation happens automatically when we stream text
    // The agent will create its internal thread structure on first message

    // Schedule async response generation with the first message
    await ctx.scheduler.runAfter(0, internalRef.chat.generateResponseAsync, {
      threadId: agentThreadId,
      prompt: args.prompt,
    })

    // Schedule title generation after response
    await ctx.scheduler.runAfter(3000, internalRef.chat.generateThreadTitle, {
      threadId: agentThreadId,
      firstMessage: args.prompt,
    })

    return {
      threadId: threadId.toString(),
    }
  },
})

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
    const threads = await ctx.db.query('agentThreads').collect()
    const thread = threads.find((t) => t._id.toString() === args.threadId)

    if (thread) {
      await ctx.db.patch(thread._id, {
        title: args.title,
        updatedAt: Date.now(),
      })
    }
  },
})

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
      key: 'thread-title-generation',
    })

    // Check if enabled
    const isEnabled =
      setting?.isEnabled ??
      DEFAULT_SETTINGS['thread-title-generation'].isEnabled
    if (!isEnabled) return

    // Get model ID from setting or default
    const modelId =
      setting?.modelId ?? DEFAULT_SETTINGS['thread-title-generation'].modelId
    const temperature =
      setting?.temperature ??
      DEFAULT_SETTINGS['thread-title-generation'].temperature

    try {
      const model = createModelFromId(modelId)

      const result = await generateText({
        model,
        prompt: `Generate a very short (3-5 word) title for this conversation. Just respond with the title, nothing else. No quotes, no punctuation at the end.

First message: "${args.firstMessage.slice(0, 500)}"`,
        maxOutputTokens: 30,
        temperature,
      })

      // Track AI cost
      if (result.usage) {
        const usage = result.usage as { promptTokens?: number; completionTokens?: number };
        await trackAICost(ctx, {
          featureKey: 'thread-title',
          fullModelId: modelId,
          usage: {
            promptTokens: usage.promptTokens ?? 0,
            completionTokens: usage.completionTokens ?? 0,
            totalTokens: (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
          },
          threadId: args.threadId.toString(),
        })
      }

      const title = result.text.trim().replace(/^["']|["']$/g, '') // Remove quotes if present

      await ctx.runMutation(internalRef.chat.updateThreadTitleInternal, {
        threadId: args.threadId,
        title,
      })
    } catch (error) {
      console.error('Failed to generate thread title:', error)
      // Silently fail - the thread will keep its default title
    }
  },
})

// =============================================================================
// Data Repair
// =============================================================================

/**
 * Clear corrupted agentThreadId values from threads
 * This fixes threads where agentThreadId was incorrectly set to our table's ID
 * instead of the agent component's thread ID
 */
export const repairCorruptedThreads = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const threads = await ctx.db
      .query('agentThreads')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    let repaired = 0
    for (const thread of threads) {
      // Check if agentThreadId looks like our table ID (matches the thread's own _id)
      // Agent thread IDs from the agent component should be different
      if (
        thread.agentThreadId &&
        thread.agentThreadId === thread._id.toString()
      ) {
        await ctx.db.patch(thread._id, {
          agentThreadId: undefined,
          updatedAt: Date.now(),
        })
        repaired++
      }
    }

    return { repaired, total: threads.length }
  },
})
