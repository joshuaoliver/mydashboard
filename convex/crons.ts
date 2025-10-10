import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Sync Beeper chats every 10 minutes
 * Keeps database fresh with latest chat data
 */
crons.interval(
  "sync-beeper-chats",
  { minutes: 10 },
  internal.beeperSync.syncBeeperChatsInternal,
  { syncSource: "cron" }
);

export default crons;
