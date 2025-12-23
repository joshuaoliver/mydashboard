import { Agent, createTool } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// =============================================================================
// Custom Tools
// =============================================================================

/**
 * Look up a contact by name - searches contacts table for matching names
 */
const lookupContact = createTool({
  description: "Look up a contact by name to find their details (phone, email, Instagram, WhatsApp, etc.)",
  args: z.object({
    name: z.string().describe("The name to search for (first name, last name, or both)"),
  }),
  handler: async (ctx, args) => {
    const contacts = await ctx.runQuery(internal.agentChat.searchContacts, {
      query: args.name,
    });
    if (contacts.length === 0) {
      return { found: false, message: `No contacts found matching "${args.name}"` };
    }
    return { found: true, contacts };
  },
});

/**
 * Create a pending action that requires user approval
 * This is the core "human-in-the-loop" tool for the agent
 */
const createPendingAction = createTool({
  description: "Create a pending action that requires user approval before execution. Use this for any action that modifies data or sends messages.",
  args: z.object({
    actionType: z.enum([
      "message_contact",
      "create_todo",
      "create_reminder",
      "add_to_note",
      "schedule_task",
      "other"
    ]).describe("The type of action to create"),
    title: z.string().describe("Short title describing the action"),
    description: z.string().optional().describe("Detailed description of what the action will do"),
    actionData: z.any().describe("Action-specific data (e.g., contact info, todo text, reminder time)"),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.agentChat.insertPendingAction, {
      threadId: ctx.threadId!,
      messageId: ctx.messageId,
      actionType: args.actionType,
      title: args.title,
      description: args.description,
      actionData: args.actionData,
    });
    return {
      success: true,
      message: `Created pending action: ${args.title}. User will need to approve this before it executes.`,
      actionId: result.actionId,
    };
  },
});

/**
 * Create a todo item immediately (no approval needed for simple todos)
 */
const createTodo = createTool({
  description: "Create a todo item immediately without requiring approval. Use for simple, low-risk tasks.",
  args: z.object({
    text: z.string().describe("The todo item text"),
    documentId: z.string().optional().describe("Optional: specific todo document to add to"),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.agentChat.createTodoItem, {
      text: args.text,
      documentId: args.documentId,
    });
    return {
      success: true,
      message: `Created todo: "${args.text}"`,
      todoId: result.todoId,
    };
  },
});

/**
 * Search recent messages for a contact
 */
const searchContactMessages = createTool({
  description: "Search recent messages from a specific contact to understand context for a reply",
  args: z.object({
    contactName: z.string().describe("Name of the contact to search messages for"),
    limit: z.number().optional().describe("Maximum number of messages to return (default 10)"),
  }),
  handler: async (ctx, args) => {
    const messages = await ctx.runQuery(internal.agentChat.getContactMessages, {
      contactName: args.contactName,
      limit: args.limit ?? 10,
    });
    return messages;
  },
});

/**
 * List recent pending actions for visibility
 */
const listPendingActions = createTool({
  description: "List pending actions that are awaiting user approval",
  args: z.object({
    limit: z.number().optional().describe("Maximum number of actions to return (default 10)"),
  }),
  handler: async (ctx, args) => {
    const actions = await ctx.runQuery(internal.agentChat.getPendingActions, {
      threadId: ctx.threadId!,
      limit: args.limit ?? 10,
    });
    return actions;
  },
});

/**
 * Get current date and time context
 */
const getCurrentContext = createTool({
  description: "Get the current date, time, and any relevant context for planning",
  args: z.object({}),
  handler: async (ctx) => {
    const context = await ctx.runQuery(internal.agentChat.getDailyContext, {});
    return context;
  },
});

// =============================================================================
// Agent Definition
// =============================================================================

