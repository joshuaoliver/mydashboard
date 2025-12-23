import { Agent, createTool } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { openai } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_SETTINGS } from "./aiSettings";

// =============================================================================
// Dynamic Model Creation
// =============================================================================

/**
 * Create a language model from a model ID string (e.g., "google/gemini-3-flash")
 */
export function createModelFromId(modelId: string) {
  const [provider, modelName] = modelId.split("/");

  switch (provider) {
    case "google":
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google(modelName);
    case "openai":
      const openaiProvider = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return openaiProvider(modelName);
    case "anthropic":
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(modelName);
    case "deepseek":
      // DeepSeek uses OpenAI-compatible API
      const deepseek = createOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com/v1",
      });
      return deepseek(modelName);
    case "xai":
      // xAI Grok uses OpenAI-compatible API
      const xai = createOpenAI({
        apiKey: process.env.XAI_API_KEY,
        baseURL: "https://api.x.ai/v1",
      });
      return xai(modelName);
    default:
      // Default to Google Gemini Flash
      const defaultGoogle = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return defaultGoogle("gemini-2.0-flash");
  }
}

/**
 * Get the default model ID from settings or fallback
 */
export function getDefaultModelId(): string {
  return DEFAULT_SETTINGS["chat-agent"].modelId;
}

// =============================================================================
// Supermemory Integration (Optional)
// =============================================================================

let supermemoryTools: Record<string, unknown> = {};
try {
  if (process.env.SUPERMEMORY_API_KEY) {
    const { createSupermemoryTools } = require("@supermemory/tools/ai-sdk");
    supermemoryTools = createSupermemoryTools(process.env.SUPERMEMORY_API_KEY, {});
  }
} catch (e) {
  console.log("Supermemory not configured - memory tools disabled");
}

// =============================================================================
// Custom Tools
// =============================================================================

/**
 * Look up a contact by name
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
 * Create a todo item immediately
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
 * List recent pending actions
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

/**
 * Get today's calendar events
 */
const getCalendarEvents = createTool({
  description: "Get calendar events for today or a specific date",
  args: z.object({
    date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
  }),
  handler: async (ctx, args) => {
    const events = await ctx.runQuery(internal.agentChat.getCalendarEvents, {
      date: args.date,
    });
    return events;
  },
});

/**
 * Get today's plan
 */
const getTodayPlan = createTool({
  description: "Get the current day's plan including scheduled blocks, tasks, and adhoc items",
  args: z.object({}),
  handler: async (ctx) => {
    const plan = await ctx.runQuery(internal.agentChat.getTodayPlanSummary, {});
    return plan;
  },
});

/**
 * Add an adhoc task to today's plan
 */
const addAdhocTask = createTool({
  description: "Add an adhoc task to today's plan that needs to be done but isn't scheduled in a specific block",
  args: z.object({
    text: z.string().describe("The task description"),
    priority: z.enum(["high", "medium", "low"]).optional().describe("Task priority (default: medium)"),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.agentChat.addAdhocTaskToday, {
      text: args.text,
      priority: args.priority ?? "medium",
    });
    return result;
  },
});

/**
 * List active projects
 */
const listProjects = createTool({
  description: "List all active projects to understand what the user is working on",
  args: z.object({}),
  handler: async (ctx) => {
    const projects = await ctx.runQuery(internal.agentChat.getActiveProjects, {});
    return projects;
  },
});

/**
 * List notes/documents
 */
const listNotes = createTool({
  description: "List available note documents to see where tasks can be added",
  args: z.object({
    limit: z.number().optional().describe("Maximum number of notes to return (default 10)"),
  }),
  handler: async (ctx, args) => {
    const notes = await ctx.runQuery(internal.agentChat.getRecentNotes, {
      limit: args.limit ?? 10,
    });
    return notes;
  },
});

// =============================================================================
// Agent Instructions
// =============================================================================

const agentInstructions = `You are Joshua's personal AI assistant. Your role is to help manage tasks, messages, reminders, and daily planning.

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

4. **Calendar Awareness**: You can check today's calendar events and plan to help schedule tasks appropriately.

5. **Project Context**: You can list active projects to understand what the user is working on.

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
- getCurrentContext: Get today's date and context
- getCalendarEvents: Get calendar events for today
- getTodayPlan: Get today's plan with scheduled blocks
- addAdhocTask: Add a task to today's plan
- listProjects: List active projects
- listNotes: List available note documents

## Memory (if enabled)

You have access to long-term memory across conversations. Use it to:
- Remember important details about contacts and preferences
- Recall past decisions and context
- Store useful information for future reference`;

// =============================================================================
// Agent Definition (Default)
// =============================================================================

