import { internalMutation, internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import BeeperDesktop from '@beeper/desktop-api';

// Beeper API configuration
const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

/**
 * In-memory cache for sync tracking
 * Stores the last sync time to filter API requests by lastActivityAfter
 */
let lastSyncTimestamp: number | null = null;

/**
 * Initialize Beeper SDK client
 * Configured for your custom V0 endpoint server
 */
function createBeeperClient() {
  if (!BEEPER_TOKEN) {
    throw new Error("BEEPER_TOKEN environment variable is not set");
  }

  return new BeeperDesktop({
    accessToken: BEEPER_TOKEN,
    baseURL: BEEPER_API_URL,
    maxRetries: 2,
    timeout: 15000, // 15 seconds
  });
}

/**
 * Helper mutation to upsert a single chat into database
 * Returns doc ID and whether messages need syncing
 */
export const upsertChat = internalMutation({
  args: {
    chatData: v.object({
      chatId: v.string(),
      localChatID: v.string(),
      title: v.string(),
      network: v.string(),
      accountID: v.string(),
      type: v.string(),
      username: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
      email: v.optional(v.string()),
      participantId: v.optional(v.string()),
      lastActivity: v.number(),
      unreadCount: v.number(),
      isArchived: v.boolean(),
      isMuted: v.boolean(),
      isPinned: v.boolean(),
      lastSyncedAt: v.number(),
      syncSource: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const existingChat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatData.chatId))
      .first();

    let chatDocId;
    let shouldSyncMessages = false;

    if (existingChat) {
      await ctx.db.patch(existingChat._id, args.chatData);
      chatDocId = existingChat._id;
      // Check if messages need syncing
      shouldSyncMessages =
        !existingChat.lastMessagesSyncedAt ||
        args.chatData.lastActivity > existingChat.lastMessagesSyncedAt;
      
      console.log(
        `[upsertChat] Chat ${args.chatData.chatId}: ` +
        `lastMessagesSyncedAt=${existingChat.lastMessagesSyncedAt}, ` +
        `lastActivity=${args.chatData.lastActivity}, ` +
        `shouldSync=${shouldSyncMessages}`
      );
    } else {
      chatDocId = await ctx.db.insert("beeperChats", args.chatData);
      // New chat - always sync messages
      shouldSyncMessages = true;
      console.log(`[upsertChat] New chat ${args.chatData.chatId}: will sync messages`);
    }

    return { chatDocId, shouldSyncMessages };
  },
});

/**
 * Helper mutation to sync messages for a chat
 * Uses upsert logic: updates existing messages, inserts new ones
 */
export const syncChatMessages = internalMutation({
  args: {
    chatId: v.string(),
    messages: v.array(
      v.object({
        messageId: v.string(),
        text: v.string(),
        timestamp: v.number(),
        senderId: v.string(),
        senderName: v.string(),
        isFromUser: v.boolean(),
        attachments: v.optional(v.array(v.object({
          type: v.string(),
          srcURL: v.string(),
          mimeType: v.optional(v.string()),
          fileName: v.optional(v.string()),
          fileSize: v.optional(v.number()),
          isGif: v.optional(v.boolean()),
          isSticker: v.optional(v.boolean()),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
        }))),
      })
    ),
    chatDocId: v.id("beeperChats"),
    lastMessagesSyncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    let insertedCount = 0;
    let skippedCount = 0;

    // OPTIMIZATION: Messages are immutable - once sent, they never change.
    // So we only need to INSERT new messages, never UPDATE existing ones.
    // This eliminates unnecessary database patches.
    
    for (const msg of args.messages) {
      // Check if message already exists using the by_message_id index (faster)
      const existingMessage = await ctx.db
        .query("beeperMessages")
        .withIndex("by_message_id", (q) => q.eq("messageId", msg.messageId))
        .first();

      if (existingMessage) {
        // Message already exists - skip it (messages are immutable)
        skippedCount++;
      } else {
        // Insert new message
        await ctx.db.insert("beeperMessages", {
          chatId: args.chatId,
          messageId: msg.messageId,
          text: msg.text,
          timestamp: msg.timestamp,
          senderId: msg.senderId,
          senderName: msg.senderName,
          isFromUser: msg.isFromUser,
          attachments: msg.attachments,
        });
        insertedCount++;
      }
    }

    console.log(
      `[syncChatMessages] Chat ${args.chatId}: inserted ${insertedCount}, skipped ${skippedCount} (already cached)`
    );

    // Calculate reply tracking from messages
    let lastMessageFrom: "user" | "them" | undefined;
    let needsReply = false;
    let lastMessageText: string | undefined;

    if (args.messages.length > 0) {
      // Messages MUST be sorted by timestamp (oldest to newest) before calling this function
      // Get the MOST RECENT message (last item in sorted array)
      const lastMessage = args.messages[args.messages.length - 1];
      lastMessageFrom = lastMessage.isFromUser ? "user" : "them";
      needsReply = !lastMessage.isFromUser; // Need to reply if they sent last message
      lastMessageText = lastMessage.text;
    }

    // Update chat with lastMessagesSyncedAt and reply tracking
    await ctx.db.patch(args.chatDocId, {
      lastMessagesSyncedAt: args.lastMessagesSyncedAt,
      lastMessageFrom,
      needsReply,
      lastMessage: lastMessageText,
    });

    return insertedCount;
  },
});

/**
 * Internal action to fetch data from Beeper API and sync to database
 * NOW USING OFFICIAL BEEPER SDK! 🎉
 * 
 * Benefits:
 * - Type safety
 * - Built-in error handling & retries
 * - Cleaner code
 * - Better timeout handling
 */
export const syncBeeperChatsInternal = internalAction({
  handler: async (ctx, args: { syncSource: string; forceMessageSync?: boolean; bypassCache?: boolean }) => {
    try {
      const now = Date.now();
      
      // Initialize Beeper SDK client
      const client = createBeeperClient();

      // Determine if we should filter by lastActivityAfter
      const useFilter = !args.bypassCache && lastSyncTimestamp !== null;
      
      if (useFilter) {
        const filterAge = now - lastSyncTimestamp!;
        console.log(
          `[Beeper Sync] Filtering chats with activity after ${new Date(lastSyncTimestamp!).toISOString()} ` +
          `(${Math.round(filterAge / 1000)}s ago)`
        );
      } else {
        console.log(`[Beeper Sync] ${args.bypassCache ? 'Cache bypassed' : 'No previous sync'} - fetching all chats`);
      }

      // Fetch chats using V1 API which supports date filtering
      // V1 API: /v1/chats/search supports lastActivityAfter and lastActivityBefore
      const queryParams: any = {
        limit: 100,
        // Optional filters:
        // type: 'single',  // Only direct messages
        // unreadOnly: true,  // Only unread chats
      };

      // Add lastActivityAfter filter if we have a previous sync timestamp
      if (useFilter && lastSyncTimestamp) {
        queryParams.lastActivityAfter = new Date(lastSyncTimestamp).toISOString();
      }

      const response = await client.get('/v1/chats/search', {
        query: queryParams
      }) as any;

      const chats = response.items || [];
      
      console.log(
        `[Beeper Sync] Received ${chats.length} chats from API ` +
        `(${useFilter ? 'filtered by lastActivityAfter' : 'all chats'})`
      );

      let syncedChatsCount = 0;
      let syncedMessagesCount = 0;

      // Process each chat
      for (const chat of chats) {
        // Extract contact info for single chats
        let username: string | undefined;
        let phoneNumber: string | undefined;
        let email: string | undefined;
        let participantId: string | undefined;

        if (chat.type === "single" && chat.participants?.items) {
          // Find the participant that's not yourself
          const otherPerson = chat.participants.items.find(
            (p: any) => p.isSelf === false
          );

          if (otherPerson) {
            username = otherPerson.username;
            phoneNumber = otherPerson.phoneNumber;
            email = otherPerson.email;
            participantId = otherPerson.id;
          }
        }

        const lastActivity = new Date(chat.lastActivity).getTime();

        const chatData = {
          chatId: chat.id,
          localChatID: chat.localChatID || chat.id,
          title: chat.title || "Unknown",
          network: chat.network || chat.accountID || "Unknown",
          accountID: chat.accountID || "",
          type: chat.type || "single",
          username,
          phoneNumber,
          email,
          participantId,
          lastActivity,
          unreadCount: chat.unreadCount || 0,
          isArchived: chat.isArchived || false,
          isMuted: chat.isMuted || false,
          isPinned: chat.isPinned || false,
          lastSyncedAt: now,
          syncSource: args.syncSource,
        };

        // Upsert chat via mutation (returns chatDocId and shouldSyncMessages)
        const { chatDocId, shouldSyncMessages } = await ctx.runMutation(
          internal.beeperSync.upsertChat,
          { chatData }
        );

        syncedChatsCount++;

        // Force message sync if explicitly requested (manual refresh)
        // or if shouldSyncMessages is true (new activity detected)
        const shouldFetchMessages = args.forceMessageSync || shouldSyncMessages;

        if (shouldFetchMessages) {
          try {
            // Get the existing chat to check when we last synced messages
            const existingChat = await ctx.runQuery(
              internal.beeperQueries.getChatByIdInternal,
              { chatId: chat.id }
            );

            // Build query params - only fetch messages newer than last sync
            const messageQueryParams: any = {};
            
            if (existingChat?.lastMessagesSyncedAt && !args.forceMessageSync) {
              // Only fetch messages since last sync (incremental update)
              messageQueryParams.dateAfter = new Date(existingChat.lastMessagesSyncedAt).toISOString();
              console.log(
                `[Beeper Sync] Fetching NEW messages for chat ${chat.id} (${chat.title}) ` +
                `since ${new Date(existingChat.lastMessagesSyncedAt).toISOString()}...`
              );
            } else {
              // Full sync - fetch all recent messages
              console.log(`[Beeper Sync] Fetching ALL messages for chat ${chat.id} (${chat.title})...`);
            }
            
            // Use the better /v1/chats/{chatID}/messages endpoint
            // This endpoint supports proper pagination and higher limits
            const messagesResponse = await client.get(`/v1/chats/${encodeURIComponent(chat.id)}/messages`, {
              query: messageQueryParams
            }) as any;

            const messages = messagesResponse.items || [];
            console.log(
              `[Beeper Sync] Received ${messages.length} messages from API for chat ${chat.id} (${chat.title}) ` +
              `${messageQueryParams.dateAfter ? '(incremental)' : '(full sync)'}`
            );

            // Prepare messages for mutation
            const messagesToSync = messages
              .map((msg: any) => {
                // Extract attachments if present
                const attachments = msg.attachments?.map((att: any) => ({
                  type: att.type || "unknown",
                  srcURL: att.srcURL,
                  mimeType: att.mimeType,
                  fileName: att.fileName,
                  fileSize: att.fileSize,
                  isGif: att.isGif,
                  isSticker: att.isSticker,
                  width: att.size?.width,
                  height: att.size?.height,
                }));

                return {
                  messageId: msg.id,
                  text: msg.text || "",
                  timestamp: new Date(msg.timestamp).getTime(),
                  senderId: msg.senderID,
                  senderName: msg.senderName || msg.senderID,
                  isFromUser: msg.isSender || false,
                  attachments: attachments && attachments.length > 0 ? attachments : undefined,
                };
              })
              // CRITICAL: Sort by timestamp (oldest to newest) before syncing
              // This ensures lastMessage is correctly identified as the most recent
              .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp);

            console.log(`[Beeper Sync] Syncing ${messagesToSync.length} messages for chatId: ${chat.id} (${chat.title})`);
            
            // Sync messages via mutation
            const messageCount = await ctx.runMutation(
              internal.beeperSync.syncChatMessages,
              {
                chatId: chat.id,
                messages: messagesToSync,
                chatDocId,
                lastMessagesSyncedAt: now,
              }
            );

            syncedMessagesCount += messageCount;
          } catch (msgError) {
            // SDK handles retries, but log if it still fails
            const msgErrorMsg = msgError instanceof Error ? msgError.message : "Unknown error";
            console.warn(
              `[Beeper Sync] Error syncing messages for chat ${chat.id}: ${msgErrorMsg}`
            );
          }
        } else {
          console.log(`[Beeper Sync] Skipping message sync for chat ${chat.id} (already up to date)`);
        }
      }

      console.log(
        `[Beeper Sync] Synced ${syncedChatsCount} chats, ${syncedMessagesCount} messages (source: ${args.syncSource})`
      );

      // Update lastSyncTimestamp for next sync (use current time, not max activity)
      lastSyncTimestamp = now;
      console.log(`[Beeper Sync] Updated lastSyncTimestamp to ${new Date(now).toISOString()}`);

      return {
        success: true,
        syncedChats: syncedChatsCount,
        syncedMessages: syncedMessagesCount,
        timestamp: now,
        source: args.syncSource,
      };
    } catch (error) {
      // SDK provides better error messages
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Beeper Sync] Unexpected error: ${errorMsg}`);
      
      return {
        success: false,
        syncedChats: 0,
        syncedMessages: 0,
        timestamp: Date.now(),
        source: args.syncSource,
        error: `Unexpected error: ${errorMsg}`,
      };
    }
  },
});

/**
 * Public action for manual sync
 * Can be triggered by frontend on page load or refresh button
 * Forces message sync for all chats to ensure latest data
 * Bypasses cache to get a full refresh
 */
export const manualSync = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    syncedChats: number;
    syncedMessages: number;
    timestamp: number;
    source: string;
    error?: string;
  }> => {
    const result = await ctx.runAction(internal.beeperSync.syncBeeperChatsInternal, {
      syncSource: "manual",
      forceMessageSync: true, // Always fetch messages on manual refresh
      bypassCache: true, // Bypass cache for manual refresh
    });
    return result;
  },
});

/**
 * Page load sync - triggered when user opens the page
 * Only syncs messages for chats with new activity (not forced)
 * Uses in-memory cache to avoid re-fetching unchanged chats
 */
export const pageLoadSync = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    syncedChats: number;
    syncedMessages: number;
    timestamp: number;
    source: string;
    error?: string;
  }> => {
    const result = await ctx.runAction(internal.beeperSync.syncBeeperChatsInternal, {
      syncSource: "page_load",
      forceMessageSync: false, // Don't force on page load - only sync new activity
      bypassCache: false, // Use cache to filter by recent activity
    });
    return result;
  },
});

