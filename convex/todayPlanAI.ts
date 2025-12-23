import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";

/**
 * Today Plan AI - AI-powered suggestion engine for time blocks
 *
 * Generates task suggestions for each free block based on:
 * - Block duration
 * - Task priorities and deadlines
 * - Ad-hoc life items as constraints
 * - Simple heuristics (no complex scoring)
 */

// ==========================================
// Types
// ==========================================

interface WorkItem {
  type: "todo" | "linear" | "adhoc" | "email";
  id: string;
  title: string;
  priority: number;
  estimatedDuration: number;
  dueDate?: string;
  preferredTime?: number;
  source?: Record<string, unknown>;
}

interface BlockSuggestion {
  taskType: string;
  taskId: string;
  taskTitle: string;
  suggestedDuration: number;
  confidence: number;
  reason: string;
}

interface FreeBlock {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  label?: string;
}

// ==========================================
// Suggestion Generation
// ==========================================

/**
 * Generate suggestions for a single block
 * Uses simple heuristics, not AI model (for speed and simplicity)
 */
export const generateBlockSuggestions = action({
  args: {
    planId: v.id("todayPlans"),
    blockId: v.string(),
  },
  handler: async (ctx, args): Promise<BlockSuggestion[]> => {
    // Get the plan and work pool
    const plan = await ctx.runQuery(api.todayPlan.getTodayPlan, {});
    if (!plan) return [];

    const block = plan.freeBlocks.find((b: FreeBlock) => b.id === args.blockId);
    if (!block) return [];

    const workPool = await ctx.runQuery(api.todayPlan.getWorkPool, {
      planId: args.planId,
    });

    // Get existing assignments to exclude already-assigned tasks
    const assignments = await ctx.runQuery(api.todayPlan.getBlockAssignments, {
      planId: args.planId,
    });
    const assignedTaskIds = new Set(assignments.map((a: { taskId: string }) => a.taskId));

    // Get ad-hoc items for constraint checking
    const adhocItems = await ctx.runQuery(api.todayPlan.listAdhocItems, {
      planId: args.planId,
    });

    // Filter available tasks
    const availableTasks = workPool.filter(
      (item: WorkItem) => !assignedTaskIds.has(item.id.toString())
    );

    // Generate suggestions using heuristics
    const suggestions = generateSuggestionsForBlock(
      block,
      availableTasks,
      adhocItems
    );

    // Cache suggestions
    await ctx.runMutation(internal.todayPlanAI.cacheSuggestions, {
      planId: args.planId,
      blockId: args.blockId,
      suggestions,
      contextHash: generateContextHash(availableTasks),
    });

    return suggestions;
  },
});

/**
 * Generate suggestions for all blocks in a plan
 */
export const generateAllBlockSuggestions = action({
  args: {
    planId: v.id("todayPlans"),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.runQuery(api.todayPlan.getTodayPlan, {});
    if (!plan) return { generated: 0 };

    let generated = 0;

    for (const block of plan.freeBlocks) {
      await ctx.runAction(api.todayPlanAI.generateBlockSuggestions, {
        planId: args.planId,
        blockId: block.id,
      });
      generated++;
    }

    return { generated };
  },
});

/**
 * Get random task assignment (shuffle)
 */
