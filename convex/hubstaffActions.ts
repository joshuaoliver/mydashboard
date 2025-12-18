import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  refreshAccessToken,
  getOrganizations,
  getOrganizationUsers,
  getOrganizationProjects,
  getOrganizationActivities,
  type HubstaffUser,
  type HubstaffProject,
  type HubstaffOrganization,
} from "./hubstaffClient";

/**
 * Hubstaff Actions - Token management and API interactions
 */

// ==========================================
// Token Management
// ==========================================

/**
 * Get a valid access token (refreshes if needed)
 */
export const getAccessToken = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const settings = await ctx.runQuery(internal.settingsStore.getHubstaffSettingsInternal, {});

    if (!settings?.refreshToken) {
      throw new Error("Hubstaff not configured. Please set up refresh token first.");
    }

    // Check if we have a valid access token (with 5 min buffer)
    if (
      settings.accessToken &&
      settings.tokenExpiry &&
      settings.tokenExpiry > Date.now() + 300000
    ) {
      return settings.accessToken;
    }

    console.log("Refreshing Hubstaff access token...");

    // Refresh the token
    const tokens = await refreshAccessToken(settings.refreshToken);

    // Update stored tokens
    await ctx.runMutation(internal.settingsStore.setSettingInternal, {
      key: "hubstaff",
      type: "config",
      value: {
        ...settings,
        accessToken: tokens.access_token,
        tokenExpiry: Date.now() + tokens.expires_in * 1000,
        // Update refresh token if a new one was provided
        refreshToken: tokens.refresh_token || settings.refreshToken,
      },
    });

    console.log("Hubstaff access token refreshed successfully");
    return tokens.access_token;
  },
});

// ==========================================
// Organization & User Management
// ==========================================

/**
 * Fetch organizations for the authenticated user
 */
export const fetchOrganizations = action({
  args: {},
  handler: async (ctx): Promise<HubstaffOrganization[]> => {
    const accessToken = await ctx.runAction(internal.hubstaffActions.getAccessToken, {});
    const response = await getOrganizations(accessToken);
    return response.organizations || [];
  },
});

/**
 * Fetch users in an organization
 */
export const fetchOrganizationUsers = action({
  args: { organizationId: v.number() },
  handler: async (ctx, args): Promise<HubstaffUser[]> => {
    const accessToken = await ctx.runAction(internal.hubstaffActions.getAccessToken, {});
    const response = await getOrganizationUsers(accessToken, args.organizationId);
    return response.users || [];
  },
});

/**
 * Fetch projects in an organization
 */
export const fetchOrganizationProjects = action({
  args: { organizationId: v.number() },
  handler: async (ctx, args): Promise<HubstaffProject[]> => {
    const accessToken = await ctx.runAction(internal.hubstaffActions.getAccessToken, {});
    const response = await getOrganizationProjects(accessToken, args.organizationId);
    return response.projects || [];
  },
});

// ==========================================
// Activity Fetching
// ==========================================

/**
 * Fetch activities for date range
 */
export const fetchActivities = internalAction({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    projectIds: v.optional(v.array(v.number())),
    userIds: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.runQuery(internal.settingsStore.getHubstaffSettingsInternal, {});

    if (!settings?.organizationId) {
      throw new Error("Hubstaff organization not configured");
    }

    const accessToken = await ctx.runAction(internal.hubstaffActions.getAccessToken, {});

    const response = await getOrganizationActivities(accessToken, settings.organizationId, {
      startDate: args.startDate,
      endDate: args.endDate,
      projectIds: args.projectIds,
      userIds: args.userIds,
      include: ["users", "projects", "tasks"],
      pageLimit: 500,
    });

    return response;
  },
});

/**
 * Test Hubstaff connection
 */
