import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
 * Query to find a contact by WhatsApp phone number
 * Used for matching Beeper WhatsApp chats to Dex contacts
 */
export const findContactByPhone = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.phoneNumber) {
      return null;
    }

    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizePhone = (phone: string) => {
      return phone.replace(/[\s\-\(\)]/g, '');
    };

    const searchPhone = normalizePhone(args.phoneNumber);

    // Try exact match on whatsapp field first
    let contact = await ctx.db
      .query("contacts")
      .withIndex("by_whatsapp", (q) => q.eq("whatsapp", args.phoneNumber))
      .first();

    // If not found, search in phones array
    if (!contact) {
      const allContacts = await ctx.db
        .query("contacts")
        .filter((q) => q.neq(q.field("phones"), undefined))
        .collect();

      contact = allContacts.find((c) => {
        if (!c.phones) return false;
        return c.phones.some((p) => normalizePhone(p.phone) === searchPhone);
      }) || null;
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
      const normalizePhone = (phone: string) => phone.replace(/[\s\-\(\)]/g, '');
      const searchPhone = normalizePhone(args.phoneNumber);

      // Check whatsapp field
      const existingWhatsapp = await ctx.db
        .query("contacts")
        .withIndex("by_whatsapp", (q) => q.eq("whatsapp", args.phoneNumber))
        .first();

      if (existingWhatsapp) {
        return { contactId: existingWhatsapp._id, existed: true };
      }

      // Check phones array
      const allContactsWithPhones = await ctx.db
        .query("contacts")
        .filter((q) => q.neq(q.field("phones"), undefined))
        .collect();

      const existingPhone = allContactsWithPhones.find((c) => {
        if (!c.phones) return false;
        return c.phones.some((p) => normalizePhone(p.phone) === searchPhone);
      });

      if (existingPhone) {
        return { contactId: existingPhone._id, existed: true };
      }
    }

    // Determine if this should sync to Dex
    // If only a phone number is provided (iMessage), don't sync to Dex
    const doNotSyncToDex = !args.instagram && !args.whatsapp && !!args.phoneNumber;

    // Create new contact (no dexId - will be added when Dex sync finds a match)
    const contactId = await ctx.db.insert("contacts", {
      instagram: args.instagram,
      whatsapp: args.whatsapp,
      phones: args.phoneNumber ? [{ phone: args.phoneNumber }] : undefined,
      firstName: args.firstName,
      lastName: args.lastName,
      description: args.description,
      doNotSyncToDex: doNotSyncToDex || undefined,
      lastSyncedAt: now,
      lastModifiedAt: now,
    });

    return { contactId, existed: false };
  },
});

/**
 * Update lead status (local-only)
 * Auto-sets sex to "Female" if leadStatus is set and sex is empty
 */
export const updateLeadStatus = mutation({
  args: {
    contactId: v.id("contacts"),
    leadStatus: v.union(
      v.literal("Talking"),
      v.literal("Planning"),
      v.literal("Dated"),
      v.literal("Connected"),
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

    await ctx.db.patch(args.contactId, update);

    return { success: true };
  },
});

/**
 * Re-match all chats to contacts
 * Call this when contacts are created, updated (instagram/whatsapp/phone fields), or merged
 * 
 * This is an internal mutation that scans all beeperChats and updates their contactId
 * based on current contact data. Runs at sync time, not query time.
 */
export const rematchChatsToContacts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let matchedCount = 0;
    let unmatchedCount = 0;
    let unchangedCount = 0;

    // Get all single chats (groups don't have contactId)
    const chats = await ctx.db
      .query("beeperChats")
      .withIndex("by_type_archived", (q) => q.eq("type", "single"))
      .collect();

    console.log(`[rematchChatsToContacts] Processing ${chats.length} single chats`);

    for (const chat of chats) {
      let newContactId: string | undefined = undefined;

      // 1. Try matching by Instagram username
      if (chat.username) {
        const contactByInstagram = await ctx.db
          .query("contacts")
          .withIndex("by_instagram", (q) => q.eq("instagram", chat.username!))
          .first();
        
        if (contactByInstagram) {
          newContactId = contactByInstagram._id;
        }
      }

      // 2. Try matching by WhatsApp phone number
      if (!newContactId && chat.phoneNumber) {
        const contactByWhatsapp = await ctx.db
          .query("contacts")
          .withIndex("by_whatsapp", (q) => q.eq("whatsapp", chat.phoneNumber!))
          .first();
        
        if (contactByWhatsapp) {
          newContactId = contactByWhatsapp._id;
        }
      }

      // Update only if contactId changed
      const currentContactId = chat.contactId;
      if (newContactId !== currentContactId) {
        await ctx.db.patch(chat._id, {
          contactId: newContactId as any,
          contactMatchedAt: now,
        });
        
        if (newContactId) {
          matchedCount++;
        } else {
          unmatchedCount++;
        }
      } else {
        unchangedCount++;
      }
    }

    console.log(
      `[rematchChatsToContacts] Complete: ${matchedCount} matched, ${unmatchedCount} unmatched, ${unchangedCount} unchanged`
    );

    return { matchedCount, unmatchedCount, unchangedCount };
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

    // 2. By WhatsApp phone (search chats with matching phone number)
    if (contact.whatsapp) {
      const allSingleChats = await ctx.db
        .query("beeperChats")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", contact.whatsapp!))
        .collect();
      
      for (const chat of allSingleChats) {
        if (chat.contactId !== args.contactId) {
          await ctx.db.patch(chat._id, {
            contactId: args.contactId,
            contactMatchedAt: now,
          });
          updated++;
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
      // Check if this chat still matches this contact
      const matchesInstagram = contact.instagram && chat.username === contact.instagram;
      const matchesWhatsapp = contact.whatsapp && chat.phoneNumber === contact.whatsapp;
      
      if (!matchesInstagram && !matchesWhatsapp) {
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
          const newMatch = await ctx.db
            .query("contacts")
            .withIndex("by_whatsapp", (q) => q.eq("whatsapp", chat.phoneNumber!))
            .first();
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

