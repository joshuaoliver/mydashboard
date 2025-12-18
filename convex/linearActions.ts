import { v } from "convex/values";
import { action, internalAction, query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  getCurrentUser,
  getWorkspace,
  getTeams,
  getMyUncompletedIssues,
  type LinearUser,
  type LinearTeam,
  type LinearWorkspace,
} from "./linearClient";

/**
 * Linear Actions - API interactions and workspace management
 */

// ==========================================
// Workspace Management
// ==========================================

/**
 * List all configured Linear workspaces (public query)
 */
export const listWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("linearWorkspaces").collect();
    return workspaces;
  },
});

/**
 * List all configured Linear workspaces (internal query for actions)
 */
export const listWorkspacesInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("linearWorkspaces").collect();
    return workspaces;
  },
});

/**
 * Get active workspaces (public query)
 */
export const listActiveWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("linearWorkspaces").collect();
    return workspaces.filter((w) => w.isActive);
  },
});

/**
 * Get active workspaces (internal query for actions)
 */
export const listActiveWorkspacesInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("linearWorkspaces").collect();
    return workspaces.filter((w) => w.isActive);
  },
});

/**
 * Add a new Linear workspace
 */
export const addWorkspace = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate API key by fetching user and workspace info
    try {
      const [user, workspace, teams] = await Promise.all([
        getCurrentUser(args.apiKey),
        getWorkspace(args.apiKey),
        getTeams(args.apiKey),
      ]);

      // Check if workspace already exists
      const workspaces = await ctx.runQuery(internal.linearActions.listWorkspacesInternal, {});
      const existing = workspaces.find((w: any) => w.workspaceId === workspace.id);

      if (existing) {
        throw new Error(`Workspace "${workspace.name}" is already configured`);
      }

      // Save workspace
      const id = await ctx.runMutation(internal.linearActions.insertWorkspace, {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        apiKey: args.apiKey,
        userId: user.id,
        userName: user.name,
      });

      return {
        success: true,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        userName: user.name,
        teamCount: teams.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to add workspace: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Insert workspace (internal mutation)
 */
export const insertWorkspace = internalMutation({
  args: {
    workspaceId: v.string(),
    workspaceName: v.string(),
    apiKey: v.string(),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("linearWorkspaces", {
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName,
      apiKey: args.apiKey,
      userId: args.userId,
      userName: args.userName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/**
 * Update workspace
 */
export const updateWorkspace = mutation({
  args: {
    id: v.id("linearWorkspaces"),
    apiKey: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Workspace not found");
    }

    const updates: Partial<typeof existing> = {
      updatedAt: Date.now(),
    };

    if (args.apiKey !== undefined) updates.apiKey = args.apiKey;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Delete workspace
 */
export const deleteWorkspace = mutation({
  args: { id: v.id("linearWorkspaces") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Workspace not found");
    }

    // Delete associated issues
    const issues = await ctx.db
      .query("linearIssues")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", existing.workspaceId))
      .collect();

    for (const issue of issues) {
      await ctx.db.delete(issue._id);
    }

    await ctx.db.delete(args.id);
    return true;
  },
});

/**
 * Toggle workspace active status
 */
export const toggleWorkspaceActive = mutation({
  args: { id: v.id("linearWorkspaces") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Workspace not found");
    }

    await ctx.db.patch(args.id, {
      isActive: !existing.isActive,
      updatedAt: Date.now(),
    });

    return !existing.isActive;
  },
});

// ==========================================
// API Actions
// ==========================================

/**
 * Test connection for a workspace
 */
export const testConnection = action({
  args: { workspaceId: v.id("linearWorkspaces") },
  handler: async (ctx, args) => {
    const workspaces = await ctx.runQuery(internal.linearActions.listWorkspacesInternal, {});
    const workspace = workspaces.find((w: any) => w._id === args.workspaceId);

    if (!workspace) {
      return { success: false, error: "Workspace not found" };
    }

    try {
      const user = await getCurrentUser(workspace.apiKey);
      const teams = await getTeams(workspace.apiKey);

      return {
        success: true,
        userName: user.name,
        teamCount: teams.length,
        teams: teams.map((t) => t.name),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Fetch teams for a workspace
 */
export const fetchTeams = action({
  args: { workspaceId: v.id("linearWorkspaces") },
  handler: async (ctx, args): Promise<LinearTeam[]> => {
    const workspaces = await ctx.runQuery(internal.linearActions.listWorkspacesInternal, {});
    const workspace = workspaces.find((w: any) => w._id === args.workspaceId);

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    return getTeams(workspace.apiKey);
  },
});

/**
 * Fetch uncompleted issues for all active workspaces
 */
export const fetchMyIssues = internalAction({
  args: {
    workspaceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspaces = await ctx.runQuery(internal.linearActions.listActiveWorkspacesInternal, {});
    
    console.log(`[Linear] Found ${workspaces.length} active workspaces`);
    
    // Filter by workspace if specified
    const targetWorkspaces = args.workspaceId
      ? workspaces.filter((w: any) => w.workspaceId === args.workspaceId)
      : workspaces;

    console.log(`[Linear] Target workspaces: ${targetWorkspaces.map((w: any) => w.workspaceName).join(', ')}`);

    const allIssues: {
      workspaceId: string;
      workspaceName: string;
      issues: Awaited<ReturnType<typeof getMyUncompletedIssues>>["issues"];
    }[] = [];

    for (const workspace of targetWorkspaces) {
      try {
        console.log(`[Linear] Fetching issues for workspace: ${workspace.workspaceName}`);
        const result = await getMyUncompletedIssues(workspace.apiKey);
        console.log(`[Linear] Found ${result.issues.length} issues in ${workspace.workspaceName}`);
        allIssues.push({
          workspaceId: workspace.workspaceId,
          workspaceName: workspace.workspaceName,
          issues: result.issues,
        });
      } catch (error) {
        console.error(`[Linear] Failed to fetch issues for workspace ${workspace.workspaceName}:`, error);
        // Still add the workspace with empty issues so it shows in the results
        allIssues.push({
          workspaceId: workspace.workspaceId,
          workspaceName: workspace.workspaceName,
          issues: [],
        });
      }
    }

    console.log(`[Linear] Total workspaces with data: ${allIssues.length}`);
    return allIssues;
  },
});

/**
 * Trigger a manual sync of all workspaces
 */
export const triggerManualSync = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    totalIssuesProcessed?: number;
    workspaces?: { workspace: string; issues: number; error?: string }[];
    error?: string;
  }> => {
    console.log("Manual Linear sync triggered...");

    const workspaces = await ctx.runQuery(internal.linearActions.listActiveWorkspacesInternal, {});

    if (workspaces.length === 0) {
      return { success: false, error: "No active workspaces configured" };
    }

    try {
      let totalIssuesProcessed = 0;
      const results: { workspace: string; issues: number; error?: string }[] = [];

      const allIssuesData = await ctx.runAction(internal.linearActions.fetchMyIssues, {});

      for (const workspaceData of allIssuesData) {
        try {
          const result = await ctx.runMutation(internal.linearSync.upsertIssues, {
            workspaceId: workspaceData.workspaceId,
            workspaceName: workspaceData.workspaceName,
            issues: workspaceData.issues.map((issue: any) => ({
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
          results.push({
            workspace: workspaceData.workspaceName,
            issues: 0,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        success: true,
        totalIssuesProcessed,
        workspaces: results,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Fetch all teams from all active workspaces (for project creation dropdown)
 */
export const fetchAllTeams = action({
  args: {},
  handler: async (ctx): Promise<{
    workspaceId: string;
    workspaceName: string;
    teams: { id: string; name: string; key: string }[];
  }[]> => {
    const workspaces = await ctx.runQuery(internal.linearActions.listActiveWorkspacesInternal, {});

    const allTeams: {
      workspaceId: string;
      workspaceName: string;
      teams: { id: string; name: string; key: string }[];
    }[] = [];

    for (const workspace of workspaces) {
      try {
        const teams = await getTeams(workspace.apiKey);
        allTeams.push({
          workspaceId: workspace.workspaceId,
          workspaceName: workspace.workspaceName,
          teams,
        });
      } catch (error) {
        console.error(`Failed to fetch teams for ${workspace.workspaceName}:`, error);
      }
    }

    return allTeams;
  },
});

// Note: listWorkspacesInternal removed - use listWorkspaces query directly
