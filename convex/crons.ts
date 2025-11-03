import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Sync Beeper chats every 10 minutes
 * Keeps database fresh with latest chat data
 * Uses in-memory cache to only fetch chats with recent activity
 */
crons.interval(
  "sync-beeper-chats",
  { minutes: 10 },
  internal.beeperSync.syncBeeperChatsInternal,
  { 
    syncSource: "cron",
    forceMessageSync: false, // Only sync messages for chats with new activity
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

export default crons;
