import { v } from "convex/values";
import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { 
  HubstaffActivity, 
  HubstaffUser, 
  HubstaffProject, 
  HubstaffTask,
  HubstaffActivitiesResponse 
} from "./hubstaffClient";

/**
 * Hubstaff Sync - Periodic sync of time entries
 * 
 * Ported from transdirect-pm/agents/hubstaff-agent-db.js
 */

// Type for settings
interface HubstaffSettings {
  refreshToken?: string;
  accessToken?: string;
  tokenExpiry?: number;
  organizationId?: number;
  organizationName?: string;
  selectedUserId?: number;
  selectedUserName?: string;
  isConfigured?: boolean;
}

// Type for project
interface Project {
  _id: string;
  name: string;
  hubstaffProjectId?: number;
  hubstaffProjectName?: string;
  linearWorkspaceId?: string;
  linearTeamId?: string;
  linearTeamName?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// ==========================================
// Main Sync Action
// ==========================================

/**
 * Main sync action - called by cron every 15 minutes
 * Syncs time entries for the selected user
 */
export const syncTimeEntries = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    skipped?: boolean;
    reason?: string;
    success?: boolean;
    entriesProcessed?: number;
    entriesDeleted?: number;
    datesProcessed?: number;
    error?: string;
  }> => {
    console.log("Starting Hubstaff time entries sync...");

    // Get Hubstaff settings
    const settings: HubstaffSettings | null = await ctx.runQuery(
      internal.settingsStore.getHubstaffSettingsInternal, 
      {}
    );

    if (!settings?.isConfigured || !settings?.selectedUserId) {
      console.log("Hubstaff not configured or no user selected, skipping sync");
      return { skipped: true, reason: "not_configured" };
    }

    try {
      // Sync today and yesterday (to catch late entries)
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const startDate = yesterday.toISOString().split("T")[0];
      const endDate = today.toISOString().split("T")[0];

      console.log(`Syncing Hubstaff entries from ${startDate} to ${endDate} for user ${settings.selectedUserId}`);

      // Get active projects to filter by
      const projects: Project[] = await ctx.runQuery(
        internal.projectsStore.listActiveProjectsInternal, 
        {}
      );
      const hubstaffProjectIds: number[] = projects
        .filter((p: Project) => p.hubstaffProjectId)
        .map((p: Project) => p.hubstaffProjectId as number);

      // Fetch activities from Hubstaff API
      const activities: HubstaffActivitiesResponse = await ctx.runAction(
        internal.hubstaffActions.fetchActivities, 
        {
          startDate,
          endDate,
          userIds: [settings.selectedUserId],
          projectIds: hubstaffProjectIds.length > 0 ? hubstaffProjectIds : undefined,
        }
      );

      if (!activities.daily_activities?.length) {
        console.log("No activities found for the date range");
        return { success: true, entriesProcessed: 0 };
      }

      // Create lookup maps for side-loaded data
      const userMap = new Map<number, HubstaffUser>(
        (activities.users || []).map((u: HubstaffUser) => [u.id, u])
      );
      const projectMap = new Map<number, HubstaffProject>(
        (activities.projects || []).map((p: HubstaffProject) => [p.id, p])
      );
      const taskMap = new Map<number, HubstaffTask>(
        (activities.tasks || []).map((t: HubstaffTask) => [t.id, t])
      );

      // Store entries
      const result = await ctx.runMutation(internal.hubstaffSync.upsertTimeEntries, {
        activities: activities.daily_activities.map((activity: HubstaffActivity) => ({
          ...activity,
          userName: userMap.get(activity.user_id)?.name || `User ${activity.user_id}`,
          projectName: projectMap.get(activity.project_id)?.name || `Project ${activity.project_id}`,
          taskName: activity.task_id ? taskMap.get(activity.task_id)?.summary : undefined,
        })),
        selectedUserId: settings.selectedUserId,
      });

      console.log(`Hubstaff sync complete: ${result.entriesProcessed} entries processed`);

      // Trigger summary recalculation for affected dates
      const affectedDates = [...new Set(activities.daily_activities.map((a: HubstaffActivity) => a.date))];
      for (const date of affectedDates) {
        await ctx.runMutation(internal.hubstaffSync.calculateDailySummaryForDate, {
          date,
          hubstaffUserId: settings.selectedUserId,
        });
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Hubstaff sync failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Calculate daily summaries - called by cron every hour
 */
export const calculateDailySummaries = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Calculating Hubstaff daily summaries...");

    const settings = await ctx.runQuery(internal.settingsStore.getHubstaffSettingsInternal, {});

    if (!settings?.selectedUserId) {
      return { skipped: true, reason: "no_user_selected" };
    }

    // Get last 7 days of entries and recalculate summaries
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    let datesProcessed = 0;

    // Iterate from weekAgo to today (inclusive)
    const d = new Date(weekAgo);
    while (d <= today) {
      const date = d.toISOString().split("T")[0];
      await ctx.runMutation(internal.hubstaffSync.calculateDailySummaryForDate, {
        date,
        hubstaffUserId: settings.selectedUserId,
      });
      datesProcessed++;
      d.setDate(d.getDate() + 1);
    }

    console.log(`Calculated summaries for ${datesProcessed} dates`);
    return { success: true, datesProcessed };
  },
});

