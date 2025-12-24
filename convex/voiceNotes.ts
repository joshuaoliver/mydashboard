import { mutation, query, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { experimental_transcribe as transcribe } from "ai";
import { openai } from "@ai-sdk/openai";
import { internal } from "./_generated/api";
import { chatAgent } from "./agentChat";

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
    // Generate response from agent with streaming
    // Type assertion needed due to AI SDK version conflicts
    await (chatAgent as any).streamText(
      ctx,
      { threadId: args.threadId },
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
