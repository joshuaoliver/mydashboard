import { v } from "convex/values";
import { action, internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { LinearIssue } from "./linearClient";

/**
 * Linear Sync - Periodic sync of issues from all workspaces
 */

// Type for workspace data from fetchMyIssues
interface WorkspaceIssuesData {
  workspaceId: string;
  workspaceName: string;
  issues: LinearIssue[];
}

// ==========================================
// Main Sync Action
// ==========================================

/**
 * Sync issues from all active workspaces
 * Called by cron every 15 minutes
 */
export const syncAllWorkspaces = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    skipped?: boolean;
    reason?: string;
    success?: boolean;
    totalIssuesProcessed?: number;
    workspaces?: { workspace: string; issues: number; error?: string }[];
  }> => {
    console.log("[LinearSync] Starting Linear issues sync...");

    // Get all active workspaces
    const workspaces = await ctx.runQuery(internal.linearActions.listActiveWorkspacesInternal, {});
    console.log(`[LinearSync] Found ${workspaces.length} active workspaces from DB`);

    if (workspaces.length === 0) {
      console.log("[LinearSync] No active Linear workspaces configured, skipping sync");
      return { skipped: true, reason: "no_workspaces" };
    }

    let totalIssuesProcessed = 0;
    const results: { workspace: string; issues: number; error?: string }[] = [];

    // Fetch issues from each workspace
    console.log("[LinearSync] Calling fetchMyIssues...");
    const allIssuesData: WorkspaceIssuesData[] = await ctx.runAction(
      internal.linearActions.fetchMyIssues, 
      {}
    );
    console.log(`[LinearSync] fetchMyIssues returned ${allIssuesData.length} workspaces with data`);

    for (const workspaceData of allIssuesData) {
      console.log(`[LinearSync] Processing workspace ${workspaceData.workspaceName} with ${workspaceData.issues.length} issues`);
      try {
        // Upsert issues for this workspace
        const result = await ctx.runMutation(internal.linearSync.upsertIssues, {
          workspaceId: workspaceData.workspaceId,
          workspaceName: workspaceData.workspaceName,
          issues: workspaceData.issues.map((issue: LinearIssue) => ({
            linearId: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            priority: issue.priority,
            priorityLabel: issue.priorityLabel,
            createdAt: new Date(issue.createdAt).getTime(),
            updatedAt: new Date(issue.updatedAt).getTime(),
            completedAt: issue.completedAt ? new Date(issue.completedAt).getTime() : undefined,
            dueDate: issue.dueDate,
            url: issue.url,
            assigneeId: issue.assignee?.id || "",
            assigneeName: issue.assignee?.name,
            status: issue.state.name,
            statusType: issue.state.type,
            teamId: issue.team.id,
            teamName: issue.team.name,
          })),
        });

        totalIssuesProcessed += result.issuesUpserted;
        results.push({
          workspace: workspaceData.workspaceName,
          issues: result.issuesUpserted,
        });
      } catch (error) {
        console.error(`Failed to sync workspace ${workspaceData.workspaceName}:`, error);
        results.push({
          workspace: workspaceData.workspaceName,
          issues: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log(`Linear sync complete: ${totalIssuesProcessed} issues across ${workspaces.length} workspaces`);

    return {
      success: true,
      totalIssuesProcessed,
      workspaces: results,
    };
  },
});

// ==========================================
// Mutations
// ==========================================

/**
 * Upsert issues for a workspace
 */
export const upsertIssues = internalMutation({
  args: {
    workspaceId: v.string(),
    workspaceName: v.string(),
    issues: v.array(
      v.object({
        linearId: v.string(),
        identifier: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        priority: v.number(),
        priorityLabel: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
        completedAt: v.optional(v.number()),
        dueDate: v.optional(v.string()),
        url: v.string(),
        assigneeId: v.string(),
        assigneeName: v.optional(v.string()),
        status: v.string(),
        statusType: v.string(),
        teamId: v.string(),
        teamName: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let issuesUpserted = 0;
    let issuesDeleted = 0;

    // Get existing issues for this workspace
    const existingIssues = await ctx.db
      .query("linearIssues")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const existingByLinearId = new Map(
      existingIssues.map((i) => [i.linearId, i])
    );

    // Track which issues we've seen
    const seenLinearIds = new Set<string>();

    // Upsert each issue
    for (const issue of args.issues) {
      seenLinearIds.add(issue.linearId);
      const existing = existingByLinearId.get(issue.linearId);

      // Try to find matching project
      const project = await ctx.db
        .query("projects")
        .withIndex("by_linear_team", (q) => q.eq("linearTeamId", issue.teamId))
        .first();

      if (existing) {
        // Update if changed
        if (existing.updatedAt < issue.updatedAt) {
          await ctx.db.patch(existing._id, {
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            priority: issue.priority,
            priorityLabel: issue.priorityLabel,
            updatedAt: issue.updatedAt,
            completedAt: issue.completedAt,
            dueDate: issue.dueDate,
            url: issue.url,
            assigneeId: issue.assigneeId,
            assigneeName: issue.assigneeName,
            status: issue.status,
            statusType: issue.statusType,
            teamId: issue.teamId,
            teamName: issue.teamName,
            projectId: project?._id,
            syncedAt: now,
          });
          issuesUpserted++;
        }
      } else {
        // Insert new issue
        await ctx.db.insert("linearIssues", {
          linearId: issue.linearId,
          identifier: issue.identifier,
          workspaceId: args.workspaceId,
          workspaceName: args.workspaceName,
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          priorityLabel: issue.priorityLabel,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          completedAt: issue.completedAt,
          dueDate: issue.dueDate,
          url: issue.url,
          assigneeId: issue.assigneeId,
          assigneeName: issue.assigneeName,
          status: issue.status,
          statusType: issue.statusType,
          teamId: issue.teamId,
          teamName: issue.teamName,
          projectId: project?._id,
          syncedAt: now,
        });
        issuesUpserted++;
      }
    }

    // Mark issues as completed if they weren't in the response
    // (they've been completed or cancelled)
    for (const existing of existingIssues) {
      if (!seenLinearIds.has(existing.linearId) && !existing.completedAt) {
        // Issue is no longer in uncompleted list - mark as completed
        await ctx.db.patch(existing._id, {
          completedAt: now,
          statusType: "completed",
          syncedAt: now,
        });
        issuesDeleted++;
      }
    }

    return { issuesUpserted, issuesDeleted };
  },
});

/**
 * Handle webhook update for a single issue
 */
export const handleIssueWebhook = internalMutation({
  args: {
    action: v.string(), // "create" | "update" | "remove"
    workspaceId: v.string(),
    issue: v.optional(
      v.object({
        id: v.string(),
        identifier: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        priority: v.number(),
        priorityLabel: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
        completedAt: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        url: v.string(),
        assigneeId: v.optional(v.string()),
        state: v.object({
          name: v.string(),
          type: v.string(),
        }),
        team: v.object({
          id: v.string(),
          name: v.string(),
        }),
      })
    ),
    issueId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.action === "remove" && args.issueId) {
      // Delete the issue
      const issueIdToRemove = args.issueId;
      const existing = await ctx.db
        .query("linearIssues")
        .withIndex("by_linear_id", (q) => q.eq("linearId", issueIdToRemove))
        .first();

      if (existing) {
        await ctx.db.delete(existing._id);
        return { action: "deleted", issueId: args.issueId };
      }
      return { action: "not_found", issueId: args.issueId };
    }

    if (!args.issue) {
      return { action: "no_issue_data" };
    }

    // Find existing issue
    const existing = await ctx.db
      .query("linearIssues")
      .withIndex("by_linear_id", (q) => q.eq("linearId", args.issue!.id))
      .first();

    // Get workspace info
    const workspace = await ctx.db
      .query("linearWorkspaces")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    // Check if issue is assigned to the configured user
    if (workspace?.userId && args.issue.assigneeId !== workspace.userId) {
      // Not assigned to us - delete if exists
      if (existing) {
        await ctx.db.delete(existing._id);
        return { action: "deleted_not_assigned" };
      }
      return { action: "skipped_not_assigned" };
    }

    // Skip if completed or cancelled
    if (
      args.issue.state.type === "completed" ||
      args.issue.state.type === "canceled"
    ) {
      if (existing) {
        await ctx.db.delete(existing._id);
        return { action: "deleted_completed" };
      }
      return { action: "skipped_completed" };
    }

    // Try to find matching project
    const project = await ctx.db
      .query("projects")
      .withIndex("by_linear_team", (q) => q.eq("linearTeamId", args.issue!.team.id))
      .first();

    const issueData = {
      linearId: args.issue.id,
      identifier: args.issue.identifier,
      workspaceId: args.workspaceId,
      workspaceName: workspace?.workspaceName,
      title: args.issue.title,
      description: args.issue.description,
      priority: args.issue.priority,
      priorityLabel: args.issue.priorityLabel,
      createdAt: new Date(args.issue.createdAt).getTime(),
      updatedAt: new Date(args.issue.updatedAt).getTime(),
      completedAt: args.issue.completedAt
        ? new Date(args.issue.completedAt).getTime()
        : undefined,
      dueDate: args.issue.dueDate,
      url: args.issue.url,
      assigneeId: args.issue.assigneeId || "",
      status: args.issue.state.name,
      statusType: args.issue.state.type,
      teamId: args.issue.team.id,
      teamName: args.issue.team.name,
      projectId: project?._id,
      syncedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, issueData);
      return { action: "updated", issueId: args.issue.id };
    } else {
      await ctx.db.insert("linearIssues", issueData);
      return { action: "created", issueId: args.issue.id };
    }
  },
});

// ==========================================
// Queries
// ==========================================

/**
 * Get all uncompleted issues
 */
export const getUncompletedIssues = query({
  args: {
    workspaceId: v.optional(v.string()),
    teamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let issues = await ctx.db.query("linearIssues").collect();

    // Filter out completed/cancelled
    issues = issues.filter(
      (i) => i.statusType !== "completed" && i.statusType !== "canceled"
    );

    // Filter by workspace
    if (args.workspaceId) {
      issues = issues.filter((i) => i.workspaceId === args.workspaceId);
    }

    // Filter by team
    if (args.teamId) {
      issues = issues.filter((i) => i.teamId === args.teamId);
    }

    // Sort by priority (higher first) then by updated date
    issues.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.updatedAt - a.updatedAt;
    });

    return issues;
  },
});

/**
 * Get issues grouped by workspace
 */
export const getIssuesByWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const issues = await ctx.db.query("linearIssues").collect();

    // Filter out completed
    const activeIssues = issues.filter(
      (i) => i.statusType !== "completed" && i.statusType !== "canceled"
    );

    // Group by workspace
    const byWorkspace = new Map<
      string,
      { workspaceName: string; issues: typeof activeIssues }
    >();

    for (const issue of activeIssues) {
      if (!byWorkspace.has(issue.workspaceId)) {
        byWorkspace.set(issue.workspaceId, {
          workspaceName: issue.workspaceName || issue.workspaceId,
          issues: [],
        });
      }
      byWorkspace.get(issue.workspaceId)!.issues.push(issue);
    }

    // Sort issues within each workspace by priority
    for (const [, data] of byWorkspace) {
      data.issues.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.updatedAt - a.updatedAt;
      });
    }

    return Array.from(byWorkspace.entries()).map(([workspaceId, data]) => ({
      workspaceId,
      ...data,
    }));
  },
});