export const getShuffledTask = action({
  args: {
    planId: v.id("todayPlans"),
    blockId: v.string(),
    excludeTaskIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<BlockSuggestion | null> => {
    const plan = await ctx.runQuery(api.todayPlan.getTodayPlan, {});
    if (!plan) return null;

    const block = plan.freeBlocks.find((b: FreeBlock) => b.id === args.blockId);
    if (!block) return null;

    const workPool = await ctx.runQuery(api.todayPlan.getWorkPool, {
      planId: args.planId,
    });

    // Get existing assignments
    const assignments = await ctx.runQuery(api.todayPlan.getBlockAssignments, {
      planId: args.planId,
    });
    const assignedTaskIds = new Set(assignments.map((a: { taskId: string }) => a.taskId));

    // Exclude already assigned and explicitly excluded tasks
    const excludeSet = new Set([
      ...assignedTaskIds,
      ...(args.excludeTaskIds || []),
    ]);

    const availableTasks = workPool.filter(
      (item: WorkItem) =>
        !excludeSet.has(item.id.toString()) &&
        item.estimatedDuration <= block.duration
    );

    if (availableTasks.length === 0) return null;

    // Random selection
    const randomIndex = Math.floor(Math.random() * availableTasks.length);
    const selectedTask = availableTasks[randomIndex];

    return {
      taskType: selectedTask.type,
      taskId: selectedTask.id.toString(),
      taskTitle: selectedTask.title,
      suggestedDuration: Math.min(selectedTask.estimatedDuration, block.duration),
      confidence: 0.7,
      reason: "Random selection from available tasks",
    };
  },
});

/**
 * Get frog task suggestion
 * Finds the most resistant/difficult task that fits
 */
export const getFrogSuggestion = action({
  args: {
    planId: v.id("todayPlans"),
    blockDuration: v.number(),
  },
  handler: async (ctx, args): Promise<BlockSuggestion | null> => {
    const plan = await ctx.runQuery(api.todayPlan.getTodayPlan, {});
    if (!plan) return null;

    const workPool = await ctx.runQuery(api.todayPlan.getWorkPool, {
      planId: args.planId,
    });

    // Get tasks marked as frog or high priority
    const frogCandidates = workPool
      .filter((item: WorkItem) => {
        // Linear issues with high/urgent priority
        if (item.type === "linear" && item.priority <= 2) return true;
        // Tasks with overdue dates
        if (item.dueDate && new Date(item.dueDate) < new Date()) return true;
        // Current frog task
        if (plan.frogTaskId === item.id.toString()) return true;
        return false;
      })
      .sort((a: WorkItem, b: WorkItem) => {
        // Sort by priority (lower is higher priority in Linear)
        if (a.priority !== b.priority) return a.priority - b.priority;
        // Then by due date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return 0;
      });

    if (frogCandidates.length === 0) {
      // Fall back to any task if no clear frog
      const anyTask = workPool[0];
      if (!anyTask) return null;

      return {
        taskType: anyTask.type,
        taskId: anyTask.id.toString(),
        taskTitle: anyTask.title,
        suggestedDuration: Math.min(anyTask.estimatedDuration, args.blockDuration),
        confidence: 0.5,
        reason: "No clear frog task, selected first available",
      };
    }

    const frog = frogCandidates[0];

    // If frog is too big for the block, suggest a prep step
    if (frog.estimatedDuration > args.blockDuration) {
      return {
        taskType: frog.type,
        taskId: frog.id.toString(),
        taskTitle: `Frog prep: Start on "${frog.title}"`,
        suggestedDuration: args.blockDuration,
        confidence: 0.8,
        reason: `Task too large (${frog.estimatedDuration}m) - starting with first ${args.blockDuration}m chunk`,
      };
    }

    return {
      taskType: frog.type,
      taskId: frog.id.toString(),
      taskTitle: frog.title,
      suggestedDuration: frog.estimatedDuration,
      confidence: 0.9,
      reason: frog.priority <= 2
        ? "High priority task"
        : ('dueDate' in frog && frog.dueDate)
        ? "Overdue task"
        : "Designated frog",
    };
  },
});

// ==========================================
// Internal Helpers
// ==========================================

/**
 * Cache suggestions for a block
 */
export const cacheSuggestions = internalMutation({
  args: {
    planId: v.id("todayPlans"),
    blockId: v.string(),
    suggestions: v.array(v.object({
      taskType: v.string(),
      taskId: v.string(),
      taskTitle: v.string(),
      suggestedDuration: v.number(),
      confidence: v.number(),
      reason: v.string(),
    })),
    contextHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for existing cache
    const existing = await ctx.db
      .query("aiBlockSuggestions")
      .withIndex("by_plan_block", (q) =>
        q.eq("planId", args.planId).eq("blockId", args.blockId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        suggestions: args.suggestions,
        contextHash: args.contextHash,
        generatedAt: Date.now(),
        modelUsed: "heuristic-v1",
      });
    } else {
      await ctx.db.insert("aiBlockSuggestions", {
        planId: args.planId,
        blockId: args.blockId,
        suggestions: args.suggestions,
        contextHash: args.contextHash,
        generatedAt: Date.now(),
        modelUsed: "heuristic-v1",
      });
    }
  },
});

/**
 * Get cached suggestions for a block
 */
export const getCachedSuggestions = internalQuery({
  args: {
    planId: v.id("todayPlans"),
    blockId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiBlockSuggestions")
      .withIndex("by_plan_block", (q) =>
        q.eq("planId", args.planId).eq("blockId", args.blockId)
      )
      .first();
  },
});

// ==========================================
// Heuristic Engine
// ==========================================

interface AdhocItem {
  text: string;
  estimatedDuration?: number;
  preferredTime?: number;
  isCompleted: boolean;
}

