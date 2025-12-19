import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create a new location
 */
export const createLocation = mutation({
  args: {
    name: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const locationId = await ctx.db.insert("locations", {
      name: args.name,
      latitude: args.latitude,
      longitude: args.longitude,
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
 * Update a location's name and coordinates
 */
export const updateLocation = mutation({
  args: {
    id: v.id("locations"),
    name: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: Partial<{ name: string; latitude: number; longitude: number }> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.latitude !== undefined) updates.latitude = args.latitude;
    if (args.longitude !== undefined) updates.longitude = args.longitude;
    
    await ctx.db.patch(args.id, updates);
  },
});

/**
 * Seed locations - bulk create locations with coordinates
 * Used for initial population of the locations table
 */
export const seedLocations = mutation({
  args: {
    locations: v.array(v.object({
      name: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results: { name: string; id: string; status: "created" | "exists" }[] = [];
    
    for (const location of args.locations) {
      // Check if location already exists by name
      const existing = await ctx.db
        .query("locations")
        .withIndex("by_name", (q) => q.eq("name", location.name))
        .first();
      
      if (existing) {
        // Update coordinates if they're missing
        if (existing.latitude === undefined || existing.longitude === undefined) {
          await ctx.db.patch(existing._id, {
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }
        results.push({ name: location.name, id: existing._id, status: "exists" });
      } else {
        const id = await ctx.db.insert("locations", {
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          createdAt: now,
        });
        results.push({ name: location.name, id, status: "created" });
      }
    }
    
    return results;
  },
});