/**
 * Get stats about Linear issues
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const issues = await ctx.db.query("linearIssues").collect();
    const workspaces = await ctx.db.query("linearWorkspaces").collect();

    const activeIssues = issues.filter(
      (i) => i.statusType !== "completed" && i.statusType !== "canceled"
    );

    // Count by priority
    const byPriority = {
      urgent: activeIssues.filter((i) => i.priority === 1).length,
      high: activeIssues.filter((i) => i.priority === 2).length,
      medium: activeIssues.filter((i) => i.priority === 3).length,
      low: activeIssues.filter((i) => i.priority === 4).length,
      none: activeIssues.filter((i) => i.priority === 0).length,
    };

    // Count by status type
    const byStatusType = {
      backlog: activeIssues.filter((i) => i.statusType === "backlog").length,
      unstarted: activeIssues.filter((i) => i.statusType === "unstarted").length,
      started: activeIssues.filter((i) => i.statusType === "started").length,
    };

    return {
      totalIssues: activeIssues.length,
      totalWorkspaces: workspaces.filter((w) => w.isActive).length,
      byPriority,
      byStatusType,
      lastSyncedAt: issues.length > 0 ? Math.max(...issues.map((i) => i.syncedAt)) : null,
    };
  },
});

// ==========================================
// Manual Trigger Actions
// ==========================================

/**
 * Manually trigger a Linear issues sync (public action wrapper)
 */
export const triggerManualSync = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    message?: string;
    totalIssuesProcessed?: number;
    error?: string;
  }> => {
    try {
      const result = await ctx.runAction(internal.linearSync.syncAllWorkspaces, {});
      
      if (result.skipped) {
        return { 
          success: false, 
          error: "No Linear workspaces configured. Go to Settings > Linear to set up." 
        };
      }
      
      if (result.success) {
        const workspaceCount = result.workspaces?.length || 0;
        return { 
          success: true, 
          message: `Synced successfully: ${result.totalIssuesProcessed} issues from ${workspaceCount} workspace(s)`,
          totalIssuesProcessed: result.totalIssuesProcessed 
        };
      }
      
      return { 
        success: false, 
        error: "Unknown error" 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  },
});