export const chatAgent = new Agent(components.agent, {
  name: "PersonalAssistant",
  chat: openai.chat("gpt-4o-mini"),
  textEmbedding: openai.embedding("text-embedding-3-small"),
  instructions: `You are Joshua's personal AI assistant. Your role is to help manage tasks, messages, reminders, and daily planning.

## Core Behaviors

1. **Action Processing**: When the user mentions actions they want to take (like messaging someone, creating reminders, or adding tasks), you should:
   - Create pending actions for important or sensitive operations (like sending messages)
   - Create todos directly for simple task tracking
   - Always confirm what you've created

2. **Contact Lookup**: When the user mentions a person's name:
   - Use the lookupContact tool to find their details
   - If multiple matches, ask for clarification
   - Reference memory to understand context about the relationship

3. **Message Understanding**: When the user wants to reply to someone:
   - Look up recent messages from that contact
   - Understand the conversation context
   - Suggest appropriate responses as pending actions

4. **Voice Note Processing**: When processing voice notes, extract:
   - Action items that need to be created
   - Reminders to set
   - People to contact
   - Tasks to schedule

## Response Style

- Be concise and action-oriented
- Confirm what actions you've created
- Ask for clarification when names or references are ambiguous
- Use natural language, not formal assistant speak

## Tools Available

- lookupContact: Find contact details by name
- createPendingAction: Create actions requiring approval (messages, important tasks)
- createTodo: Create simple todo items immediately
- searchContactMessages: Get recent messages from a contact
- listPendingActions: Show current pending actions
- getCurrentContext: Get today's date and context`,
  tools: {
    lookupContact,
    createPendingAction,
    createTodo,
    searchContactMessages,
    listPendingActions,
    getCurrentContext,
  },
});

// =============================================================================
// Internal Queries and Mutations for Tools
// =============================================================================

/**
 * Search contacts by name
 */
export const searchContacts = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    // Get all contacts and filter by name match
    const allContacts = await ctx.db.query("contacts").collect();
    const query = args.query.toLowerCase();

    const matches = allContacts.filter((contact) => {
      const firstName = contact.firstName?.toLowerCase() || "";
      const lastName = contact.lastName?.toLowerCase() || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const setName = contact.setName?.toLowerCase() || "";

      return (
        firstName.includes(query) ||
        lastName.includes(query) ||
        fullName.includes(query) ||
        setName.includes(query)
      );
    });

    // Return simplified contact info
    return matches.slice(0, 5).map((c) => ({
      id: c._id,
      firstName: c.firstName,
      lastName: c.lastName,
      displayName: c.setName || `${c.firstName || ""} ${c.lastName || ""}`.trim(),
      instagram: c.instagram,
      whatsapp: c.whatsapp,
      phones: c.phones?.map((p) => p.phone) || [],
      emails: c.emails?.map((e) => e.email) || [],
    }));
  },
});

/**
 * Insert a pending action
 */
