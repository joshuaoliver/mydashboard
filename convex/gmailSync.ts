import { v } from "convex/values";
import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Gmail Sync - Periodic sync of inbox stats
 */

// ==========================================
// Sync Actions
// ==========================================

/**
 * Main sync action - called by cron every 15 minutes
 */
export const syncInbox = internalAction({
  args: {},
  handler: async (ctx): Promise<
    | { skipped: true; reason: string }
    | { success: true; stats: { totalInbox: number; unread: number } }
    | { success: false; error: string }
  > => {
    console.log("Starting Gmail inbox sync...");

    // Check if Gmail is configured
    const settings = await ctx.runQuery(internal.settingsStore.getGmailSettingsInternal, {});
    
    if (!settings?.isConfigured || !settings?.refreshToken) {
      console.log("Gmail not configured, skipping sync");
      return { skipped: true, reason: "not_configured" };
    }

    try {
      // Get inbox stats from Gmail API
      const stats = await ctx.runAction(internal.gmailActions.getInboxStats, {}) as {
        totalInbox: number;
        unread: number;
        primary?: number;
        social?: number;
        promotions?: number;
        updates?: number;
        forums?: number;
      };

      // Store snapshot
      await ctx.runMutation(internal.gmailSync.storeSnapshot, {
        totalInbox: stats.totalInbox,
        unread: stats.unread,
        primary: stats.primary,
        social: stats.social,
        promotions: stats.promotions,
        updates: stats.updates,
        forums: stats.forums,
      });

      console.log(`Gmail sync complete: ${stats.totalInbox} total, ${stats.unread} unread`);
      return { success: true, stats };
    } catch (error) {
      console.error("Gmail sync failed:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  },
});

// ==========================================
// Mutations
// ==========================================

/**
 * Store a Gmail snapshot
 */
export const storeSnapshot = internalMutation({
  args: {
    totalInbox: v.number(),
    unread: v.number(),
    primary: v.optional(v.number()),
    social: v.optional(v.number()),
    promotions: v.optional(v.number()),
    updates: v.optional(v.number()),
    forums: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("gmailSnapshots", {
      timestamp: Date.now(),
      totalInbox: args.totalInbox,
      unread: args.unread,
      primary: args.primary,
      social: args.social,
      promotions: args.promotions,
      updates: args.updates,
      forums: args.forums,
    });
    return id;
  },
});

/**
 * Delete a Gmail snapshot by ID
 */
export const deleteSnapshot = mutation({
  args: {
    id: v.id("gmailSnapshots"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// ==========================================
// Queries
// ==========================================

/**
 * Get the latest Gmail snapshot
 */
export const getLatestSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const snapshot = await ctx.db
      .query("gmailSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .first();
    return snapshot;
  },
});

/**
 * Get Gmail snapshots for a time range
 */
export const getSnapshots = query({
  args: {
    limit: v.optional(v.number()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("gmailSnapshots")
      .withIndex("by_timestamp")
      .order("desc");

    const snapshots = await query.collect();

    // Filter by time range if specified
    let filtered = snapshots;
    if (args.startTime) {
      filtered = filtered.filter((s) => s.timestamp >= args.startTime!);
    }
    if (args.endTime) {
      filtered = filtered.filter((s) => s.timestamp <= args.endTime!);
    }

    // Apply limit
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

/**
 * Get daily summary of Gmail stats (for charts)
 */
export const getDailySummary = query({
  args: {
    days: v.optional(v.number()), // Default 30 days
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const snapshots = await ctx.db
      .query("gmailSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    // Filter to time range
    const filtered = snapshots.filter((s) => s.timestamp >= startTime);

    // Group by day and get the last snapshot of each day
    const byDay = new Map<string, typeof filtered[0]>();
    
    for (const snapshot of filtered) {
      const date = new Date(snapshot.timestamp).toISOString().split("T")[0];
      // Keep the most recent snapshot for each day
      if (!byDay.has(date) || snapshot.timestamp > byDay.get(date)!.timestamp) {
        byDay.set(date, snapshot);
      }
    }

    // Convert to array sorted by date
    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, snapshot]) => ({
        date,
        totalInbox: snapshot.totalInbox,
        unread: snapshot.unread,
        primary: snapshot.primary,
        social: snapshot.social,
        promotions: snapshot.promotions,
        updates: snapshot.updates,
        forums: snapshot.forums,
      }));
  },
});

/**
 * Get stats about Gmail data
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const snapshots = await ctx.db.query("gmailSnapshots").collect();
    
    if (snapshots.length === 0) {
      return {
        totalSnapshots: 0,
        oldestSnapshot: null,
        newestSnapshot: null,
        currentInbox: null,
        currentUnread: null,
      };
    }

    // Sort by timestamp
    snapshots.sort((a, b) => a.timestamp - b.timestamp);

    const oldest = snapshots[0];
    const newest = snapshots[snapshots.length - 1];

    return {
      totalSnapshots: snapshots.length,
      oldestSnapshot: oldest.timestamp,
      newestSnapshot: newest.timestamp,
      currentInbox: newest.totalInbox,
      currentUnread: newest.unread,
    };
  },
});

// ==========================================
// Manual Trigger Actions
// ==========================================

/**
 * Manually trigger a Gmail inbox sync (public action wrapper)
 */
export const triggerManualSync = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    message?: string;
    stats?: { totalInbox: number; unread: number };
    error?: string;
  }> => {
    try {
      const result = await ctx.runAction(internal.gmailSync.syncInbox, {});
      
      if ("skipped" in result && result.skipped) {
        return { 
          success: false, 
          error: "Gmail is not configured. Go to Settings > Gmail to set up." 
        };
      }
      
      if ("success" in result && result.success) {
        return { 
          success: true, 
          message: `Synced successfully: ${result.stats.totalInbox} total emails, ${result.stats.unread} unread`,
          stats: result.stats 
        };
      }
      
      return { 
        success: false, 
        error: ("error" in result && result.error) || "Unknown error" 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  },
});
