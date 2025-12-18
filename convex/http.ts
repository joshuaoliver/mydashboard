import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Image Proxy Endpoint
 * 
 * Proxies Beeper images to the browser with Convex storage caching:
 * 1. Check if image is already cached in Convex storage
 * 2. If cached, redirect to the cached URL (fast!)
 * 3. If not cached:
 *    a. Convert mxc:// to file:// via /v1/assets/download
 *    b. Fetch image data from Matrix media endpoints
 *    c. Store in Convex file storage
 *    d. Save cache record to database
 *    e. Return the image
 * 
 * Benefits:
 * - Images persist even when Beeper backend (mobile) is offline
 * - Faster subsequent loads from Convex CDN
 * - Deduplication across all users/sessions
 * 
 * Usage: GET /image-proxy?url=mxc://...
 */
http.route({
  path: "/image-proxy",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const srcURL = url.searchParams.get("url");

    if (!srcURL) {
      return new Response("Missing url parameter", { status: 400 });
    }

    const BEEPER_API_URL = process.env.BEEPER_API_URL || "http://localhost:23373";
    const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

    if (!BEEPER_TOKEN) {
      return new Response("BEEPER_TOKEN not configured", { status: 500 });
    }

    try {
      // If it's a regular HTTP URL, redirect to it
      if (srcURL.startsWith('http://') || srcURL.startsWith('https://')) {
        return Response.redirect(srcURL, 302);
      }

      // Step 0: Check if already cached in Convex storage
      const cachedUrl = await ctx.runQuery(internal.httpHelpers.getCachedImageUrl, { 
        sourceUrl: srcURL 
      });
      
      if (cachedUrl) {
        console.log(`[Image Proxy] ✅ Cache HIT - redirecting to Convex storage`);
        return Response.redirect(cachedUrl, 302);
      }

      console.log(`[Image Proxy] Cache MISS - fetching from Beeper: ${srcURL.substring(0, 60)}...`);

      // Step 1: Convert mxc:// to file:// using download endpoint
      let fileUrl = srcURL;
      
      if (srcURL.startsWith('mxc://') || srcURL.startsWith('localmxc://')) {
        console.log(`[Image Proxy] Converting MXC to file path...`);
        const downloadResponse = await fetch(`${BEEPER_API_URL}/v1/assets/download`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${BEEPER_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: srcURL }),
        });

        if (!downloadResponse.ok) {
          const errorText = await downloadResponse.text();
          console.error(`[Image Proxy] Download failed:`, errorText);
          return new Response(`Download failed: ${downloadResponse.status}`, { status: 502 });
        }

        const downloadResult = await downloadResponse.json() as { srcURL?: string; error?: string };
        
        if (downloadResult.error || !downloadResult.srcURL) {
          return new Response(downloadResult.error || 'No srcURL in response', { status: 502 });
        }

        fileUrl = downloadResult.srcURL;
        console.log(`[Image Proxy] MXC converted to: ${fileUrl.substring(0, 80)}...`);
      }

      // Step 2: Extract media ID from file:// URL
      // Format: file:///.../BeeperTexts/media/local.beeper.com/joshuaoliver_ABC123
      const mediaMatch = fileUrl.match(/media\/(.+?)$/);
      if (!mediaMatch) {
        return new Response('Cannot extract media ID from file path', { status: 500 });
      }

      const mediaId = mediaMatch[1];
      console.log(`[Image Proxy] Media ID: ${mediaId.substring(0, 50)}...`);

      // Step 3: Try Matrix media endpoints to fetch the actual file
      const endpoints = [
        `/_matrix/media/r0/download/${mediaId}`,
        `/_matrix/media/v3/download/${mediaId}`,
        `/_matrix/media/v1/download/${mediaId}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const fetchUrl = `${BEEPER_API_URL}${endpoint}`;
          console.log(`[Image Proxy] Trying: ${endpoint}`);
          
          const response = await fetch(fetchUrl, {
            headers: { 'Authorization': `Bearer ${BEEPER_TOKEN}` }
          });

          if (response.ok) {
            console.log(`[Image Proxy] ✅ Success with ${endpoint}`);
            
            // Get image data and content type
            const imageData = await response.arrayBuffer();
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const fileSize = imageData.byteLength;
            
            console.log(`[Image Proxy] Fetched ${Math.round(fileSize / 1024)}KB as ${contentType}`);
            
            // Step 4: Store in Convex file storage for future requests
            try {
              const blob = new Blob([imageData], { type: contentType });
              const storageId = await ctx.storage.store(blob);
              const convexUrl = await ctx.storage.getUrl(storageId);
              
              if (convexUrl) {
                // Save cache record to database
                await ctx.runMutation(internal.httpHelpers.storeCachedImage, {
                  sourceUrl: srcURL,
                  convexStorageId: storageId,
                  convexUrl,
                  contentType,
                  fileSize,
                });
                
                console.log(`[Image Proxy] ✅ Cached to Convex storage: ${storageId}`);
                
                // Redirect to the cached URL for future-proof caching
                return Response.redirect(convexUrl, 302);
              }
            } catch (cacheErr) {
              // Caching failed, but we still have the image data - return it directly
              console.error(`[Image Proxy] Failed to cache, returning directly:`, cacheErr);
            }
            
            // Return the image directly (fallback if caching failed)
            return new Response(imageData, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
                'Access-Control-Allow-Origin': '*', // Allow CORS
              },
            });
          }
        } catch (err) {
          // Try next endpoint
          continue;
        }
      }

      // All endpoints failed
      console.error(`[Image Proxy] All Matrix endpoints failed for ${mediaId}`);
      return new Response('Cannot access image from Beeper', { status: 502 });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Image Proxy] Error:', errorMsg);
      return new Response(errorMsg, { status: 500 });
    }
  }),
});

export default http;

