import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";

/**
 * Projects Store - unified projects linking Hubstaff + Linear
 */

// ==========================================
// Queries
// ==========================================

/**
 * List all projects
 */
export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .order("desc")
      .collect();
    return projects;
  },
});

/**
 * List only active projects
 */
export const listActiveProjects = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .collect();
    return projects.filter((p) => p.isActive);
  },
});

/**
 * Get a single project by ID
 */
export const getProject = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get project by Hubstaff project ID
 */
export const getProjectByHubstaffId = query({
  args: { hubstaffProjectId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_hubstaff_project", (q) => 
        q.eq("hubstaffProjectId", args.hubstaffProjectId)
      )
      .first();
  },
});

/**
 * Get project by Linear team ID
 */
export const getProjectByLinearTeam = query({
  args: { linearTeamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_linear_team", (q) => 
        q.eq("linearTeamId", args.linearTeamId)
      )
      .first();
  },
});

// ==========================================
// Internal Queries (for actions/crons)
// ==========================================

export const listActiveProjectsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .collect();
    return projects.filter((p) => p.isActive);
  },
});

export const getProjectByHubstaffIdInternal = internalQuery({
  args: { hubstaffProjectId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_hubstaff_project", (q) => 
        q.eq("hubstaffProjectId", args.hubstaffProjectId)
      )
      .first();
  },
});

// ==========================================
// Mutations
// ==========================================

/**
 * Create a new project
 */
export const createProject = mutation({
  args: {
    name: v.string(),
    hubstaffProjectId: v.optional(v.number()),
    hubstaffProjectName: v.optional(v.string()),
    linearWorkspaceId: v.optional(v.string()),
    linearTeamId: v.optional(v.string()),
    linearTeamName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for duplicate name
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      throw new Error(`Project with name "${args.name}" already exists`);
    }

    const id = await ctx.db.insert("projects", {
      name: args.name,
      hubstaffProjectId: args.hubstaffProjectId,
      hubstaffProjectName: args.hubstaffProjectName,
      linearWorkspaceId: args.linearWorkspaceId,
      linearTeamId: args.linearTeamId,
      linearTeamName: args.linearTeamName,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Update a project
 */
export const updateProject = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    hubstaffProjectId: v.optional(v.union(v.number(), v.null())),
    hubstaffProjectName: v.optional(v.union(v.string(), v.null())),
    linearWorkspaceId: v.optional(v.union(v.string(), v.null())),
    linearTeamId: v.optional(v.union(v.string(), v.null())),
    linearTeamName: v.optional(v.union(v.string(), v.null())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Project not found");
    }

    // If renaming, check for duplicate
    if (args.name && args.name !== existing.name) {
      const duplicate = await ctx.db
        .query("projects")
        .withIndex("by_name", (q) => q.eq("name", args.name!))
        .first();

      if (duplicate) {
        throw new Error(`Project with name "${args.name}" already exists`);
      }
    }

    const updates: Partial<typeof existing> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.hubstaffProjectId !== undefined) {
      updates.hubstaffProjectId = args.hubstaffProjectId === null ? undefined : args.hubstaffProjectId;
    }
    if (args.hubstaffProjectName !== undefined) {
      updates.hubstaffProjectName = args.hubstaffProjectName === null ? undefined : args.hubstaffProjectName;
    }
    if (args.linearWorkspaceId !== undefined) {
      updates.linearWorkspaceId = args.linearWorkspaceId === null ? undefined : args.linearWorkspaceId;
    }
    if (args.linearTeamId !== undefined) {
      updates.linearTeamId = args.linearTeamId === null ? undefined : args.linearTeamId;
    }
    if (args.linearTeamName !== undefined) {
      updates.linearTeamName = args.linearTeamName === null ? undefined : args.linearTeamName;
    }
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Delete a project
 */
export const deleteProject = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Project not found");
    }

    await ctx.db.delete(args.id);
    return true;
  },
});

/**
 * Toggle project active status
 */
export const toggleProjectActive = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Project not found");
    }

    await ctx.db.patch(args.id, {
      isActive: !existing.isActive,
      updatedAt: Date.now(),
    });

    return !existing.isActive;
  },
});

// ==========================================
// Project Detail Queries
// ==========================================

/**
 * Get time entries for a specific project
 */
export const getProjectTimeEntries = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || !project.hubstaffProjectId) {
      return [];
    }

    const limit = args.limit ?? 50;

    const entries = await ctx.db
      .query("hubstaffTimeEntries")
      .withIndex("by_project_date", (q) =>
        q.eq("hubstaffProjectId", project.hubstaffProjectId!)
      )
      .order("desc")
      .take(limit);

    return entries;
  },
});

/**
 * Get Linear issues for a specific project
 */
export const getProjectLinearIssues = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || !project.linearTeamId) {
      return [];
    }

    const issues = await ctx.db
      .query("linearIssues")
      .withIndex("by_team", (q) => q.eq("teamId", project.linearTeamId!))
      .collect();

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
