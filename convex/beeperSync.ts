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
      
      // 3. If no exact match, try normalized phone matching using pre-computed array
      // This avoids runtime normalization - just check if the array contains our search phone
      // Handles format differences like +61411785274 vs 0411785274
      if (!contactId && args.chatData.phoneNumber) {
        const searchPhone = normalizePhone(args.chatData.phoneNumber);
        
        const contactsWithNormalizedPhones = await ctx.db
          .query("contacts")
          .filter((q) => q.neq(q.field("normalizedPhones"), undefined))
          .collect();
        
        const matchedContact = contactsWithNormalizedPhones.find((c) => 
          c.normalizedPhones?.includes(searchPhone)
        );
        
        if (matchedContact) {
          contactId = matchedContact._id;
        }
      }
    }

    if (existingChat) {
      chatDocId = existingChat._id;
      
      // Check if messages need syncing
      // STRATEGY: Use cursor (sortKey) for precise change detection, fallback to timestamps
      const neverSynced = !existingChat.lastMessagesSyncedAt;
      
      if (args.chatData.newestMessageSortKey && existingChat.newestMessageSortKey) {
        // If we have cursors, use them! If the head moved, we need to sync.
        shouldSyncMessages = neverSynced || args.chatData.newestMessageSortKey !== existingChat.newestMessageSortKey;
      } else {
        // Fallback to timestamp check (vulnerable to clock skew if Beeper clock > Convex clock)
        shouldSyncMessages = neverSynced || args.chatData.lastActivity > (existingChat.lastMessagesSyncedAt ?? 0);
      }

      // OPTIMIZATION: Skip write if nothing meaningful has changed
      // Compare key fields that would affect the UI or require syncing
      
      // Helper to detect if a string looks like a raw identifier (phone, email, matrix ID)
      const isRawId = (s?: string) => {
        if (!s) return true; // undefined/empty is considered "raw" (not a good name)
        if (s.includes('@') || s.includes(':')) return true;
        const digits = s.replace(/\D/g, '');
        if (digits.length >= 6 && /^[0-9+\s\-()]+$/.test(s)) return true;
        return false;
      };
      
      const hasNewActivity = args.chatData.lastActivity > (existingChat.lastActivity || 0);
      // Only update contact if:
      // 1. We found a new contactId match from auto-matching
      // 2. The contactId is different from existing
      // 3. User has NOT manually linked this chat (contactMatchedAt means user-set = permanent)
      const userManuallyLinked = existingChat.contactMatchedAt !== undefined;
      const contactChanged = contactId !== undefined && 
                             contactId !== existingChat.contactId && 
                             !userManuallyLinked;
      // Only count as changed if we have a NEW value (avoid triggering on undefined -> undefined)
      const usernameChanged = args.chatData.username !== undefined && 
                              args.chatData.username !== existingChat.username;
      const phoneChanged = args.chatData.phoneNumber !== undefined && 
                           args.chatData.phoneNumber !== existingChat.phoneNumber;
      const unreadChanged = args.chatData.unreadCount !== existingChat.unreadCount;
      const archivedChanged = args.chatData.isArchived !== existingChat.isArchived;
      const mutedChanged = args.chatData.isMuted !== existingChat.isMuted;
      const pinnedChanged = args.chatData.isPinned !== existingChat.isPinned;
      
      // Only consider name changes meaningful if they would actually be applied
      // (i.e., if we're upgrading from raw to good, or changing a raw value)
      const existingTitleIsRaw = isRawId(existingChat.title);
      const newTitleIsRaw = isRawId(args.chatData.title);
      const titleWouldChange = args.chatData.title !== existingChat.title && 
                               (existingTitleIsRaw || !newTitleIsRaw);
      
      const existingNameIsRaw = isRawId(existingChat.participantFullName);
      const newNameIsRaw = isRawId(args.chatData.participantFullName);
      const participantNameWouldChange = args.chatData.participantFullName !== existingChat.participantFullName &&
                                         (existingNameIsRaw || !newNameIsRaw);
      
      const hasChanges = hasNewActivity || contactChanged || usernameChanged || 
                         phoneChanged || unreadChanged || archivedChanged || 
                         mutedChanged || pinnedChanged || titleWouldChange || participantNameWouldChange;
      
      if (!hasChanges) {
        // Nothing meaningful changed in chat metadata - skip the write.
        // Note: We still return shouldSyncMessages which may be true if lastActivity > lastMessagesSyncedAt.
        // This is intentional - the caller will sync messages and syncChatMessages() will update lastMessagesSyncedAt.
        // This handles the case where chat metadata is unchanged but messages haven't been synced yet.
        // chatWasUpdated: false tells the caller to skip upserting participants (nothing changed)
        return { chatDocId, shouldSyncMessages, chatWasUpdated: false };
      }
      
      // DEBUG: Log what triggered the update so we can identify unnecessary writes
      const triggers = [];
      if (hasNewActivity) triggers.push(`newActivity(${args.chatData.lastActivity} > ${existingChat.lastActivity})`);
      if (contactChanged) triggers.push(`contact(${existingChat.contactId} -> ${contactId})`);
      if (usernameChanged) triggers.push(`username(${existingChat.username} -> ${args.chatData.username})`);
      if (phoneChanged) triggers.push(`phone(${existingChat.phoneNumber} -> ${args.chatData.phoneNumber})`);
      if (unreadChanged) triggers.push(`unread(${existingChat.unreadCount} -> ${args.chatData.unreadCount})`);
      if (archivedChanged) triggers.push('archived');
      if (mutedChanged) triggers.push('muted');
      if (pinnedChanged) triggers.push('pinned');
      if (titleWouldChange) triggers.push(`title("${existingChat.title}" -> "${args.chatData.title}")`);
      if (participantNameWouldChange) triggers.push(`participantName("${existingChat.participantFullName}" -> "${args.chatData.participantFullName}")`);
      console.log(`[upsertChat] Chat ${args.chatData.chatId}: UPDATING because: ${triggers.join(', ')}`);
      

      // Build SELECTIVE update - only include fields that actually changed
      // This minimizes unnecessary reactive updates
      const updates: any = {
        // Always update sync metadata when we do write
        lastSyncedAt: args.chatData.lastSyncedAt,
        syncSource: args.chatData.syncSource,
      };
      
      // Only include changed fields
      if (hasNewActivity) {
        updates.lastActivity = args.chatData.lastActivity;
      }
      if (unreadChanged) {
        updates.unreadCount = args.chatData.unreadCount;
      }
      if (archivedChanged) {
        updates.isArchived = args.chatData.isArchived;
      }
      if (mutedChanged) {
        updates.isMuted = args.chatData.isMuted;
      }
      if (pinnedChanged) {
        updates.isPinned = args.chatData.isPinned;
      }
      if (usernameChanged) {
        updates.username = args.chatData.username;
      }
      if (phoneChanged) {
        updates.phoneNumber = args.chatData.phoneNumber;
      }
      
      // NAME PROTECTION: Don't overwrite good names with raw identifiers
      // The query uses: contactName || participantFullName || title
      // We want to preserve "better" names and avoid flashing loops.
      
      // Update title: only if it would actually change AND the new title is "better" or existing is raw
      if (titleWouldChange) {
        updates.title = args.chatData.title;
      }
      
      // Update participantFullName: same logic - don't replace a good name with a raw one
      if (participantNameWouldChange) {
        updates.participantFullName = args.chatData.participantFullName;
      }
      
      // Update contact matching if we found a NEW match
      if (contactChanged) {
        updates.contactId = contactId;
        updates.contactMatchedAt = now;
      }
      
      // Update optional fields only if they changed (not just provided)
      if (args.chatData.description !== undefined && args.chatData.description !== existingChat.description) {
        updates.description = args.chatData.description;
      }
      if (args.chatData.email !== undefined && args.chatData.email !== existingChat.email) {
        updates.email = args.chatData.email;
      }
      if (args.chatData.participantId !== undefined && args.chatData.participantId !== existingChat.participantId) {
        updates.participantId = args.chatData.participantId;
      }
      if (args.chatData.participantImgURL !== undefined && args.chatData.participantImgURL !== existingChat.participantImgURL) {
        updates.participantImgURL = args.chatData.participantImgURL;
      }
      if (args.chatData.cannotMessage !== undefined && args.chatData.cannotMessage !== existingChat.cannotMessage) {
        updates.cannotMessage = args.chatData.cannotMessage;
      }
      if (args.chatData.participantCount !== undefined && args.chatData.participantCount !== existingChat.participantCount) {
        updates.participantCount = args.chatData.participantCount;
      }
      if (args.chatData.lastReadMessageSortKey !== undefined && args.chatData.lastReadMessageSortKey !== existingChat.lastReadMessageSortKey) {
        updates.lastReadMessageSortKey = args.chatData.lastReadMessageSortKey;
      }
      if (args.chatData.newestMessageSortKey !== undefined && args.chatData.newestMessageSortKey !== existingChat.newestMessageSortKey) {
        updates.newestMessageSortKey = args.chatData.newestMessageSortKey;
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
      
      // Return that this chat was updated (not new, but changed)
      return { chatDocId, shouldSyncMessages, chatWasUpdated: true };
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
      
      // Return that this is a new chat
      return { chatDocId, shouldSyncMessages, chatWasUpdated: true };
    }
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
    // IMPORTANT: We only capture the FIRST non-self, non-Meta-AI participant's data
    // This matches the behavior of syncBeeperChatsInternal to avoid inconsistencies
    let otherPersonPhoneNumber: string | undefined = undefined;
    let otherPersonUsername: string | undefined = undefined;
    let otherPersonFullName: string | undefined = undefined;
    let otherPersonImgURL: string | undefined = undefined;
    let otherPersonContactId: string | undefined = undefined;
    let foundOtherPerson = false; // Flag to only capture first participant

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
        // Track "other person" data for backfill - ONLY the FIRST real participant
        // Skip Meta AI bot when determining the "real" conversation partner
        const shouldTrackAsOtherPerson = !foundOtherPerson && !isMetaAI(participant);
        
        if (shouldTrackAsOtherPerson) {
          foundOtherPerson = true; // Mark that we found our person - don't overwrite
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
            // Fall back to normalized matching using pre-computed normalizedPhones array
            const searchPhone = normalizePhone(participant.phoneNumber);
            const contactsWithNormalizedPhones = await ctx.db
              .query("contacts")
              .filter((q) => q.neq(q.field("normalizedPhones"), undefined))
              .collect();

            const matchedContact = contactsWithNormalizedPhones.find((c) => 
              c.normalizedPhones?.includes(searchPhone)
            );

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
      
      // Helper to detect raw identifiers (same logic as upsertChat)
      const isRawId = (s?: string) => {
        if (!s) return true;
        if (s.includes('@') || s.includes(':')) return true;
        const digits = s.replace(/\D/g, '');
        if (digits.length >= 6 && /^[0-9+\s\-()]+$/.test(s)) return true;
        return false;
      };
      
      // Backfill phoneNumber if missing but we have it from participant
      if (!chat.phoneNumber && otherPersonPhoneNumber) {
        updates.phoneNumber = otherPersonPhoneNumber;
        console.log(`[upsertParticipants] Backfilling phoneNumber for chat ${args.chatId}: ${otherPersonPhoneNumber}`);
      }
      
      // Backfill username if missing
      if (!chat.username && otherPersonUsername) {
        updates.username = otherPersonUsername;
      }
      
      // Backfill participantFullName: only if missing OR current is raw and new is good
      // This uses the same protection as upsertChat to prevent oscillation
      const currentNameIsRaw = isRawId(chat.participantFullName);
      const newNameIsRaw = isRawId(otherPersonFullName);
      if ((!chat.participantFullName || (currentNameIsRaw && !newNameIsRaw)) && otherPersonFullName) {
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

    // Get current chat state to ensure we don't overwrite newer data with older data
    // (e.g. during historical sync where we fetch old messages)
    const chat = await ctx.db.get(args.chatDocId);
    
    // Calculate reply tracking from NEW messages (if any)
    // OR query database to find the actual last message
    let lastMessageFrom: "user" | "them" | undefined;
    let needsReply: boolean | undefined;
    let lastMessageText: string | undefined;

    if (args.messages.length > 0) {
      // We have new messages - use the most recent one from the API
      // Messages MUST be sorted by timestamp (oldest to newest) before calling this function
      const potentialLastMsg = args.messages[args.messages.length - 1];
      
      // CRITICAL: Only update chat preview if this message is actually newer than what we have
      // This protects against overwriting the preview with old messages during historical sync
      const isNewer = !chat?.newestMessageSortKey || 
                      compareSortKeys(potentialLastMsg.sortKey, chat.newestMessageSortKey) >= 0;
      
      if (isNewer) {
        lastMessageFrom = potentialLastMsg.isFromUser ? "user" : "them";
        needsReply = !potentialLastMsg.isFromUser; // Need to reply if they sent last message
        lastMessageText = potentialLastMsg.text;
        
        console.log(
          `[syncChatMessages] Updated reply tracking from NEW messages: ` +
          `lastFrom=${lastMessageFrom}, needsReply=${needsReply}`
        );
      } else {
        console.log(
          `[syncChatMessages] Preserving existing chat preview (fetched messages are older than current head)`
        );
      }
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

    // Get current chat to check if anything actually changed
    const currentChat = await ctx.db.get(args.chatDocId);
    
    // Build update object only with fields that actually changed
    const chatUpdate: any = {};
    
    // Only update lastMessagesSyncedAt if we actually synced messages
    if (insertedCount > 0) {
      chatUpdate.lastMessagesSyncedAt = args.lastMessagesSyncedAt;
    }
    
    // Only update reply tracking if the values differ from current
    if (lastMessageFrom !== undefined && lastMessageFrom !== currentChat?.lastMessageFrom) {
      chatUpdate.lastMessageFrom = lastMessageFrom;
    }
    if (needsReply !== undefined && needsReply !== currentChat?.needsReply) {
      chatUpdate.needsReply = needsReply;
    }
    if (lastMessageText !== undefined && lastMessageText !== currentChat?.lastMessage) {
      chatUpdate.lastMessage = lastMessageText;
    }
    
    // Only patch if there are actual changes
    if (Object.keys(chatUpdate).length > 0) {
      await ctx.db.patch(args.chatDocId, chatUpdate);
    }

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
    // Generate unique ID for this sync instance
    const syncId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    
    // Try to acquire lock - if another sync is running, skip
    const lockAcquired = await ctx.runMutation(
      internal.cursorHelpers.tryAcquireSyncLock,
      { syncId }
    );
    
    if (!lockAcquired) {
      console.log(`[Beeper Sync] ⏭️ Skipped - another sync in progress (source: ${args.syncSource}, id: ${syncId.slice(0, 8)})`);
      return {
        success: true,
        syncedChats: 0,
        syncedMessages: 0,
        timestamp: Date.now(),
        source: args.syncSource,
        skipped: true,
        reason: "Another sync is in progress",
      };
    }
    
    console.log(`[Beeper Sync] 🔒 Lock acquired (source: ${args.syncSource}, id: ${syncId.slice(0, 8)})`);

    
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

      let syncedChatsCount = 0;
      let syncedMessagesCount = 0;

      // Pagination loop to "catch up" if there are multiple pages of new activity
      // TWO-TIER SYNC STRATEGY:
      // 1. Scheduled/triggered sync: Fetch chat list + last 15 messages per active chat
      // 2. On-demand: Full conversation history via loadFullConversation action
      let hasMore = true;
      let currentPage = 0;
      const MAX_CATCHUP_PAGES = 20; // Allow catching up on more activity (20 pages × 25 = 500 chats max)
      let lastResponse: any = null;
      
      // Use local variables for pagination so we can update them in the loop
      let currentCursor = cursor;
      let currentDirection = direction;
      
      // CYCLE DETECTION: Track cursors we've already seen to prevent infinite loops
      // This guards against API bugs or cursor corruption that could cause oscillation
      const seenCursors = new Set<string>();
      if (currentCursor) {
        seenCursors.add(currentCursor);
      }

      while (hasMore && currentPage < MAX_CATCHUP_PAGES) {
        currentPage++;
        
        // Build query params for this page
        const query: any = {};
        if (currentCursor) query.cursor = currentCursor;
        if (currentDirection) query.direction = currentDirection;
        
        // Fetch page of chats
        const response = await client.chats.list(query) as any;
        lastResponse = response;
        const chats = response.items || [];
        
        console.log(
          `[Cursor Sync] Received ${chats.length} chats from API (page ${currentPage}) ` +
          `(hasMore: ${response.hasMore || false}, ` +
          `newestCursor: ${response.newestCursor?.slice(0, 15) || 'none'}, ` +
          `oldestCursor: ${response.oldestCursor?.slice(0, 15) || 'none'})`
        );

        // OPTIMIZATION: If we're doing an incremental sync (direction=after) and the API returns
        // the same cursor we sent, it means there are no NEW chats - skip processing entirely.
        // This prevents re-syncing the same 125 chats over and over when nothing has changed.
        if (currentDirection === "after" && currentCursor && response.newestCursor === currentCursor) {
          console.log(`[Cursor Sync] No new chats (cursor unchanged) - skipping processing`);
          hasMore = false;
          break;
        }
        
        // CYCLE DETECTION: If we've seen this cursor before, we're in an infinite loop
        // This can happen due to API bugs or corrupt cursor data
        if (response.newestCursor && seenCursors.has(response.newestCursor)) {
          console.warn(
            `[Cursor Sync] ⚠️ CYCLE DETECTED: Cursor ${response.newestCursor?.slice(0, 15)} ` +
            `was already seen. Breaking to prevent infinite loop. ` +
            `Seen cursors: ${Array.from(seenCursors).map(c => c.slice(0, 10)).join(', ')}`
          );
          hasMore = false;
          break;
        }

        // Process each chat in this page
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

          // Extract preview data if available
        const preview = chat.preview;
        let lastMessage: string | undefined;
        let lastMessageFrom: "user" | "them" | undefined;
        let needsReply: boolean | undefined;
        let newestMessageSortKey: string | undefined;

        if (preview) {
          lastMessage = preview.text || undefined;
          lastMessageFrom = preview.isSender ? "user" : "them";
            needsReply = !preview.isSender;
            newestMessageSortKey = preview.sortKey;
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
          isArchived: chat.isArchived || false,
          isMuted: chat.isMuted || false,
          isPinned: chat.isPinned || false,
          lastSyncedAt: now,
          syncSource: args.syncSource,
            newestMessageSortKey,
        };

          // Upsert chat via mutation
        const { chatDocId, shouldSyncMessages, chatWasUpdated } = await ctx.runMutation(
          internal.beeperSync.upsertChat,
          { chatData }
        );

          // Sync participants - ONLY if the chat was new or updated
          // Skip if nothing changed to avoid unnecessary database operations
        if (chatWasUpdated && chat.participants?.items && chat.participants.items.length > 0) {
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

        // Only sync messages if this is NOT a page load sync
        // Page loads should be lightweight and avoid race conditions with loadNewerMessages
        // The actual conversation messages will be loaded when the user opens the chat
        if (shouldSyncMessages && args.syncSource !== "page_load") {
          try {
            const RECENT_MESSAGE_LIMIT = 15;
              const messageQueryParams: any = { limit: RECENT_MESSAGE_LIMIT };
            
            const messagesResponse = await client.get(`/v1/chats/${encodeURIComponent(chat.id)}/messages`, {
              query: messageQueryParams
            }) as any;
            const messages = messagesResponse.items || [];

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
            
            if (messagesToSync.length > 0) {
              const newestSortKey = messagesToSync[messagesToSync.length - 1]?.sortKey;
              const oldestSortKey = messagesToSync[0]?.sortKey;
              
              await ctx.runMutation(
                internal.cursorHelpers.updateChatMessageCursors,
                {
                  chatDocId,
                  newestMessageSortKey: newestSortKey,
                  oldestMessageSortKey: oldestSortKey,
                  messageCount: messagesToSync.length, 
                }
              );
              
              // Only pre-generate suggestions for single chats where we need to reply
              // Group chats have too many participants to generate meaningful suggestions
              if (messageCount > 0 && needsReply && chatType === "single") {
                await ctx.scheduler.runAfter(0, api.beeperActions.generateReplySuggestions, {
                  chatId: chat.id,
                  chatName: chat.title || "Unknown",
                  instagramUsername: username,
                });
              }
            }
          } catch (msgError) {
              console.warn(`[Beeper Sync] Error syncing messages for chat ${chat.id}: ${msgError instanceof Error ? msgError.message : "Unknown error"}`);
            }
          }
        }

        // Check if we need to fetch another page (forward sync only)
        if (currentDirection === "after" && response.hasMore) {
          currentCursor = response.newestCursor;
          // Track this cursor to detect cycles on future pages
          if (currentCursor) {
            seenCursors.add(currentCursor);
          }
          console.log(`[Cursor Sync] Fetching next page of newer chats (cursor: ${currentCursor?.slice(0, 15)})...`);
        } else {
          hasMore = false;
        }
      }

      console.log(
        `[Beeper Sync] Synced ${syncedChatsCount} chats, ${syncedMessagesCount} messages (source: ${args.syncSource})`
      );

      // Store cursor boundaries for next sync using LAST response
      // Only update if we got a valid response from the API
      // NOTE: Use currentDirection (not direction) since it tracks the actual pagination state
      if (lastResponse) {
        const updateData: any = {
          syncSource: args.syncSource,
        };

        if (currentDirection === "after") {
          updateData.newestCursor = lastResponse.newestCursor;
        } else if (currentDirection === "before") {
          updateData.oldestCursor = lastResponse.oldestCursor;
        } else {
          updateData.newestCursor = lastResponse.newestCursor;
          if (!syncState?.oldestCursor) {
            updateData.oldestCursor = lastResponse.oldestCursor;
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
      } else {
        console.warn(`[Cursor Sync] No API response received - skipping cursor update`);
      }

      // Cache ALL profile images that don't have them yet (run in background)
      // Schedule as a separate action so it doesn't block the sync response
      await ctx.scheduler.runAfter(0, api.imageCache.cacheAllProfileImages, {});

      // Release lock before returning
      await ctx.runMutation(internal.cursorHelpers.releaseSyncLock, { syncId });
      console.log(`[Beeper Sync] 🔓 Lock released (source: ${args.syncSource}, id: ${syncId.slice(0, 8)})`);

      return {
        success: true,
        syncedChats: syncedChatsCount,
        syncedMessages: syncedMessagesCount,
        timestamp: now,
        source: args.syncSource,
      };
    } catch (error) {
      // Always release lock on error
      await ctx.runMutation(internal.cursorHelpers.releaseSyncLock, { syncId });
      console.log(`[Beeper Sync] 🔓 Lock released on error (source: ${args.syncSource}, id: ${syncId.slice(0, 8)})`);
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
      bypassCache: false, // Use incremental sync for manual refresh
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

