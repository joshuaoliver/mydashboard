import { mutation, query, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { normalizePhone } from "./messageHelpers";

/**
 * Query to find a contact by Instagram username
 * Used for matching Beeper Instagram chats to Dex contacts
 * 
 * Based on database inspection:
 * - Beeper stores without @ (e.g., "atwilliamhopkins")
 * - Dex stores without @ (e.g., "its.just.kayy")
 * - No @ prefix issues found
 * 
 * Simple exact match strategy with case-insensitive fallback
 */
export const findContactByInstagram = query({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.username) {
      return null;
    }

    // Try exact match first
    let contact = await ctx.db
      .query("contacts")
      .withIndex("by_instagram", (q) => q.eq("instagram", args.username))
      .first();

    // If not found, try case-insensitive match
    if (!contact) {
      const allContacts = await ctx.db
        .query("contacts")
        .filter((q) => q.neq(q.field("instagram"), undefined))
        .collect();

      const normalizedSearch = args.username.toLowerCase();
      contact = allContacts.find((c) => {
        if (!c.instagram) return false;
        return c.instagram.toLowerCase() === normalizedSearch;
      }) || null;
    }

    return contact;
  },
});

/**
 * Query to find a contact by phone number
 * Used for matching Beeper WhatsApp/iMessage chats to Dex contacts
 * Uses normalized phone matching via index for O(1) lookup
 */
export const findContactByPhone = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.phoneNumber) {
      return null;
    }

    const searchPhone = normalizePhone(args.phoneNumber);

    // Try exact match on whatsapp field first (fast index)
    let contact = await ctx.db
      .query("contacts")
      .withIndex("by_whatsapp", (q) => q.eq("whatsapp", args.phoneNumber))
      .first();

    // If not found, search using pre-computed normalizedPhones array
    // This avoids runtime normalization - just check if the array contains our search phone
    if (!contact) {
      const contactsWithNormalizedPhones = await ctx.db
        .query("contacts")
        .filter((q) => q.neq(q.field("normalizedPhones"), undefined))
        .collect();
      
      contact = contactsWithNormalizedPhones.find((c) => 
        c.normalizedPhones?.includes(searchPhone)
      ) || null;
    }

    // If still not found, check socialHandles for whatsapp platform
    if (!contact) {
      const allContacts = await ctx.db
        .query("contacts")
        .filter((q) => q.neq(q.field("socialHandles"), undefined))
        .collect();

      contact = allContacts.find((c) => {
        if (!c.socialHandles) return false;
        return c.socialHandles.some((h) => 
          h.platform === "whatsapp" && normalizePhone(h.handle) === searchPhone
        );
      }) || null;
    }

    return contact;
  },
});

/**
 * Update contact connection types - multi-select (local-only, doesn't sync to Dex)
 */
