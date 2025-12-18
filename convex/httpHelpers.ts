import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get cached image URL by source URL
 * Used by HTTP routes to check if an image is already cached
 */
export const getCachedImageUrl = internalQuery({
  args: { sourceUrl: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("cachedImages")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();
    
    return cached?.convexUrl ?? null;
  },
});

/**
 * Store a cached image record
 * Called after successfully fetching and storing an image in Convex storage
 */
export const storeCachedImage = internalMutation({
  args: {
    sourceUrl: v.string(),
    convexStorageId: v.string(),
    convexUrl: v.string(),
    contentType: v.string(),
    fileSize: v.number(),
  },
  returns: v.id("cachedImages"),
  handler: async (ctx, args) => {
    // Check if already exists (upsert logic)
    const existing = await ctx.db
      .query("cachedImages")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        convexStorageId: args.convexStorageId,
        convexUrl: args.convexUrl,
        contentType: args.contentType,
        fileSize: args.fileSize,
        cachedAt: Date.now(),
      });
      return existing._id;
    }

    // Insert new record
    const id = await ctx.db.insert("cachedImages", {
      sourceUrl: args.sourceUrl,
      convexStorageId: args.convexStorageId,
      convexUrl: args.convexUrl,
      contentType: args.contentType,
      fileSize: args.fileSize,
      cachedAt: Date.now(),
    });

    return id;
  },
});
