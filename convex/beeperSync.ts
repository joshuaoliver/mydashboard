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
 * Initialize Beeper SDK client (v4.2.2+)
 * Configured for your custom endpoint server
 * 
 * Features:
 * - Auto-retry on connection errors, timeouts, and rate limits
 * - Debug logging in development mode
 * - Proper error types for better error handling
 */
function createBeeperClient() {
  if (!BEEPER_TOKEN) {
    throw new Error("BEEPER_TOKEN environment variable is not set");
  }

  return new BeeperDesktop({
    accessToken: BEEPER_TOKEN,
    baseURL: BEEPER_API_URL,
    maxRetries: 2, // Retry on 408, 429, 5xx errors
    timeout: 15000, // 15 seconds
    logLevel: process.env.BEEPER_LOG_LEVEL as any || 'warn', // 'debug', 'info', 'warn', 'error', 'off'
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
      type: v.union(v.literal("single"), v.literal("group")),
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

    // Calculate reply tracking from NEW messages (if any)
    // OR query database to find the actual last message
    let lastMessageFrom: "user" | "them" | undefined;
    let needsReply: boolean | undefined;
    let lastMessageText: string | undefined;

    if (args.messages.length > 0) {
      // We have new messages - use the most recent one from the API
      // Messages MUST be sorted by timestamp (oldest to newest) before calling this function
      const lastMessage = args.messages[args.messages.length - 1];
      lastMessageFrom = lastMessage.isFromUser ? "user" : "them";
      needsReply = !lastMessage.isFromUser; // Need to reply if they sent last message
      lastMessageText = lastMessage.text;
      
      console.log(
        `[syncChatMessages] Updated reply tracking from NEW messages: ` +
        `lastFrom=${lastMessageFrom}, needsReply=${needsReply}`
      );
    } else {
      // No new messages - query database to find the actual last message
      // This ensures we don't overwrite existing tracking data with undefined
      const existingMessages = await ctx.db
        .query("beeperMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
        .order("desc") // Newest first
        .take(1);
      
      if (existingMessages.length > 0) {
        const lastMsg = existingMessages[0];
        lastMessageFrom = lastMsg.isFromUser ? "user" : "them";
        needsReply = !lastMsg.isFromUser;
        lastMessageText = lastMsg.text;
        
        console.log(
          `[syncChatMessages] Preserved reply tracking from DB (no new messages): ` +
          `lastFrom=${lastMessageFrom}, needsReply=${needsReply}`
        );
      } else {
        // No messages at all for this chat - leave as undefined
        console.log(`[syncChatMessages] No messages found for chat ${args.chatId}`);
      }
    }

    // Update chat with lastMessagesSyncedAt and reply tracking
    // CRITICAL: Only include fields that have values to avoid overwriting with undefined
    const chatUpdate: any = {
      lastMessagesSyncedAt: args.lastMessagesSyncedAt,
    };
    
    if (lastMessageFrom !== undefined) {
      chatUpdate.lastMessageFrom = lastMessageFrom;
    }
    if (needsReply !== undefined) {
      chatUpdate.needsReply = needsReply;
    }
    if (lastMessageText !== undefined) {
      chatUpdate.lastMessage = lastMessageText;
    }
    
    await ctx.db.patch(args.chatDocId, chatUpdate);

    return insertedCount;
  },
});

/**
 * Internal action to fetch data from Beeper API and sync to database
 * NOW USING OFFICIAL BEEPER SDK v4.2.2+! 🎉
 * 
 * Benefits:
 * - Type safety with TypeScript definitions
 * - Built-in error handling & retries (2x on 429, 5xx, timeouts)
 * - Specific error types (APIError, RateLimitError, etc.)
 * - Auto-pagination support
 * - Debug logging in development
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

        // Ensure type is properly typed as "single" | "group"
        const chatType = (chat.type === "single" || chat.type === "group") ? chat.type : "single" as const;

        const chatData = {
          chatId: chat.id,
          localChatID: chat.localChatID || chat.id,
          title: chat.title || "Unknown",
          network: chat.network || chat.accountID || "Unknown",
          accountID: chat.accountID || "",
          type: chatType,
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

            // Build query params - fetch messages newer than last sync
            const messageQueryParams: any = {
              limit: 200, // Fetch up to 200 per page (API may have lower max)
            };
            
            let messages: any[] = [];
            
            if (existingChat?.lastMessagesSyncedAt && !args.forceMessageSync) {
              // Incremental sync - fetch ALL messages since last sync using auto-pagination
              messageQueryParams.dateAfter = new Date(existingChat.lastMessagesSyncedAt).toISOString();
              console.log(
                `[Beeper Sync] Fetching ALL NEW messages for chat ${chat.id} (${chat.title}) ` +
                `since ${new Date(existingChat.lastMessagesSyncedAt).toISOString()} (auto-paginating)...`
              );
              
              // Use auto-pagination to get ALL new messages (SDK v4.2.2+ feature)
              const allMessages: any[] = [];
              for await (const message of client.messages.list({
                chatID: chat.id,
                ...messageQueryParams
              } as any)) {
                allMessages.push(message);
              }
              messages = allMessages;
            } else {
              // Full sync - fetch recent messages (limited to avoid overload on first sync)
              messageQueryParams.limit = 200; // Limit to last 200 messages on full sync
              console.log(`[Beeper Sync] Fetching last ${messageQueryParams.limit} messages for chat ${chat.id} (${chat.title}) (full sync)...`);
              
              const messagesResponse = await client.get(`/v1/chats/${encodeURIComponent(chat.id)}/messages`, {
                query: messageQueryParams
              }) as any;
              messages = messagesResponse.items || [];
            }

            console.log(
              `[Beeper Sync] Received ${messages.length} messages from API for chat ${chat.id} (${chat.title}) ` +
              `${messageQueryParams.dateAfter ? '(incremental, auto-paginated)' : '(full sync, limited)'}`
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
      // SDK v4.2.2+ provides specific error types
      let errorMsg = "Unknown error";
      let errorType = "UnknownError";
      
      if (error && typeof error === 'object' && 'constructor' in error) {
        const errorName = error.constructor.name;
        errorType = errorName;
        
        // Check for specific API error types from SDK
        if ('status' in error && 'message' in error) {
          const apiError = error as any;
          errorMsg = `${errorName} (${apiError.status}): ${apiError.message}`;
          
          // Log specific error details for debugging
          if (apiError.status === 429) {
            console.error(`[Beeper Sync] Rate limited! Please wait before retrying.`);
          } else if (apiError.status >= 500) {
            console.error(`[Beeper Sync] Server error - Beeper API may be experiencing issues.`);
          } else if (apiError.status === 401) {
            console.error(`[Beeper Sync] Authentication failed - check BEEPER_TOKEN`);
          }
        } else if (error instanceof Error) {
          errorMsg = error.message;
        }
      }
      
      console.error(`[Beeper Sync] ${errorType}: ${errorMsg}`);
      
      return {
        success: false,
        syncedChats: 0,
        syncedMessages: 0,
        timestamp: Date.now(),
        source: args.syncSource,
        error: errorMsg,
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

