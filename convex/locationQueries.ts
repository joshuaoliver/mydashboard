import { query } from "./_generated/server";

// Priority locations that should appear at the top of the dropdown
const PRIORITY_LOCATIONS = ["Sydney", "Melbourne", "Brisbane", "Gold Coast", "Perth"];

/**
 * List all locations with priority locations first
 */
export const listLocations = query({
  handler: async (ctx) => {
    const locations = await ctx.db
      .query("locations")
      .order("desc")
      .collect();

    // Sort with priority locations first, then alphabetically
    return locations.sort((a, b) => {
      const aPriority = PRIORITY_LOCATIONS.indexOf(a.name);
      const bPriority = PRIORITY_LOCATIONS.indexOf(b.name);

      // Both are priority locations - sort by priority order
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      // Only a is priority - a comes first
      if (aPriority !== -1) return -1;
      // Only b is priority - b comes first
      if (bPriority !== -1) return 1;
      // Neither is priority - alphabetical
      return a.name.localeCompare(b.name);
    });
  },
});

