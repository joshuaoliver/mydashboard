import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Today Plan - Main functions for the daily planning feature
 *
 * Manages:
 * - Free time blocks (calculated from calendar)
 * - Work pool (todos + Linear + ad-hoc items)
 * - Block assignments and suggestions
 * - Timer sessions
 */

// ==========================================
// Helper Functions
// ==========================================

/**
 * Get today's date in YYYY-MM-DD format (in local timezone)
 */
function getTodayDate(): string {
  // Use Sydney timezone for consistency with the rest of the app
  const now = new Date();
  const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
  return sydneyTime.toISOString().split('T')[0];
}

/**
 * Generate a unique block ID
 */
function generateBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ==========================================
// Today Plan Core Functions
// ==========================================

/**
 * Get or create today's plan
 */
export const getOrCreateTodayPlan = mutation({
  args: {
    date: v.optional(v.string()), // Optional date override (YYYY-MM-DD)
  },
  handler: async (ctx, args) => {
    const date = args.date ?? getTodayDate();

    // Check if plan exists for this date
    const existing = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (existing) {
      return existing;
    }

    // Create new plan for today
    const now = Date.now();
    const id = await ctx.db.insert("todayPlans", {
      date,
      freeBlocks: [],
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(id);
  },
});

/**
 * Get today's plan (query only, no creation)
 */
export const getTodayPlan = query({
  args: {
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const date = args.date ?? getTodayDate();

    return await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();
  },
});

/**
 * Update free blocks for a plan
 * Called after calendar sync to refresh available time slots
 */
export const updateFreeBlocks = mutation({
  args: {
    planId: v.id("todayPlans"),
    freeBlocks: v.array(v.object({
      id: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      duration: v.number(),
      label: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.planId, {
      freeBlocks: args.freeBlocks,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Set the frog task for today
 */
export const setFrogTask = mutation({
  args: {
    planId: v.id("todayPlans"),
    taskId: v.optional(v.string()), // null to clear
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.planId, {
      frogTaskId: args.taskId,
      updatedAt: Date.now(),
    });
  },
});

// ==========================================
// Ad-hoc Items (Life Items)
// ==========================================

/**
 * List ad-hoc items for a plan
 */
export const listAdhocItems = query({
  args: {
    planId: v.id("todayPlans"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("adhocItems")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();
  },
});

/**
 * Add an ad-hoc item (life item like breakfast, gym, etc.)
 */
export const addAdhocItem = mutation({
  args: {
    planId: v.id("todayPlans"),
    text: v.string(),
    estimatedDuration: v.optional(v.number()),
    preferredTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get current max order
    const existing = await ctx.db
      .query("adhocItems")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();

    const maxOrder = existing.reduce((max, item) => Math.max(max, item.order), -1);

    const id = await ctx.db.insert("adhocItems", {
      planId: args.planId,
      text: args.text,
      estimatedDuration: args.estimatedDuration,
      preferredTime: args.preferredTime,
      isCompleted: false,
      order: maxOrder + 1,
      createdAt: Date.now(),
    });

    return id;
  },
});

/**
 * Update an ad-hoc item
 */
export const updateAdhocItem = mutation({
  args: {
    id: v.id("adhocItems"),
    text: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
    preferredTime: v.optional(v.number()),
    isCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const now = Date.now();

    const item = await ctx.db.get(id);
    if (!item) throw new Error("Ad-hoc item not found");

    const patch: Record<string, unknown> = {};

    if (updates.text !== undefined) patch.text = updates.text;
    if (updates.estimatedDuration !== undefined) patch.estimatedDuration = updates.estimatedDuration;
    if (updates.preferredTime !== undefined) patch.preferredTime = updates.preferredTime;
    if (updates.isCompleted !== undefined) {
      patch.isCompleted = updates.isCompleted;
      if (updates.isCompleted && !item.isCompleted) {
        patch.completedAt = now;
      } else if (!updates.isCompleted) {
        patch.completedAt = undefined;
      }
    }

    await ctx.db.patch(id, patch);
  },
});

/**
 * Delete an ad-hoc item
 */
export const deleteAdhocItem = mutation({
  args: {
    id: v.id("adhocItems"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ==========================================
// Block Assignments
// ==========================================

/**
 * Get assignments for a plan
 */
export const getBlockAssignments = query({
  args: {
    planId: v.id("todayPlans"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blockAssignments")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();
  },
});

/**
 * Assign a task to a block
 */
export const assignTaskToBlock = mutation({
  args: {
    planId: v.id("todayPlans"),
    blockId: v.string(),
    taskType: v.union(v.literal("todo"), v.literal("linear"), v.literal("adhoc"), v.literal("email")),
    taskId: v.string(),
    taskTitle: v.string(),
    taskDuration: v.number(),
    aiConfidence: v.optional(v.number()),
    aiReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if there's already an assignment for this block
    const existing = await ctx.db
      .query("blockAssignments")
      .withIndex("by_block", (q) => q.eq("planId", args.planId).eq("blockId", args.blockId))
      .first();

    if (existing) {
      // Update existing assignment
      await ctx.db.patch(existing._id, {
        taskType: args.taskType,
        taskId: args.taskId,
        taskTitle: args.taskTitle,
        taskDuration: args.taskDuration,
        status: "assigned",
        aiConfidence: args.aiConfidence,
        aiReason: args.aiReason,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new assignment
    const id = await ctx.db.insert("blockAssignments", {
      planId: args.planId,
      blockId: args.blockId,
      taskType: args.taskType,
      taskId: args.taskId,
      taskTitle: args.taskTitle,
      taskDuration: args.taskDuration,
      status: "assigned",
      aiConfidence: args.aiConfidence,
      aiReason: args.aiReason,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Update assignment status
 */
export const updateAssignmentStatus = mutation({
  args: {
    id: v.id("blockAssignments"),
    status: v.union(
      v.literal("suggested"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("skipped")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Clear assignment from a block
 */
export const clearBlockAssignment = mutation({
  args: {
    planId: v.id("todayPlans"),
    blockId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("blockAssignments")
      .withIndex("by_block", (q) => q.eq("planId", args.planId).eq("blockId", args.blockId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// ==========================================
// Work Pool Queries
// ==========================================

/**
 * Get the unified work pool for today
 * Combines: todos, Linear issues, and ad-hoc items
 */
export const getWorkPool = query({
  args: {
    planId: v.optional(v.id("todayPlans")),
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const includeCompleted = args.includeCompleted ?? false;

    // Get uncompleted todos
    const todoQuery = ctx.db
      .query("todoItems")
      .withIndex("by_completed", (q) => q.eq("isCompleted", false));

    const todos = await todoQuery.collect();

    // Get uncompleted Linear issues
    const linearIssues = await ctx.db
      .query("linearIssues")
      .withIndex("by_status_type", (q) => q.eq("statusType", "started"))
      .collect();

    // Also get unstarted issues
    const unstartedIssues = await ctx.db
      .query("linearIssues")
      .withIndex("by_status_type", (q) => q.eq("statusType", "unstarted"))
      .collect();

    // Get ad-hoc items if plan provided
    let adhocItems: Array<{
      _id: Id<"adhocItems">;
      text: string;
      estimatedDuration?: number;
      preferredTime?: number;
      isCompleted: boolean;
      order: number;
    }> = [];

    if (args.planId) {
      const items = await ctx.db
        .query("adhocItems")
        .withIndex("by_plan", (q) => q.eq("planId", args.planId as Id<"todayPlans">))
        .collect();

      adhocItems = includeCompleted
        ? items
        : items.filter(item => !item.isCompleted);
    }

    // Get document titles for todos
    const documentIds = [...new Set(todos.map(t => t.documentId))];
    const documents = await Promise.all(
      documentIds.map(id => ctx.db.get(id))
    );
    const docMap = new Map(documents.filter(Boolean).map(d => [d!._id, d!.title]));

    // Transform to unified format
    const workItems = [
      // Todos
      ...todos.map(todo => ({
        type: "todo" as const,
        id: todo._id,
        title: todo.text,
        source: {
          documentId: todo.documentId,
          documentTitle: docMap.get(todo.documentId) || "Unknown",
          projectId: todo.projectId,
        },
        priority: 3, // Default medium priority for todos
        estimatedDuration: 30, // Default 30 min
        dueDate: undefined,
        createdAt: todo.createdAt,
      })),
      // Linear issues
      ...[...linearIssues, ...unstartedIssues].map(issue => ({
        type: "linear" as const,
        id: issue.linearId,
        title: issue.title,
        source: {
          identifier: issue.identifier,
          teamName: issue.teamName,
          url: issue.url,
        },
        priority: issue.priority,
        priorityLabel: issue.priorityLabel,
        estimatedDuration: 45, // Default 45 min for Linear issues
        dueDate: issue.dueDate,
        status: issue.status,
        statusType: issue.statusType,
        createdAt: issue.createdAt,
      })),
      // Ad-hoc items
      ...adhocItems.map(item => ({
        type: "adhoc" as const,
        id: item._id,
        title: item.text,
        source: {},
        priority: 3,
        estimatedDuration: item.estimatedDuration ?? 30,
        preferredTime: item.preferredTime,
        isCompleted: item.isCompleted,
        order: item.order,
      })),
    ];

    return workItems;
  },
});

// ==========================================
// Timer Sessions
// ==========================================

/**
 * Get active timer session
 */
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const session = await ctx.db
      .query("timerSessions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    if (!session) return null;

    let projectName = undefined;
    let taskUrl = undefined;

    if (session.taskType === "linear") {
      // fetch linear issue to get project/team info
      const issue = await ctx.db
        .query("linearIssues")
        .withIndex("by_linear_id", q => q.eq("linearId", session.taskId))
        .first();

      if (issue) {
        taskUrl = issue.url;
        if (issue.projectId) {
          const proj = await ctx.db.get(issue.projectId);
          if (proj) projectName = proj.name;
        } else {
          projectName = issue.teamName; // Fallback to team name
        }
      }
    } else if (session.taskType === "todo") {
      // fetch todo to get project/doc info
      // We know taskId is an ID, but we need to cast or just use it.
      // In valid usage it overlaps, but safer to try/catch or just use generic get if possible.
      // However, we know it's an ID from how we inserted it.
      try {
        // We cast to any to allow generic get, or assume it's valid Id string
        const todo = await ctx.db.get(session.taskId as any);
        if (todo) {
          if (todo.projectId) {
            const proj = await ctx.db.get(todo.projectId);
            if (proj) projectName = proj.name;
          } else if (todo.documentId) {
            const doc = await ctx.db.get(todo.documentId);
            if (doc) projectName = doc.title; // Use doc title as project fallback
          }
        }
      } catch (e) {
        // Ignore invalid ID errors
      }
    }

    return {
      ...session,
      projectName,
      taskUrl
    };
  },
});

/**
 * Update the session note (live save)
 */
export const updateSessionNote = mutation({
  args: {
    sessionId: v.id("timerSessions"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      resultNote: args.note,
    });
  },
});

/**
 * Start a timer session
 */
export const startTimerSession = mutation({
  args: {
    planId: v.id("todayPlans"),
    blockId: v.optional(v.string()),
    assignmentId: v.optional(v.id("blockAssignments")),
    taskType: v.string(),
    taskId: v.string(),
    taskTitle: v.string(),
    mode: v.union(v.literal("normal"), v.literal("frog")),
    targetDuration: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // End any existing active session
    const activeSession = await ctx.db
      .query("timerSessions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    if (activeSession) {
      await ctx.db.patch(activeSession._id, {
        isActive: false,
        endedAt: now,
        result: "skipped",
      });
    }

    // Update assignment status if provided
    if (args.assignmentId) {
      await ctx.db.patch(args.assignmentId, {
        status: "in_progress",
        updatedAt: now,
      });
    }

    // Create new session
    const id = await ctx.db.insert("timerSessions", {
      planId: args.planId,
      blockId: args.blockId,
      assignmentId: args.assignmentId,
      taskType: args.taskType,
      taskId: args.taskId,
      taskTitle: args.taskTitle,
      mode: args.mode,
      targetDuration: args.targetDuration,
      startedAt: now,
      totalPausedSeconds: 0,
      isActive: true,
    });

    return id;
  },
});

/**
 * Pause the active timer session
 */
export const pauseTimerSession = mutation({
  args: {
    id: v.id("timerSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session || !session.isActive || session.pausedAt) {
      throw new Error("Session cannot be paused");
    }

    await ctx.db.patch(args.id, {
      pausedAt: Date.now(),
    });
  },
});

/**
 * Resume a paused timer session
 */
export const resumeTimerSession = mutation({
  args: {
    id: v.id("timerSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session || !session.isActive || !session.pausedAt) {
      throw new Error("Session cannot be resumed");
    }

    const pausedDuration = Math.floor((Date.now() - session.pausedAt) / 1000);

    await ctx.db.patch(args.id, {
      pausedAt: undefined,
      totalPausedSeconds: session.totalPausedSeconds + pausedDuration,
    });
  },
});

/**
 * End a timer session
 */
export const endTimerSession = mutation({
  args: {
    id: v.id("timerSessions"),
    result: v.union(v.literal("completed"), v.literal("partial"), v.literal("skipped")),
    resultNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db.get(args.id);

    if (!session) {
      throw new Error("Session not found");
    }

    // Calculate total paused time if still paused
    let totalPausedSeconds = session.totalPausedSeconds;
    if (session.pausedAt) {
      totalPausedSeconds += Math.floor((now - session.pausedAt) / 1000);
    }

    await ctx.db.patch(args.id, {
      isActive: false,
      endedAt: now,
      totalPausedSeconds,
      result: args.result,
      resultNote: args.resultNote,
    });

    // Update assignment status if linked
    if (session.assignmentId) {
      const newStatus = args.result === "completed" ? "completed" :
        args.result === "skipped" ? "skipped" : "assigned";
      await ctx.db.patch(session.assignmentId, {
        status: newStatus,
        updatedAt: now,
      });
    }

    // If task was a todo and completed, mark it as done
    if (args.result === "completed" && session.taskType === "todo") {
      const todoId = session.taskId as Id<"todoItems">;
      const todo = await ctx.db.get(todoId);
      if (todo && !todo.isCompleted) {
        await ctx.db.patch(todoId, {
          isCompleted: true,
          completedAt: now,
          updatedAt: now,
        });
      }
    }

    // If task was an adhoc item and completed, mark it as done
    if (args.result === "completed" && session.taskType === "adhoc") {
      const adhocId = session.taskId as Id<"adhocItems">;
      const adhoc = await ctx.db.get(adhocId);
      if (adhoc && !adhoc.isCompleted) {
        await ctx.db.patch(adhocId, {
          isCompleted: true,
          completedAt: now,
        });
      }
    }
  },
});

/**
 * Get timer sessions for a plan
 */
export const getPlanSessions = query({
  args: {
    planId: v.id("todayPlans"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("timerSessions")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();
  },
});

// ==========================================
// Email Blocks
// ==========================================

/**
 * Get email block templates
 */
export const getEmailBlocks = query({
  args: {},
  handler: async (ctx) => {
    const blocks = await ctx.db.query("emailBlocks").collect();

    // If no blocks exist, return defaults
    if (blocks.length === 0) {
      return [
        { id: "email-triage", title: "Triage inbox", duration: 20, isDefault: true },
        { id: "email-reply-5", title: "Reply to newest 5", duration: 15, isDefault: true },
        { id: "email-flagged", title: "Clear flagged threads", duration: 30, isDefault: false },
        { id: "email-deep", title: "Deep email admin", duration: 45, isDefault: false },
      ];
    }

    return blocks.map(b => ({
      id: b._id,
      title: b.title,
      duration: b.duration,
      isDefault: b.isDefault,
    }));
  },
});

/**
 * Initialize default email blocks
 */
export const initializeEmailBlocks = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("emailBlocks").first();
    if (existing) return { created: 0 };

    const defaults = [
      { title: "Triage inbox", duration: 20, isDefault: true, order: 0 },
      { title: "Reply to newest 5", duration: 15, isDefault: true, order: 1 },
      { title: "Clear flagged threads", duration: 30, isDefault: false, order: 2 },
      { title: "Deep email admin", duration: 45, isDefault: false, order: 3 },
    ];

    for (const block of defaults) {
      await ctx.db.insert("emailBlocks", block);
    }

    return { created: defaults.length };
  },
});

// ==========================================
// Calendar Integration Helpers
// ==========================================

/**
 * Calculate free blocks from calendar events for a given day
 */
export const calculateFreeBlocks = internalQuery({
  args: {
    date: v.string(), // YYYY-MM-DD
    dayStartHour: v.optional(v.number()), // Default 8
    dayEndHour: v.optional(v.number()), // Default 18
    minBlockMinutes: v.optional(v.number()), // Default 15
  },
  handler: async (ctx, args) => {
    const dayStartHour = args.dayStartHour ?? 8;
    const dayEndHour = args.dayEndHour ?? 18;
    const minBlockMinutes = args.minBlockMinutes ?? 15;

    // Parse date and get day boundaries in Sydney time
    const [year, month, day] = args.date.split('-').map(Number);

    // Create date objects for day boundaries
    const dayStart = new Date(year, month - 1, day, dayStartHour, 0, 0);
    const dayEnd = new Date(year, month - 1, day, dayEndHour, 0, 0);

    const dayStartTs = dayStart.getTime();
    const dayEndTs = dayEnd.getTime();

    // Get calendar events for this day
    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_start_time")
      .collect();

    // Filter to events that overlap with this day
    const dayEvents = events
      .filter(e =>
        e.status !== "cancelled" &&
        !e.isAllDay &&
        e.startTime < dayEndTs &&
        e.endTime > dayStartTs
      )
      .sort((a, b) => a.startTime - b.startTime);

    // Calculate free blocks
    const freeBlocks: Array<{
      id: string;
      startTime: number;
      endTime: number;
      duration: number;
      label?: string;
    }> = [];

    let currentTime = dayStartTs;

    for (const event of dayEvents) {
      const eventStart = Math.max(event.startTime, dayStartTs);
      const eventEnd = Math.min(event.endTime, dayEndTs);

      // If there's a gap before this event
      if (eventStart > currentTime) {
        const gapDuration = Math.floor((eventStart - currentTime) / (1000 * 60));

        if (gapDuration >= minBlockMinutes) {
          freeBlocks.push({
            id: generateBlockId(),
            startTime: currentTime,
            endTime: eventStart,
            duration: gapDuration,
            label: freeBlocks.length === 0 ? "Start of day" : `Before: ${event.summary}`,
          });
        }
      }

      currentTime = Math.max(currentTime, eventEnd);
    }

    // Check for free time after last event
    if (currentTime < dayEndTs) {
      const gapDuration = Math.floor((dayEndTs - currentTime) / (1000 * 60));

      if (gapDuration >= minBlockMinutes) {
        freeBlocks.push({
          id: generateBlockId(),
          startTime: currentTime,
          endTime: dayEndTs,
          duration: gapDuration,
          label: "End of day",
        });
      }
    }

    return freeBlocks;
  },
});

/**
 * Refresh free blocks for today's plan
 */
export const refreshFreeBlocks = mutation({
  args: {
    planId: v.id("todayPlans"),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan not found");

    // For now, create sample free blocks if calendar isn't set up
    // In a real implementation, this would call calculateFreeBlocks
    const today = getTodayDate();
    const [year, month, day] = today.split('-').map(Number);

    // Create sample blocks for demo (every hour from 9 AM to 5 PM)
    const sampleBlocks = [];
    for (let hour = 9; hour < 17; hour += 2) {
      const startTime = new Date(year, month - 1, day, hour, 0, 0).getTime();
      const endTime = new Date(year, month - 1, day, hour + 1, 30, 0).getTime();

      sampleBlocks.push({
        id: generateBlockId(),
        startTime,
        endTime,
        duration: 90,
        label: hour === 9 ? "Morning block" : hour === 14 ? "Afternoon focus" : undefined,
      });
    }

    await ctx.db.patch(args.planId, {
      freeBlocks: sampleBlocks,
      updatedAt: Date.now(),
    });

    return sampleBlocks;
  },
});