export const updateContactConnections = mutation({
  args: {
    contactId: v.id("contacts"),
    connections: v.array(v.string()), // Array of connection type strings
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      connections: args.connections,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Toggle a single connection type (add if not present, remove if present)
 */
export const toggleConnectionType = mutation({
  args: {
    contactId: v.id("contacts"),
    connectionType: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    const currentConnections = contact.connections || [];
    const newConnections = currentConnections.includes(args.connectionType)
      ? currentConnections.filter((c) => c !== args.connectionType)
      : [...currentConnections, args.connectionType];

    await ctx.db.patch(args.contactId, {
      connections: newConnections,
      lastModifiedAt: Date.now(),
    });

    return { success: true, connections: newConnections };
  },
});

/**
 * Update contact notes (local-only, doesn't sync to Dex)
 */
export const updateContactNotes = mutation({
  args: {
    contactId: v.id("contacts"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      notes: args.notes,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update contact objective (local-only, doesn't sync to Dex)
 */
export const updateContactObjective = mutation({
  args: {
    contactId: v.id("contacts"),
    objective: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      objective: args.objective,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update contact sex (local-only, multi-select)
 */
export const updateContactSex = mutation({
  args: {
    contactId: v.id("contacts"),
    sex: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      sex: args.sex,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Toggle a sex identifier (add if not present, remove if present)
 */
export const toggleSex = mutation({
  args: {
    contactId: v.id("contacts"),
    sexType: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    const currentSex = contact.sex || [];
    const newSex = currentSex.includes(args.sexType)
      ? currentSex.filter((s) => s !== args.sexType)
      : [...currentSex, args.sexType];

    await ctx.db.patch(args.contactId, {
      sex: newSex,
      lastModifiedAt: Date.now(),
    });

    return { success: true, sex: newSex };
  },
});

/**
 * Update private notes (local-only, PIN-protected)
 */
export const updatePrivateNotes = mutation({
  args: {
    contactId: v.id("contacts"),
    privateNotes: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      privateNotes: args.privateNotes,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update contact locations - multi-select (local-only)
 */
export const updateContactLocations = mutation({
  args: {
    contactId: v.id("contacts"),
    locationIds: v.array(v.id("locations")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      locationIds: args.locationIds,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update timezone for a contact
 * Used for time-aware AI reply suggestions
 */
export const updateContactTimezone = mutation({
  args: {
    contactId: v.id("contacts"),
    timezone: v.optional(v.string()), // IANA timezone identifier (e.g., "America/New_York")
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      timezone: args.timezone,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Toggle a location (add if not present, remove if present)
 */
export const toggleLocation = mutation({
  args: {
    contactId: v.id("contacts"),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    const currentLocations = contact.locationIds || [];
    const newLocations = currentLocations.includes(args.locationId)
      ? currentLocations.filter((id) => id !== args.locationId)
      : [...currentLocations, args.locationId];

    await ctx.db.patch(args.contactId, {
      locationIds: newLocations,
      lastModifiedAt: Date.now(),
    });

    return { success: true, locationIds: newLocations };
  },
});

/**
 * Update intimate connection flag and date (local-only, PIN-protected)
 */
export const updateIntimateConnection = mutation({
  args: {
    contactId: v.id("contacts"),
    intimateConnection: v.boolean(),
    intimateConnectionDate: v.optional(v.string()), // ISO date string
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      intimateConnection: args.intimateConnection,
      intimateConnectionDate: args.intimateConnectionDate,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Create a new contact (user-initiated, no dexId yet)
 * When Dex sync runs later, it will match by Instagram username or phone and adopt this contact
 * For iMessage-only contacts (phone number only), sets doNotSyncToDex flag
 */
export const createContact = mutation({
  args: {
    instagram: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    phoneNumber: v.optional(v.string()), // iMessage phone number
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if contact with this Instagram already exists
    if (args.instagram) {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_instagram", (q) => q.eq("instagram", args.instagram))
        .first();

      if (existing) {
        // Return the existing contact instead of creating duplicate
        return { contactId: existing._id, existed: true };
      }
    }

    // Check if contact with this WhatsApp already exists
    if (args.whatsapp) {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_whatsapp", (q) => q.eq("whatsapp", args.whatsapp))
        .first();

      if (existing) {
        // Return the existing contact instead of creating duplicate
        return { contactId: existing._id, existed: true };
      }
    }

    // Check if contact with this phone number already exists (for iMessage)
    if (args.phoneNumber) {
      // Normalize phone number for comparison
      const searchPhone = normalizePhone(args.phoneNumber);

      // Check whatsapp field (exact match first - fast)
      const existingWhatsapp = await ctx.db
        .query("contacts")
        .withIndex("by_whatsapp", (q) => q.eq("whatsapp", args.phoneNumber))
        .first();

      if (existingWhatsapp) {
        return { contactId: existingWhatsapp._id, existed: true };
      }

      // Check using pre-computed normalizedPhones array
      // This avoids runtime normalization - just check if the array contains our search phone
      const contactsWithNormalizedPhones = await ctx.db
        .query("contacts")
        .filter((q) => q.neq(q.field("normalizedPhones"), undefined))
        .collect();
      
      const existingPhone = contactsWithNormalizedPhones.find((c) => 
        c.normalizedPhones?.includes(searchPhone)
      );

      if (existingPhone) {
        return { contactId: existingPhone._id, existed: true };
      }
    }

    // Determine if this should sync to Dex
    // If only a phone number is provided (iMessage), don't sync to Dex
    const doNotSyncToDex = !args.instagram && !args.whatsapp && !!args.phoneNumber;

    // Compute normalizedPhones for O(1) matching
    const allNormalizedPhones = new Set<string>();
    if (args.whatsapp) {
      const normalized = normalizePhone(args.whatsapp);
      if (normalized) allNormalizedPhones.add(normalized);
    }
    if (args.phoneNumber) {
      const normalized = normalizePhone(args.phoneNumber);
      if (normalized) allNormalizedPhones.add(normalized);
    }
    const normalizedPhones = allNormalizedPhones.size > 0 
      ? Array.from(allNormalizedPhones) 
      : undefined;

    // Create new contact (no dexId - will be added when Dex sync finds a match)
    const contactId = await ctx.db.insert("contacts", {
      instagram: args.instagram,
      whatsapp: args.whatsapp,
      phones: args.phoneNumber ? [{ phone: args.phoneNumber }] : undefined,
      normalizedPhones, // Pre-computed for O(1) phone matching
      firstName: args.firstName,
      lastName: args.lastName,
      description: args.description,
      doNotSyncToDex: doNotSyncToDex || undefined,
      lastSyncedAt: now,
      lastModifiedAt: now,
    });

    // Trigger rematch to link existing chats to this new contact
    // This runs in the same transaction, so it's atomic
    await ctx.scheduler.runAfter(0, internal.contactMutations.rematchChatsForContact, {
      contactId,
    });

    return { contactId, existed: false };
  },
});

/**
 * Update lead status (local-only)
 * Auto-sets sex to "Female" if leadStatus is set and sex is empty
 * Auto-sets intimateConnection to true if leadStatus is Connected, Current, or Former
 */
export const updateLeadStatus = mutation({
  args: {
    contactId: v.id("contacts"),
    leadStatus: v.union(
      v.literal("Potential"),
      v.literal("Talking"),
      v.literal("Planning"),
      v.literal("Dated"),
      v.literal("Connected"),
      v.literal("Current"),
      v.literal("Former"),
      v.null()
    ),
  },
  handler: async (ctx, args) => {
    // Get the current contact
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Prepare the update
    const update: any = {
      leadStatus: args.leadStatus ?? undefined,
      lastModifiedAt: Date.now(),
    };

    // If setting a lead status (not clearing it) and sex is empty, set to Female
    if (args.leadStatus && (!contact.sex || contact.sex.length === 0)) {
      update.sex = ["Female"];
    }

    // Auto-set intimateConnection to true for Connected, Current, or Former statuses
    const intimateStatuses = ["Connected", "Current", "Former"];
    if (args.leadStatus && intimateStatuses.includes(args.leadStatus)) {
      update.intimateConnection = true;
      // If no date is set, set it to today
      if (!contact.intimateConnectionDate) {
        update.intimateConnectionDate = new Date().toISOString().split("T")[0];
      }
    }

    await ctx.db.patch(args.contactId, update);

    return { success: true };
  },
});

/**
 * Update contact's custom set name (local-only)
 * This allows users to set a custom display name for the contact
 */
export const updateSetName = mutation({
  args: {
    contactId: v.id("contacts"),
    setName: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      setName: args.setName ?? undefined,
      lastModifiedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Update contact's priority (local-only)
 * Priority is a number from 1-100 for importance ranking
 */
export const updatePriority = mutation({
  args: {
    contactId: v.id("contacts"),
    priority: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    // Clamp priority to 1-100 range if provided
    let priority = args.priority;
    if (priority !== null) {
      priority = Math.max(1, Math.min(100, priority));
    }
    
    await ctx.db.patch(args.contactId, {
      priority: priority ?? undefined,
      lastModifiedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Re-match all chats AND participants to contacts
 * Call this when contacts are created, updated (instagram/whatsapp/phone fields), or merged
 * 
 * This is an internal mutation that scans all beeperChats AND beeperParticipants
 * and updates their contactId based on current contact data.
 */
export const rematchChatsToContacts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let chatMatchedCount = 0;
    let chatUnmatchedCount = 0;
    let chatUnchangedCount = 0;
    let participantMatchedCount = 0;
    let participantUnchangedCount = 0;

    // PRE-FETCH: Load all contacts ONCE and build lookup maps
    // This avoids repeatedly querying contacts inside the loop
    const allContacts = await ctx.db.query("contacts").collect();
    
    // Build lookup maps for O(1) matching
    // Use pre-computed normalizedPhones for phone matching (no runtime normalization needed)
    const instagramMap = new Map<string, string>(); // username -> contactId
    const phoneMap = new Map<string, string>();     // normalized phone -> contactId
    
    for (const contact of allContacts) {
      if (contact.instagram) {
        instagramMap.set(contact.instagram, contact._id);
      }
      // Use pre-computed normalizedPhones array (already normalized, no runtime cost)
      if (contact.normalizedPhones) {
        for (const normalizedPhone of contact.normalizedPhones) {
          phoneMap.set(normalizedPhone, contact._id);
        }
      }
    }
    
    console.log(`[rematchChatsToContacts] Built lookup maps: ${instagramMap.size} instagram, ${phoneMap.size} phones`);

    // ============================================
    // PART 1: Match beeperChats
    // ============================================
    const chats = await ctx.db
      .query("beeperChats")
      .withIndex("by_type_archived", (q) => q.eq("type", "single"))
      .collect();

    console.log(`[rematchChatsToContacts] Processing ${chats.length} single chats`);

    for (const chat of chats) {
      let newContactId: string | undefined = undefined;

      // 1. Try matching by Instagram username (O(1) lookup)
      if (chat.username) {
        newContactId = instagramMap.get(chat.username);
      }

      // 2. Try matching by phone number (O(1) lookup with normalization)
      // Works for all networks: WhatsApp, iMessage, SMS
      if (!newContactId && chat.phoneNumber) {
        const searchPhone = normalizePhone(chat.phoneNumber);
        newContactId = phoneMap.get(searchPhone);
      }

      // Update only if contactId changed
      const currentContactId = chat.contactId;
      if (newContactId !== currentContactId) {
        await ctx.db.patch(chat._id, {
          contactId: newContactId as any,
          contactMatchedAt: now,
        });
        
        if (newContactId) {
          chatMatchedCount++;
        } else {
          chatUnmatchedCount++;
        }
      } else {
        chatUnchangedCount++;
      }
    }

    // ============================================
    // PART 2: Match beeperParticipants
    // ============================================
    const participants = await ctx.db
      .query("beeperParticipants")
      .filter((q) => q.eq(q.field("isSelf"), false)) // Only match non-self participants
      .collect();

    console.log(`[rematchChatsToContacts] Processing ${participants.length} non-self participants`);

    for (const participant of participants) {
      let newContactId: string | undefined = undefined;

      // 1. Try matching by Instagram username
      if (participant.username) {
        newContactId = instagramMap.get(participant.username);
      }

      // 2. Try matching by phone number (normalized, covers WhatsApp + phones array)
      if (!newContactId && participant.phoneNumber) {
        const searchPhone = normalizePhone(participant.phoneNumber);
        newContactId = phoneMap.get(searchPhone);
      }

      // Update only if contactId changed
      const currentContactId = participant.contactId;
      if (newContactId !== currentContactId) {
        await ctx.db.patch(participant._id, {
          contactId: newContactId as any,
        });
        
        if (newContactId) {
          participantMatchedCount++;
        }
        // Don't count unmatched for participants (too noisy)
      } else {
        participantUnchangedCount++;
      }
    }

    console.log(
      `[rematchChatsToContacts] Complete: ` +
      `Chats: ${chatMatchedCount} matched, ${chatUnmatchedCount} unmatched, ${chatUnchangedCount} unchanged | ` +
      `Participants: ${participantMatchedCount} matched, ${participantUnchangedCount} unchanged`
    );

    // Return combined counts (for backward compatibility, use chat counts as primary)
    return { 
      matchedCount: chatMatchedCount + participantMatchedCount, 
      unmatchedCount: chatUnmatchedCount, 
      unchangedCount: chatUnchangedCount + participantUnchangedCount,
      // Also return detailed breakdown
      chatMatchedCount,
      chatUnmatchedCount,
      chatUnchangedCount,
      participantMatchedCount,
      participantUnchangedCount,
    };
  },
});

/**
 * Re-match chats for a specific contact
 * Call this when a single contact's identifiers (instagram/whatsapp) are updated
 * More efficient than full rematch when only one contact changes
 */
export const rematchChatsForContact = internalMutation({
  args: {
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const contact = await ctx.db.get(args.contactId);
    
    if (!contact) {
      return { updated: 0 };
    }

    let updated = 0;

    // Find chats that should be linked to this contact
    // 1. By Instagram username
    if (contact.instagram) {
      const chatsByInstagram = await ctx.db
        .query("beeperChats")
        .withIndex("by_username", (q) => q.eq("username", contact.instagram!))
        .collect();
      
      for (const chat of chatsByInstagram) {
        if (chat.contactId !== args.contactId) {
          await ctx.db.patch(chat._id, {
            contactId: args.contactId,
            contactMatchedAt: now,
          });
          updated++;
        }
      }
    }

    // 2. By phone number (using pre-computed normalizedPhones)
    // Use the contact's normalizedPhones array if available, otherwise compute
    const contactPhones = new Set<string>(contact.normalizedPhones || []);
    
    // Fallback: if normalizedPhones not populated, compute from whatsapp/phones
    if (contactPhones.size === 0) {
      if (contact.whatsapp) {
        contactPhones.add(normalizePhone(contact.whatsapp));
      }
      if (contact.phones) {
        for (const p of contact.phones) {
          if (p.phone) {
            contactPhones.add(normalizePhone(p.phone));
          }
        }
      }
    }
    
    if (contactPhones.size > 0) {
      // Get all single chats with a phone number
      const chatsWithPhone = await ctx.db
        .query("beeperChats")
        .filter((q) => 
          q.and(
            q.eq(q.field("type"), "single"),
            q.neq(q.field("phoneNumber"), undefined)
          )
        )
        .collect();
      
      // Check each chat's phone against contact's phones (normalized)
      for (const chat of chatsWithPhone) {
        if (chat.contactId !== args.contactId && chat.phoneNumber) {
          const chatPhoneNormalized = normalizePhone(chat.phoneNumber);
          
          if (contactPhones.has(chatPhoneNormalized)) {
            await ctx.db.patch(chat._id, {
              contactId: args.contactId,
              contactMatchedAt: now,
            });
            updated++;
          }
        }
      }
    }

    // Also update any chats that WERE linked to this contact but shouldn't be anymore
    // (in case the contact's identifiers changed)
    const linkedChats = await ctx.db
      .query("beeperChats")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .collect();
    
    for (const chat of linkedChats) {
      // Check if this chat still matches this contact (using normalized phone comparison)
      const matchesInstagram = contact.instagram && chat.username === contact.instagram;
      
      // Use normalized phone matching for whatsapp and phones
      let matchesPhone = false;
      if (chat.phoneNumber) {
        const chatPhoneNormalized = normalizePhone(chat.phoneNumber);
        matchesPhone = contactPhones.has(chatPhoneNormalized);
      }
      
      if (!matchesInstagram && !matchesPhone) {
        // This chat no longer matches - try to find a new match or clear
        let newContactId: string | undefined = undefined;
        
        if (chat.username) {
          const newMatch = await ctx.db
            .query("contacts")
            .withIndex("by_instagram", (q) => q.eq("instagram", chat.username!))
            .first();
          if (newMatch) newContactId = newMatch._id;
        }
        
        if (!newContactId && chat.phoneNumber) {
          // Try normalized phone matching using pre-computed normalizedPhones
          const chatPhoneNormalized = normalizePhone(chat.phoneNumber);
          const contactsWithNormalizedPhones = await ctx.db
            .query("contacts")
            .filter((q) => q.neq(q.field("normalizedPhones"), undefined))
            .collect();
          
          const newMatch = contactsWithNormalizedPhones.find((c) => 
            c.normalizedPhones?.includes(chatPhoneNormalized)
          );
          if (newMatch) newContactId = newMatch._id;
        }
        
        await ctx.db.patch(chat._id, {
          contactId: newContactId as any,
          contactMatchedAt: now,
        });
        updated++;
      }
    }

    console.log(`[rematchChatsForContact] Contact ${args.contactId}: ${updated} chats updated`);

    return { updated };
  },
});

/**
 * Public action to trigger a full rematch of all chats to contacts
 * Use this after bulk importing contacts (e.g., from Dex)
 */
export const triggerFullRematch = action({
  args: {},
  handler: async (ctx): Promise<{ matchedCount: number; unmatchedCount: number; unchangedCount: number }> => {
    console.log("[triggerFullRematch] Starting full rematch of chats to contacts...");
    
    const result: { matchedCount: number; unmatchedCount: number; unchangedCount: number } = 
      await ctx.runMutation(internal.contactMutations.rematchChatsToContacts, {});
    
    console.log(`[triggerFullRematch] Complete: ${result.matchedCount} matched, ${result.unmatchedCount} unmatched, ${result.unchangedCount} unchanged`);
    
    return result;
  },
});

/**
 * Backfill chat phoneNumber from participant data
 * 
 * This is a one-time migration for chats where the API didn't include
 * phoneNumber in the chat list response (iMessage/SMS chats).
 * The data exists in beeperParticipants but not in beeperChats.phoneNumber.
 * 
 * Run via: npx convex run contactMutations:backfillChatPhoneNumbers
 */
export const backfillChatPhoneNumbers = mutation({
  args: {},
  handler: async (ctx): Promise<{ 
    scanned: number; 
    updated: number; 
    alreadyHasPhone: number;
    noParticipantPhone: number;
  }> => {
    console.log("[backfillChatPhoneNumbers] Starting backfill of chat phone numbers from participants...");
    
    // Get all single chats without phoneNumber
    const chatsWithoutPhone = await ctx.db
      .query("beeperChats")
      .filter((q) => 
        q.and(
          q.eq(q.field("type"), "single"),
          q.or(
            q.eq(q.field("phoneNumber"), undefined),
            q.eq(q.field("phoneNumber"), null),
            q.eq(q.field("phoneNumber"), "")
          )
        )
      )
      .collect();
    
    console.log(`[backfillChatPhoneNumbers] Found ${chatsWithoutPhone.length} single chats without phoneNumber`);
    
    let updated = 0;
    let noParticipantPhone = 0;
    let alreadyHasPhone = 0;
    
    for (const chat of chatsWithoutPhone) {
      // Find the non-self participant for this chat
      const participants = await ctx.db
        .query("beeperParticipants")
        .withIndex("by_chat", (q) => q.eq("chatId", chat.chatId))
        .collect();
      
      const otherPerson = participants.find(p => !p.isSelf);
      
      if (otherPerson?.phoneNumber) {
        // Update the chat with the participant's phone number
        const updates: Record<string, any> = {
          phoneNumber: otherPerson.phoneNumber,
        };
        
        // Also backfill other missing fields
        if (!chat.username && otherPerson.username) {
          updates.username = otherPerson.username;
        }
        if (!chat.participantFullName && otherPerson.fullName) {
          updates.participantFullName = otherPerson.fullName;
        }
        if (!chat.participantImgURL && otherPerson.imgURL) {
          updates.participantImgURL = otherPerson.imgURL;
        }
        if (!chat.contactId && otherPerson.contactId) {
          updates.contactId = otherPerson.contactId;
          updates.contactMatchedAt = Date.now();
        }
        
        await ctx.db.patch(chat._id, updates);
        updated++;
        
        console.log(`[backfillChatPhoneNumbers] Updated chat "${chat.title}" with phone: ${otherPerson.phoneNumber}`);
      } else {
        noParticipantPhone++;
      }
    }
    
    // Count chats that already have phone numbers
    const chatsWithPhone = await ctx.db
      .query("beeperChats")
      .filter((q) => 
        q.and(
          q.eq(q.field("type"), "single"),
          q.neq(q.field("phoneNumber"), undefined),
          q.neq(q.field("phoneNumber"), null),
          q.neq(q.field("phoneNumber"), "")
        )
      )
      .collect();
    
    alreadyHasPhone = chatsWithPhone.length;
    
    console.log(
      `[backfillChatPhoneNumbers] Complete: ` +
      `scanned=${chatsWithoutPhone.length}, updated=${updated}, ` +
      `alreadyHasPhone=${alreadyHasPhone}, noParticipantPhone=${noParticipantPhone}`
    );
    
    return {
      scanned: chatsWithoutPhone.length,
      updated,
      alreadyHasPhone,
      noParticipantPhone,
    };
  },
});

/**
 * Backfill normalizedPhones field for all existing contacts
 * 
 * This is a one-time migration to populate the normalizedPhones field
 * for O(1) phone matching. Run after deploying the schema change.
 * 
 * Run via: npx convex run contactMutations:backfillNormalizedPhones --prod
 */
export const backfillNormalizedPhones = mutation({
  args: {},
  handler: async (ctx): Promise<{
    scanned: number;
    updated: number;
    alreadyHas: number;
    noPhones: number;
  }> => {
    console.log("[backfillNormalizedPhones] Starting backfill of normalizedPhones for all contacts...");
    
    // Get all contacts
    const allContacts = await ctx.db.query("contacts").collect();
    
    console.log(`[backfillNormalizedPhones] Found ${allContacts.length} contacts to process`);
    
    let updated = 0;
    let alreadyHas = 0;
    let noPhones = 0;
    
    for (const contact of allContacts) {
      // Compute normalizedPhones from whatsapp and phones array
      const allNormalizedPhones = new Set<string>();
      
      // Add whatsapp field
      if (contact.whatsapp) {
        const normalized = normalizePhone(contact.whatsapp);
        if (normalized) allNormalizedPhones.add(normalized);
      }
      
      // Add phones array
      if (contact.phones) {
        for (const p of contact.phones) {
          if (p.phone) {
            const normalized = normalizePhone(p.phone);
            if (normalized) allNormalizedPhones.add(normalized);
          }
        }
      }
      
      if (allNormalizedPhones.size === 0) {
        noPhones++;
        continue;
      }
      
      const newNormalizedPhones = Array.from(allNormalizedPhones);
      
      // Check if already has correct normalizedPhones
      const existingNormalized = contact.normalizedPhones || [];
      const isSame = 
        existingNormalized.length === newNormalizedPhones.length &&
        existingNormalized.every(p => newNormalizedPhones.includes(p));
      
      if (isSame) {
        alreadyHas++;
        continue;
      }
      
      // Update the contact
      await ctx.db.patch(contact._id, {
        normalizedPhones: newNormalizedPhones,
      });
      updated++;
    }
    
    console.log(
      `[backfillNormalizedPhones] Complete: ` +
      `scanned=${allContacts.length}, updated=${updated}, ` +
      `alreadyHas=${alreadyHas}, noPhones=${noPhones}`
    );
    
    return {
      scanned: allContacts.length,
      updated,
      alreadyHas,
      noPhones,
    };
  },
});
