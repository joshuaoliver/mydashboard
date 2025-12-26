import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * List all locations sorted by usage count (most used first)
 * Falls back to alphabetical if no usage data
 */
export const listLocations = query({
  handler: async (ctx) => {
    const locations = await ctx.db
      .query("locations")
      .collect();

    // Sort by usage count (highest first), then alphabetically for ties
    return locations.sort((a, b) => {
      const aCount = a.useCount ?? 0;
      const bCount = b.useCount ?? 0;
      
      // Sort by usage count descending
      if (aCount !== bCount) {
        return bCount - aCount;
      }
      
      // Tie-breaker: alphabetical
      return a.name.localeCompare(b.name);
    });
  },
});

/**
 * Increment the usage count for a location
 * Call this when a location is assigned to a contact
 */
export const incrementLocationUse = mutation({
  args: { 
    locationId: v.id("locations") 
  },
  handler: async (ctx, args) => {
    const loc = await ctx.db.get(args.locationId);
    if (loc) {
      await ctx.db.patch(args.locationId, { 
        useCount: (loc.useCount ?? 0) + 1 
      });
    }
  },
});
