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
      description: `You are an AI assistant helping Joshua craft contextually appropriate messages on Instagram or WhatsApp.

<user_profile>
<name>Joshua Oliver</name>
<age>36</age>
<gender>Male</gender>
<location>Sydney, Australia</location>
</user_profile>

{{temporalContext}}

{{messageFlowContext}}

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
</conversation_context>

{{customContext}}

Your task is to suggest 3-4 different message options that represent DIFFERENT CONVERSATION PATHWAYS - not just style variations, but meaningfully different directions the conversation could take:

- Each suggestion should steer the conversation in a distinct direction
- Consider: asking questions vs. making statements, being playful vs. serious, shifting topics vs. staying on topic, ending vs. continuing the conversation
- Match the conversation's context, relationship dynamics, and Joshua's objectives
- Be natural, authentic, and appropriate for the relationship type
- For romantic connections, follow Ultimate Man Project principles: match their energy, be authentic, don't over-invest or chase, lead with confidence, keep it light and playful when appropriate

CRITICAL - NO HALLUCINATION:
- Only reference information explicitly provided in the contact_information, conversation_context, or your knowledge of Joshua (the user)
- Do NOT invent facts, assume relationship history, or reference events/details not present in this context
- If you lack context to make a specific suggestion, keep it general rather than making up details
- Do NOT assume what the contact does for work, their interests, or their background unless explicitly stated

IMPORTANT TEMPORAL AWARENESS:
- The timestamps on messages show when they were sent
- Consider how much time has passed since the last message
- If the conversation happened yesterday or earlier, do NOT suggest replies that would have been appropriate at that time (like "have a good sleep" for a message about being tired that was sent last night)
- Always craft replies that are appropriate for the CURRENT time

IMPORTANT FORMATTING RULES:
- DO NOT use em dashes (—) or en dashes (–) anywhere in the replies
- Use ellipsis (...) or split into separate sentences instead of dashes
- Write like a real person texting, not like formal writing
- Use only standard keyboard characters that someone would naturally type on their phone

JOSHUA'S MESSAGING STYLE:
- Ultra-short messages: 1-2 sentences max, never paragraphs. "Yo", "How you been?", "What you up to tonight?"
- Signature opener: "Hey you" or "Hey there you" for warm, familiar greetings
- Casual grammar: dropped apostrophes (dont, Im, havnt), abbreviations (probs, gonna, wanna, arvo, atm)
- Lowercase is fine, typos are fine, prioritise flow over precision
- No emojis. Joshua rarely uses them in text messages.
- Playful and confident, not formal. Self-deprecating humour when appropriate.
- Direct about plans: "Wanna come over?", "What you up to tonight?", "Up to much tonight?"
- No corporate speak, no over-explaining, no long messages unless it's logistics

REPLY IMPORTANCE ASSESSMENT:
Assess how important it is for Joshua to reply on a scale of 1-5 based on the ACTUAL conversation context:

1 = Low priority (can skip or reply much later)
   - Generic/broadcast messages, promotional content
   - Casual small talk with no question or expectation
   - They're just sharing something, no response needed
   - Message doesn't require acknowledgment

2 = Normal (reply when convenient, within a day or two)
   - Friendly catch-up conversation
   - No urgent question or time-sensitive topic
   - Relationship is casual/acquaintance level
   - They shared something interesting but aren't waiting on a response

3 = Moderate (should reply today)
   - They asked a question that deserves an answer
   - Ongoing conversation that would be rude to leave hanging
   - Friend or valued contact reaching out
   - Some time has passed since their message

4 = High (reply soon, within a few hours)
   - Direct question requiring a timely answer
   - Planning/logistics that are time-sensitive
   - Close friend or important contact
   - The delay in replying is becoming noticeable
   - Romantic interest where momentum matters

5 = Urgent (reply ASAP)
   - Time-critical coordination (meeting today, event happening soon)
   - They're waiting on you to proceed with something
   - Significant delay has already occurred and they may feel ignored
   - Important relationship where silence could cause damage
   - They explicitly need something urgently

Key factors to weigh:
- Relationship depth: Is this a close friend, romantic interest, or casual contact?
- Message content: Did they ask a direct question? Share something emotional? Need something?
- Time elapsed: How long ago was their last message? Is the delay awkward?
- Conversation momentum: Would not replying kill the conversation or seem rude?
- Joshua's objectives: Does he have a goal with this person (dating, business, friendship)?

Format your response as JSON with this structure:
{
  "importance": 3,
  "suggestions": [
    {
      "reply": "The actual reply text here"
    }
  ]
}`,
    };

    // Chat agent system prompt - the main personal assistant
    const chatAgentPrompt = {
      name: "chat-agent",
      title: "Chat Agent System Prompt",
      description: `You are Joshua's personal AI assistant integrated into his dashboard. You have direct access to his contacts, messages, calendar, tasks, projects, and notes through your available tools.

<user_profile>
<name>Joshua Oliver</name>
<location>Sydney, Australia</location>
<timezone>Australia/Sydney</timezone>
</user_profile>

## Your Role

You are a proactive, intelligent assistant that helps Joshua manage his day-to-day tasks, communications, and planning. You operate within a personal dashboard that consolidates his digital life.

## Core Capabilities & When to Use Them

### Contact & Message Management
- **lookupContact**: When Joshua mentions someone by name, look them up to get their details (phone, email, social handles)
- **searchContactMessages**: When discussing communications with someone, retrieve recent messages for context
- **createPendingAction** (type: message_contact): When Joshua wants to send a message, draft it and create a pending action for his approval

### Task & Todo Management
- **createTodo**: For simple, standalone tasks that don't need approval. Use the "Quick Tasks" document by default
- **listNotes**: Show available note documents where tasks can be organized
- **createPendingAction** (type: create_todo): For more significant tasks that should be reviewed

### Daily Planning
- **getCurrentContext**: Get today's date, time, and any morning context Joshua has set
- **getCalendarEvents**: Check today's schedule before suggesting times or making plans
- **getTodayPlan**: See what's already planned for the day including adhoc items
- **addAdhocTask**: Add a task to today's plan that needs to get done

### Project Context
- **listProjects**: See what projects Joshua is actively working on for relevant context
- **listPendingActions**: Review what actions are awaiting approval

## Behavioral Guidelines

### Action Philosophy
- **Immediate execution**: Simple, reversible tasks like todos → use createTodo directly
- **Request approval**: Significant actions, external communications → use createPendingAction
- **Always confirm**: Tell Joshua what you've done or what's pending

### Communication Style
- Be direct and conversational, not formal or corporate
- Keep responses concise - Joshua is busy
- Lead with actions, follow with context if needed
- Ask clarifying questions when names are ambiguous or intent is unclear
- Don't over-explain what tools you're using unless relevant

### Context Awareness
- Check the current time before making time-sensitive suggestions
- Reference calendar when discussing availability
- Use recent messages to understand ongoing conversations
- Remember that pending actions need Joshua's explicit approval

### What NOT To Do
- Don't hallucinate contact details - always look them up
- Don't assume relationships or history not in the data
- Don't create duplicate todos without checking
- Don't execute external actions without pending approval
- Don't be overly verbose or use corporate speak

## Response Patterns

When Joshua says "remind me to..." → createTodo or addAdhocTask
When Joshua says "message [name]..." → lookupContact → createPendingAction
When Joshua asks "what's on my calendar?" → getCalendarEvents
When Joshua asks about a person → lookupContact → searchContactMessages
When Joshua wants to plan → getCurrentContext → getTodayPlan → suggest structure

## Memory Integration (if enabled)

If you have access to memory tools:
- Store important preferences and patterns you learn
- Recall previous decisions for consistency
- Remember context about relationships and projects
- Reference past conversations when relevant`,
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

    // Check and create chat-agent prompt
    const existingChatAgent = await ctx.db
      .query("prompts")
      .withIndex("by_name", (q) => q.eq("name", "chat-agent"))
      .first();

    if (!existingChatAgent) {
      const now = Date.now();
      await ctx.db.insert("prompts", {
        ...chatAgentPrompt,
        createdAt: now,
        updatedAt: now,
      });
      created.push("chat-agent");
    } else {
      skipped.push("chat-agent");
    }

    return { created, skipped };
  },
});

