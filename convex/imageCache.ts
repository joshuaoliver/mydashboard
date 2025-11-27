import { action, query, mutation } from "./_generated/server";
import { api } from "./_generated/api.js";
import { v } from "convex/values";

// Beeper Media Server Configuration
const BEEPER_MEDIA_SERVER = process.env.BEEPER_MEDIA_SERVER || "https://beeperimage.bywave.com.au";
const BEEPER_MEDIA_TOKEN = process.env.BEEPER_MEDIA_TOKEN || "1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9";

/**
 * Get cached image URL or return null if not cached
 * Used at query time to look up profile pictures
 */
export const getCachedImageUrl = query({
  args: {
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up in cache
    const cached = await ctx.db
      .query("cachedImages")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();
    
    return cached?.convexUrl || null;
  },
});

/**
 * Store cached image in database
 */
export const storeCachedImage = mutation({
  args: {
    sourceUrl: v.string(),
    convexStorageId: v.string(),
    convexUrl: v.string(),
    contentType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("cachedImages")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();
    
    if (existing) {
      return existing._id;
    }
    
    // Insert new cached image
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
 * Cache all profile images from Beeper chats
 * Self-contained action that handles everything inline
 */
export const cacheAllProfileImages = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10000;
    
    let successCount = 0;
    let failCount = 0;
    
    // Get chats that still need caching via helper query
    const chatsData = await ctx.runQuery(api.imageCache.listChatsNeedingCache, { limit }) as Array<{
      chatId: string;
      participantImgURL: string;
    }>;
    
    if (chatsData.length === 0) {
      return { processed: 0, success: 0, failed: 0 };
    }
    
    // Process in parallel batches
    const batchSize = 10;
    const totalBatches = Math.ceil(chatsData.length / batchSize);
    
    for (let i = 0; i < chatsData.length; i += batchSize) {
      const batch = chatsData.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      console.log(`[ImageCache] Batch ${batchNum}/${totalBatches} (${batch.length} images)...`);
      
      const results = await Promise.allSettled(
        batch.map(async (chat: { chatId: string; participantImgURL: string }) => {
          const sourceUrl = chat.participantImgURL;
          
          const convexUrl = await cacheSingleImage(ctx, sourceUrl);
          return convexUrl ? { success: true } : { success: false };
        })
      );
      
      // Count successes and failures
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      });
    }

    return {
      processed: chatsData.length,
      success: successCount,
      failed: failCount,
    };
  },
});

/**
 * Cache a single image (public action)
 */
export const cacheImage = action({
  args: {
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    return await cacheSingleImage(ctx, args.sourceUrl);
  },
});

/**
 * List chats needing cache (internal query)
 */
export const listChatsNeedingCache = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const chats = await ctx.db
      .query("beeperChats")
      .filter((q) => q.neq(q.field("participantImgURL"), undefined))
      .take(args.limit);
    
    const results: Array<{ chatId: string; participantImgURL: string }> = [];
    
    for (const chat of chats) {
      if (!chat.participantImgURL) continue;
      const cached = await ctx.db
        .query("cachedImages")
        .withIndex("by_source_url", (q) => q.eq("sourceUrl", chat.participantImgURL!))
        .first();
      if (!cached) {
        results.push({
          chatId: chat.chatId,
          participantImgURL: chat.participantImgURL,
        });
      }
    }
    return results;
  },
});

// Helper shared by both actions
async function cacheSingleImage(ctx: any, sourceUrl: string): Promise<string | null> {
  if (!sourceUrl.startsWith("file://")) {
    return sourceUrl;
  }

  const existing = await ctx.runQuery(api.imageCache.getCachedImageUrl, { sourceUrl });
  if (existing) {
    return existing;
  }

  const decodedUrl = decodeURIComponent(sourceUrl);
  const mediaMatch = decodedUrl.match(/\/media\/(.+)$/);
  if (!mediaMatch) {
    return null;
  }

  const mediaPath = mediaMatch[1];
  const mediaServerUrl = `${BEEPER_MEDIA_SERVER}/${mediaPath}?token=${BEEPER_MEDIA_TOKEN}`;

  const response = await fetch(mediaServerUrl);
  if (!response.ok) {
    return null;
  }

  const blob = await response.blob();
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const storageId = await ctx.storage.store(blob);
  const convexUrl = await ctx.storage.getUrl(storageId);
  if (!convexUrl) {
    return null;
  }

  await ctx.runMutation(api.imageCache.storeCachedImage, {
    sourceUrl,
    convexStorageId: storageId,
    convexUrl,
    contentType,
    fileSize: blob.size,
  });

  return convexUrl;
}
