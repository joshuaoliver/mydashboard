import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { experimental_transcribe as transcribe } from "ai";
import { openai } from "@ai-sdk/openai";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Note: agentChat imports are done dynamically in processTranscription to avoid
// loading AI model code for simple database queries like getPendingTranscriptions

// Type assertion for internal references that may not be in generated types yet
// Run `npx convex dev` to regenerate types after adding new files
const internalRef = internal as any;

// =============================================================================
// Voice Note Upload and Transcription
// =============================================================================

/**
 * Generate upload URL for voice note
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save voice note metadata and trigger transcription
 */
export const saveVoiceNote = mutation({
  args: {
    threadId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Create voice note record
    const voiceNoteId = await ctx.db.insert("voiceNotes", {
      threadId: args.threadId,
      storageId: args.storageId,
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule transcription
    await ctx.scheduler.runAfter(0, internalRef.voiceNotes.transcribeVoiceNote, {
      voiceNoteId,
    });

    return { voiceNoteId };
  },
});

/**
 * Transcribe a voice note using OpenAI Whisper via AI SDK
 */
export const transcribeVoiceNote = internalAction({
  args: {
    voiceNoteId: v.id("voiceNotes"),
  },
  handler: async (ctx, args) => {
    // Get voice note record
    const voiceNote = await ctx.runQuery(internalRef.voiceNotes.getVoiceNote, {
      voiceNoteId: args.voiceNoteId,
    });

    if (!voiceNote) {
      throw new Error("Voice note not found");
    }

    // Mark as transcribing
    await ctx.runMutation(internalRef.voiceNotes.updateVoiceNoteStatus, {
      voiceNoteId: args.voiceNoteId,
      status: "transcribing",
    });

    try {
      // Get audio from storage
      const audioUrl = await ctx.storage.getUrl(voiceNote.storageId);
      if (!audioUrl) {
        throw new Error("Audio file not found in storage");
      }

      // Fetch the audio data
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }
      const audioBuffer = await audioResponse.arrayBuffer();

      // Transcribe using AI SDK with OpenAI Whisper
      const result = await transcribe({
        model: openai.transcription("whisper-1"),
        audio: new Uint8Array(audioBuffer),
      });

      // Update voice note with transcription
      await ctx.runMutation(internalRef.voiceNotes.updateVoiceNoteTranscription, {
        voiceNoteId: args.voiceNoteId,
        transcription: result.text,
        durationSeconds: result.durationInSeconds,
      });

      // Send transcribed text to the agent for processing
      await ctx.runAction(internalRef.voiceNotes.processTranscription, {
        threadId: voiceNote.threadId,
        transcription: result.text,
      });

      return {
        success: true,
        transcription: result.text,
        duration: result.durationInSeconds,
      };
    } catch (error) {
      // Mark as failed
      await ctx.runMutation(internalRef.voiceNotes.updateVoiceNoteStatus, {
        voiceNoteId: args.voiceNoteId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  },
});

/**
 * Process transcription with the agent
 */
export const processTranscription = internalAction({
  args: {
    threadId: v.string(),
    transcription: v.string(),
  },
  handler: async (ctx, args) => {
    // Dynamic import to avoid loading agent code for simple database queries
    const { createAgentWithModel, getDefaultModelId } = await import("./agentChat");

    // Get thread info to find the agent thread ID
    const threadInfo = await ctx.runQuery(internalRef.chat.getThreadInfo, {
      threadId: args.threadId,
    });

    if (!threadInfo) {
      console.error(`[voiceNotes:processTranscription] Thread not found: ${args.threadId}`);
      return;
    }

    // Get the model ID from thread or default
    const modelId = threadInfo.modelId || getDefaultModelId();
    const agent = createAgentWithModel(modelId);

    // Determine the agent thread ID - create one if needed
    let agentThreadId = threadInfo.agentThreadId;

    if (!agentThreadId) {
      console.log(`[voiceNotes:processTranscription] Creating new agent thread...`);
      const { threadId: newAgentThreadId } = await agent.createThread(ctx, {
        userId: threadInfo.userId,
      });
      agentThreadId = newAgentThreadId;

      // Store the agent thread ID in our table
      if (threadInfo._id) {
        await ctx.runMutation(internalRef.chat.updateAgentThreadId, {
          threadId: threadInfo._id,
          agentThreadId,
        });
      }
    }

    // Generate response from agent with streaming using the correct agent thread ID
    await agent.streamText(
      ctx,
      { threadId: agentThreadId },
      {
        prompt: `[Voice Note Transcription]\n\n${args.transcription}\n\nPlease process this voice note and extract any actions, reminders, or tasks mentioned.`,
      },
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
// Internal Queries and Mutations
// =============================================================================

export const getVoiceNote = query({
  args: { voiceNoteId: v.id("voiceNotes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.voiceNoteId);
  },
});

export const updateVoiceNoteStatus = mutation({
  args: {
    voiceNoteId: v.id("voiceNotes"),
    status: v.union(
      v.literal("pending"),
      v.literal("transcribing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.voiceNoteId, {
      status: args.status,
      errorMessage: args.errorMessage,
    });
  },
});

export const updateVoiceNoteTranscription = mutation({
  args: {
    voiceNoteId: v.id("voiceNotes"),
    transcription: v.string(),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.voiceNoteId, {
      transcription: args.transcription,
      durationSeconds: args.durationSeconds,
      status: "completed",
    });
  },
});

// =============================================================================
// Quick Voice Recording (Navbar)
// =============================================================================

/**
 * Process audio recording from navbar and start a new chat conversation
 * This is for quick voice memos that should start a new AI conversation
 */
export const transcribeAndStartChat = internalAction({
  args: {
    storageId: v.id("_storage"),
    userId: v.id("users"),
    transcriptionId: v.id("pendingVoiceTranscriptions"),
  },
  handler: async (ctx, args) => {
    try {
      // Update status to transcribing
      await ctx.runMutation(internalRef.voiceNotes.updateTranscriptionStatus, {
        transcriptionId: args.transcriptionId,
        status: "transcribing",
      });

      // Get audio from storage
      const audioUrl = await ctx.storage.getUrl(args.storageId);
      if (!audioUrl) {
        throw new Error("Audio file not found in storage");
      }

      // Fetch the audio data
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }
      const audioBuffer = await audioResponse.arrayBuffer();

      // Transcribe using AI SDK with OpenAI Whisper
      const result = await transcribe({
        model: openai.transcription("whisper-1"),
        audio: new Uint8Array(audioBuffer),
      });

      if (!result.text || result.text.trim().length === 0) {
        throw new Error("No speech detected in recording");
      }

      const transcription = result.text.trim();
      console.log(`[voiceNotes:transcribeAndStartChat] Transcribed: "${transcription.slice(0, 100)}..."`);

      // Create a new chat thread with the transcribed text
      const threadId = await ctx.runMutation(internalRef.voiceNotes.createThreadFromVoice, {
        userId: args.userId as any, // Pass the Id from the action args
        transcription,
      });

      // Schedule the AI response
      await ctx.scheduler.runAfter(0, internalRef.chat.generateResponseAsync, {
        threadId: threadId.toString(),
        prompt: transcription,
      });

      // Schedule title generation
      await ctx.scheduler.runAfter(3000, internalRef.chat.generateThreadTitle, {
        threadId: threadId.toString(),
        firstMessage: transcription,
      });

      // Clean up the audio file from storage
      await ctx.storage.delete(args.storageId);

      // Update status to completed with the thread ID
      await ctx.runMutation(internalRef.voiceNotes.updateTranscriptionStatus, {
        transcriptionId: args.transcriptionId,
        status: "completed",
        threadId: threadId.toString(),
        transcription,
      });

      return {
        success: true,
        threadId: threadId.toString(),
        transcription,
      };
    } catch (error) {
      console.error("[voiceNotes:transcribeAndStartChat] Error:", error);

      // Update status to failed
      await ctx.runMutation(internalRef.voiceNotes.updateTranscriptionStatus, {
        transcriptionId: args.transcriptionId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  },
});

/**
 * Internal mutation to update transcription status
 */
export const updateTranscriptionStatus = internalMutation({
  args: {
    transcriptionId: v.id("pendingVoiceTranscriptions"),
    status: v.union(
      v.literal("pending"),
      v.literal("transcribing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    threadId: v.optional(v.string()),
    transcription: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.transcriptionId, {
      status: args.status,
      threadId: args.threadId,
      transcription: args.transcription,
      errorMessage: args.errorMessage,
    });
  },
});

/**
 * Internal mutation to create thread from voice transcription
 */
export const createThreadFromVoice = internalMutation({
  args: {
    userId: v.id("users"),
    transcription: v.string(),
  },
  handler: async (ctx, args) => {
    const title = args.transcription.slice(0, 50) + (args.transcription.length > 50 ? "..." : "");

    const threadId = await ctx.db.insert("agentThreads", {
      title,
      userId: args.userId,
      messageCount: 1,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return threadId;
  },
});

/**
 * Save audio and trigger transcription + chat creation
 */
export const startChatFromRecording = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Create a pending transcription record for UI tracking
    const transcriptionId = await ctx.db.insert("pendingVoiceTranscriptions", {
      userId,
      storageId: args.storageId,
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule the transcription and chat creation
    await ctx.scheduler.runAfter(0, internalRef.voiceNotes.transcribeAndStartChat, {
      storageId: args.storageId,
      userId,
      transcriptionId,
    });

    return { success: true, transcriptionId };
  },
});

/**
 * Get pending/recent transcriptions for the current user (for toast notifications)
 */
export const getPendingTranscriptions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Get transcriptions from the last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const transcriptions = await ctx.db
      .query("pendingVoiceTranscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .filter((q) => q.gte(q.field("createdAt"), fiveMinutesAgo))
      .collect();

    return transcriptions;
  },
});

/**
 * Mark a transcription as acknowledged (user has seen the toast)
 */
export const acknowledgeTranscription = mutation({
  args: {
    transcriptionId: v.id("pendingVoiceTranscriptions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const transcription = await ctx.db.get(args.transcriptionId);
    if (!transcription || transcription.userId !== userId) {
      throw new Error("Transcription not found");
    }

    // Delete the record after acknowledgment
    await ctx.db.delete(args.transcriptionId);
  },
});

// =============================================================================
// Public Queries
// =============================================================================

/**
 * List voice notes for a thread
 */
export const listVoiceNotes = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("voiceNotes")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .collect();
  },
});
