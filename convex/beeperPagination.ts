import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createBeeperClient } from "./beeperClient";
import { extractMessageText } from "./messageHelpers";

/**
 * Load older chats (backward pagination)
 * Called when user clicks "Load More" button
 */
export const loadOlderChats = action({
  args: {
    limit: v.optional(v.number()), // How many to load (default: 50)
  },
  handler: async (ctx, args) => {
    try {
      const client = createBeeperClient();
      
      // Get current sync state
      const syncState = await ctx.runQuery(
        internal.cursorHelpers.getChatListSync,
        {}
      );
      
      if (!syncState?.oldestCursor) {
        return {
          success: false,
          error: "No oldestCursor available - can't load older chats",
          chatsLoaded: 0,
        };
      }
      
      console.log(
        `[Load Older] Fetching older chats using cursor: ${syncState.oldestCursor.slice(0, 13)}...`
      );
      
      // Fetch chats OLDER than our oldest cursor
      const response = await client.get('/v1/chats', {
        query: {
          cursor: syncState.oldestCursor,
          direction: "before", // Get OLDER chats
        }
      }) as any;
      
      const chats = response.items || [];
      console.log(
        `[Load Older] Fetched ${chats.length} older chats ` +
        `(hasMore: ${response.hasMore || false})`
      );
      
      // Process and store chats using existing sync logic
      let syncedChatsCount = 0;
      const now = Date.now();
      
      for (const chat of chats) {
        // Extract contact info
        let username: string | undefined;
        let phoneNumber: string | undefined;
        let email: string | undefined;
        let participantId: string | undefined;
        let participantFullName: string | undefined;
        let participantImgURL: string | undefined;
        let cannotMessage: boolean | undefined;

        if (chat.type === "single" && chat.participants?.items) {
          // Get all non-self participants
          const otherParticipants = chat.participants.items.filter(
            (p: any) => p.isSelf === false
          );
          
          // Filter out Meta AI (bot that Instagram injects into chats)
          // This ensures we show the real conversation partner, not the AI bot
          const realParticipants = otherParticipants.filter(
            (p: any) => {
              const name = (p.fullName || '').toLowerCase();
              const uname = (p.username || '').toLowerCase();
              return !name.includes('meta ai') && uname !== 'meta.ai';
            }
          );
          
          // Prefer real participants, fall back to first non-self if all are bots
          const otherPerson = realParticipants.length > 0 
            ? realParticipants[0] 
            : otherParticipants[0];

          if (otherPerson) {
            username = otherPerson.username;
            phoneNumber = otherPerson.phoneNumber;
            email = otherPerson.email;
            participantId = otherPerson.id;
            participantFullName = otherPerson.fullName;
            participantImgURL = otherPerson.imgURL;
            cannotMessage = otherPerson.cannotMessage;
          }
        }

        const lastActivity = new Date(chat.lastActivity).getTime();
        const chatType = (chat.type === "single" || chat.type === "group") ? chat.type : "single" as const;

        // Extract preview data
        const preview = chat.preview;
        let lastMessage: string | undefined;
        let lastMessageFrom: "user" | "them" | undefined;
        let needsReply: boolean | undefined;

        if (preview) {
          lastMessage = preview.text || undefined;
          lastMessageFrom = preview.isSender ? "user" : "them";
          needsReply = !preview.isSender;
        }

        const chatData = {
          chatId: chat.id,
          localChatID: chat.localChatID || chat.id,
          title: chat.title || "Unknown",
          network: chat.network || chat.accountID || "Unknown",
          accountID: chat.accountID || "",
          type: chatType,
          description: chat.description,
          username,
          phoneNumber,
          email,
          participantId,
          participantFullName,
          participantImgURL,
          cannotMessage,
          participantCount: chat.participants?.total,
          lastActivity,
          unreadCount: chat.unreadCount || 0,
          lastMessage,
          lastMessageFrom,
          needsReply,
          // Convert lastReadMessageSortKey to string (API may return as number)
          lastReadMessageSortKey: chat.lastReadMessageSortKey ? String(chat.lastReadMessageSortKey) : undefined,
          newestMessageSortKey: preview?.sortKey,
          isArchived: chat.isArchived || false,
          isMuted: chat.isMuted || false,
          isPinned: chat.isPinned || false,
          lastSyncedAt: now,
          syncSource: "load_older",
        };

        await ctx.runMutation(
          internal.beeperSync.upsertChat,
          { chatData }
        );
        
        syncedChatsCount++;
      }
      
      // Update oldestCursor to extend our window backward
      // Keep newestCursor unchanged (window doesn't move forward)
      await ctx.runMutation(
        internal.cursorHelpers.updateChatListSync,
        {
          newestCursor: syncState.newestCursor, // Keep unchanged
          oldestCursor: response.oldestCursor || syncState.oldestCursor,
          syncSource: "load_older",
          totalChats: syncState.totalChats + syncedChatsCount,
        }
      );
      
      console.log(
        `[Load Older] Stored ${syncedChatsCount} older chats. ` +
        `New oldestCursor: ${response.oldestCursor?.slice(0, 13)}...`
      );
      
      return {
        success: true,
        chatsLoaded: syncedChatsCount,
        hasMore: response.hasMore || false,
        timestamp: now,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Load Older] Error: ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg,
        chatsLoaded: 0,
        hasMore: false,
      };
    }
  },
});

