import { internalMutation, internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Beeper API configuration
const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

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
    } else {
      chatDocId = await ctx.db.insert("beeperChats", args.chatData);
      // New chat - always sync messages
      shouldSyncMessages = true;
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
      // Check if message already exists
      const existingMessage = await ctx.db
        .query("beeperMessages")
        .withIndex("by_message_id", (q) => q.eq("messageId", msg.messageId))
        .first();

      if (existingMessage) {
        // Update existing message (in case content changed)
        await ctx.db.patch(existingMessage._id, {
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

    // Update lastMessagesSyncedAt
    await ctx.db.patch(args.chatDocId, {
      lastMessagesSyncedAt: args.lastMessagesSyncedAt,
    });

    return insertedCount + updatedCount;
  },
});

/**
 * Internal action to fetch data from Beeper API and sync to database
 * Actions can use fetch() and setTimeout()
 * Called by cron job or manual sync actions
 */
export const syncBeeperChatsInternal = internalAction({
  handler: async (ctx, args: { syncSource: string }) => {
    try {
      // Fetch chats from Beeper API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      let response;
      try {
        response = await fetch(`${BEEPER_API_URL}/v0/search-chats?limit=100`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${BEEPER_TOKEN}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Network error or timeout
        const errorMsg = fetchError instanceof Error ? fetchError.message : "Unknown error";
        console.error(`[Beeper Sync] Network error: ${errorMsg}`);
        return {
          success: false,
          syncedChats: 0,
          syncedMessages: 0,
          timestamp: Date.now(),
          source: args.syncSource,
          error: `Network error: ${errorMsg}`,
        };
      }

      if (!response.ok) {
        console.error(`[Beeper Sync] API error: ${response.status} ${response.statusText}`);
        return {
          success: false,
          syncedChats: 0,
          syncedMessages: 0,
          timestamp: Date.now(),
          source: args.syncSource,
          error: `API error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      const chats = data.items || [];

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

        if (shouldSyncMessages) {
          try {
            // Fetch messages for this chat with timeout
            const msgController = new AbortController();
            const msgTimeoutId = setTimeout(() => msgController.abort(), 10000); // 10 second timeout per chat

            const messagesResponse = await fetch(
              `${BEEPER_API_URL}/v0/search-messages?chatID=${encodeURIComponent(chat.id)}&limit=30`,
              {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${BEEPER_TOKEN}`,
                },
                signal: msgController.signal,
              }
            );
            clearTimeout(msgTimeoutId);

            if (messagesResponse.ok) {
              const messagesData = await messagesResponse.json();
              const messages = messagesData.items || [];

              // Prepare messages for mutation
              const messagesToSync = messages.map((msg: any) => ({
                messageId: msg.id,
                text: msg.text || "",
                timestamp: new Date(msg.timestamp).getTime(),
                senderId: msg.senderID,
                senderName: msg.senderName || msg.senderID,
                isFromUser: msg.isSender || false,
              }));

              console.log(`[Beeper Sync] Syncing ${messagesToSync.length} messages for chatId: ${chat.id}`);
              
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
            } else {
              console.warn(
                `[Beeper Sync] Failed to fetch messages for chat ${chat.id}: ${messagesResponse.status}`
              );
            }
          } catch (msgError) {
            // Log error but continue with other chats
            const msgErrorMsg = msgError instanceof Error ? msgError.message : "Unknown error";
            console.warn(
              `[Beeper Sync] Error syncing messages for chat ${chat.id}: ${msgErrorMsg}`
            );
          }
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
      // Gracefully handle any unexpected errors
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Beeper Sync] Unexpected error: ${errorMsg}`);
      
      // Return failure status instead of throwing
      // This prevents the cron job from crashing
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
    });
    return result;
  },
});

/**
 * Page load sync - triggered when user opens the page
 * Same as manual but tagged differently
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
    });
    return result;
  },
});

