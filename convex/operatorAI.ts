import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Operator Intelligence Layer
 *
 * AI-powered execution assistance with:
 * - Energy/context understanding via natural language
 * - System-aware tool calls (never guesses)
 * - Weighted random task selection
 * - Momentum tracking
 * - Daily narrative summaries
 */

// ==========================================
// Helper Functions
// ==========================================

function getTodayDate(): string {
  const now = new Date();
  const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
  return sydneyTime.toISOString().split('T')[0];
}

// ==========================================
// Energy & Context Management
// ==========================================

/**
 * Get today's context
 */
export const getTodayContext = query({
  args: {},
  handler: async (ctx) => {
    const date = getTodayDate();
    return await ctx.db
      .query("dailyContext")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();
  },
});

/**
 * Set morning context
 */
export const setMorningContext = mutation({
  args: {
    context: v.string(),
  },
  handler: async (ctx, args) => {
    const date = getTodayDate();
    const now = Date.now();

    // Get today's plan if it exists
    const plan = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    const existing = await ctx.db
      .query("dailyContext")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        morningContext: args.context,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("dailyContext", {
      date,
      planId: plan?._id,
      morningContext: args.context,
      contextNotes: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Add inline context note during the day
 */
export const addContextNote = mutation({
  args: {
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const date = getTodayDate();
    const now = Date.now();

    const existing = await ctx.db
      .query("dailyContext")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        contextNotes: [...existing.contextNotes, { text: args.note, timestamp: now }],
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new context with just the note
    const plan = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    return await ctx.db.insert("dailyContext", {
      date,
      planId: plan?._id,
      contextNotes: [{ text: args.note, timestamp: now }],
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update AI-inferred energy state (called after AI analysis)
 */
export const updateInferredState = internalMutation({
  args: {
    date: v.string(),
    energy: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    focus: v.optional(v.union(v.literal("scattered"), v.literal("moderate"), v.literal("deep"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyContext")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        inferredEnergy: args.energy,
        inferredFocus: args.focus,
        updatedAt: Date.now(),
      });
    }
  },
});

// ==========================================
// AI Tool Definitions (System Queries)
// ==========================================

/**
 * Get free time blocks for today
 * AI Tool: getFreeTimeBlocks
 */
export const toolGetFreeBlocks = internalQuery({
  args: {},
  handler: async (ctx) => {
    const date = getTodayDate();
    const plan = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (!plan) return { blocks: [], message: "No plan exists for today" };

    const now = Date.now();
    const futureBlocks = plan.freeBlocks.filter(b => b.endTime > now);

    return {
      blocks: futureBlocks.map(b => ({
        id: b.id,
        startTime: new Date(b.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        endTime: new Date(b.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        duration: b.duration,
        label: b.label,
      })),
      totalFreeMinutes: futureBlocks.reduce((sum, b) => sum + b.duration, 0),
    };
  },
});

/**
 * Get work pool items
 * AI Tool: getWorkPoolItems
 */
export const toolGetWorkPool = internalQuery({
  args: {
    type: v.optional(v.union(v.literal("todo"), v.literal("linear"), v.literal("adhoc"))),
    priorityMin: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get todos
    const todos = await ctx.db
      .query("todoItems")
      .withIndex("by_completed", (q) => q.eq("isCompleted", false))
      .collect();

    // Get Linear issues
    const linearStarted = await ctx.db
      .query("linearIssues")
      .withIndex("by_status_type", (q) => q.eq("statusType", "started"))
      .collect();
    const linearUnstarted = await ctx.db
      .query("linearIssues")
      .withIndex("by_status_type", (q) => q.eq("statusType", "unstarted"))
      .collect();
    const linearIssues = [...linearStarted, ...linearUnstarted];

    // Get ad-hoc items
    const date = getTodayDate();
    const plan = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    let adhocItems: Array<{ _id: Id<"adhocItems">; text: string; estimatedDuration?: number; isCompleted: boolean }> = [];
    if (plan) {
      const items = await ctx.db
        .query("adhocItems")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .collect();
      adhocItems = items.filter(i => !i.isCompleted);
    }

    // Filter by type if specified
    const result = {
      todos: args.type && args.type !== "todo" ? [] : todos.map(t => ({
        id: t._id,
        title: t.text,
        type: "todo" as const,
        priority: 3,
        estimatedDuration: 30,
      })),
      linear: args.type && args.type !== "linear" ? [] : linearIssues
        .filter(i => !args.priorityMin || i.priority <= args.priorityMin)
        .map(i => ({
          id: i.linearId,
          title: i.title,
          identifier: i.identifier,
          type: "linear" as const,
          priority: i.priority,
          priorityLabel: i.priorityLabel,
          status: i.status,
          dueDate: i.dueDate,
          url: i.url,
          estimatedDuration: 45,
        })),
      adhoc: args.type && args.type !== "adhoc" ? [] : adhocItems.map(a => ({
        id: a._id,
        title: a.text,
        type: "adhoc" as const,
        priority: 3,
        estimatedDuration: a.estimatedDuration ?? 30,
      })),
    };

    return {
      ...result,
      totalItems: result.todos.length + result.linear.length + result.adhoc.length,
      highPriorityCount: result.linear.filter(i => i.priority <= 2).length,
    };
  },
});

/**
 * Get recent execution stats
 * AI Tool: getRecentExecutionStats
 */
export const toolGetExecutionStats = internalQuery({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 7;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Get recent sessions
    const allSessions = await ctx.db.query("timerSessions").collect();
    const recentSessions = allSessions.filter(s => s.startedAt >= since);

    const completed = recentSessions.filter(s => s.result === "completed").length;
    const partial = recentSessions.filter(s => s.result === "partial").length;
    const skipped = recentSessions.filter(s => s.result === "skipped").length;
    const total = recentSessions.length;

    const frogSessions = recentSessions.filter(s => s.mode === "frog");
    const frogCompleted = frogSessions.filter(s => s.result === "completed").length;

    // Calculate average session duration
    const completedSessions = recentSessions.filter(s => s.endedAt && s.result === "completed");
    const avgDuration = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + (s.endedAt! - s.startedAt) / 60000, 0) / completedSessions.length
      : 0;

    return {
      period: `Last ${days} days`,
      totalSessions: total,
      completed,
      partial,
      skipped,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      frogAttempts: frogSessions.length,
      frogCompletions: frogCompleted,
      averageSessionMinutes: Math.round(avgDuration),
    };
  },
});

/**
 * Get skipped tasks history
 * AI Tool: getSkippedTasksHistory
 */
export const toolGetSkippedHistory = internalQuery({
  args: {},
  handler: async (ctx) => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const skipped = await ctx.db
      .query("taskSkipHistory")
      .withIndex("by_skipped")
      .collect();

    const recent = skipped.filter(s => s.skippedAt >= weekAgo);

    return {
      recentlySkipped: recent.map(s => ({
        taskType: s.taskType,
        taskTitle: s.taskTitle,
        skipCount: s.skipCount,
        daysSinceSkip: Math.round((Date.now() - s.skippedAt) / (24 * 60 * 60 * 1000)),
      })),
      totalSkipsThisWeek: recent.reduce((sum, s) => sum + s.skipCount, 0),
      mostSkippedTask: recent.sort((a, b) => b.skipCount - a.skipCount)[0]?.taskTitle,
    };
  },
});

/**
 * Get energy context
 * AI Tool: getEnergyContext
 */
export const toolGetEnergyContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const date = getTodayDate();
    const context = await ctx.db
      .query("dailyContext")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (!context) {
      return {
        hasContext: false,
        message: "No energy context set for today",
      };
    }

    return {
      hasContext: true,
      morningContext: context.morningContext,
      recentNotes: context.contextNotes.slice(-3).map(n => ({
        text: n.text,
        hoursAgo: Math.round((Date.now() - n.timestamp) / (60 * 60 * 1000)),
      })),
      inferredEnergy: context.inferredEnergy,
      inferredFocus: context.inferredFocus,
    };
  },
});

// ==========================================
// Smart Weighted Random Selection
// ==========================================

/**
 * Calculate weighted score for a task
 */
function calculateTaskWeight(task: {
  type: string;
  priority: number;
  dueDate?: string;
  estimatedDuration: number;
  isFrog?: boolean;
}, context: {
  blockDuration: number;
  skipHistory: Map<string, number>;
  energy?: "low" | "medium" | "high";
}): { weight: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {
    priority: 0,
    deadline: 0,
    frogBonus: 0,
    skipDecay: 0,
    durationFit: 0,
    energyMatch: 0,
  };

  // Priority score (Linear: 1=urgent, 2=high, 3=medium, 4=low)
  if (task.type === "linear") {
    factors.priority = task.priority === 1 ? 40 :
                       task.priority === 2 ? 30 :
                       task.priority === 3 ? 15 : 5;
  } else {
    factors.priority = 15; // Default for non-Linear
  }

  // Deadline urgency
  if (task.dueDate) {
    const dueTime = new Date(task.dueDate).getTime();
    const hoursUntilDue = (dueTime - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilDue < 0) factors.deadline = 50; // Overdue!
    else if (hoursUntilDue < 24) factors.deadline = 35;
    else if (hoursUntilDue < 72) factors.deadline = 20;
  }

  // Frog bonus
  if (task.isFrog) {
    factors.frogBonus = 25;
  }

  // Skip decay (tasks skipped before get boosted slightly)
  const skipKey = `${task.type}:${task.priority}`;
  const skipCount = context.skipHistory.get(skipKey) || 0;
  if (skipCount > 0) {
    factors.skipDecay = Math.min(20, skipCount * 5); // Max 20 points boost
  }

  // Duration fit
  const durationRatio = task.estimatedDuration / context.blockDuration;
  if (durationRatio >= 0.7 && durationRatio <= 1.0) {
    factors.durationFit = 15;
  } else if (durationRatio >= 0.5 && durationRatio < 0.7) {
    factors.durationFit = 10;
  } else if (durationRatio < 0.5) {
    factors.durationFit = 5;
  }

  // Energy match (adjust task difficulty based on energy)
  if (context.energy === "low") {
    // Prefer easier tasks when low energy
    if (task.type === "email" || task.type === "adhoc") factors.energyMatch = 10;
    if (task.priority <= 2) factors.energyMatch -= 10; // Penalize hard tasks
  } else if (context.energy === "high") {
    // Prefer challenging tasks when high energy
    if (task.priority <= 2) factors.energyMatch = 15;
  }

  const weight = Object.values(factors).reduce((sum, f) => sum + f, 0);
  return { weight, factors };
}

/**
 * Get weighted random task selection
 */
export const getWeightedSuggestion = action({
  args: {
    blockDuration: v.number(),
    excludeTaskIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{
    task: {
      taskType: string;
      taskId: string;
      taskTitle: string;
      weight: number;
      duration: number;
      reason: string;
    } | null;
    pool: Array<{ taskType: string; taskId: string; taskTitle: string; weight: number }>;
  }> => {
    // Get work pool
    const workPool = await ctx.runQuery(internal.operatorAI.toolGetWorkPool, {});

    // Get energy context
    const energyContext = await ctx.runQuery(internal.operatorAI.toolGetEnergyContext, {});

    // Get skip history
    const skipHistory = await ctx.runQuery(internal.operatorAI.toolGetSkippedHistory, {});
    const skipMap = new Map<string, number>();
    skipHistory.recentlySkipped.forEach((s: { taskType: string; taskTitle: string; skipCount: number }) => {
      skipMap.set(`${s.taskType}:${s.taskTitle}`, s.skipCount);
    });

    // Get today's frog
    const date = getTodayDate();
    const plan = await ctx.runQuery(api.todayPlan.getTodayPlan, { date });
    const frogTaskId = plan?.frogTaskId;

    // Combine all tasks - include all necessary properties
    type TaskWithDetails = { 
      id: string | number; 
      estimatedDuration: number; 
      priority?: number;
      title?: string;
      dueDate?: string;
    };
    const allTasks = [
      ...workPool.todos.map((t: TaskWithDetails) => ({ ...t, type: "todo" as const })),
      ...workPool.linear.map((t: TaskWithDetails) => ({ ...t, type: "linear" as const })),
      ...workPool.adhoc.map((t: TaskWithDetails) => ({ ...t, type: "adhoc" as const })),
    ];

    // Filter by duration and exclusions
    const excludeSet = new Set(args.excludeTaskIds || []);
    const eligibleTasks = allTasks.filter(t =>
      t.estimatedDuration <= args.blockDuration &&
      !excludeSet.has(t.id.toString())
    );

    if (eligibleTasks.length === 0) {
      return { task: null, pool: [] };
    }

    // Calculate weights
    const weightedTasks = eligibleTasks.map(task => {
      const { weight, factors } = calculateTaskWeight(
        {
          type: task.type,
          priority: task.priority ?? 3, // Default to medium priority
          dueDate: task.dueDate,
          estimatedDuration: task.estimatedDuration,
          isFrog: frogTaskId === task.id.toString(),
        },
        {
          blockDuration: args.blockDuration,
          skipHistory: skipMap,
          energy: energyContext.inferredEnergy as "low" | "medium" | "high" | undefined,
        }
      );

      return {
        taskType: task.type,
        taskId: task.id.toString(),
        taskTitle: task.title ?? "Untitled",
        weight,
        factors,
        duration: task.estimatedDuration,
      };
    });

    // Sort by weight (for display)
    weightedTasks.sort((a, b) => b.weight - a.weight);

    // Weighted random selection
    const totalWeight = weightedTasks.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedTask = weightedTasks[0];

    for (const task of weightedTasks) {
      random -= task.weight;
      if (random <= 0) {
        selectedTask = task;
        break;
      }
    }

    // Generate reason based on factors
    const topFactors = Object.entries(selectedTask.factors)
      .filter(([_, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => k);

    const reasonMap: Record<string, string> = {
      priority: "High priority",
      deadline: "Approaching deadline",
      frogBonus: "Your frog for today",
      skipDecay: "Previously skipped",
      durationFit: "Perfect fit for this block",
      energyMatch: "Matches your energy level",
    };

    const reason = topFactors.map(f => reasonMap[f]).join(" • ") || "Good candidate";

    return {
      task: {
        taskType: selectedTask.taskType,
        taskId: selectedTask.taskId,
        taskTitle: selectedTask.taskTitle,
        weight: selectedTask.weight,
        duration: selectedTask.duration,
        reason,
      },
      pool: weightedTasks.slice(0, 5).map(t => ({
        taskType: t.taskType,
        taskId: t.taskId,
        taskTitle: t.taskTitle,
        weight: t.weight,
      })),
    };
  },
});

/**
 * Record a task skip (for decay weighting)
 */
export const recordTaskSkip = mutation({
  args: {
    taskType: v.string(),
    taskId: v.string(),
    taskTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("taskSkipHistory")
      .withIndex("by_task", (q) => q.eq("taskType", args.taskType).eq("taskId", args.taskId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        skipCount: existing.skipCount + 1,
        skippedAt: now,
        lastOfferedAt: now,
      });
    } else {
      await ctx.db.insert("taskSkipHistory", {
        taskType: args.taskType,
        taskId: args.taskId,
        taskTitle: args.taskTitle,
        skippedAt: now,
        skipCount: 1,
        lastOfferedAt: now,
      });
    }
  },
});

// ==========================================
// Execution State Management
// ==========================================

/**
 * Get current execution state
 */
export const getExecutionState = query({
  args: {},
  handler: async (ctx) => {
    const states = await ctx.db.query("executionState").collect();
    return states[0] || null;
  },
});

/**
 * Update execution state with new suggestions
 */
export const updateExecutionState = mutation({
  args: {
    isActive: v.boolean(),
    sessionId: v.optional(v.id("timerSessions")),
    planId: v.optional(v.id("todayPlans")),
    currentTask: v.optional(v.object({
      type: v.string(),
      id: v.string(),
      title: v.string(),
      startedAt: v.number(),
      targetDuration: v.number(),
    })),
    nextSuggestions: v.array(v.object({
      taskType: v.string(),
      taskId: v.string(),
      taskTitle: v.string(),
      weight: v.number(),
      duration: v.number(),
      reason: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("executionState").first();

    const data = {
      isActive: args.isActive,
      sessionId: args.sessionId,
      planId: args.planId,
      currentTask: args.currentTask,
      nextSuggestions: args.nextSuggestions,
      candidatePool: [],
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("executionState", data);
  },
});

// ==========================================
// Momentum Tracking
// ==========================================

/**
 * Get today's momentum
 */
export const getTodayMomentum = query({
  args: {},
  handler: async (ctx) => {
    const date = getTodayDate();
    return await ctx.db
      .query("dailyMomentum")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();
  },
});

/**
 * Compute and store daily momentum stats
 */
export const computeDailyMomentum = internalMutation({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    // Get all sessions for the day
    const allSessions = await ctx.db.query("timerSessions").collect();
    const daySessions = allSessions.filter(s => {
      const sessionDate = new Date(s.startedAt).toISOString().split('T')[0];
      return sessionDate === args.date;
    });

    // Calculate stats
    const blocksStarted = daySessions.length;
    const blocksCompleted = daySessions.filter(s => s.result === "completed").length;
    const blocksPartial = daySessions.filter(s => s.result === "partial").length;
    const blocksSkipped = daySessions.filter(s => s.result === "skipped").length;

    const frogSessions = daySessions.filter(s => s.mode === "frog");
    const frogAttempts = frogSessions.length;
    const frogCompletions = frogSessions.filter(s => s.result === "completed").length;

    // Time stats
    const completedSessions = daySessions.filter(s => s.endedAt);
    const totalMinutesWorked = completedSessions.reduce((sum, s) => {
      const duration = (s.endedAt! - s.startedAt - (s.totalPausedSeconds * 1000)) / 60000;
      return sum + duration;
    }, 0);
    const totalMinutesPlanned = daySessions.reduce((sum, s) => sum + s.targetDuration, 0);
    const averageBlockDuration = blocksStarted > 0 ? totalMinutesWorked / blocksStarted : 0;

    // Task type breakdown
    const taskTypeBreakdown = {
      todo: daySessions.filter(s => s.taskType === "todo").length,
      linear: daySessions.filter(s => s.taskType === "linear").length,
      email: daySessions.filter(s => s.taskType === "email").length,
      adhoc: daySessions.filter(s => s.taskType === "adhoc").length,
    };

    // Timing patterns
    const sortedSessions = [...daySessions].sort((a, b) => a.startedAt - b.startedAt);
    const firstBlockStartedAt = sortedSessions[0]?.startedAt;
    const lastBlockEndedAt = sortedSessions[sortedSessions.length - 1]?.endedAt;

    const now = Date.now();
    const existing = await ctx.db
      .query("dailyMomentum")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    const data = {
      date: args.date,
      planId: plan?._id,
      blocksStarted,
      blocksCompleted,
      blocksPartial,
      blocksSkipped,
      totalMinutesPlanned: Math.round(totalMinutesPlanned),
      totalMinutesWorked: Math.round(totalMinutesWorked),
      averageBlockDuration: Math.round(averageBlockDuration),
      frogAttempts,
      frogCompletions,
      taskTypeBreakdown,
      firstBlockStartedAt,
      lastBlockEndedAt,
      computedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("dailyMomentum", data);
  },
});

/**
 * Increment momentum on session start
 */
export const incrementMomentum = mutation({
  args: {
    field: v.union(
      v.literal("blocksStarted"),
      v.literal("blocksCompleted"),
      v.literal("blocksPartial"),
      v.literal("blocksSkipped"),
      v.literal("frogAttempts"),
      v.literal("frogCompletions")
    ),
  },
  handler: async (ctx, args) => {
    const date = getTodayDate();
    const existing = await ctx.db
      .query("dailyMomentum")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (existing) {
      const update: Record<string, number> = {};
      update[args.field] = (existing[args.field] as number) + 1;
      update.computedAt = Date.now();
      await ctx.db.patch(existing._id, update);
    } else {
      // Create new momentum record with this increment
      const plan = await ctx.db
        .query("todayPlans")
        .withIndex("by_date", (q) => q.eq("date", date))
        .first();

      const data: Record<string, unknown> = {
        date,
        planId: plan?._id,
        blocksStarted: 0,
        blocksCompleted: 0,
        blocksPartial: 0,
        blocksSkipped: 0,
        totalMinutesPlanned: 0,
        totalMinutesWorked: 0,
        averageBlockDuration: 0,
        frogAttempts: 0,
        frogCompletions: 0,
        taskTypeBreakdown: { todo: 0, linear: 0, email: 0, adhoc: 0 },
        computedAt: Date.now(),
      };
      data[args.field] = 1;
      await ctx.db.insert("dailyMomentum", data as never);
    }
  },
});