export const testConnection = action({
  args: {},
  handler: async (ctx) => {
    try {
      const accessToken = await ctx.runAction(internal.hubstaffActions.getAccessToken, {});
      const orgs = await getOrganizations(accessToken);

      return {
        success: true,
        organizations: orgs.organizations?.length || 0,
        message: `Connected! Found ${orgs.organizations?.length || 0} organization(s).`,
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
 * Trigger a manual sync with configurable date range
 */
export const triggerManualSync = action({
  args: {
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    entriesProcessed?: number;
    datesProcessed?: number;
    error?: string;
  }> => {
    const daysBack = args.daysBack ?? 7;
    
    const settings = await ctx.runQuery(internal.settingsStore.getHubstaffSettingsInternal, {});
    
    if (!settings?.isConfigured || !settings?.selectedUserId) {
      return { success: false, error: "Hubstaff not configured" };
    }

    try {
      const today = new Date();
      const startDay = new Date(today);
      startDay.setDate(startDay.getDate() - daysBack);

      const startDate = startDay.toISOString().split("T")[0];
      const endDate = today.toISOString().split("T")[0];

      console.log(`Manual Hubstaff sync: ${startDate} to ${endDate} (${daysBack} days)`);

      // Get active projects to filter by
      const projects = await ctx.runQuery(internal.projectsStore.listActiveProjectsInternal, {});
      const hubstaffProjectIds: number[] = projects
        .filter((p: any) => p.hubstaffProjectId)
        .map((p: any) => p.hubstaffProjectId as number);

      // Fetch activities from Hubstaff API
      const activities = await ctx.runAction(internal.hubstaffActions.fetchActivities, {
        startDate,
        endDate,
        userIds: [settings.selectedUserId],
        projectIds: hubstaffProjectIds.length > 0 ? hubstaffProjectIds : undefined,
      });

      if (!activities.daily_activities?.length) {
        return { success: true, entriesProcessed: 0, datesProcessed: 0 };
      }

      // Create lookup maps
      const userMap = new Map((activities.users || []).map((u: any) => [u.id, u]));
      const projectMap = new Map((activities.projects || []).map((p: any) => [p.id, p]));
      const taskMap = new Map((activities.tasks || []).map((t: any) => [t.id, t]));

      // Store entries
      const result = await ctx.runMutation(internal.hubstaffSync.upsertTimeEntries, {
        activities: activities.daily_activities.map((activity: any) => ({
          ...activity,
          userName: (userMap.get(activity.user_id) as any)?.name || `User ${activity.user_id}`,
          projectName: (projectMap.get(activity.project_id) as any)?.name || `Project ${activity.project_id}`,
          taskName: activity.task_id ? (taskMap.get(activity.task_id) as any)?.summary : undefined,
        })),
        selectedUserId: settings.selectedUserId,
      });

      // Recalculate summaries for affected dates
      const affectedDates = [...new Set(activities.daily_activities.map((a: any) => a.date))];
      for (const date of affectedDates) {
        await ctx.runMutation(internal.hubstaffSync.calculateDailySummaryForDate, {
          date: date as string,
          hubstaffUserId: settings.selectedUserId,
        });
      }

      return {
        success: true,
        entriesProcessed: result.entriesProcessed,
        datesProcessed: affectedDates.length,
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
 * Save Hubstaff configuration
 */
export const saveConfiguration = action({
  args: {
    refreshToken: v.string(),
    organizationId: v.number(),
    organizationName: v.optional(v.string()),
    selectedUserId: v.optional(v.number()),
    selectedUserName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Test the refresh token first
    try {
      const tokens = await refreshAccessToken(args.refreshToken);

      // Save configuration
      await ctx.runMutation(internal.settingsStore.setSettingInternal, {
        key: "hubstaff",
        type: "config",
        value: {
          refreshToken: tokens.refresh_token || args.refreshToken,
          accessToken: tokens.access_token,
          tokenExpiry: Date.now() + tokens.expires_in * 1000,
          organizationId: args.organizationId,
          organizationName: args.organizationName,
          selectedUserId: args.selectedUserId,
          selectedUserName: args.selectedUserName,
          isConfigured: true,
        },
      });

      return { success: true };
    } catch (error) {
      throw new Error(
        `Failed to validate refresh token: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});