/**
 * Load newer messages for a specific chat (forward pagination)
 * Called when opening a conversation to fetch any messages that arrived since last sync
 */
export const loadNewerMessages = action({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const client = createBeeperClient();
      
      // Get chat to find newestMessageSortKey
      const chat: any = await ctx.runQuery(
        internal.beeperQueries.getChatByIdInternal,
        { chatId: args.chatId }
      );
      
      if (!chat) {
        return {
          success: false,
          error: "Chat not found",
          messagesLoaded: 0,
        };
      }
      
      // If no newestMessageSortKey, we need to do an initial load
      if (!chat.newestMessageSortKey) {
        console.log(
          `[Load Newer Messages] Chat ${args.chatId} has no cursor - ` +
          `fetching initial batch of messages`
        );
        
        // Fetch last 50 messages without cursor
        const response = await client.get(
          `/v1/chats/${encodeURIComponent(args.chatId)}/messages`,
          {
            query: {
              limit: 50,
            }
          }
        ) as any;
        
        const messages = response.items || [];
        
        if (messages.length === 0) {
          return {
            success: true,
            messagesLoaded: 0,
            hasMore: false,
          };
        }
        
        // Transform and store messages
        const messagesToSync = messages
          .map((msg: any) => {
            const attachments = msg.attachments?.map((att: any) => ({
              type: att.type || "unknown",
              srcURL: att.srcURL,
              mimeType: att.mimeType,
              fileName: att.fileName,
              fileSize: att.fileSize,
              isGif: att.isGif,
              isSticker: att.isSticker,
              isVoiceNote: att.isVoiceNote,
              posterImg: att.posterImg,
              width: att.size?.width,
              height: att.size?.height,
            }));
            
            const reactions = msg.reactions?.map((r: any) => ({
              id: r.id,
              participantID: r.participantID,
              reactionKey: r.reactionKey,
              emoji: r.emoji,
              imgURL: r.imgURL,
            }));

            return {
              messageId: msg.id,
              accountID: msg.accountID,
              text: extractMessageText(msg.text),
              timestamp: new Date(msg.timestamp).getTime(),
              sortKey: msg.sortKey,
              senderId: msg.senderID,
              senderName: msg.senderName || msg.senderID,
              isFromUser: msg.isSender || false,
              isUnread: msg.isUnread,
              attachments: attachments && attachments.length > 0 ? attachments : undefined,
              reactions: reactions && reactions.length > 0 ? reactions : undefined,
            };
          })
          .sort((a: { sortKey: string }, b: { sortKey: string }) => 
            a.sortKey.localeCompare(b.sortKey)
          );

        // Store messages
        const messageCount: number = await ctx.runMutation(
          internal.beeperSync.syncChatMessages,
          {
            chatId: args.chatId,
            messages: messagesToSync,
            chatDocId: chat._id,
            lastMessagesSyncedAt: Date.now(),
          }
        );
        
        // Update cursor boundaries
        const newestSortKey = messagesToSync[messagesToSync.length - 1]?.sortKey;
        const oldestSortKey = messagesToSync[0]?.sortKey;
        
        await ctx.runMutation(
          internal.cursorHelpers.updateChatMessageCursors,
          {
            chatDocId: chat._id,
            newestMessageSortKey: newestSortKey,
            oldestMessageSortKey: oldestSortKey,
            messageCount: messagesToSync.length,
          }
        );
        
        console.log(
          `[Load Newer Messages] Initial load: stored ${messageCount} messages`
        );
        
        return {
          success: true,
          messagesLoaded: messageCount,
          hasMore: response.hasMore || false,
          timestamp: Date.now(),
        };
      }
      
      console.log(
        `[Load Newer Messages] Fetching newer messages for chat ${args.chatId} ` +
        `using cursor: ${chat.newestMessageSortKey.slice(0, 10)}...`
      );
      
      // Fetch messages NEWER than our newest sortKey
      const response = await client.get(
        `/v1/chats/${encodeURIComponent(args.chatId)}/messages`,
        {
          query: {
            cursor: chat.newestMessageSortKey,
            direction: "after", // Get NEWER messages
          }
        }
      ) as any;
      
      const messages = response.items || [];
      console.log(
        `[Load Newer Messages] Fetched ${messages.length} newer messages ` +
        `(hasMore: ${response.hasMore || false})`
      );
      
      if (messages.length === 0) {
        return {
          success: true,
          messagesLoaded: 0,
          hasMore: false,
        };
      }
      
      // Transform and store messages - match API spec exactly
      const messagesToSync = messages
        .map((msg: any) => {
          const attachments = msg.attachments?.map((att: any) => ({
            type: att.type || "unknown",
            srcURL: att.srcURL,
            mimeType: att.mimeType,
            fileName: att.fileName,
            fileSize: att.fileSize,
            isGif: att.isGif,
            isSticker: att.isSticker,
            isVoiceNote: att.isVoiceNote,
            posterImg: att.posterImg,
            width: att.size?.width,
            height: att.size?.height,
          }));
          
          const reactions = msg.reactions?.map((r: any) => ({
            id: r.id,
            participantID: r.participantID,
            reactionKey: r.reactionKey,
            emoji: r.emoji,
            imgURL: r.imgURL,
          }));

          return {
            messageId: msg.id,
            accountID: msg.accountID,
            text: extractMessageText(msg.text),
            timestamp: new Date(msg.timestamp).getTime(),
            sortKey: msg.sortKey,
            senderId: msg.senderID,
            senderName: msg.senderName || msg.senderID,
            isFromUser: msg.isSender || false,
            isUnread: msg.isUnread,
            attachments: attachments && attachments.length > 0 ? attachments : undefined,
            reactions: reactions && reactions.length > 0 ? reactions : undefined,
          };
        })
        .sort((a: { sortKey: string }, b: { sortKey: string }) => 
          a.sortKey.localeCompare(b.sortKey)
        );

      // Store messages
      const messageCount: number = await ctx.runMutation(
        internal.beeperSync.syncChatMessages,
        {
          chatId: args.chatId,
          messages: messagesToSync,
          chatDocId: chat._id,
          lastMessagesSyncedAt: Date.now(),
        }
      );
      
      // Update newestMessageSortKey to extend window forward
      if (messages.length > 0) {
        const newestSortKey = messagesToSync[messagesToSync.length - 1]?.sortKey;
        
        await ctx.runMutation(
          internal.cursorHelpers.updateChatMessageCursors,
          {
            chatDocId: chat._id,
            newestMessageSortKey: newestSortKey,
            oldestMessageSortKey: chat.oldestMessageSortKey, // Keep unchanged
            messageCount: (chat.messageCount || 0) + messageCount,
          }
        );
      }
      
      console.log(
        `[Load Newer Messages] Stored ${messageCount} newer messages`
      );
      
      return {
        success: true,
        messagesLoaded: messageCount,
        hasMore: response.hasMore || false,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Load Newer Messages] Error: ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg,
        messagesLoaded: 0,
        hasMore: false,
      };
    }
  },
});