// Default agent uses the settings default model
// For dynamic model selection, use createAgentWithModel()
export const chatAgent = new Agent(components.agent, {
  name: "PersonalAssistant",
  chat: createModelFromId(getDefaultModelId()),
  textEmbedding: openai.embedding("text-embedding-3-small"),
  instructions: agentInstructions,
  tools: {
    lookupContact,
    createPendingAction,
    createTodo,
    searchContactMessages,
    listPendingActions,
    getCurrentContext,
    getCalendarEvents,
    getTodayPlan,
    addAdhocTask,
    listProjects,
    listNotes,
    ...supermemoryTools,
  },
});

/**
 * Create an agent with a specific model and optional custom instructions
 * Use this when you need to use a different model than the default
 */
export function createAgentWithModel(modelId: string, customInstructions?: string) {
  return new Agent(components.agent, {
    name: "PersonalAssistant",
    chat: createModelFromId(modelId),
    textEmbedding: openai.embedding("text-embedding-3-small"),
    instructions: customInstructions || agentInstructions,
    tools: {
      lookupContact,
      createPendingAction,
      createTodo,
      searchContactMessages,
      listPendingActions,
      getCurrentContext,
      getCalendarEvents,
      getTodayPlan,
      addAdhocTask,
      listProjects,
      listNotes,
      ...supermemoryTools,
    },
  });
}

// =============================================================================
// Internal Queries and Mutations for Tools
// =============================================================================

/**
 * Search contacts by name
 */
export const searchContacts = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, args) => {
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
    let docId = args.documentId;

    if (!docId) {
      const existingDoc = await ctx.db
        .query("todoDocuments")
        .filter((q) => q.eq(q.field("title"), "Quick Tasks"))
        .first();

      if (existingDoc) {
        docId = existingDoc._id;
      } else {
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

    const existingItems = await ctx.db
      .query("todoItems")
      .withIndex("by_document", (q) => q.eq("documentId", docId as any))
      .collect();
    const maxOrder = existingItems.reduce((max, item) => Math.max(max, item.order), -1);

    const todoId = await ctx.db.insert("todoItems", {
      documentId: docId as any,
      text: args.text,
      isCompleted: false,
      order: maxOrder + 1,
      nodeId: `node-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

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

    const todayPlan = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

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

/**
 * Get calendar events
 */
export const getCalendarEvents = internalQuery({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const targetDate = args.date || new Date().toISOString().split("T")[0];

    // Get events for the target date
    const startOfDay = new Date(targetDate + "T00:00:00").getTime();
    const endOfDay = new Date(targetDate + "T23:59:59").getTime();

    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_start_time")
      .filter((q) =>
        q.and(
          q.gte(q.field("startTime"), startOfDay),
          q.lte(q.field("startTime"), endOfDay)
        )
      )
      .collect();

    return events.map((e) => ({
      title: e.title,
      startTime: new Date(e.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      endTime: new Date(e.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      location: e.location,
      description: e.description,
    }));
  },
});

/**
 * Get today's plan summary
 */
export const getTodayPlanSummary = internalQuery({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];

    const todayPlan = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

    if (!todayPlan) {
      return { hasPlan: false, message: "No plan created for today" };
    }

    // Get adhoc items
    const adhocItems = await ctx.db
      .query("adhocItems")
      .withIndex("by_plan", (q) => q.eq("planId", todayPlan._id))
      .collect();

    return {
      hasPlan: true,
      status: todayPlan.status,
      morningContext: todayPlan.morningContext,
      adhocItems: adhocItems.map((item) => ({
        text: item.text,
        isCompleted: item.isCompleted,
        priority: item.priority,
      })),
    };
  },
});

/**
 * Add adhoc task to today's plan
 */
export const addAdhocTaskToday = internalMutation({
  args: {
    text: v.string(),
    priority: v.string(),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];

    let todayPlan = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

    if (!todayPlan) {
      // Create a basic plan
      const planId = await ctx.db.insert("todayPlans", {
        date: today,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      todayPlan = await ctx.db.get(planId);
    }

    const adhocId = await ctx.db.insert("adhocItems", {
      planId: todayPlan!._id,
      text: args.text,
      isCompleted: false,
      priority: args.priority as "high" | "medium" | "low",
      createdAt: Date.now(),
    });

    return { success: true, adhocId, message: `Added "${args.text}" to today's plan` };
  },
});

/**
 * Get active projects
 */
export const getActiveProjects = internalQuery({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return projects.map((p) => ({
      id: p._id,
      name: p.name,
      description: p.description,
    }));
  },
});

/**
 * Get recent notes
 */
export const getRecentNotes = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("todoDocuments")
      .order("desc")
      .take(args.limit);

    return notes.map((n) => ({
      id: n._id,
      title: n.title,
      todoCount: n.todoCount,
      completedCount: n.completedCount,
      updatedAt: n.updatedAt,
    }));
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
