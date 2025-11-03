import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create a new location
 */
export const createLocation = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const locationId = await ctx.db.insert("locations", {
      name: args.name,
      createdAt: now,
    });

    return locationId;
  },
});

/**
 * Delete a location
 */
export const deleteLocation = mutation({
  args: {
    id: v.id("locations"),
  },
  handler: async (ctx, args) => {
    // Remove the location reference from any contacts that have it
    const allContacts = await ctx.db.query("contacts").collect();
    
    for (const contact of allContacts) {
      if (contact.locationIds?.includes(args.id)) {
        const newLocationIds = contact.locationIds.filter((id) => id !== args.id);
        await ctx.db.patch(contact._id, {
          locationIds: newLocationIds,
        });
      }
    }

    // Delete the location
    await ctx.db.delete(args.id);
  },
});

/**
 * Update a location's name
 */
export const updateLocation = mutation({
  args: {
    id: v.id("locations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      name: args.name,
    });
  },
});

