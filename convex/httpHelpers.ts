import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal helpers for HTTP actions
 * These allow httpAction handlers to interact with the database
 */

/**
 * Get cached image URL by source URL
 * Returns the Convex storage URL if cached, null otherwise
 */
export const getCachedImageUrl = internalQuery({
  args: {
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("cachedImages")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();
    
    return cached?.convexUrl || null;
  },
});

/**
 * Store a cached image record
 * Called after uploading to Convex storage
 */
export const storeCachedImage = internalMutation({
  args: {
    sourceUrl: v.string(),
    convexStorageId: v.string(),
    convexUrl: v.string(),
    contentType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if already exists (race condition protection)
    const existing = await ctx.db
      .query("cachedImages")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();
    
    if (existing) {
      // Already cached by another request
      return existing._id;
    }
    
    // Insert new cached image record
    const id = await ctx.db.insert("cachedImages", {
      sourceUrl: args.sourceUrl,
      convexStorageId: args.convexStorageId,
      convexUrl: args.convexUrl,
      contentType: args.contentType,
      fileSize: args.fileSize,
      cachedAt: Date.now(),
    });
    
    console.log(`[httpHelpers] Cached image: ${args.sourceUrl.substring(0, 50)}... -> ${args.convexStorageId}`);
    
    return id;
  },
});
