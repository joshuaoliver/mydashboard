import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createBeeperClient } from "./beeperClient";
import { extractMessageText } from "./messageHelpers";

/**
 * Focus/open a chat in Beeper Desktop
 * Optionally sets draft text
 */
export const focusChat = action({
  args: {
    chatId: v.string(),
    draftText: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      console.log(`[Focus Chat] Opening chat ${args.chatId} in Beeper Desktop`);

      // Initialize Beeper SDK client
      const client = createBeeperClient();

      // Build request body
      const requestBody: {
        chatID: string;
        draftText?: string;
      } = {
        chatID: args.chatId,
      };

      if (args.draftText) {
        requestBody.draftText = args.draftText;
        console.log(`[Focus Chat] Setting draft text: "${args.draftText.slice(0, 50)}..."`);
      }

      // Call focus endpoint
      const response = await client.post(`/v1/focus`, {
        body: requestBody,
      }) as any;

      if (!response.success) {
        throw new Error('Beeper did not confirm successful focus');
      }

      console.log(`[Focus Chat] Successfully focused chat ${args.chatId}`);

      return {
        success: true,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Focus Chat] Error: ${errorMsg}`);

      return {
        success: false,
        error: `Failed to open chat: ${errorMsg}`,
      };
    }
  },
});

/**
 * Send a message to a Beeper chat
 * Supports replying to specific messages
 */
export const sendMessage = action({
  args: {
    chatId: v.string(),
    text: v.string(),
    replyToMessageId: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{
    success: boolean;
    chatId?: string;
    pendingMessageId?: string;
    error?: string;
  }> => {
    try {
      console.log(`[Send Message] Sending to chat ${args.chatId}: "${args.text.slice(0, 50)}..."`);

      // Initialize Beeper SDK client
      const client = createBeeperClient();

      // Build request body
      const requestBody: {
        text: string;
        replyToMessageID?: string;
      } = {
        text: args.text,
      };

      // Add reply-to if specified
      if (args.replyToMessageId) {
        requestBody.replyToMessageID = args.replyToMessageId;
        console.log(`[Send Message] Replying to message ${args.replyToMessageId}`);
      }

      // Send message via V1 API
      const response = await client.post(`/v1/chats/${args.chatId}/messages`, {
        body: requestBody,
      }) as any;

      console.log(
        `[Send Message] Success! Pending message ID: ${response.pendingMessageID}`
      );

      return {
        success: true,
        chatId: response.chatID,
        pendingMessageId: response.pendingMessageID,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Send Message] Error: ${errorMsg}`);

      return {
        success: false,
        error: `Failed to send message: ${errorMsg}`,
      };
    }
  },
});

/**
 * Load full conversation history for a specific chat
 * Uses the Beeper SDK with auto-pagination to fetch all messages from the last year
 * Reuses existing syncChatMessages mutation for storage
 */
export const loadFullConversation = action({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    messagesLoaded: number;
    totalFetched?: number;
  }> => {
    try {
      // Get the chat details
      const chat: any = await ctx.runQuery(internal.beeperQueries.getChatByIdInternal, {
        chatId: args.chatId,
      });

      if (!chat) {
        return {
          success: false,
          error: "Chat not found",
          messagesLoaded: 0,
        };
      }

      const roomId = chat.localChatID || args.chatId;
      
      // Calculate timestamp for 1 year ago
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      console.log(`📥 Loading full conversation for ${chat.title} (${roomId})`);
      console.log(`   Fetching messages from ${oneYearAgo.toISOString()}`);

      // Initialize Beeper SDK client
      const client = createBeeperClient();

      // Use SDK auto-pagination to fetch ALL messages since one year ago
      const allMessages: any[] = [];
      for await (const message of client.messages.list({
        chatID: roomId,
        dateAfter: oneYearAgo.toISOString(),
        limit: 100, // Fetch 100 per page
      } as any)) {
        allMessages.push(message);
      }

      console.log(`✅ Fetched ${allMessages.length} messages from Beeper SDK`);

      // Transform messages to match our schema - all API fields
      const transformedMessages = allMessages.map((msg: any) => ({
        messageId: msg.id,
        accountID: msg.accountID,
        text: extractMessageText(msg.text),
        timestamp: new Date(msg.timestamp).getTime(),
        sortKey: msg.sortKey,
        senderId: msg.senderID || msg.sender?.id || "unknown",
        senderName: msg.senderName || msg.sender?.displayName || msg.sender?.name || "Unknown",
        isFromUser: msg.isSender || msg.sender?.isSelf || false,
        isUnread: msg.isUnread,
        attachments: msg.attachments?.map((att: any) => ({
          type: att.type || "unknown",
          srcURL: att.url || att.srcURL || "",
          mimeType: att.mimeType,
          fileName: att.fileName,
          fileSize: att.fileSize,
          isGif: att.isGif,
          isSticker: att.isSticker,
          isVoiceNote: att.isVoiceNote,
          posterImg: att.posterImg,
          width: att.size?.width || att.width,
          height: att.size?.height || att.height,
        })),
        reactions: msg.reactions?.map((r: any) => ({
          id: r.id,
          participantID: r.participantID,
          reactionKey: r.reactionKey,
          emoji: r.emoji,
          imgURL: r.imgURL,
        })),
      }));

      // Sort messages by sortKey (oldest first) for proper storage
      transformedMessages.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      // Store messages using the existing syncChatMessages mutation
      const storedCount: number = await ctx.runMutation(
        internal.beeperSync.syncChatMessages,
        {
          chatId: args.chatId,
          messages: transformedMessages,
          chatDocId: chat._id,
          lastMessagesSyncedAt: Date.now(),
        }
      );

      console.log(`✅ Stored ${storedCount} new messages`);
      
      // Update cursor boundaries - we've loaded full history
      if (transformedMessages.length > 0) {
        const newestSortKey = transformedMessages[transformedMessages.length - 1]?.sortKey;
        const oldestSortKey = transformedMessages[0]?.sortKey;
        
        await ctx.runMutation(
          internal.cursorHelpers.updateChatMessageCursors,
          {
            chatDocId: chat._id,
            newestMessageSortKey: newestSortKey,
            oldestMessageSortKey: oldestSortKey,
            messageCount: transformedMessages.length,
            hasCompleteHistory: true, // Full history loaded from last year
          }
        );
        
        console.log(`✅ Updated cursor boundaries: newest=${newestSortKey?.slice(0, 10)}..., oldest=${oldestSortKey?.slice(0, 10)}...`);
      }

      return {
        success: true,
        messagesLoaded: storedCount,
        totalFetched: allMessages.length,
      };
    } catch (error) {
      console.error("❌ Error loading full conversation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        messagesLoaded: 0,
      };
    }
  },
});