export const insertPendingAction = internalMutation({
  args: {
    threadId: v.string(),
    messageId: v.optional(v.string()),
    actionType: v.union(
      v.literal("message_contact"),
      v.literal("create_todo"),
      v.literal("create_reminder"),
      v.literal("add_to_note"),
      v.literal("schedule_task"),
      v.literal("other")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    actionData: v.any(),
  },
  handler: async (ctx, args) => {
    const actionId = await ctx.db.insert("agentPendingActions", {
      threadId: args.threadId,
      messageId: args.messageId,
      actionType: args.actionType,
      title: args.title,
      description: args.description,
      actionData: args.actionData,
      status: "pending",
      createdAt: Date.now(),
    });
    return { actionId };
  },
});

/**
 * Create a todo item
 */
export const createTodoItem = internalMutation({
  args: {
    text: v.string(),
    documentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // If no document specified, get or create a default "Quick Tasks" document
    let docId = args.documentId;

    if (!docId) {
      // Look for existing "Quick Tasks" document
      const existingDoc = await ctx.db
        .query("todoDocuments")
        .filter((q) => q.eq(q.field("title"), "Quick Tasks"))
        .first();

      if (existingDoc) {
        docId = existingDoc._id;
      } else {
        // Create new document
        docId = await ctx.db.insert("todoDocuments", {
          title: "Quick Tasks",
          content: "[]",
          todoCount: 0,
          completedCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // Get current max order for the document
    const existingItems = await ctx.db
      .query("todoItems")
      .withIndex("by_document", (q) => q.eq("documentId", docId as any))
      .collect();
    const maxOrder = existingItems.reduce((max, item) => Math.max(max, item.order), -1);

    // Create the todo item
    const todoId = await ctx.db.insert("todoItems", {
      documentId: docId as any,
      text: args.text,
      isCompleted: false,
      order: maxOrder + 1,
      nodeId: `node-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update document count
    await ctx.db.patch(docId as any, {
      todoCount: existingItems.filter((i) => !i.isCompleted).length + 1,
      updatedAt: Date.now(),
    });

    return { todoId };
  },
});

/**
 * Get messages from a specific contact
 */
export const getContactMessages = internalQuery({
  args: {
    contactName: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // First find matching contacts
    const allContacts = await ctx.db.query("contacts").collect();
    const query = args.contactName.toLowerCase();

    const matchedContact = allContacts.find((contact) => {
      const firstName = contact.firstName?.toLowerCase() || "";
      const lastName = contact.lastName?.toLowerCase() || "";
      const fullName = `${firstName} ${lastName}`.trim();
      return (
        firstName.includes(query) ||
        lastName.includes(query) ||
        fullName.includes(query)
      );
    });

    if (!matchedContact) {
      return { found: false, message: `No contact found matching "${args.contactName}"` };
    }

    // Find chats linked to this contact
    const chats = await ctx.db
      .query("beeperChats")
      .withIndex("by_contact", (q) => q.eq("contactId", matchedContact._id))
      .collect();

    if (chats.length === 0) {
      return {
        found: true,
        contact: {
          name: `${matchedContact.firstName || ""} ${matchedContact.lastName || ""}`.trim(),
        },
        messages: [],
        message: "No chat history found for this contact",
      };
    }

    // Get recent messages from all linked chats
    const allMessages = [];
    for (const chat of chats) {
      const messages = await ctx.db
        .query("beeperMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat.chatId))
        .order("desc")
        .take(args.limit);
      allMessages.push(...messages.map((m) => ({
        ...m,
        network: chat.network,
        chatTitle: chat.title,
      })));
    }

    // Sort by timestamp and take limit
    allMessages.sort((a, b) => b.timestamp - a.timestamp);

    return {
      found: true,
      contact: {
        name: `${matchedContact.firstName || ""} ${matchedContact.lastName || ""}`.trim(),
      },
      messages: allMessages.slice(0, args.limit).map((m) => ({
        text: m.text,
        isFromUser: m.isFromUser,
        timestamp: m.timestamp,
        network: m.network,
      })),
    };
  },
});

/**
 * Get pending actions for a thread
 */
export const getPendingActions = internalQuery({
  args: {
    threadId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const actions = await ctx.db
      .query("agentPendingActions")
      .withIndex("by_thread_status", (q) =>
        q.eq("threadId", args.threadId).eq("status", "pending")
      )
      .order("desc")
      .take(args.limit);

    return actions.map((a) => ({
      id: a._id,
      actionType: a.actionType,
      title: a.title,
      description: a.description,
      createdAt: a.createdAt,
    }));
  },
});

/**
 * Get daily context for AI
 */
export const getDailyContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Get today's plan if exists
    const todayPlan = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

    // Get daily context
    const dailyContext = await ctx.db
      .query("dailyContext")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

    return {
      date: today,
      dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
      time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      hasPlan: !!todayPlan,
      energy: dailyContext?.inferredEnergy,
      focus: dailyContext?.inferredFocus,
      morningContext: dailyContext?.morningContext,
    };
  },
});

// =============================================================================
// Public Queries for Frontend
// =============================================================================

/**
 * List pending actions for display
 */
export const listPendingActionsForThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const actions = await ctx.db
      .query("agentPendingActions")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .collect();

    return actions;
  },
});

/**
 * Approve a pending action
 */
export const approvePendingAction = mutation({
  args: { actionId: v.id("agentPendingActions") },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new Error("Action not found");
    if (action.status !== "pending") throw new Error("Action is not pending");

    await ctx.db.patch(args.actionId, {
      status: "approved",
    });

    // TODO: Trigger action execution based on actionType
    // For now, we just mark it as approved

    return { success: true };
  },
});

/**
 * Reject a pending action
 */
export const rejectPendingAction = mutation({
  args: { actionId: v.id("agentPendingActions") },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new Error("Action not found");
    if (action.status !== "pending") throw new Error("Action is not pending");

    await ctx.db.patch(args.actionId, {
      status: "rejected",
    });

    return { success: true };
  },
});
