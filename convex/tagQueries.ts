import { query } from "./_generated/server";

/**
 * List all tags
 */
export const listTags = query({
  args: {},
  handler: async (ctx) => {
    const tags = await ctx.db
      .query("tags")
      .order("asc")
      .collect();

    return tags;
  },
});

