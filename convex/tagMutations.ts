import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create a new tag
 */
export const createTag = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if tag already exists
    const existing = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      return { tagId: existing._id, existed: true };
    }

    const tagId = await ctx.db.insert("tags", {
      name: args.name,
      color: args.color,
      createdAt: Date.now(),
    });

    return { tagId, existed: false };
  },
});

/**
 * Toggle a tag on a contact
 */
export const toggleTag = mutation({
  args: {
    contactId: v.id("contacts"),
    tagId: v.id("tags"),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    const currentTags = contact.tagIds || [];
    const hasTag = currentTags.includes(args.tagId);

    const updatedTags = hasTag
      ? currentTags.filter((id) => id !== args.tagId)
      : [...currentTags, args.tagId];

    await ctx.db.patch(args.contactId, {
      tagIds: updatedTags.length > 0 ? updatedTags : undefined,
      lastModifiedAt: Date.now(),
    });

    return { success: true, added: !hasTag };
  },
});

/**
 * Delete a tag
 */
export const deleteTag = mutation({
  args: {
    tagId: v.id("tags"),
  },
  handler: async (ctx, args) => {
    // Remove tag from all contacts first
    const contactsWithTag = await ctx.db
      .query("contacts")
      .filter((q) => q.neq(q.field("tagIds"), undefined))
      .collect();

    for (const contact of contactsWithTag) {
      if (contact.tagIds?.includes(args.tagId)) {
        await ctx.db.patch(contact._id, {
          tagIds: contact.tagIds.filter((id) => id !== args.tagId),
          lastModifiedAt: Date.now(),
        });
      }
    }

    // Delete the tag
    await ctx.db.delete(args.tagId);

    return { success: true };
  },
});

