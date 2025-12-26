import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Message Stats - Periodic snapshots of Beeper chat statistics
 * 
 * Tracks counts across all messaging networks to monitor response rates
 * and communication patterns over time.
 */

// ==========================================
// Sync Actions
// ==========================================

/**
 * Main sync action - called by cron every 30 minutes
 * Calculates current stats from beeperChats table and stores snapshot
 */
export const captureStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("[messageStats] Starting message stats capture...");

    // Get the last snapshot timestamp to count messages sent since then
    const lastSnapshot = await ctx.db
      .query("messageSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .first();
    const lastSnapshotTimestamp = lastSnapshot?.timestamp;

    // Get all chats
    const allChats = await ctx.db.query("beeperChats").collect();

    // Initialize counters
    let totalChats = 0;
    let archivedChats = 0;
    let activeChats = 0;
    let needsReplyChats = 0;
    let mutedChats = 0;
    let pinnedChats = 0;

    // Network breakdowns
    const networkCounts: Record<string, number> = {
      imessage: 0,
      whatsapp: 0,
      instagram: 0,
      facebook: 0,
      telegram: 0,
      other: 0,
    };

    // Needs reply by network
    const needsReplyByNetwork: Record<string, number> = {
      imessage: 0,
      whatsapp: 0,
      instagram: 0,
      facebook: 0,
      telegram: 0,
      other: 0,
    };

    // Process each chat
    for (const chat of allChats) {
      // Only count single chats (not groups) for reply tracking
      const isSingleChat = chat.type === "single";
      
      totalChats++;

      // Archived status
      if (chat.isArchived) {
        archivedChats++;
      } else {
        activeChats++;
      }

      // Muted/Pinned
      if (chat.isMuted) mutedChats++;
      if (chat.isPinned) pinnedChats++;

      // Needs reply - only for single chats that aren't archived
      if (isSingleChat && !chat.isArchived && chat.needsReply) {
        needsReplyChats++;
      }

      // Network breakdown
      const network = (chat.network || "other").toLowerCase();
      const networkKey = getNetworkKey(network);
      networkCounts[networkKey]++;

      // Needs reply by network (single chats only)
      if (isSingleChat && !chat.isArchived && chat.needsReply) {
        needsReplyByNetwork[networkKey]++;
      }
    }

    // Count messages sent by user since last snapshot
    let messagesSentSinceLastSnapshot = 0;
    if (lastSnapshotTimestamp) {
      // Query all messages sent by user since the last snapshot
      const allUserMessages = await ctx.db
        .query("beeperMessages")
        .filter((q) =>
          q.and(
            q.eq(q.field("isFromUser"), true),
            q.gt(q.field("timestamp"), lastSnapshotTimestamp)
          )
        )
        .collect();
      messagesSentSinceLastSnapshot = allUserMessages.length;
    }

    // Store snapshot
    const snapshotId = await ctx.db.insert("messageSnapshots", {
      timestamp: Date.now(),
      totalChats,
      archivedChats,
      activeChats,
      needsReplyChats,
      mutedChats,
      pinnedChats,
      // Network breakdown
      imessageChats: networkCounts.imessage,
      whatsappChats: networkCounts.whatsapp,
      instagramChats: networkCounts.instagram,
      facebookChats: networkCounts.facebook,
      telegramChats: networkCounts.telegram,
      otherNetworkChats: networkCounts.other,
      // Needs reply by network
      needsReplyImessage: needsReplyByNetwork.imessage,
      needsReplyWhatsapp: needsReplyByNetwork.whatsapp,
      needsReplyInstagram: needsReplyByNetwork.instagram,
      needsReplyFacebook: needsReplyByNetwork.facebook,
      needsReplyTelegram: needsReplyByNetwork.telegram,
      needsReplyOther: needsReplyByNetwork.other,
      // Sent message tracking
      messagesSentSinceLastSnapshot,
    });

    console.log(
      `[messageStats] Snapshot captured: ${totalChats} total, ` +
      `${activeChats} active, ${archivedChats} archived, ` +
      `${needsReplyChats} awaiting reply, ` +
      `${messagesSentSinceLastSnapshot} sent since last snapshot`
    );

    return {
      snapshotId,
      totalChats,
      activeChats,
      archivedChats,
      needsReplyChats,
      messagesSentSinceLastSnapshot,
    };
  },
});

/**
 * Helper to normalize network names to our tracking categories
 */