// ==========================================
// Mutations
// ==========================================

/**
 * Upsert time entries (delete-then-insert pattern for idempotency)
 */
export const upsertTimeEntries = internalMutation({
  args: {
    activities: v.array(
      v.object({
        id: v.number(),
        user_id: v.number(),
        project_id: v.number(),
        task_id: v.optional(v.number()),
        date: v.string(),
        tracked: v.number(),
        overall: v.optional(v.number()),
        keyboard: v.optional(v.number()),
        mouse: v.optional(v.number()),
        input_tracked: v.optional(v.number()),
        billable: v.optional(v.boolean()),
        userName: v.string(),
        projectName: v.string(),
        taskName: v.optional(v.string()),
      })
    ),
    selectedUserId: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let entriesProcessed = 0;
    let entriesDeleted = 0;

    // Group activities by date for efficient deletion
    const byDate = new Map<string, typeof args.activities>();
    for (const activity of args.activities) {
      if (!byDate.has(activity.date)) {
        byDate.set(activity.date, []);
      }
      byDate.get(activity.date)!.push(activity);
    }

    // Process each date
    for (const [date, dateActivities] of byDate) {
      // Delete existing entries for this date + user
      const existing = await ctx.db
        .query("hubstaffTimeEntries")
        .withIndex("by_user_date", (q) =>
          q.eq("hubstaffUserId", args.selectedUserId).eq("date", date)
        )
        .collect();

      for (const entry of existing) {
        await ctx.db.delete(entry._id);
        entriesDeleted++;
      }

      // Insert new entries
      for (const activity of dateActivities) {
        // Try to find matching project in our projects table
        const project = await ctx.db
          .query("projects")
          .withIndex("by_hubstaff_project", (q) =>
            q.eq("hubstaffProjectId", activity.project_id)
          )
          .first();

        await ctx.db.insert("hubstaffTimeEntries", {
          date: activity.date,
          hubstaffActivityId: activity.id.toString(),
          hubstaffUserId: activity.user_id,
          hubstaffUserName: activity.userName,
          projectId: project?._id,
          hubstaffProjectId: activity.project_id,
          hubstaffProjectName: activity.projectName,
          taskId: activity.task_id?.toString(),
          taskName: activity.taskName,
          trackedSeconds: activity.tracked,
          activityPercent: activity.input_tracked
            ? Math.round((activity.overall || 0) / activity.input_tracked * 100)
            : undefined,
          keyboardSeconds: activity.keyboard,
          mouseSeconds: activity.mouse,
          billable: activity.billable,
          syncedAt: now,
        });
        entriesProcessed++;
      }
    }

    return { entriesProcessed, entriesDeleted, datesProcessed: byDate.size };
  },
});

/**
 * Calculate daily summary for a specific date
 */
