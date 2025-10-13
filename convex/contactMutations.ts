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
 * Update contact connection type (local-only, doesn't sync to Dex)
 */
export const updateContactConnection = mutation({
  args: {
    contactId: v.id("contacts"),
    connection: v.union(
      v.literal("Professional"),
      v.literal("Friend"),
      v.literal("Good friend"),
      v.literal("Romantic"),
      v.literal("Other")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      connection: args.connection,
      lastModifiedAt: Date.now(),
    });

    return { success: true };
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

