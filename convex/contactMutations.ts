import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
 * Update intimate connection flag (local-only, PIN-protected)
 */
export const updateIntimateConnection = mutation({
  args: {
    contactId: v.id("contacts"),
    intimateConnection: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      intimateConnection: args.intimateConnection,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Create a new contact (user-initiated, no dexId yet)
 * When Dex sync runs later, it will match by Instagram username and adopt this contact
 */
export const createContact = mutation({
  args: {
    instagram: v.optional(v.string()),
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

    // Create new contact (no dexId - will be added when Dex sync finds a match)
    const contactId = await ctx.db.insert("contacts", {
      instagram: args.instagram,
      firstName: args.firstName,
      lastName: args.lastName,
      description: args.description,
      lastSyncedAt: now,
      lastModifiedAt: now,
    });

    return { contactId, existed: false };
  },
});

/**
 * Update lead status (local-only)
 */
export const updateLeadStatus = mutation({
  args: {
    contactId: v.id("contacts"),
    leadStatus: v.union(
      v.literal("Talking"),
      v.literal("Planning"),
      v.literal("Dated"),
      v.literal("Connected"),
      v.null()
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      leadStatus: args.leadStatus ?? undefined,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
  },
});

