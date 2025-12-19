import { internalMutation, internalAction, action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { createBeeperClient } from "./beeperClient";
import { extractMessageText, compareSortKeys, normalizePhone } from "./messageHelpers";

/**
 * Helper mutation to upsert a single chat into database
 * Returns doc ID and whether messages need syncing
 * 
 * PRESERVES EXISTING METADATA: Only updates fields that have changed
 * Does not override lastMessage, lastMessageFrom, needsReply unless new data is provided
 * 
 * CONTACT MATCHING: Matches chat to contacts at sync time (not query time)
 * This avoids expensive N+1 queries when listing chats
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
      description: v.optional(v.string()),
      username: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
      email: v.optional(v.string()),
      participantId: v.optional(v.string()),
      participantFullName: v.optional(v.string()),
      participantImgURL: v.optional(v.string()),
      cannotMessage: v.optional(v.boolean()),
      participantCount: v.optional(v.number()),
      lastActivity: v.number(),
      unreadCount: v.number(),
      lastMessage: v.optional(v.string()),
      lastMessageFrom: v.optional(v.union(v.literal("user"), v.literal("them"))),
      needsReply: v.optional(v.boolean()),
      lastReadMessageSortKey: v.optional(v.string()),
      newestMessageSortKey: v.optional(v.string()),
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

    // Match contact at sync time (for single chats only)
    let contactId: string | undefined = undefined;
    const now = Date.now();
    
    if (args.chatData.type === "single") {
      // 1. Try matching by Instagram username (fast indexed lookup)
      if (args.chatData.username) {
        const contactByInstagram = await ctx.db
          .query("contacts")
          .withIndex("by_instagram", (q) => q.eq("instagram", args.chatData.username!))
          .first();
        
        if (contactByInstagram) {
          contactId = contactByInstagram._id;
        }
      }

      // 2. Try matching by WhatsApp phone number (fast indexed lookup - exact match)
      if (!contactId && args.chatData.phoneNumber) {
        const contactByWhatsapp = await ctx.db
          .query("contacts")
          .withIndex("by_whatsapp", (q) => q.eq("whatsapp", args.chatData.phoneNumber!))
          .first();
        
        if (contactByWhatsapp) {
          contactId = contactByWhatsapp._id;
        }
      }
      
      // 3. If no exact match, try normalized phone matching against:
      //    - whatsapp field (normalized)
      //    - phones array (normalized)
      // This handles format differences like +61411785274 vs 0411785274
      if (!contactId && args.chatData.phoneNumber) {
        const searchPhone = normalizePhone(args.chatData.phoneNumber);
        
        // Get all contacts with whatsapp or phones fields
        const contactsWithPhones = await ctx.db
          .query("contacts")
          .filter((q) => 
            q.or(
              q.neq(q.field("whatsapp"), undefined),
              q.neq(q.field("phones"), undefined)
            )
          )
          .collect();
        
        // Search with normalized comparison
        for (const contact of contactsWithPhones) {
          // Check whatsapp field with normalization
          if (contact.whatsapp && normalizePhone(contact.whatsapp) === searchPhone) {
            contactId = contact._id;
            break;
          }
          // Check phones array with normalization
          if (contact.phones) {
            const hasMatch = contact.phones.some(
              (p) => normalizePhone(p.phone) === searchPhone
            );
            if (hasMatch) {
              contactId = contact._id;
              break;
            }
          }
        }
      }
    }

    if (existingChat) {
      chatDocId = existingChat._id;
      
      // Check if messages need syncing (based on activity timestamp)
      shouldSyncMessages =
        !existingChat.lastMessagesSyncedAt ||
        args.chatData.lastActivity > existingChat.lastMessagesSyncedAt;

      // OPTIMIZATION: Skip write if nothing meaningful has changed
      // Compare key fields that would affect the UI or require syncing
      const hasNewActivity = args.chatData.lastActivity > (existingChat.lastActivity || 0);
      const contactChanged = contactId !== undefined && contactId !== existingChat.contactId;
      const usernameChanged = args.chatData.username !== existingChat.username;
      const phoneChanged = args.chatData.phoneNumber !== existingChat.phoneNumber;
      const unreadChanged = args.chatData.unreadCount !== existingChat.unreadCount;
      const archivedChanged = args.chatData.isArchived !== existingChat.isArchived;
      const mutedChanged = args.chatData.isMuted !== existingChat.isMuted;
      const pinnedChanged = args.chatData.isPinned !== existingChat.isPinned;
      const titleChanged = args.chatData.title !== existingChat.title;
      
      const hasChanges = hasNewActivity || contactChanged || usernameChanged || 
                         phoneChanged || unreadChanged || archivedChanged || 
                         mutedChanged || pinnedChanged || titleChanged;
      
      if (!hasChanges) {
        // Nothing meaningful changed in chat metadata - skip the write.
        // Note: We still return shouldSyncMessages which may be true if lastActivity > lastMessagesSyncedAt.
        // This is intentional - the caller will sync messages and syncChatMessages() will update lastMessagesSyncedAt.
        // This handles the case where chat metadata is unchanged but messages haven't been synced yet.
        console.log(
          `[upsertChat] Chat ${args.chatData.chatId}: SKIPPED (no metadata changes), ` +
          `shouldSyncMessages=${shouldSyncMessages}`
        );
        return { chatDocId, shouldSyncMessages };
      }

      // Build selective update - only include fields that are provided
      const updates: any = {
        localChatID: args.chatData.localChatID,
        title: args.chatData.title,
        network: args.chatData.network,
        accountID: args.chatData.accountID,
        type: args.chatData.type,
        lastActivity: args.chatData.lastActivity,
        unreadCount: args.chatData.unreadCount,
        isArchived: args.chatData.isArchived,
        isMuted: args.chatData.isMuted,
        isPinned: args.chatData.isPinned,
        lastSyncedAt: args.chatData.lastSyncedAt,
        syncSource: args.chatData.syncSource,
      };
      
      // Only update optional fields if they're provided
      if (args.chatData.description !== undefined) updates.description = args.chatData.description;
      if (args.chatData.username !== undefined) updates.username = args.chatData.username;
      if (args.chatData.phoneNumber !== undefined) updates.phoneNumber = args.chatData.phoneNumber;
      if (args.chatData.email !== undefined) updates.email = args.chatData.email;
      if (args.chatData.participantId !== undefined) updates.participantId = args.chatData.participantId;
      if (args.chatData.participantFullName !== undefined) updates.participantFullName = args.chatData.participantFullName;
      if (args.chatData.participantImgURL !== undefined) updates.participantImgURL = args.chatData.participantImgURL;
      if (args.chatData.cannotMessage !== undefined) updates.cannotMessage = args.chatData.cannotMessage;
      if (args.chatData.participantCount !== undefined) updates.participantCount = args.chatData.participantCount;
      if (args.chatData.lastReadMessageSortKey !== undefined) updates.lastReadMessageSortKey = args.chatData.lastReadMessageSortKey;
      if (args.chatData.newestMessageSortKey !== undefined) updates.newestMessageSortKey = args.chatData.newestMessageSortKey;
      
      // Update contact matching if we found a match (or if username/phone changed, re-match)
      if (contactId !== undefined) {
        updates.contactId = contactId;
        updates.contactMatchedAt = now;
      } else if (args.chatData.username !== existingChat.username || 
                 args.chatData.phoneNumber !== existingChat.phoneNumber) {
        // Username or phone changed but no match found - clear old contactId
        updates.contactId = undefined;
        updates.contactMatchedAt = now;
      }
      
      // Only update message metadata if provided AND it's newer
      if (args.chatData.lastMessage !== undefined) {
        // Only update if the new activity is actually newer
        if (args.chatData.lastActivity >= (existingChat.lastActivity || 0)) {
          updates.lastMessage = args.chatData.lastMessage;
        }
      }
      if (args.chatData.lastMessageFrom !== undefined) {
        if (args.chatData.lastActivity >= (existingChat.lastActivity || 0)) {
          updates.lastMessageFrom = args.chatData.lastMessageFrom;
        }
      }
      if (args.chatData.needsReply !== undefined) {
        if (args.chatData.lastActivity >= (existingChat.lastActivity || 0)) {
          updates.needsReply = args.chatData.needsReply;
        }
      }
      
      await ctx.db.patch(existingChat._id, updates);
      
      console.log(
        `[upsertChat] Chat ${args.chatData.chatId}: UPDATED, ` +
        `shouldSyncMessages=${shouldSyncMessages}, ` +
        `contactId=${contactId || 'none'}`
      );
    } else {
      // New chat - include contactId in initial insert
      const insertData = {
        ...args.chatData,
        contactId: contactId as any,
        contactMatchedAt: contactId ? now : undefined,
      };
      chatDocId = await ctx.db.insert("beeperChats", insertData);
      // New chat - always sync messages
      shouldSyncMessages = true;
      console.log(`[upsertChat] New chat ${args.chatData.chatId}: will sync messages, contactId=${contactId || 'none'}`);
    }

    return { chatDocId, shouldSyncMessages };
  },
});

/**
 * Helper mutation to upsert participants for a chat
 * Stores all participant data from the API (both single and group chats)
 * Also matches participants to existing contacts by username/phone
 * 
 * IMPORTANT: Also backfills beeperChats.phoneNumber for iMessage/SMS chats
 * where the API doesn't include phone numbers in the chat list response
 */
export const upsertParticipants = internalMutation({
  args: {
    chatId: v.string(),
    participants: v.array(v.object({
      id: v.string(),
      fullName: v.optional(v.string()),
      username: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
      email: v.optional(v.string()),
      imgURL: v.optional(v.string()),
      isSelf: v.boolean(),
      cannotMessage: v.optional(v.boolean()),
    })),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    let insertedCount = 0;
    let updatedCount = 0;
    let matchedCount = 0;

    // Track the "other person" participant for single chats
    // Used to backfill chat phoneNumber if missing
    let otherPersonPhoneNumber: string | undefined = undefined;
    let otherPersonUsername: string | undefined = undefined;
    let otherPersonFullName: string | undefined = undefined;
    let otherPersonImgURL: string | undefined = undefined;
    let otherPersonContactId: string | undefined = undefined;

    // Helper to check if a participant is Meta AI (bot injected by Instagram)
    const isMetaAI = (p: typeof args.participants[0]) => {
      const name = (p.fullName || '').toLowerCase();
      const uname = (p.username || '').toLowerCase();
      return name.includes('meta ai') || uname === 'meta.ai';
    };

    for (const participant of args.participants) {
      // Try to match participant to an existing contact (skip self for matching)
      let contactId: string | undefined = undefined;

      // Only try to match non-self participants to contacts
      if (!participant.isSelf) {
        // Track "other person" data for backfill
        // Skip Meta AI bot when determining the "real" conversation partner
        const shouldTrackAsOtherPerson = !isMetaAI(participant);
        
        if (shouldTrackAsOtherPerson) {
          if (participant.phoneNumber) {
            otherPersonPhoneNumber = participant.phoneNumber;
          }
          if (participant.username) {
            otherPersonUsername = participant.username;
          }
          if (participant.fullName) {
            otherPersonFullName = participant.fullName;
          }
          if (participant.imgURL) {
            otherPersonImgURL = participant.imgURL;
          }
        }

        // 1. Try matching by Instagram username
        if (participant.username) {
          const contactByInstagram = await ctx.db
            .query("contacts")
            .withIndex("by_instagram", (q) => q.eq("instagram", participant.username!))
            .first();
          
          if (contactByInstagram) {
            contactId = contactByInstagram._id;
          }
        }

        // 2. Try matching by phone number (with normalization for format differences)
        if (!contactId && participant.phoneNumber) {
          // First try exact match on whatsapp (fast index)
          const contactByWhatsapp = await ctx.db
            .query("contacts")
            .withIndex("by_whatsapp", (q) => q.eq("whatsapp", participant.phoneNumber!))
            .first();
          
          if (contactByWhatsapp) {
            contactId = contactByWhatsapp._id;
          } else {
            // Fall back to normalized matching against whatsapp and phones array
            const searchPhone = normalizePhone(participant.phoneNumber);
            const allContactsWithPhones = await ctx.db
              .query("contacts")
              .filter((q) => 
                q.or(
                  q.neq(q.field("whatsapp"), undefined),
                  q.neq(q.field("phones"), undefined)
                )
              )
              .collect();

            const matchedContact = allContactsWithPhones.find((c) => {
              // Check whatsapp field with normalization
              if (c.whatsapp && normalizePhone(c.whatsapp) === searchPhone) {
                return true;
              }
              // Check phones array with normalization
              if (c.phones) {
                return c.phones.some((p) => normalizePhone(p.phone) === searchPhone);
              }
              return false;
            });

            if (matchedContact) {
              contactId = matchedContact._id;
            }
          }
        }

        if (contactId) {
          matchedCount++;
          // Only set otherPersonContactId for real participants (not Meta AI)
          if (shouldTrackAsOtherPerson) {
            otherPersonContactId = contactId;
          }
        }
      }

      // Check if participant already exists for this chat (store ALL participants including self)
      const existingParticipant = await ctx.db
        .query("beeperParticipants")
        .withIndex("by_chat_participant", (q) => 
          q.eq("chatId", args.chatId).eq("participantId", participant.id)
        )
        .first();

      if (existingParticipant) {
        // OPTIMIZATION: Skip update if nothing has changed
        const hasChanges = 
          existingParticipant.fullName !== participant.fullName ||
          existingParticipant.username !== participant.username ||
          existingParticipant.phoneNumber !== participant.phoneNumber ||
          existingParticipant.email !== participant.email ||
          existingParticipant.imgURL !== participant.imgURL ||
          existingParticipant.cannotMessage !== participant.cannotMessage ||
          existingParticipant.contactId !== contactId;
        
        if (hasChanges) {
          // Update existing participant
          await ctx.db.patch(existingParticipant._id, {
            fullName: participant.fullName,
            username: participant.username,
            phoneNumber: participant.phoneNumber,
            email: participant.email,
            imgURL: participant.imgURL,
            isSelf: participant.isSelf,
            cannotMessage: participant.cannotMessage,
            lastSyncedAt: args.lastSyncedAt,
            contactId: contactId as any, // Link to matched contact
          });
          updatedCount++;
        }
        // If no changes, skip the write entirely
      } else {
        // Insert new participant
        await ctx.db.insert("beeperParticipants", {
          chatId: args.chatId,
          participantId: participant.id,
          fullName: participant.fullName,
          username: participant.username,
          phoneNumber: participant.phoneNumber,
          email: participant.email,
          imgURL: participant.imgURL,
          isSelf: participant.isSelf,
          cannotMessage: participant.cannotMessage,
          lastSyncedAt: args.lastSyncedAt,
          contactId: contactId as any, // Link to matched contact
        });
        insertedCount++;
      }
    }

    // BACKFILL: Update the chat record with participant data if missing
    // This is critical for iMessage/SMS chats where the API doesn't include
    // phone numbers in the chat list response
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();

    if (chat && chat.type === "single") {
      const updates: Record<string, any> = {};
      
      // Backfill phoneNumber if missing but we have it from participant
      if (!chat.phoneNumber && otherPersonPhoneNumber) {
        updates.phoneNumber = otherPersonPhoneNumber;
        console.log(`[upsertParticipants] Backfilling phoneNumber for chat ${args.chatId}: ${otherPersonPhoneNumber}`);
      }
      
      // Backfill username if missing
      if (!chat.username && otherPersonUsername) {
        updates.username = otherPersonUsername;
      }
      
      // Backfill participantFullName if missing
      if (!chat.participantFullName && otherPersonFullName) {
        updates.participantFullName = otherPersonFullName;
      }
      
      // Backfill participantImgURL if missing
      if (!chat.participantImgURL && otherPersonImgURL) {
        updates.participantImgURL = otherPersonImgURL;
      }
      
      // Backfill contactId if missing but we matched one
      if (!chat.contactId && otherPersonContactId) {
        updates.contactId = otherPersonContactId;
        updates.contactMatchedAt = args.lastSyncedAt;
      }
      
      // Apply updates if we have any
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(chat._id, updates);
        console.log(`[upsertParticipants] Backfilled ${Object.keys(updates).length} fields for chat ${args.chatId}`);
      }
    }

    console.log(
      `[upsertParticipants] Chat ${args.chatId}: inserted ${insertedCount}, updated ${updatedCount}, matched ${matchedCount} to contacts`
    );

    return { insertedCount, updatedCount, matchedCount };
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
        accountID: v.string(),
        text: v.string(),
        timestamp: v.number(),
        sortKey: v.string(), // Required for cursor tracking
        senderId: v.string(),
        senderName: v.string(),
        isFromUser: v.boolean(),
        isUnread: v.optional(v.boolean()),
        attachments: v.optional(v.array(v.object({
          type: v.string(),
          srcURL: v.string(),
          mimeType: v.optional(v.string()),
          fileName: v.optional(v.string()),
          fileSize: v.optional(v.number()),
          isGif: v.optional(v.boolean()),
          isSticker: v.optional(v.boolean()),
          isVoiceNote: v.optional(v.boolean()),
          posterImg: v.optional(v.string()),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
        }))),
        reactions: v.optional(v.array(v.object({
          id: v.string(),
          participantID: v.string(),
          reactionKey: v.string(),
          emoji: v.optional(v.boolean()),
          imgURL: v.optional(v.string()),
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
        // Insert new message with all fields from API
        await ctx.db.insert("beeperMessages", {
          chatId: args.chatId,
          messageId: msg.messageId,
          accountID: msg.accountID,
          text: msg.text,
          timestamp: msg.timestamp,
          sortKey: msg.sortKey,
          senderId: msg.senderId,
          senderName: msg.senderName,
          isFromUser: msg.isFromUser,
          isUnread: msg.isUnread,
          attachments: msg.attachments,
          reactions: msg.reactions,
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
 * Uses official Beeper API v1 endpoints with preview data extraction
 * 
 * Two-tier sync strategy:
 * - Scheduled/triggered: Fetch chat list + last 15 messages per active chat
 * - On-demand: Full conversation history via loadFullConversation action
 * 
 * Benefits:
 * - Type safety with TypeScript definitions
 * - Built-in error handling & retries (2x on 429, 5xx, timeouts)
 * - Preview data reduces unnecessary message fetches
 * - Preserves existing metadata (no overrides)
 */
export const syncBeeperChatsInternal = internalAction({
  handler: async (ctx, args: { syncSource: string; bypassCache?: boolean }) => {
    try {
      const now = Date.now();
      
      // Initialize Beeper SDK client
      const client = createBeeperClient();

      // Get stored cursor state from database
      const syncState = await ctx.runQuery(
        internal.cursorHelpers.getChatListSync,
        {}
      );
      
      // Build query params for cursor-based pagination
      let cursor: string | undefined;
      let direction: "after" | "before" | undefined;
      
      if (syncState?.newestCursor && !args.bypassCache) {
        // Incremental sync: Fetch only chats NEWER than our newest cursor
        cursor = syncState.newestCursor;
        direction = "after";
        
        console.log(
          `[Cursor Sync] Incremental sync - fetching NEWER chats only` +
          ` (cursor: ${syncState.newestCursor.slice(0, 13)}...)` +
          ` (last synced: ${new Date(syncState.lastSyncedAt).toISOString()})`
        );
      } else {
        // First sync: Fetch initial batch
        // No cursor = API returns most recent chats with internal default limit
        console.log(
          `[Cursor Sync] ${args.bypassCache ? 'Cache bypassed' : 'First sync'} - fetching initial batch`
        );
        // Note: No 'limit' parameter in official API - it uses internal default
        // Use hasMore flag to determine if there are more chats to load
      }

      // Fetch chats using official SDK method (matches API spec)
      const allChats: any[] = [];
      const query: any = {};
      if (cursor) query.cursor = cursor;
      if (direction) query.direction = direction;
      
      // Manual pagination (not auto-pagination) - we control when to fetch more
      const response = await client.chats.list(query) as any;

      const chats = response.items || [];
      
      console.log(
        `[Cursor Sync] Received ${chats.length} chats from API ` +
        `(hasMore: ${response.hasMore || false})`
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

        // Ensure type is properly typed as "single" | "group"
        const chatType = (chat.type === "single" || chat.type === "group") ? chat.type : "single" as const;

        // Extract preview data if available (last message preview from API)
        const preview = chat.preview;
        let lastMessage: string | undefined;
        let lastMessageFrom: "user" | "them" | undefined;
        let needsReply: boolean | undefined;
        let previewTimestamp: number | undefined;
        let newestMessageSortKey: string | undefined;

        if (preview) {
          lastMessage = preview.text || undefined;
          lastMessageFrom = preview.isSender ? "user" : "them";
          needsReply = !preview.isSender; // Need to reply if they sent last message
          previewTimestamp = new Date(preview.timestamp).getTime();
          newestMessageSortKey = preview.sortKey; // ← CRITICAL: Use preview sortKey as newest!
          
          console.log(
            `[Beeper Sync] Chat ${chat.id} preview: ` +
            `lastFrom=${lastMessageFrom}, needsReply=${needsReply}, ` +
            `sortKey=${preview.sortKey}, ` +
            `previewTime=${new Date(previewTimestamp).toISOString()}`
          );
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
          participantFullName,  // NEW
          participantImgURL,    // NEW
          cannotMessage,        // NEW
          participantCount: chat.participants?.total,
          lastActivity,
          unreadCount: chat.unreadCount || 0,
          lastMessage,
          lastMessageFrom,
          needsReply,
          // Convert lastReadMessageSortKey to string (API may return as number)
          lastReadMessageSortKey: chat.lastReadMessageSortKey ? String(chat.lastReadMessageSortKey) : undefined,
          isArchived: chat.isArchived || false,
          isMuted: chat.isMuted || false,
          isPinned: chat.isPinned || false,
          lastSyncedAt: now,
          syncSource: args.syncSource,
          newestMessageSortKey,  // NEW: From preview.sortKey
        };

        // Upsert chat via mutation (returns chatDocId and shouldSyncMessages)
        const { chatDocId, shouldSyncMessages } = await ctx.runMutation(
          internal.beeperSync.upsertChat,
          { chatData }
        );

        // Sync ALL participants to beeperParticipants table (for both single and group chats)
        if (chat.participants?.items && chat.participants.items.length > 0) {
          await ctx.runMutation(
            internal.beeperSync.upsertParticipants,
            {
              chatId: chat.id,
              participants: chat.participants.items.map((p: any) => ({
                id: p.id,
                fullName: p.fullName,
                username: p.username,
                phoneNumber: p.phoneNumber,
                email: p.email,
                imgURL: p.imgURL,
                isSelf: p.isSelf ?? false,
                cannotMessage: p.cannotMessage,
              })),
              lastSyncedAt: now,
            }
          );
        }

        syncedChatsCount++;

        // TWO-TIER SYNC STRATEGY:
        // 1. Scheduled/triggered sync: Only fetch last 10-20 messages (lightweight)
        // 2. On-demand full load: User opens chat → loadFullConversation (in beeperMessages.ts)
        const shouldFetchMessages = shouldSyncMessages;

        if (shouldFetchMessages) {
          try {
            // Lightweight sync: Only fetch last 10-20 recent messages
            // Full conversation history is loaded on-demand when user opens the chat
            const RECENT_MESSAGE_LIMIT = 15;
            
            const messageQueryParams: any = {
              limit: RECENT_MESSAGE_LIMIT, // Only fetch last 15 messages
            };
            
            console.log(
              `[Beeper Sync] Fetching last ${RECENT_MESSAGE_LIMIT} messages for chat ${chat.id} (${chat.title})...`
            );
            
            const messagesResponse = await client.get(`/v1/chats/${encodeURIComponent(chat.id)}/messages`, {
              query: messageQueryParams
            }) as any;
            const messages = messagesResponse.items || [];

            console.log(
              `[Beeper Sync] Received ${messages.length} recent messages from API for chat ${chat.id} (${chat.title})`
            );

            // Prepare messages for mutation - match API spec exactly
            const messagesToSync = messages
              .map((msg: any) => {
                // Extract attachments if present (all fields from API)
                const attachments = msg.attachments?.map((att: any) => ({
                  type: att.type || "unknown",
                  srcURL: att.srcURL,
                  mimeType: att.mimeType,
                  fileName: att.fileName,
                  fileSize: att.fileSize,
                  isGif: att.isGif,
                  isSticker: att.isSticker,
                  isVoiceNote: att.isVoiceNote,    // NEW
                  posterImg: att.posterImg,        // NEW
                  width: att.size?.width,
                  height: att.size?.height,
                }));
                
                // Extract reactions if present (all fields from API)
                const reactions = msg.reactions?.map((r: any) => ({
                  id: r.id,
                  participantID: r.participantID,
                  reactionKey: r.reactionKey,
                  emoji: r.emoji,
                  imgURL: r.imgURL,
                }));

                return {
                  messageId: msg.id,
                  accountID: msg.accountID,        // NEW: Required in API
                  text: extractMessageText(msg.text),
                  timestamp: new Date(msg.timestamp).getTime(),
                  sortKey: msg.sortKey,            // Required for cursor tracking
                  senderId: msg.senderID,
                  senderName: msg.senderName || msg.senderID,
                  isFromUser: msg.isSender || false,
                  isUnread: msg.isUnread,          // NEW
                  attachments: attachments && attachments.length > 0 ? attachments : undefined,
                  reactions: reactions && reactions.length > 0 ? reactions : undefined,  // NEW
                };
              })
              // CRITICAL: Sort by sortKey (lexicographically) before syncing
              // sortKeys are designed to be sortable strings
              .sort((a: { sortKey: string }, b: { sortKey: string }) => 
                compareSortKeys(a.sortKey, b.sortKey)
              );

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
            
            // Track message cursor boundaries
            if (messagesToSync.length > 0) {
              // Messages are sorted oldest to newest
              const newestSortKey = messagesToSync[messagesToSync.length - 1]?.sortKey;
              const oldestSortKey = messagesToSync[0]?.sortKey;
              
              // Smart update: mutation will only update boundaries if they are expanded
              await ctx.runMutation(
                internal.cursorHelpers.updateChatMessageCursors,
                {
                  chatDocId,
                  newestMessageSortKey: newestSortKey,
                  oldestMessageSortKey: oldestSortKey,
                  messageCount: messagesToSync.length, 
                }
              );
            }
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

      // Store cursor boundaries for next sync
      // SMART CURSOR UPDATE:
      // 1. If we synced "after", only update newestCursor
      // 2. If we synced "before", only update oldestCursor
      // 3. If no cursor (initial), update both
      const updateData: any = {
        syncSource: args.syncSource,
      };

      if (direction === "after") {
        updateData.newestCursor = response.newestCursor;
        // Do NOT pass oldestCursor, mutation will preserve existing global oldest
      } else if (direction === "before") {
        updateData.oldestCursor = response.oldestCursor;
        // Do NOT pass newestCursor, mutation will preserve existing global newest
      } else {
        // Initial sync or bypassCache - fetching the front of the list
        updateData.newestCursor = response.newestCursor;
        
        // ONLY update oldestCursor if we don't have one yet.
        // This prevents overwriting a deep historical boundary with the 
        // oldest cursor of the first page of recent chats.
        if (!syncState?.oldestCursor) {
          updateData.oldestCursor = response.oldestCursor;
        }
      }
      
      await ctx.runMutation(
        internal.cursorHelpers.updateChatListSync,
        updateData
      );

      console.log(
        `[Cursor Sync] Updated sync state: ` +
        `newest=${(updateData.newestCursor || "unchanged")?.slice(0, 13)}..., ` +
        `oldest=${(updateData.oldestCursor || "unchanged")?.slice(0, 13)}...`
      );

      // Cache ALL profile images that don't have them yet (run in background)
      // Schedule as a separate action so it doesn't block the sync response
      await ctx.scheduler.runAfter(0, api.imageCache.cacheAllProfileImages, {});

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
      let isCloudflareError = false;
      let statusCode = 0;
      
      if (error && typeof error === 'object' && 'constructor' in error) {
        const errorName = error.constructor.name;
        errorType = errorName;
        
        // Check for specific API error types from SDK
        if ('status' in error && 'message' in error) {
          const apiError = error as any;
          statusCode = apiError.status;
          errorMsg = `${errorName} (${apiError.status}): ${apiError.message}`;
          
          // Detect Cloudflare errors (502, 530, 522, 524, etc.)
          // These are expected when the backend is on a mobile device that's sometimes down
          const cloudflareErrorCodes = [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530, 1033];
          const messageIndicatesCloudflare = 
            apiError.message?.includes('Cloudflare') || 
            apiError.message?.includes('cloudflare') ||
            apiError.message?.includes('Bad gateway') ||
            apiError.message?.includes('Tunnel error');
          
          isCloudflareError = cloudflareErrorCodes.includes(statusCode) || messageIndicatesCloudflare;
          
          if (isCloudflareError) {
            // Cloudflare/tunnel errors are EXPECTED - the backend runs on a mobile device
            // that's sometimes unavailable. Just log as info and wait for next sync.
            console.log(
              `[Beeper Sync] Backend temporarily unavailable (Cloudflare ${statusCode}). ` +
              `This is expected - the sync server may be offline. Will retry in 10 minutes.`
            );
          } else if (apiError.status === 429) {
            console.error(`[Beeper Sync] Rate limited! Please wait before retrying.`);
          } else if (apiError.status >= 500) {
            console.error(`[Beeper Sync] Server error - Beeper API may be experiencing issues.`);
          } else if (apiError.status === 401) {
            console.error(`[Beeper Sync] Authentication failed - check BEEPER_TOKEN`);
          }
        } else if (error instanceof Error) {
          errorMsg = error.message;
          // Also check error message for Cloudflare indicators
          isCloudflareError = 
            errorMsg.includes('Cloudflare') || 
            errorMsg.includes('Bad gateway') ||
            errorMsg.includes('ECONNREFUSED');
          
          if (isCloudflareError) {
            console.log(
              `[Beeper Sync] Backend temporarily unavailable. ` +
              `This is expected - the sync server may be offline. Will retry in 10 minutes.`
            );
          }
        }
      }
      
      // Only log as error if it's NOT a Cloudflare/connectivity issue
      if (!isCloudflareError) {
        console.error(`[Beeper Sync] ${errorType}: ${errorMsg}`);
      }
      
      return {
        success: false,
        syncedChats: 0,
        syncedMessages: 0,
        timestamp: Date.now(),
        source: args.syncSource,
        error: isCloudflareError 
          ? `Backend temporarily unavailable (will retry)` 
          : errorMsg,
        // Flag to indicate this was an expected temporary error
        isTemporaryError: isCloudflareError,
      };
    }
  },
});

/**
 * Public action for manual sync
 * Can be triggered by frontend on page load or refresh button
 * Fetches all chats and recent messages (15 per chat with new activity)
 * Full message history is loaded on-demand via loadFullConversation
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
    isTemporaryError?: boolean;
  }> => {
    const result = await ctx.runAction(internal.beeperSync.syncBeeperChatsInternal, {
      syncSource: "manual",
      bypassCache: true, // Bypass cache for manual refresh
    });
    return result;
  },
});

/**
 * Page load sync - triggered when user opens the page
 * Only syncs messages for chats with new activity (not all chats)
 * Lightweight sync - fetches recent messages only
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
    isTemporaryError?: boolean;
  }> => {
    const result = await ctx.runAction(internal.beeperSync.syncBeeperChatsInternal, {
      syncSource: "page_load",
      bypassCache: false, // Use cache to filter by recent activity
    });
    return result;
  },
});

/**
 * Full resync - resyncs all chats and messages
 * Used for admin purposes when data needs to be refreshed
 * By default syncs over existing data (upserts), optionally can clear first
 */
export const fullResync = action({
  args: {
    messageLimit: v.optional(v.number()), // Messages per chat to fetch (default 50)
    clearFirst: v.optional(v.boolean()), // Whether to clear existing messages first (default false)
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    clearedMessages?: number;
    syncedChats: number;
    syncedMessages: number;
    timestamp: number;
    error?: string;
  }> => {
    const messageLimit = args.messageLimit ?? 50;
    const clearFirst = args.clearFirst ?? false;
    
    try {
      let clearedMessages = 0;
      
      // Optionally clear existing messages first
      if (clearFirst) {
        const clearResult = await ctx.runMutation(
          internal.beeperSync.clearMessagesForResync,
          {}
        );
        clearedMessages = clearResult.deleted;
      }
      
      // Trigger a full sync with bypass cache
      const syncResult = await ctx.runAction(
        internal.beeperSync.syncBeeperChatsInternal,
        {
          syncSource: "full_resync",
          bypassCache: true,
        }
      );
      
      return {
        success: syncResult.success,
        clearedMessages,
        syncedChats: syncResult.syncedChats,
        syncedMessages: syncResult.syncedMessages,
        timestamp: Date.now(),
        error: syncResult.error,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        syncedChats: 0,
        syncedMessages: 0,
        timestamp: Date.now(),
        error: errorMsg,
      };
    }
  },
});

/**
 * Internal mutation to clear messages for resync
 */
export const clearMessagesForResync = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const messages = await ctx.db.query("beeperMessages").collect();
    
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    
    console.log(`[fullResync] Cleared ${messages.length} messages for resync`);
    
    return { deleted: messages.length };
  },
});

