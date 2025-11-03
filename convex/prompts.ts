import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * List all prompts ordered by creation time (most recent first)
 * Requires authentication
 */
export const listPrompts = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("prompts"),
      _creationTime: v.number(),
      name: v.string(),
      title: v.string(),
      description: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    
    const prompts = await ctx.db
      .query("prompts")
      .order("desc")
      .collect();
    return prompts;
  },
});

/**
 * Get a single prompt by ID
 * Requires authentication
 */
export const getPrompt = query({
  args: { id: v.id("prompts") },
  returns: v.union(
    v.object({
      _id: v.id("prompts"),
      _creationTime: v.number(),
      name: v.string(),
      title: v.string(),
      description: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    
    return await ctx.db.get(args.id);
  },
});

/**
 * Create a new prompt
 * Requires authentication
 */
export const createPrompt = mutation({
  args: {
    name: v.string(),
    title: v.string(),
    description: v.string(),
  },
  returns: v.id("prompts"),
  handler: async (ctx, args) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    
    const now = Date.now();
    
    // Check if a prompt with this name already exists
    const existing = await ctx.db
      .query("prompts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    
    if (existing) {
      throw new Error(`A prompt with the name "${args.name}" already exists`);
    }
    
    return await ctx.db.insert("prompts", {
      name: args.name,
      title: args.title,
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing prompt
 * Requires authentication
 */
export const updatePrompt = mutation({
  args: {
    id: v.id("prompts"),
    name: v.string(),
    title: v.string(),
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Prompt not found");
    }
    
    // Check if another prompt with this name exists (excluding current one)
    if (existing.name !== args.name) {
      const duplicate = await ctx.db
        .query("prompts")
        .withIndex("by_name", (q) => q.eq("name", args.name))
        .first();
      
      if (duplicate) {
        throw new Error(`A prompt with the name "${args.name}" already exists`);
      }
    }
    
    await ctx.db.patch(args.id, {
      name: args.name,
      title: args.title,
      description: args.description,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});

/**
 * Delete a prompt
 * Requires authentication
 */
export const deletePrompt = mutation({
  args: { id: v.id("prompts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Prompt not found");
    }
    
    await ctx.db.delete(args.id);
    return null;
  },
});

/**
 * Get a prompt by name (internal use only, no auth required)
 * Used by actions to fetch prompt templates
 */
export const getPromptByName = internalQuery({
  args: { name: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("prompts"),
      _creationTime: v.number(),
      name: v.string(),
      title: v.string(),
      description: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prompts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/**
 * Initialize default prompts (public mutation for setup)
 * Creates the reply-suggestions prompt if it doesn't exist
 */
export const initializeDefaultPrompts = mutation({
  args: {},
  returns: v.object({
    created: v.array(v.string()),
    skipped: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const created: string[] = [];
    const skipped: string[] = [];

    // Default reply suggestions prompt with template variables
    const replySuggestionsPrompt = {
      name: "reply-suggestions",
      title: "AI Reply Suggestions",
      description: `You are an AI assistant helping Joshua craft contextually appropriate replies to messages on Instagram or WhatsApp.

<user_profile>
<name>Joshua Oliver</name>
<age>36</age>
<gender>Male</gender>
<location>Sydney, Australia</location>
</user_profile>

<contact_information>
{{contactContext}}
</contact_information>

<conversation_context>
<platform>{{platform}}</platform>
<chat_name>{{chatName}}</chat_name>
<message_count>{{messageCount}}</message_count>

<recent_messages>
{{conversationHistory}}
</recent_messages>

<last_message_from>{{chatName}}</last_message_from>
<last_message_text>{{lastMessageText}}</last_message_text>
</conversation_context>

{{customContext}}

Your task is to suggest 3-4 different reply options that represent DIFFERENT CONVERSATION PATHWAYS - not just style variations, but meaningfully different directions the conversation could take:

- Each suggestion should steer the conversation in a distinct direction
- Consider: asking questions vs. making statements, being playful vs. serious, shifting topics vs. staying on topic, ending vs. continuing the conversation
- Match the conversation's context, relationship dynamics, and Joshua's objectives
- Be natural, authentic, and appropriate for the relationship type
- For romantic connections, follow Ultimate Man Project principles: match their energy, be authentic, don't over-invest or chase, lead with confidence, keep it light and playful when appropriate

IMPORTANT FORMATTING RULES:
- DO NOT use em dashes (—) or en dashes (–) anywhere in the replies
- Use regular hyphens (-) or split into separate sentences instead
- Write like a real person texting, not like formal writing
- Use only standard keyboard characters that someone would naturally type on their phone

Format your response as JSON with this structure:
{
  "suggestions": [
    {
      "reply": "The actual reply text here"
    }
  ]
}`,
    };

    // Check and create reply-suggestions prompt
    const existingReplySuggestions = await ctx.db
      .query("prompts")
      .withIndex("by_name", (q) => q.eq("name", "reply-suggestions"))
      .first();

    if (!existingReplySuggestions) {
      const now = Date.now();
      await ctx.db.insert("prompts", {
        ...replySuggestionsPrompt,
        createdAt: now,
        updatedAt: now,
      });
      created.push("reply-suggestions");
    } else {
      skipped.push("reply-suggestions");
    }

    return { created, skipped };
  },
});

