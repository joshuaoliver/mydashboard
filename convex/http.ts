import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Image Proxy Endpoint
 * 
 * Proxies Beeper images to the browser by:
 * 1. Converting mxc:// to file:// via /v1/assets/download
 * 2. Extracting media ID from file path
 * 3. Fetching actual image data from Matrix media endpoints
 * 4. Returning image to browser
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

      console.log(`[Image Proxy] Processing: ${srcURL.substring(0, 80)}...`);

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
            
            console.log(`[Image Proxy] ✅ Returning ${Math.round(imageData.byteLength / 1024)}KB as ${contentType}`);
            
            // Return the image directly to the browser
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