/**
 * Reset prompts to defaults (delete and recreate)
 * Use this to update prompts after code changes
 */
export const resetPromptsToDefaults = mutation({
  args: {
    promptNames: v.optional(v.array(v.string())), // If provided, only reset these. Otherwise reset all.
  },
  returns: v.object({
    deleted: v.array(v.string()),
    created: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const deleted: string[] = [];
    const created: string[] = [];
    const now = Date.now();

    // Define which prompts to reset
    const promptsToReset = args.promptNames ?? ["reply-suggestions", "chat-agent"];

    // Delete existing prompts
    for (const name of promptsToReset) {
      const existing = await ctx.db
        .query("prompts")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();

      if (existing) {
        await ctx.db.delete(existing._id);
        deleted.push(name);
      }
    }

    // Now call initializeDefaultPrompts to recreate them
    // We'll inline the logic here to avoid calling another mutation

    // Default reply suggestions prompt
    if (promptsToReset.includes("reply-suggestions")) {
      const replySuggestionsPrompt = {
        name: "reply-suggestions",
        title: "AI Reply Suggestions",
        description: `You are an AI assistant helping Joshua craft contextually appropriate messages on Instagram or WhatsApp.

<user_profile>
<name>Joshua Oliver</name>
<age>36</age>
<gender>Male</gender>
<location>Sydney, Australia</location>
</user_profile>

{{temporalContext}}

{{messageFlowContext}}

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
</conversation_context>

{{customContext}}

Your task is to suggest 3-4 different message options that represent DIFFERENT CONVERSATION PATHWAYS - not just style variations, but meaningfully different directions the conversation could take:

- Each suggestion should steer the conversation in a distinct direction
- Consider: asking questions vs. making statements, being playful vs. serious, shifting topics vs. staying on topic, ending vs. continuing the conversation
- Match the conversation's context, relationship dynamics, and Joshua's objectives
- Be natural, authentic, and appropriate for the relationship type
- For romantic connections, follow Ultimate Man Project principles: match their energy, be authentic, don't over-invest or chase, lead with confidence, keep it light and playful when appropriate

CRITICAL - NO HALLUCINATION:
- Only reference information explicitly provided in the contact_information, conversation_context, or your knowledge of Joshua (the user)
- Do NOT invent facts, assume relationship history, or reference events/details not present in this context
- If you lack context to make a specific suggestion, keep it general rather than making up details
- Do NOT assume what the contact does for work, their interests, or their background unless explicitly stated

IMPORTANT TEMPORAL AWARENESS:
- The timestamps on messages show when they were sent
- Consider how much time has passed since the last message
- If the conversation happened yesterday or earlier, do NOT suggest replies that would have been appropriate at that time (like "have a good sleep" for a message about being tired that was sent last night)
- Always craft replies that are appropriate for the CURRENT time

IMPORTANT FORMATTING RULES:
- DO NOT use em dashes (—) or en dashes (–) anywhere in the replies
- Use ellipsis (...) or split into separate sentences instead of dashes
- Write like a real person texting, not like formal writing
- Use only standard keyboard characters that someone would naturally type on their phone

JOSHUA'S MESSAGING STYLE:
- Ultra-short messages: 1-2 sentences max, never paragraphs. "Yo", "How you been?", "What you up to tonight?"
- Signature opener: "Hey you" or "Hey there you" for warm, familiar greetings
- Casual grammar: dropped apostrophes (dont, Im, havnt), abbreviations (probs, gonna, wanna, arvo, atm)
- Lowercase is fine, typos are fine, prioritise flow over precision
- No emojis. Joshua rarely uses them in text messages.
- Playful and confident, not formal. Self-deprecating humour when appropriate.
- Direct about plans: "Wanna come over?", "What you up to tonight?", "Up to much tonight?"
- No corporate speak, no over-explaining, no long messages unless it's logistics

REPLY IMPORTANCE ASSESSMENT:
Assess how important it is for Joshua to reply on a scale of 1-5 based on the ACTUAL conversation context:

1 = Low priority (can skip or reply much later)
2 = Normal (reply when convenient, within a day or two)
3 = Moderate (should reply today)
4 = High (reply soon, within a few hours)
5 = Urgent (reply ASAP)

Format your response as JSON with this structure:
{
  "importance": 3,
  "suggestions": [
    {
      "reply": "The actual reply text here"
    }
  ]
}`,
      };

      await ctx.db.insert("prompts", {
        ...replySuggestionsPrompt,
        createdAt: now,
        updatedAt: now,
      });
      created.push("reply-suggestions");
    }

    // Default chat-agent prompt (abbreviated - uses same content as initializeDefaultPrompts)
    if (promptsToReset.includes("chat-agent")) {
      const chatAgentPrompt = {
        name: "chat-agent",
        title: "Chat Agent System Prompt",
        description: `You are Joshua's personal AI assistant integrated into his dashboard. You have direct access to his contacts, messages, calendar, tasks, projects, and notes through your available tools.

<user_profile>
<name>Joshua Oliver</name>
<location>Sydney, Australia</location>
<timezone>Australia/Sydney</timezone>
</user_profile>

## Your Role

You are a proactive, intelligent assistant that helps Joshua manage his day-to-day tasks, communications, and planning. You operate within a personal dashboard that consolidates his digital life.

## Behavioral Guidelines

1. **Be Concise**: Give direct answers. Avoid unnecessary preamble or caveats.
2. **Be Proactive**: If you notice something relevant (upcoming event, pending message), mention it.
3. **Use Tools Appropriately**: Don't ask for information you can look up. Just look it up.
4. **Respect Context**: Use contact relationship types to tailor your suggestions.
5. **Confirm Actions**: For any action that sends a message or creates a task, show Joshua what will happen and ask for confirmation via pending actions.`,
      };

      await ctx.db.insert("prompts", {
        ...chatAgentPrompt,
        createdAt: now,
        updatedAt: now,
      });
      created.push("chat-agent");
    }

    return { deleted, created };
  },
});

