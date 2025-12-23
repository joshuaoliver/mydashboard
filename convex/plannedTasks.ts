import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all planned tasks for a specific date
export const getPlannedTasksForDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("plannedTasks")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();
  },
});

// Create a planned task (when user drags from Work Pool to calendar)
export const createPlannedTask = mutation({
  args: {
    date: v.string(),
    taskType: v.union(v.literal("todo"), v.literal("linear"), v.literal("adhoc")),
    taskId: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    taskTitle: v.string(),
    taskPriority: v.optional(v.number()),
    projectName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const duration = Math.round((args.endTime - args.startTime) / 60000); // Convert ms to minutes
    const now = Date.now();
    
    return await ctx.db.insert("plannedTasks", {
      date: args.date,
      taskType: args.taskType,
      taskId: args.taskId,
      startTime: args.startTime,
      endTime: args.endTime,
      duration,
      taskTitle: args.taskTitle,
      taskPriority: args.taskPriority,
      projectName: args.projectName,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update a planned task (when user drags to reschedule)
export const updatePlannedTask = mutation({
  args: {
    id: v.id("plannedTasks"),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("scheduled"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Planned task not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.startTime !== undefined) updates.startTime = args.startTime;
    if (args.endTime !== undefined) {
      updates.endTime = args.endTime;
      const startTime = args.startTime ?? existing.startTime;
      updates.duration = Math.round((args.endTime - startTime) / 60000);
    }
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "completed") {
        updates.completedAt = Date.now();
      }
    }

    await ctx.db.patch(args.id, updates);
  },
});

// Delete a planned task (remove from calendar)
export const deletePlannedTask = mutation({
  args: { id: v.id("plannedTasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { 
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});

// Mark a planned task as complete
export const completePlannedTask = mutation({
  args: { id: v.id("plannedTasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

