import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { createBeeperClient } from "./beeperClient";
import { extractMessageText, compareSortKeys } from "./messageHelpers";

interface HistoricalSyncStatus {
  isRunning: boolean;
  chatsProcessed: number;
  totalChats: number;
  messagesLoaded: number;
  currentChat: string | null;
  startedAt: number | null;
  lastUpdated: number | null;
  error: string | null;
}

const getHistoricalSyncStatusHandler = async (ctx: any): Promise<HistoricalSyncStatus> => {
  const setting = await ctx.db
    .query("settings")
    .withIndex("by_key", (q: any) => q.eq("key", "historical_sync_status"))
    .first();
  
  if (!setting) {
    return {
      isRunning: false,
      chatsProcessed: 0,
      totalChats: 0,
      messagesLoaded: 0,
      currentChat: null,
      startedAt: null,
      lastUpdated: null,
      error: null,
    };
  }
  
  return setting.value as HistoricalSyncStatus;
};

/**
 * Historical sync state - tracks progress of historical sync job (public query for UI)
 */
export const getHistoricalSyncStatus = query({
  args: {},
  handler: getHistoricalSyncStatusHandler,
});

/**
 * Historical sync state - internal query for use within actions
 */
export const getHistoricalSyncStatusInternal = internalQuery({
  args: {},
  handler: getHistoricalSyncStatusHandler,
});

export const updateHistoricalSyncStatus = internalMutation({
  args: {
    isRunning: v.boolean(),
    chatsProcessed: v.optional(v.number()),
    totalChats: v.optional(v.number()),
    messagesLoaded: v.optional(v.number()),
    currentChat: v.optional(v.union(v.string(), v.null())),
    startedAt: v.optional(v.union(v.number(), v.null())),
    error: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "historical_sync_status"))
      .first();
    
    const newValue = {
      isRunning: args.isRunning,
      chatsProcessed: args.chatsProcessed ?? existing?.value?.chatsProcessed ?? 0,
      totalChats: args.totalChats ?? existing?.value?.totalChats ?? 0,
      messagesLoaded: args.messagesLoaded ?? existing?.value?.messagesLoaded ?? 0,
      currentChat: args.currentChat !== undefined ? args.currentChat : existing?.value?.currentChat ?? null,
      startedAt: args.startedAt !== undefined ? args.startedAt : existing?.value?.startedAt ?? null,
      lastUpdated: Date.now(),
      error: args.error !== undefined ? args.error : existing?.value?.error ?? null,
    };
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: newValue,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        key: "historical_sync_status",
        type: "config",
        value: newValue,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Stop the historical sync
 */
export const stopHistoricalSync = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.beeperPagination.updateHistoricalSyncStatus, {
      isRunning: false,
      error: "Stopped by user",
    });
    return { success: true };
  },
});

interface HistoricalSyncBatchResult {
  success: boolean;
  chatsProcessed: number;
  messagesLoaded: number;
  olderChatsLoaded: number;
  hasMoreChats: boolean;
  hasMoreMessages: boolean;
  reachedDateLimit?: boolean;
  stoppedByUser?: boolean;
  error?: string;
}

interface LoadChatsResult {
  success: boolean;
  chatsLoaded: number;
  hasMore: boolean;
  timestamp?: number;
  error?: string;
}

interface LoadMessagesResult {
  success: boolean;
  messagesLoaded: number;
  hasMore: boolean;
  timestamp?: number;
  error?: string;
}

/**
 * Aggressive historical sync - continuously loads older chats and messages until:
 * - User stops the sync
 * - We reach a specified date limit
 * - All history is loaded
 * 
 * This runs in a single batch but processes ALL available data.
 */
