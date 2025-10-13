import { internalMutation, internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import BeeperDesktop from '@beeper/desktop-api';

// Beeper API configuration
const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

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
      })
    ),
    chatDocId: v.id("beeperChats"),
    lastMessagesSyncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    let insertedCount = 0;
    let updatedCount = 0;

    // Upsert each message
    for (const msg of args.messages) {
      // Check if message already exists FOR THIS SPECIFIC CHAT
      // Use by_chat index to check chatId + messageId combination
      const existingMessages = await ctx.db
        .query("beeperMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
        .filter((q) => q.eq(q.field("messageId"), msg.messageId))
        .first();

      if (existingMessages) {
        // Update existing message (in case content changed)
        await ctx.db.patch(existingMessages._id, {
          text: msg.text,
          timestamp: msg.timestamp,
          senderId: msg.senderId,
          senderName: msg.senderName,
          isFromUser: msg.isFromUser,
        });
        updatedCount++;
      } else {
        // Insert new message with chatId
        await ctx.db.insert("beeperMessages", {
          chatId: args.chatId,
          messageId: msg.messageId,
          text: msg.text,
          timestamp: msg.timestamp,
          senderId: msg.senderId,
          senderName: msg.senderName,
          isFromUser: msg.isFromUser,
        });
        insertedCount++;
      }
    }

    console.log(
      `[syncChatMessages] Chat ${args.chatId}: inserted ${insertedCount}, updated ${updatedCount}`
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

    return insertedCount + updatedCount;
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
  handler: async (ctx, args: { syncSource: string; forceMessageSync?: boolean }) => {
    try {
      // Initialize Beeper SDK client
      const client = createBeeperClient();

      // Fetch chats using SDK (automatically handles V0 endpoints)
      // The SDK will retry on failures and handle errors gracefully
      const response = await client.get('/v0/search-chats', {
        query: { 
          limit: 100,
          // Optional filters:
          // type: 'single',  // Only direct messages
          // unreadOnly: true,  // Only unread chats
        }
      }) as any; // Type assertion needed for custom V0 endpoint

      const chats = response.items || [];

      let syncedChatsCount = 0;
      let syncedMessagesCount = 0;
      const now = Date.now();

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
            console.log(`[Beeper Sync] Fetching messages for chat ${chat.id} (${chat.title})...`);
            
            // Fetch messages using direct fetch (SDK doesn't handle array parameters correctly)
            // The API expects chatIDs[] (with brackets) for array notation
            const messagesUrl = `${BEEPER_API_URL}/v0/search-messages?chatIDs[]=${encodeURIComponent(chat.id)}&limit=30`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const messagesResponse = await fetch(messagesUrl, {
              method: "GET",
              headers: { "Authorization": `Bearer ${BEEPER_TOKEN}` },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!messagesResponse.ok) {
              throw new Error(`HTTP ${messagesResponse.status}: ${await messagesResponse.text()}`);
            }

            const messagesData = await messagesResponse.json() as any;
            const messages = messagesData.items || [];
            console.log(`[Beeper Sync] Received ${messages.length} messages from API for chat ${chat.id} (${chat.title})`);

            // Prepare messages for mutation
            const messagesToSync = messages
              .map((msg: any) => ({
                messageId: msg.id,
                text: msg.text || "",
                timestamp: new Date(msg.timestamp).getTime(),
                senderId: msg.senderID,
                senderName: msg.senderName || msg.senderID,
                isFromUser: msg.isSender || false,
              }))
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
    });
    return result;
  },
});

/**
 * Page load sync - triggered when user opens the page
 * Only syncs messages for chats with new activity (not forced)
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
    });
    return result;
  },
});

