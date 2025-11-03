import { query } from "./_generated/server";

/**
 * List all locations ordered by creation time
 */
export const listLocations = query({
  handler: async (ctx) => {
    const locations = await ctx.db
      .query("locations")
      .order("desc")
      .collect();

    return locations;
  },
});