export const runHistoricalSyncBatch = action({
  args: {
    stopAtDate: v.optional(v.number()),  // Unix timestamp - stop loading messages older than this
    loadOlderChats: v.optional(v.boolean()), // Whether to load older chats (expand chat list)
    messagesPerRequest: v.optional(v.number()), // Messages per API call (default 50)
  },
  handler: async (ctx, args): Promise<HistoricalSyncBatchResult> => {
    const stopAtDate = args.stopAtDate;
    const loadOlderChats = args.loadOlderChats ?? true;
    const messagesPerRequest = args.messagesPerRequest ?? 50;
    
    try {
      // Check if already running
      const status: HistoricalSyncStatus = await ctx.runQuery(internal.beeperPagination.getHistoricalSyncStatusInternal, {});
      
      // Mark as running
      await ctx.runMutation(internal.beeperPagination.updateHistoricalSyncStatus, {
        isRunning: true,
        startedAt: status.startedAt || Date.now(),
        error: null,
      });
      
      let chatsProcessed = 0;
      let totalMessagesLoaded = 0;
      let olderChatsLoaded = 0;
      let hasMoreChats = true;
      let hasMoreMessages = false;
      let reachedDateLimit = false;
      
      // Step 1: Load ALL older chats first (if enabled)
      if (loadOlderChats) {
        console.log(`[Historical Sync] Loading all older chats...`);
        
        while (hasMoreChats) {
          // Check if we should stop
          const currentStatus: HistoricalSyncStatus = await ctx.runQuery(internal.beeperPagination.getHistoricalSyncStatusInternal, {});
          if (!currentStatus.isRunning) {
            console.log(`[Historical Sync] Stopped by user during chat loading`);
            return {
              success: true,
              chatsProcessed,
              messagesLoaded: totalMessagesLoaded,
              olderChatsLoaded,
              hasMoreChats: true,
              hasMoreMessages: true,
              stoppedByUser: true,
            };
          }
          
          const loadOlderChatsRef = internal.beeperPagination.loadOlderChatsInternal as any;
          const loadChatsResult: LoadChatsResult = await ctx.runAction(loadOlderChatsRef, {});
          
          if (!loadChatsResult.success) {
            console.log(`[Historical Sync] No more older chats: ${loadChatsResult.error}`);
            hasMoreChats = false;
            break;
          }
          
          olderChatsLoaded += loadChatsResult.chatsLoaded;
          hasMoreChats = loadChatsResult.hasMore;
          
          console.log(`[Historical Sync] Loaded ${loadChatsResult.chatsLoaded} older chats (total: ${olderChatsLoaded})`);
          
          // Update status
          await ctx.runMutation(internal.beeperPagination.updateHistoricalSyncStatus, {
            isRunning: true,
            currentChat: `Loading older chats... (${olderChatsLoaded} loaded)`,
          });
          
          if (loadChatsResult.chatsLoaded === 0) {
            hasMoreChats = false;
            break;
          }
        }
        
        console.log(`[Historical Sync] Finished loading older chats. Total: ${olderChatsLoaded}`);
      }
      
      // Step 2: Get ALL chats that need more message history
      const chatsNeedingHistory = await ctx.runQuery(
        internal.beeperPagination.getChatsNeedingHistory,
        { limit: 1000 } // Get all of them
      );
      
      if (chatsNeedingHistory.length === 0) {
        await ctx.runMutation(internal.beeperPagination.updateHistoricalSyncStatus, {
          isRunning: false,
          chatsProcessed,
          messagesLoaded: totalMessagesLoaded,
          error: olderChatsLoaded > 0 ? null : "All chats have complete history",
        });
        
        return {
          success: true,
          chatsProcessed,
          messagesLoaded: totalMessagesLoaded,
          olderChatsLoaded,
          hasMoreChats: false,
          hasMoreMessages: false,
        };
      }
      
      await ctx.runMutation(internal.beeperPagination.updateHistoricalSyncStatus, {
        isRunning: true,
        totalChats: chatsNeedingHistory.length,
      });
      
      console.log(`[Historical Sync] Processing ${chatsNeedingHistory.length} chats for messages...`);
      
      // Step 3: For EACH chat, load ALL older messages until complete or date limit
      for (const chat of chatsNeedingHistory) {
        // Check if we should stop
        const currentStatus: HistoricalSyncStatus = await ctx.runQuery(internal.beeperPagination.getHistoricalSyncStatusInternal, {});
        if (!currentStatus.isRunning) {
          console.log(`[Historical Sync] Stopped by user`);
          return {
            success: true,
            chatsProcessed,
            messagesLoaded: totalMessagesLoaded,
            olderChatsLoaded,
            hasMoreChats: false,
            hasMoreMessages: true,
            stoppedByUser: true,
          };
        }
        
        await ctx.runMutation(internal.beeperPagination.updateHistoricalSyncStatus, {
          isRunning: true,
          currentChat: chat.title,
          chatsProcessed,
          messagesLoaded: totalMessagesLoaded,
        });
        
        console.log(`[Historical Sync] Processing chat: ${chat.title} (${chat.messageCount || 0} messages)`);
        
        // Load ALL messages for this chat until complete or date limit
        let messagesLoadedForChat = 0;
        let chatHasMore = true;
        let chatReachedDateLimit = false;
        
        while (chatHasMore && !chatReachedDateLimit) {
          // Check if we should stop (every iteration)
          const innerStatus: HistoricalSyncStatus = await ctx.runQuery(internal.beeperPagination.getHistoricalSyncStatusInternal, {});
          if (!innerStatus.isRunning) {
            console.log(`[Historical Sync] Stopped by user during message loading`);
            return {
              success: true,
              chatsProcessed,
              messagesLoaded: totalMessagesLoaded,
              olderChatsLoaded,
              hasMoreChats: false,
              hasMoreMessages: true,
              stoppedByUser: true,
            };
          }
          
          // Get chat details to check current state
          const chatDetails = await ctx.runQuery(
            internal.beeperQueries.getChatByIdInternal,
            { chatId: chat.chatId }
          ) as any;
          
          if (!chatDetails?.oldestMessageSortKey) {
            // Need to do initial message load first
            const loadNewerMessagesRef = internal.beeperPagination.loadNewerMessagesInternal as any;
            const initialResult: LoadMessagesResult = await ctx.runAction(loadNewerMessagesRef, {
              chatId: chat.chatId,
            });
            
            if (initialResult.success) {
              messagesLoadedForChat += initialResult.messagesLoaded;
              totalMessagesLoaded += initialResult.messagesLoaded;
              chatHasMore = initialResult.hasMore;
            } else {
              console.log(`[Historical Sync] Initial load failed for ${chat.title}: ${initialResult.error}`);
              break;
            }
          } else if (chatDetails?.hasCompleteHistory) {
            console.log(`[Historical Sync] Chat ${chat.title} has complete history`);
            chatHasMore = false;
            break;
          } else {
            // Check if we've reached the date limit based on oldest message
            if (stopAtDate) {
              // Get oldest message timestamp - the oldestMessageSortKey format is usually timestamp-based
              // We can query the oldest cached message
              const oldestMessages = await ctx.runQuery(
                internal.beeperPagination.getOldestMessageTimestamp,
                { chatId: chat.chatId }
              );
              
              if (oldestMessages && oldestMessages < stopAtDate) {
                console.log(`[Historical Sync] Chat ${chat.title} reached date limit`);
                chatReachedDateLimit = true;
                reachedDateLimit = true;
                break;
              }
            }
            
            // Load older messages
            const loadOlderMessagesRef = internal.beeperPagination.loadOlderMessagesInternal as any;
            const result: LoadMessagesResult = await ctx.runAction(loadOlderMessagesRef, {
              chatId: chat.chatId,
              limit: messagesPerRequest,
            });
            
            if (result.success) {
              messagesLoadedForChat += result.messagesLoaded;
              totalMessagesLoaded += result.messagesLoaded;
              chatHasMore = result.hasMore;
              
              if (result.messagesLoaded === 0) {
                break;
              }
            } else {
              console.log(`[Historical Sync] Error loading messages for ${chat.title}: ${result.error}`);
              break;
            }
          }
          
          // Update status every iteration
          await ctx.runMutation(internal.beeperPagination.updateHistoricalSyncStatus, {
            isRunning: true,
            messagesLoaded: totalMessagesLoaded,
          });
        }
        
        if (chatHasMore && !chatReachedDateLimit) {
          hasMoreMessages = true;
        }
        
        chatsProcessed++;
        console.log(`[Historical Sync] Loaded ${messagesLoadedForChat} messages for ${chat.title} (total: ${totalMessagesLoaded})`);
      }
      
      // Update final status
      await ctx.runMutation(internal.beeperPagination.updateHistoricalSyncStatus, {
        isRunning: false,
        chatsProcessed,
        messagesLoaded: totalMessagesLoaded,
        currentChat: null,
      });
      
      // Check if there are more chats to process
      const remainingChats = await ctx.runQuery(
        internal.beeperPagination.getChatsNeedingHistory,
        { limit: 1 }
      );
      
      return {
        success: true,
        chatsProcessed,
        messagesLoaded: totalMessagesLoaded,
        olderChatsLoaded,
        hasMoreChats: remainingChats.length > 0,
        hasMoreMessages,
        reachedDateLimit,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Historical Sync] Error: ${errorMsg}`);
      
      await ctx.runMutation(internal.beeperPagination.updateHistoricalSyncStatus, {
        isRunning: false,
        error: errorMsg,
      });
      
      return {
        success: false,
        error: errorMsg,
        chatsProcessed: 0,
        messagesLoaded: 0,
        olderChatsLoaded: 0,
        hasMoreChats: false,
        hasMoreMessages: false,
      };
    }
  },
});

/**
 * Get oldest message timestamp for a chat (internal)
 * Used to check if we've reached a date limit during historical sync
 */
export const getOldestMessageTimestamp = internalQuery({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the oldest message by timestamp for this chat
    const oldestMessage = await ctx.db
      .query("beeperMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .first();
    
    return oldestMessage?.timestamp ?? null;
  },
});

/**
 * Get chats that need more message history (internal)
 * Returns chats sorted by: hasCompleteHistory=false first, then by messageCount ascending
 */
export const getChatsNeedingHistory = internalQuery({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all chats that don't have complete history
    const chats = await ctx.db
      .query("beeperChats")
      .filter((q) => 
        q.or(
          q.eq(q.field("hasCompleteHistory"), false),
          q.eq(q.field("hasCompleteHistory"), undefined)
        )
      )
      .collect();
    
    // Sort by message count ascending (prioritize chats with fewest messages)
    const sorted = chats.sort((a, b) => (a.messageCount || 0) - (b.messageCount || 0));
    
    return sorted.slice(0, args.limit).map(chat => ({
      chatId: chat.chatId,
      title: chat.title,
      messageCount: chat.messageCount || 0,
      hasCompleteHistory: chat.hasCompleteHistory || false,
    }));
  },
});

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
          oldestCursor: response.oldestCursor, // mutation will preserve newestCursor
          syncSource: "load_older",
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
            compareSortKeys(a.sortKey, b.sortKey)
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

// Internal action versions - these can be called from other actions without circular reference issues

/**
 * Internal version of loadOlderChats for use in other actions
 */
export const loadOlderChatsInternal = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<LoadChatsResult> => {
    try {
      const client = createBeeperClient();
      
      const syncState = await ctx.runQuery(
        internal.cursorHelpers.getChatListSync,
        {}
      );
      
      if (!syncState?.oldestCursor) {
        return {
          success: false,
          error: "No oldestCursor available - can't load older chats",
          chatsLoaded: 0,
          hasMore: false,
        };
      }
      
      const response = await client.get('/v1/chats', {
        query: {
          cursor: syncState.oldestCursor,
          direction: "before",
        }
      }) as any;
      
      const chats = response.items || [];
      let syncedChatsCount = 0;
      const now = Date.now();
      
      for (const chat of chats) {
        let username: string | undefined;
        let phoneNumber: string | undefined;
        let email: string | undefined;
        let participantId: string | undefined;
        let participantFullName: string | undefined;
        let participantImgURL: string | undefined;
        let cannotMessage: boolean | undefined;

        if (chat.type === "single" && chat.participants?.items) {
          const otherParticipants = chat.participants.items.filter(
            (p: any) => p.isSelf === false
          );
          const realParticipants = otherParticipants.filter(
            (p: any) => {
              const name = (p.fullName || '').toLowerCase();
              const uname = (p.username || '').toLowerCase();
              return !name.includes('meta ai') && uname !== 'meta.ai';
            }
          );
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
      
      await ctx.runMutation(
        internal.cursorHelpers.updateChatListSync,
        {
          oldestCursor: response.oldestCursor,
          syncSource: "load_older",
        }
      );
      
      return {
        success: true,
        chatsLoaded: syncedChatsCount,
        hasMore: response.hasMore || false,
        timestamp: now,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
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
 * Internal version of loadNewerMessages for use in other actions
 */
export const loadNewerMessagesInternal = internalAction({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args): Promise<LoadMessagesResult> => {
    try {
      const client = createBeeperClient();
      
      const chat: any = await ctx.runQuery(
        internal.beeperQueries.getChatByIdInternal,
        { chatId: args.chatId }
      );
      
      if (!chat) {
        return {
          success: false,
          error: "Chat not found",
          messagesLoaded: 0,
          hasMore: false,
        };
      }
      
      if (!chat.newestMessageSortKey) {
        // Initial load
        const response = await client.get(
          `/v1/chats/${encodeURIComponent(args.chatId)}/messages`,
          { query: { limit: 50 } }
        ) as any;
        
        const messages = response.items || [];
        
        if (messages.length === 0) {
          return { success: true, messagesLoaded: 0, hasMore: false };
        }
        
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
            compareSortKeys(a.sortKey, b.sortKey)
          );

        const messageCount: number = await ctx.runMutation(
          internal.beeperSync.syncChatMessages,
          {
            chatId: args.chatId,
            messages: messagesToSync,
            chatDocId: chat._id,
            lastMessagesSyncedAt: Date.now(),
          }
        );
        
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
        
        return {
          success: true,
          messagesLoaded: messageCount,
          hasMore: response.hasMore || false,
          timestamp: Date.now(),
        };
      }
      
      // Load newer messages
      const response = await client.get(
        `/v1/chats/${encodeURIComponent(args.chatId)}/messages`,
        {
          query: {
            cursor: chat.newestMessageSortKey,
            direction: "after",
          }
        }
      ) as any;
      
      const messages = response.items || [];
      
      if (messages.length === 0) {
        return { success: true, messagesLoaded: 0, hasMore: false };
      }
      
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

      const messageCount: number = await ctx.runMutation(
        internal.beeperSync.syncChatMessages,
        {
          chatId: args.chatId,
          messages: messagesToSync,
          chatDocId: chat._id,
          lastMessagesSyncedAt: Date.now(),
        }
      );
      
      if (messages.length > 0) {
        const newestSortKey = messagesToSync[messagesToSync.length - 1]?.sortKey;
        
        await ctx.runMutation(
          internal.cursorHelpers.updateChatMessageCursors,
          {
            chatDocId: chat._id,
            newestMessageSortKey: newestSortKey,
            oldestMessageSortKey: chat.oldestMessageSortKey,
            messageCount: (chat.messageCount || 0) + messageCount,
          }
        );
      }
      
      return {
        success: true,
        messagesLoaded: messageCount,
        hasMore: response.hasMore || false,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
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
 * Internal version of loadOlderMessages for use in other actions
 */
export const loadOlderMessagesInternal = internalAction({
  args: {
    chatId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<LoadMessagesResult> => {
    try {
      const client = createBeeperClient();
      
      const chat: any = await ctx.runQuery(
        internal.beeperQueries.getChatByIdInternal,
        { chatId: args.chatId }
      );
      
      if (!chat) {
        return {
          success: false,
          error: "Chat not found",
          messagesLoaded: 0,
          hasMore: false,
        };
      }
      
      if (!chat.oldestMessageSortKey) {
        return {
          success: false,
          error: "No oldestMessageSortKey - can't load older messages",
          messagesLoaded: 0,
          hasMore: false,
        };
      }
      
      if (chat.hasCompleteHistory) {
        return { success: true, messagesLoaded: 0, hasMore: false };
      }
      
      const response = await client.get(
        `/v1/chats/${encodeURIComponent(args.chatId)}/messages`,
        {
          query: {
            cursor: chat.oldestMessageSortKey,
            direction: "before",
            limit: args.limit || 50,
          }
        }
      ) as any;
      
      const messages = response.items || [];
      
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

      const messageCount: number = await ctx.runMutation(
        internal.beeperSync.syncChatMessages,
        {
          chatId: args.chatId,
          messages: messagesToSync,
          chatDocId: chat._id,
          lastMessagesSyncedAt: Date.now(),
        }
      );
      
      if (messages.length > 0) {
        const oldestSortKey = messagesToSync[0]?.sortKey;
        
        await ctx.runMutation(
          internal.cursorHelpers.updateChatMessageCursors,
          {
            chatDocId: chat._id,
            newestMessageSortKey: chat.newestMessageSortKey,
            oldestMessageSortKey: oldestSortKey,
            messageCount: (chat.messageCount || 0) + messageCount,
            hasCompleteHistory: !response.hasMore,
          }
        );
      }
      
      return {
        success: true,
        messagesLoaded: messageCount,
        hasMore: response.hasMore || false,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMsg,
        messagesLoaded: 0,
        hasMore: false,
      };
    }
  },
});
