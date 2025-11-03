"use node";

import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import BeeperDesktop from '@beeper/desktop-api';

// Beeper API configuration
const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

/**
 * In-memory cache for tracking last message sync timestamp
 */
let lastMessageSyncTimestamp: number | null = null;

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
 * BETTER APPROACH: Sync latest messages globally across all chats
 * 
 * Instead of iterating through each chat and fetching messages,
 * this uses the global message search to get recent messages across ALL chats in one go.
 * 
 * Benefits:
 * - One API call instead of N calls (where N = number of chats)
 * - Automatically gets messages from most active chats
 * - Faster and more efficient
 * - Simpler logic
 * 
 * How it works:
 * 1. Fetch latest messages across all chats (limit 100-200)
 * 2. Group messages by chatId
 * 3. Upsert messages and update chat metadata
 * 4. Uses dateAfter filter for incremental syncs
 */
export const syncLatestMessagesGlobal = internalAction({
  handler: async (ctx, args: { syncSource: string; bypassCache?: boolean }) => {
    try {
      const now = Date.now();
      
      // Initialize Beeper SDK client
      const client = createBeeperClient();

      // Determine if we should filter by date
      const useFilter = !args.bypassCache && lastMessageSyncTimestamp !== null;
      
      if (useFilter) {
        const filterAge = now - lastMessageSyncTimestamp!;
        console.log(
          `[Global Message Sync] Filtering messages after ${new Date(lastMessageSyncTimestamp!).toISOString()} ` +
          `(${Math.round(filterAge / 1000)}s ago)`
        );
      } else {
        console.log(`[Global Message Sync] ${args.bypassCache ? 'Cache bypassed' : 'No previous sync'} - fetching recent messages`);
      }

      // Build query parameters for global message search
      const queryParams: any = {
        limit: 100, // Fetch up to 100 messages per page
      };

      // Add date filter if we have a previous sync timestamp
      if (useFilter && lastMessageSyncTimestamp) {
        queryParams.dateAfter = new Date(lastMessageSyncTimestamp).toISOString();
      }

      // Fetch ALL new messages across all chats using auto-pagination (SDK v4.2.2+ feature)
      const messages: any[] = [];
      const chatsMap: Record<string, any> = {};
      
      for await (const message of client.messages.search(queryParams as any)) {
        messages.push(message);
        // Collect chat info from message responses
        // Note: The messages.search endpoint may include chat data
      }
      
      // Also fetch chat metadata for any chats with new messages
      const uniqueChatIds = [...new Set(messages.map(m => m.chatID))];
      for (const chatId of uniqueChatIds) {
        if (!chatsMap[chatId]) {
          try {
            const chatResponse = await client.get(`/v1/chats/${encodeURIComponent(chatId)}`) as any;
            chatsMap[chatId] = chatResponse;
          } catch (err) {
            console.warn(`[Global Message Sync] Could not fetch chat ${chatId}:`, err);
          }
        }
      }
      
      const chats = chatsMap;
      
      console.log(
        `[Global Message Sync] Received ${messages.length} messages across ${Object.keys(chats).length} chats`
      );

      // Group messages by chatId
      const messagesByChat: Record<string, any[]> = {};
      for (const msg of messages) {
        if (!messagesByChat[msg.chatID]) {
          messagesByChat[msg.chatID] = [];
        }
        messagesByChat[msg.chatID].push(msg);
      }

      let syncedChatsCount = 0;
      let syncedMessagesCount = 0;

      // Process each chat that has messages
      for (const [chatId, chatMessages] of Object.entries(messagesByChat)) {
        const chat = chats[chatId];
        if (!chat) {
          console.warn(`[Global Message Sync] Chat ${chatId} not found in response`);
          continue;
        }

        // Extract contact info for single chats
        let username: string | undefined;
        let phoneNumber: string | undefined;
        let email: string | undefined;
        let participantId: string | undefined;

        if (chat.type === "single" && chat.participants?.items) {
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

        // Upsert chat
        const { chatDocId } = await ctx.runMutation(
          internal.beeperSync.upsertChat,
          { chatData }
        );

        syncedChatsCount++;

        // Prepare messages for mutation
        const messagesToSync = chatMessages
          .map((msg: any) => {
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
          .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp);

        // Sync messages
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
      }

      console.log(
        `[Global Message Sync] Synced ${syncedChatsCount} chats, ${syncedMessagesCount} messages (source: ${args.syncSource})`
      );

      // Update lastMessageSyncTimestamp for next sync
      if (messages.length > 0) {
        // Use the timestamp of the newest message
        const newestMessage = messages.reduce((latest: any, msg: any) => {
          const msgTime = new Date(msg.timestamp).getTime();
          const latestTime = new Date(latest.timestamp).getTime();
          return msgTime > latestTime ? msg : latest;
        });
        lastMessageSyncTimestamp = new Date(newestMessage.timestamp).getTime();
        console.log(`[Global Message Sync] Updated lastMessageSyncTimestamp to ${new Date(lastMessageSyncTimestamp).toISOString()}`);
      }

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
            console.error(`[Global Message Sync] Rate limited! Please wait before retrying.`);
          } else if (apiError.status >= 500) {
            console.error(`[Global Message Sync] Server error - Beeper API may be experiencing issues.`);
          } else if (apiError.status === 401) {
            console.error(`[Global Message Sync] Authentication failed - check BEEPER_TOKEN`);
          }
        } else if (error instanceof Error) {
          errorMsg = error.message;
        }
      }
      
      console.error(`[Global Message Sync] ${errorType}: ${errorMsg}`);
      
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
 * Hybrid approach: Sync chats first, then messages globally
 * 
 * This combines the best of both approaches:
 * 1. Sync chat list (metadata, contact info, etc.)
 * 2. Sync latest messages globally in one go
 * 
 * Benefits:
 * - Get complete chat metadata (participant info, etc.)
 * - Efficient message syncing (one API call)
 * - Simpler and faster than per-chat iteration
 */
export const hybridSync = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    syncedChats: number;
    syncedMessages: number;
    timestamp: number;
    source: string;
    error?: string;
  }> => {
    try {
      const now = Date.now();
      
      // Step 1: Sync chat list (gets metadata, participants, etc.)
      console.log('[Hybrid Sync] Step 1: Syncing chat list...');
      const chatResult = await ctx.runAction(internal.beeperSync.syncBeeperChatsInternal, {
        syncSource: "hybrid",
        forceMessageSync: false, // Don't sync messages per-chat
        bypassCache: false,
      });

      if (!chatResult.success) {
        throw new Error(chatResult.error || 'Chat sync failed');
      }

      // Step 2: Sync latest messages globally (one API call)
      console.log('[Hybrid Sync] Step 2: Syncing messages globally...');
      const messageResult = await ctx.runAction(internal.beeperGlobalSync.syncLatestMessagesGlobal, {
        syncSource: "hybrid",
        bypassCache: false,
      });

      if (!messageResult.success) {
        throw new Error(messageResult.error || 'Message sync failed');
      }

      console.log(
        `[Hybrid Sync] Complete! ` +
        `Chats: ${chatResult.syncedChats}, Messages: ${messageResult.syncedMessages}`
      );

      return {
        success: true,
        syncedChats: chatResult.syncedChats,
        syncedMessages: messageResult.syncedMessages,
        timestamp: now,
        source: "hybrid",
      };
    } catch (error) {
      // SDK v4.2.2+ provides specific error types
      let errorMsg = "Unknown error";
      
      if (error && typeof error === 'object' && 'constructor' in error) {
        const errorName = error.constructor.name;
        
        // Check for specific API error types from SDK
        if ('status' in error && 'message' in error) {
          const apiError = error as any;
          errorMsg = `${errorName} (${apiError.status}): ${apiError.message}`;
        } else if (error instanceof Error) {
          errorMsg = error.message;
        }
      }
      
      console.error(`[Hybrid Sync] Error: ${errorMsg}`);
      
      return {
        success: false,
        syncedChats: 0,
        syncedMessages: 0,
        timestamp: Date.now(),
        source: "hybrid",
        error: errorMsg,
      };
    }
  },
});

/**
 * Public action for global message sync
 * Can be used as an alternative to the per-chat approach
 */
export const globalMessageSync = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    syncedChats: number;
    syncedMessages: number;
    timestamp: number;
    source: string;
    error?: string;
  }> => {
    const result = await ctx.runAction(internal.beeperGlobalSync.syncLatestMessagesGlobal, {
      syncSource: "global",
      bypassCache: true, // Force fresh data
    });
    return result;
  },
});

