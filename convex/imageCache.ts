import { action, internalMutation, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Beeper Media Server Configuration
const BEEPER_MEDIA_SERVER = process.env.BEEPER_MEDIA_SERVER || "https://beeperimage.bywave.com.au";
const BEEPER_MEDIA_TOKEN = process.env.BEEPER_MEDIA_TOKEN || "1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9";

/**
 * Get cached image URL or cache it if not found
 * This is the main function used at query time
 * 
 * @param sourceUrl - Original file:// URL from Beeper
 * @returns Convex storage URL or null if unavailable
 */
export const getCachedImageUrl = query({
  args: {
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.sourceUrl) return null;
    
    // Skip non-file URLs
    if (!args.sourceUrl.startsWith('file://')) {
      return args.sourceUrl; // Return as-is for HTTP/HTTPS
    }
    
    // Look up in cache
    const cached = await ctx.db
      .query("cachedImages")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();
    
    if (cached) {
      return cached.convexUrl;
    }
    
    // Not cached yet - return null (frontend will show fallback)
    return null;
  },
});

/**
 * Helper to check if image is already cached
 */
export const checkIfCached = internalMutation({
  args: { sourceUrl: v.string() },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("cachedImages")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();
    
    return cached?.convexUrl || null;
  },
});

/**
 * Helper function to cache a single image (used internally)
 */
async function cacheImageHelper(ctx: any, sourceUrl: string): Promise<string | null> {
  try {
    // Check if already cached
    const existing = await ctx.runMutation(internal.imageCache.checkIfCached, { sourceUrl });
    
    if (existing) {
      return existing;
    }
    
    // Skip non-file URLs
    if (!sourceUrl.startsWith('file://')) {
      return sourceUrl;
    }

    // Convert file:// URL to media server URL
    const decodedUrl = decodeURIComponent(sourceUrl);
    const mediaMatch = decodedUrl.match(/\/media\/(.+)$/);
    
    if (!mediaMatch) {
      console.error(`[ImageCache] Invalid file URL format: ${sourceUrl}`);
      return null;
    }
    
    const mediaPath = mediaMatch[1];
    const mediaServerUrl = `${BEEPER_MEDIA_SERVER}/${mediaPath}?token=${BEEPER_MEDIA_TOKEN}`;
    
    // Fetch the image from media server
    const response = await fetch(mediaServerUrl);
    
    if (!response.ok) {
      console.error(`[ImageCache] Media server error ${response.status}`);
      return null;
    }
    
    // Get the image as a blob
    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Upload to Convex storage
    const storageId = await ctx.storage.store(blob);
    
    // Get the public URL
    const convexUrl = await ctx.storage.getUrl(storageId);
    
    if (!convexUrl) {
      console.error(`[ImageCache] Failed to get storage URL`);
      return null;
    }
    
    // Store in cache table
    await ctx.runMutation(internal.imageCache.storeCachedImage, {
      sourceUrl,
      convexStorageId: storageId,
      convexUrl,
      contentType,
      fileSize: blob.size,
    });
    
    console.log(`[ImageCache] ✅ Cached (${blob.size} bytes)`);
    
    return convexUrl;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ImageCache] Error:`, errorMsg);
    return null;
  }
}

/**
 * Cache a single image to Convex storage (public action)
 * Returns the Convex URL or null if failed
 */
export const cacheImage = action({
  args: {
    sourceUrl: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    return await cacheImageHelper(ctx, args.sourceUrl);
  },
});

/**
 * Store cached image metadata in database
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
    // Check if already exists (race condition prevention)
    const existing = await ctx.db
      .query("cachedImages")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();
    
    if (existing) {
      console.log(`[ImageCache] Already stored in DB (race condition avoided)`);
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
    
    return id;
  },
});

/**
 * Helper to list chats with profile images
 */
export const listChatsWithImages = internalMutation({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const allChats = await ctx.db
      .query("beeperChats")
      .filter((q) => q.neq(q.field("participantImgURL"), undefined))
      .take(args.limit);
    
    return allChats.map(chat => ({
      chatId: chat.chatId,
      participantImgURL: chat.participantImgURL as string,
    }));
  },
});

/**
 * Cache all profile images from chats
 * Processes all chats and caches any file:// URLs found in participantImgURL
 */
export const cacheAllProfileImages = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10000;
    
    // Get all chats with profile images
    const chats = await ctx.runMutation(internal.imageCache.listChatsWithImages, { limit });
    
    if (chats.length === 0) {
      console.log(`[ImageCache] No chats with profile images found`);
      return { processed: 0, success: 0, failed: 0, skipped: 0 };
    }
    
    console.log(`[ImageCache] Found ${chats.length} chats with profile images`);
    
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    
    // Process in parallel batches
    const batchSize = 10;
    const totalBatches = Math.ceil(chats.length / batchSize);
    
    for (let i = 0; i < chats.length; i += batchSize) {
      const batch = chats.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      console.log(`[ImageCache] Processing batch ${batchNum}/${totalBatches} (${batch.length} images)...`);
      
      await Promise.all(
        batch.map(async (chat: { chatId: string; participantImgURL: string }) => {
          try {
            // Cache this image (cacheImage will check if already cached)
            const cachedUrl = await cacheImageHelper(ctx, chat.participantImgURL);
            
            if (cachedUrl) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            console.error(`[ImageCache] Error caching image for chat ${chat.chatId}:`, error);
            failCount++;
          }
        })
      );
      
      console.log(`[ImageCache] Batch ${batchNum}/${totalBatches} complete - Total: ${successCount} cached, ${failCount} failed, ${skippedCount} skipped`);
    }
    
    console.log(`[ImageCache] ✅ COMPLETED: ${successCount} images cached, ${failCount} failed, ${skippedCount} already cached`);
    
    return {
      processed: chats.length,
      success: successCount,
      failed: failCount,
      skipped: skippedCount,
    };
  },
});

/**
 * List all chats that have profile images
 */
export const listChatsWithProfileImages = query({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const allChats = await ctx.db
      .query("beeperChats")
      .filter((q) => q.neq(q.field("participantImgURL"), undefined))
      .take(args.limit);
    
    return allChats.map(chat => ({
      chatId: chat.chatId,
      participantImgURL: chat.participantImgURL as string,
    }));
  },
});

/**
 * Get cache statistics
 */
export const getCacheStats = query({
  args: {},
  handler: async (ctx) => {
    const totalCached = await ctx.db
      .query("cachedImages")
      .collect();
    
    const chatsWithImages = await ctx.db
      .query("beeperChats")
      .filter((q) => q.neq(q.field("participantImgURL"), undefined))
      .collect();
    
    const totalSize = totalCached.reduce((sum, img) => sum + img.fileSize, 0);
    
    return {
      totalCachedImages: totalCached.length,
      totalChatsWithImages: chatsWithImages.length,
      totalStorageBytes: totalSize,
      totalStorageMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
    };
  },
});