function getNetworkKey(network: string): string {
  const normalized = network.toLowerCase();
  
  if (normalized.includes("imessage") || normalized.includes("sms")) {
    return "imessage";
  }
  if (normalized.includes("whatsapp")) {
    return "whatsapp";
  }
  if (normalized.includes("instagram")) {
    return "instagram";
  }
  if (normalized.includes("facebook") || normalized.includes("messenger")) {
    return "facebook";
  }
  if (normalized.includes("telegram")) {
    return "telegram";
  }
  return "other";
}

// ==========================================
// Queries
// ==========================================

/**
 * Get the latest message snapshot
 */
export const getLatestSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const snapshot = await ctx.db
      .query("messageSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .first();
    return snapshot;
  },
});

/**
 * Get message snapshots for a time range
 */
export const getSnapshots = query({
  args: {
    limit: v.optional(v.number()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("messageSnapshots")
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
 * Get daily summary of message stats (for charts)
 */
export const getDailySummary = query({
  args: {
    days: v.optional(v.number()), // Default 30 days
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const snapshots = await ctx.db
      .query("messageSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    // Filter to time range
    const filtered = snapshots.filter((s) => s.timestamp >= startTime);

    // Group by day and get the last snapshot of each day
    const byDay = new Map<string, (typeof filtered)[0]>();

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
        totalChats: snapshot.totalChats,
        activeChats: snapshot.activeChats,
        archivedChats: snapshot.archivedChats,
        needsReplyChats: snapshot.needsReplyChats,
        mutedChats: snapshot.mutedChats,
        pinnedChats: snapshot.pinnedChats,
        // Networks
        imessageChats: snapshot.imessageChats,
        whatsappChats: snapshot.whatsappChats,
        instagramChats: snapshot.instagramChats,
        facebookChats: snapshot.facebookChats,
        telegramChats: snapshot.telegramChats,
        otherNetworkChats: snapshot.otherNetworkChats,
        // Needs reply by network
        needsReplyImessage: snapshot.needsReplyImessage,
        needsReplyWhatsapp: snapshot.needsReplyWhatsapp,
        needsReplyInstagram: snapshot.needsReplyInstagram,
        needsReplyFacebook: snapshot.needsReplyFacebook,
        needsReplyTelegram: snapshot.needsReplyTelegram,
        needsReplyOther: snapshot.needsReplyOther,
      }));
  },
});

/**
 * Get stats about message data
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const snapshots = await ctx.db.query("messageSnapshots").collect();

    if (snapshots.length === 0) {
      return {
        totalSnapshots: 0,
        oldestSnapshot: null,
        newestSnapshot: null,
        totalMessagesSent: 0,
        currentStats: null,
      };
    }

    // Sort by timestamp
    snapshots.sort((a, b) => a.timestamp - b.timestamp);

    const oldest = snapshots[0];
    const newest = snapshots[snapshots.length - 1];

    // Sum up all messages sent across all snapshots
    const totalMessagesSent = snapshots.reduce(
      (sum, s) => sum + (s.messagesSentSinceLastSnapshot ?? 0),
      0
    );

    return {
      totalSnapshots: snapshots.length,
      oldestSnapshot: oldest.timestamp,
      newestSnapshot: newest.timestamp,
      totalMessagesSent,
      currentStats: {
        totalChats: newest.totalChats,
        activeChats: newest.activeChats,
        archivedChats: newest.archivedChats,
        needsReplyChats: newest.needsReplyChats,
      },
    };
  },
});

// ==========================================
// Mutations
// ==========================================

/**
 * Delete a message snapshot by ID
 * Requires authentication
 */
export const deleteSnapshot = mutation({
  args: {
    id: v.id("messageSnapshots"),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * Clear all message snapshots (internal use only)
 */
export const clearAllSnapshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    const snapshots = await ctx.db.query("messageSnapshots").collect();
    let deleted = 0;
    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id);
      deleted++;
    }
    return { deleted };
  },
});

// ==========================================
// Manual Trigger Actions
// ==========================================

/**
 * Manually trigger a message stats capture (public action wrapper)
 */
export const triggerManualCapture = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    message?: string;
    stats?: {
      totalChats: number;
      activeChats: number;
      archivedChats: number;
      needsReplyChats: number;
      messagesSentSinceLastSnapshot: number;
    };
    error?: string;
  }> => {
    try {
      const result = await ctx.runMutation(internal.messageStats.captureStats, {});

      return {
        success: true,
        message: `Captured: ${result.totalChats} total, ${result.activeChats} active, ${result.needsReplyChats} awaiting reply, ${result.messagesSentSinceLastSnapshot} sent`,
        stats: {
          totalChats: result.totalChats,
          activeChats: result.activeChats,
          archivedChats: result.archivedChats,
          needsReplyChats: result.needsReplyChats,
          messagesSentSinceLastSnapshot: result.messagesSentSinceLastSnapshot,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
