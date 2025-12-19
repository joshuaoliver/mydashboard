import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Sync Beeper chats every 10 minutes
 * Keeps database fresh with latest chat data
 * Lightweight sync: Fetches chat list + last 15 messages per active chat
 * Full history loaded on-demand when user opens a chat
 */
crons.interval(
  "sync-beeper-chats",
  { minutes: 10 },
  internal.beeperSync.syncBeeperChatsInternal,
  { 
    syncSource: "cron",
    bypassCache: false, // Use cache to filter by recent activity
  }
);

/**
 * Sync Dex contacts every 2 hours
 * Keeps contact database in sync with Dex CRM
 */
crons.interval(
  "sync-dex-contacts",
  { hours: 2 },
  internal.dexSync.syncContactsFromDex,
  {}
);

// ===========================================
// Stats Dashboard Sync Jobs
// ===========================================

/**
 * Gmail inbox sync - every 15 minutes
 * Stores historical inbox count snapshots
 */
crons.interval(
  "sync-gmail-inbox",
  { minutes: 15 },
  internal.gmailSync.syncInbox,
  {}
);

/**
 * Hubstaff time entries sync - every 15 minutes
 * Fetches time entries for the selected user
 */
crons.interval(
  "sync-hubstaff-entries",
  { minutes: 15 },
  internal.hubstaffSync.syncTimeEntries,
  {}
);

/**
 * Hubstaff daily summary calculation - every hour
 * Recalculates daily summaries from time entries
 */
crons.interval(
  "calc-hubstaff-summaries",
  { hours: 1 },
  internal.hubstaffSync.calculateDailySummaries,
  {}
);

/**
 * Linear issues sync - every 15 minutes
 * Syncs uncompleted issues from all active workspaces
 * Serves as backup to webhook-based real-time updates
 */
crons.interval(
  "sync-linear-issues",
  { minutes: 15 },
  internal.linearSync.syncAllWorkspaces,
  {}
);

/**
 * Linear issue stats snapshot - every hour
 * Captures current issue counts per project/team for historical tracking
 * Used to display task count trends over time
 */
crons.interval(
  "capture-linear-stats",
  { hours: 1 },
  internal.linearSync.captureHourlyStats,
  {}
);

export default crons;