/**
 * Load older messages for a specific chat (backward pagination)
 * Called when user scrolls to top of conversation
 */
export const loadOlderMessages = action({
  args: {
    chatId: v.string(),
    limit: v.optional(v.number()), // How many to load (default: 50)
  },
  handler: async (ctx, args) => {
    try {
      const client = createBeeperClient();
      
      // Get chat to find oldestMessageSortKey
      const chat: any = await ctx.runQuery(
        internal.beeperQueries.getChatByIdInternal,
        { chatId: args.chatId }
      );
      
      if (!chat) {
        return {
          success: false,
          error: "Chat not found",
          messagesLoaded: 0,
        };
      }
      
      if (!chat.oldestMessageSortKey) {
        return {
          success: false,
          error: "No oldestMessageSortKey - can't load older messages",
          messagesLoaded: 0,
        };
      }
      
      if (chat.hasCompleteHistory) {
        console.log(`[Load Older Messages] Chat ${args.chatId} already has complete history`);
        return {
          success: true,
          messagesLoaded: 0,
          hasMore: false,
        };
      }
      
      console.log(
        `[Load Older Messages] Fetching older messages for chat ${args.chatId} ` +
        `using cursor: ${chat.oldestMessageSortKey.slice(0, 10)}...`
      );
      
      // Fetch messages OLDER than our oldest sortKey
      const response = await client.get(
        `/v1/chats/${encodeURIComponent(args.chatId)}/messages`,
        {
          query: {
            cursor: chat.oldestMessageSortKey,
            direction: "before", // Get OLDER messages
            limit: args.limit || 50,
          }
        }
      ) as any;
      
      const messages = response.items || [];
      console.log(
        `[Load Older Messages] Fetched ${messages.length} older messages ` +
        `(hasMore: ${response.hasMore || false})`
      );
      
      // Transform and store messages - match API spec exactly
      const messagesToSync = messages
        .map((msg: any) => {
          const attachments = msg.attachments?.map((att: any) => ({
            type: att.type || "unknown",
            srcURL: att.srcURL,
            mimeType: att.mimeType,
            fileName: att.fileName,
            fileSize: att.fileSize,
            isGif: att.isGif,
            isSticker: att.isSticker,
            isVoiceNote: att.isVoiceNote,
            posterImg: att.posterImg,
            width: att.size?.width,
            height: att.size?.height,
          }));
          
          const reactions = msg.reactions?.map((r: any) => ({
            id: r.id,
            participantID: r.participantID,
            reactionKey: r.reactionKey,
            emoji: r.emoji,
            imgURL: r.imgURL,
          }));

          return {
            messageId: msg.id,
            accountID: msg.accountID,
            text: extractMessageText(msg.text),
            timestamp: new Date(msg.timestamp).getTime(),
            sortKey: msg.sortKey,
            senderId: msg.senderID,
            senderName: msg.senderName || msg.senderID,
            isFromUser: msg.isSender || false,
            isUnread: msg.isUnread,
            attachments: attachments && attachments.length > 0 ? attachments : undefined,
            reactions: reactions && reactions.length > 0 ? reactions : undefined,
          };
        })
        .sort((a: { sortKey: string }, b: { sortKey: string }) => 
          a.sortKey.localeCompare(b.sortKey)
        );

      // Store messages
      const messageCount: number = await ctx.runMutation(
        internal.beeperSync.syncChatMessages,
        {
          chatId: args.chatId,
          messages: messagesToSync,
          chatDocId: chat._id,
          lastMessagesSyncedAt: Date.now(),
        }
      );
      
      // Update oldestMessageSortKey to extend window backward
      if (messages.length > 0) {
        const oldestSortKey = messagesToSync[0]?.sortKey;
        
        await ctx.runMutation(
          internal.cursorHelpers.updateChatMessageCursors,
          {
            chatDocId: chat._id,
            newestMessageSortKey: chat.newestMessageSortKey, // Keep unchanged
            oldestMessageSortKey: oldestSortKey,
            messageCount: (chat.messageCount || 0) + messageCount,
            hasCompleteHistory: !response.hasMore, // If no more, we have complete history
          }
        );
      }
      
      console.log(
        `[Load Older Messages] Stored ${messageCount} older messages. ` +
        `hasMore: ${response.hasMore || false}`
      );
      
      return {
        success: true,
        messagesLoaded: messageCount,
        hasMore: response.hasMore || false,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Load Older Messages] Error: ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg,
        messagesLoaded: 0,
        hasMore: false,
      };
    }
  },
});