export const calculateDailySummaryForDate = internalMutation({
  args: {
    date: v.string(),
    hubstaffUserId: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all entries for this date + user
    const entries = await ctx.db
      .query("hubstaffTimeEntries")
      .withIndex("by_user_date", (q) =>
        q.eq("hubstaffUserId", args.hubstaffUserId).eq("date", args.date)
      )
      .collect();

    if (entries.length === 0) {
      // Delete existing summary if no entries
      const existing = await ctx.db
        .query("hubstaffDailySummary")
        .withIndex("by_user_date", (q) =>
          q.eq("hubstaffUserId", args.hubstaffUserId).eq("date", args.date)
        )
        .first();

      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return;
    }

    // Calculate totals
    const totalSeconds = entries.reduce((sum, e) => sum + e.trackedSeconds, 0);
    const totalHours = Math.round((totalSeconds / 3600) * 100) / 100;

    // Calculate project breakdown
    const byProject = new Map<number, { projectName: string; seconds: number }>();
    for (const entry of entries) {
      const existing = byProject.get(entry.hubstaffProjectId);
      if (existing) {
        existing.seconds += entry.trackedSeconds;
      } else {
        byProject.set(entry.hubstaffProjectId, {
          projectName: entry.hubstaffProjectName,
          seconds: entry.trackedSeconds,
        });
      }
    }

    const projectBreakdown = Array.from(byProject.entries()).map(([projectId, data]) => ({
      projectId,
      projectName: data.projectName,
      seconds: data.seconds,
    }));

    // Upsert summary
    const existing = await ctx.db
      .query("hubstaffDailySummary")
      .withIndex("by_user_date", (q) =>
        q.eq("hubstaffUserId", args.hubstaffUserId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalSeconds,
        totalHours,
        projectBreakdown,
        calculatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("hubstaffDailySummary", {
        date: args.date,
        hubstaffUserId: args.hubstaffUserId,
        totalSeconds,
        totalHours,
        projectBreakdown,
        calculatedAt: Date.now(),
      });
    }
  },
});

// ==========================================
// Queries
// ==========================================

/**
 * Get time entries for a date range
 */
export const getTimeEntries = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let entries = await ctx.db
      .query("hubstaffTimeEntries")
      .withIndex("by_date")
      .order("desc")
      .collect();

    // Filter by date range
    if (args.startDate) {
      entries = entries.filter((e) => e.date >= args.startDate!);
    }
    if (args.endDate) {
      entries = entries.filter((e) => e.date <= args.endDate!);
    }

    // Apply limit
    if (args.limit) {
      entries = entries.slice(0, args.limit);
    }

    return entries;
  },
});

/**
 * Get daily summaries for a date range
 */
export const getDailySummaries = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const summaries = await ctx.db
      .query("hubstaffDailySummary")
      .withIndex("by_date")
      .order("desc")
      .collect();

    return summaries.filter((s) => s.date >= startDateStr);
  },
});

/**
 * Get today's stats
 */
export const getTodayStats = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];

    const summary = await ctx.db
      .query("hubstaffDailySummary")
      .withIndex("by_date")
      .filter((q) => q.eq(q.field("date"), today))
      .first();

    return summary;
  },
});

/**
 * Get this week's stats
 */
export const getWeekStats = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const summaries = await ctx.db
      .query("hubstaffDailySummary")
      .withIndex("by_date")
      .collect();

    const weekSummaries = summaries.filter((s) => s.date >= weekAgoStr);

    const totalSeconds = weekSummaries.reduce((sum, s) => sum + s.totalSeconds, 0);
    const totalHours = Math.round((totalSeconds / 3600) * 100) / 100;

    return {
      totalHours,
      totalSeconds,
      daysTracked: weekSummaries.length,
      summaries: weekSummaries,
    };
  },
});

/**
 * Get overall Hubstaff stats
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("hubstaffTimeEntries").collect();
    const summaries = await ctx.db.query("hubstaffDailySummary").collect();

    if (entries.length === 0) {
      return {
        totalEntries: 0,
        totalDays: 0,
        oldestEntry: null,
        newestEntry: null,
        totalHoursAllTime: 0,
      };
    }

    // Sort entries by date
    entries.sort((a, b) => a.date.localeCompare(b.date));

    const oldest = entries[0];
    const newest = entries[entries.length - 1];

    const totalHoursAllTime = summaries.reduce((sum, s) => sum + s.totalHours, 0);

    return {
      totalEntries: entries.length,
      totalDays: summaries.length,
      oldestEntry: oldest.date,
      newestEntry: newest.date,
      totalHoursAllTime: Math.round(totalHoursAllTime * 100) / 100,
    };
  },
});