function generateSuggestionsForBlock(
  block: FreeBlock,
  availableTasks: WorkItem[],
  adhocItems: AdhocItem[]
): BlockSuggestion[] {
  const suggestions: BlockSuggestion[] = [];
  const now = Date.now();
  const blockStart = block.startTime;

  // Check for adhoc constraints
  const relevantAdhoc = adhocItems.filter(item => {
    if (item.isCompleted) return false;
    if (!item.preferredTime) return false;
    // Check if preferred time falls within or near this block
    const timeDiff = Math.abs(item.preferredTime - blockStart);
    return timeDiff < 2 * 60 * 60 * 1000; // Within 2 hours
  });

  // If there's a time-specific adhoc item (like lunch at 12:30), suggest it first
  for (const adhoc of relevantAdhoc) {
    if (adhoc.preferredTime && adhoc.preferredTime >= blockStart &&
        adhoc.preferredTime < block.endTime) {
      suggestions.push({
        taskType: "adhoc",
        taskId: "", // Will need actual ID
        taskTitle: adhoc.text,
        suggestedDuration: adhoc.estimatedDuration || 30,
        confidence: 0.95,
        reason: "Scheduled life item",
      });
    }
  }

  // Check for untimed adhoc items (like "breakfast sometime")
  const untimedAdhoc = adhocItems.filter(item =>
    !item.isCompleted && !item.preferredTime
  );

  // If it's a short block and there's an untimed adhoc, consider suggesting it
  if (block.duration <= 30 && untimedAdhoc.length > 0) {
    const item = untimedAdhoc[0];
    suggestions.push({
      taskType: "adhoc",
      taskId: "",
      taskTitle: item.text,
      suggestedDuration: item.estimatedDuration || 20,
      confidence: 0.7,
      reason: "Good fit for short block",
    });
  }

  // Score and rank available tasks
  const scoredTasks = availableTasks
    .filter((task: WorkItem) => task.estimatedDuration <= block.duration)
    .map((task: WorkItem) => ({
      task,
      score: calculateTaskScore(task, block, now),
    }))
    .sort((a, b) => b.score - a.score);

  // Add top 3 tasks as suggestions
  for (let i = 0; i < Math.min(3, scoredTasks.length); i++) {
    const { task, score } = scoredTasks[i];
    const normalizedConfidence = Math.min(0.95, 0.5 + score / 200);

    suggestions.push({
      taskType: task.type,
      taskId: task.id.toString(),
      taskTitle: task.title,
      suggestedDuration: Math.min(task.estimatedDuration, block.duration),
      confidence: normalizedConfidence,
      reason: getReasonForScore(task, score),
    });
  }

  // Always include an email block option for blocks > 15 min
  if (block.duration >= 15 && suggestions.length < 3) {
    const emailDuration = block.duration >= 30 ? 20 : 15;
    suggestions.push({
      taskType: "email",
      taskId: "email-triage",
      taskTitle: block.duration >= 30 ? "Triage inbox" : "Quick email check",
      suggestedDuration: emailDuration,
      confidence: 0.6,
      reason: "Email fits well in any block",
    });
  }

  return suggestions.slice(0, 3);
}

function calculateTaskScore(task: WorkItem, block: FreeBlock, now: number): number {
  let score = 50; // Base score

  // Priority boost (Linear priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low)
  if (task.type === "linear") {
    if (task.priority === 1) score += 40; // Urgent
    else if (task.priority === 2) score += 30; // High
    else if (task.priority === 3) score += 15; // Medium
  }

  // Due date urgency
  if (task.dueDate) {
    const dueTime = new Date(task.dueDate).getTime();
    const hoursUntilDue = (dueTime - now) / (1000 * 60 * 60);

    if (hoursUntilDue < 0) score += 50; // Overdue!
    else if (hoursUntilDue < 24) score += 35; // Due today
    else if (hoursUntilDue < 72) score += 20; // Due in 3 days
  }

  // Duration fit bonus
  const durationRatio = task.estimatedDuration / block.duration;
  if (durationRatio >= 0.7 && durationRatio <= 1.0) {
    score += 15; // Good fit
  } else if (durationRatio >= 0.5) {
    score += 10; // Okay fit
  }

  // Type bonuses
  if (task.type === "linear") score += 5; // Slight preference for tracked work
  if (task.type === "todo") score += 3; // Todos also good

  return score;
}

function getReasonForScore(task: WorkItem, score: number): string {
  if (score >= 90) {
    if (task.dueDate && new Date(task.dueDate).getTime() < Date.now()) {
      return "Overdue - needs attention";
    }
    return "High priority task";
  }
  if (score >= 70) {
    if (task.dueDate) return "Due soon";
    if (task.priority <= 2) return "High priority";
    return "Good candidate";
  }
  if (score >= 50) {
    return "Fits the time block well";
  }
  return "Available task";
}

function generateContextHash(workPool: WorkItem[]): string {
  // Simple hash based on work pool state
  const ids = workPool.map(w => w.id).sort().join(",");
  return `ctx_${ids.length}_${Date.now()}`;
}
