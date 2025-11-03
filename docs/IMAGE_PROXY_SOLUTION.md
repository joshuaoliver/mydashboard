# Image Proxy Solution & Limitations

## Current Problem

After reviewing the Beeper API spec and your tunnel setup, we've hit a fundamental limitation:

### What We Know

1. **Only documented endpoint**: `/v1/assets/download`
   - Accepts: `mxc://` or `localmxc://` URLs only
   - Returns: `file://` URLs (local file paths)

2. **Your tunnel** (`beeper.bywave.com.au`):
   - Forwards documented API endpoints to `localhost:23373`
   - May not forward undocumented Matrix endpoints

3. **Browser security**:
   - Cannot load `mxc://` URLs (unknown protocol)
   - Cannot load `file://` URLs (local file access blocked)

### The Catch-22

```
mxc:// URL → /v1/assets/download → file:// URL → ??? 
                                    ↑
                            Can't access from browser!
```

## Attempted Solution

We created a Convex HTTP proxy that:
1. Calls `/v1/assets/download` to convert `mxc://` → `file://`
2. Extracts media ID from file path
3. Attempts to fetch from Matrix endpoints: `/_matrix/media/r0/download/{mediaId}`

**This requires** that `beeper.bywave.com.au` supports Matrix media endpoints.

## Testing Required

Run this test to check if Matrix endpoints work:

```bash
node test-matrix-endpoint.js
```

**If successful**, you'll see:
```
✅ WORKING ENDPOINT FOUND: /_matrix/media/r0/download/...
```

**If it fails**, Matrix endpoints aren't available through your tunnel.

## Solution Options

### Option 1: ✅ Configure Tunnel to Support Matrix Endpoints

Update your `beeper.bywave.com.au` tunnel configuration to also forward:
- `/_matrix/media/r0/download/*`
- `/_matrix/media/v3/download/*`
- `/_matrix/media/v1/download/*`

**If this works**: Images will load through the Convex HTTP proxy! ✅

### Option 2: Check Beeper Desktop Direct Serving

Some versions of Beeper Desktop might serve media at:
- `http://localhost:23373/_matrix/media/...`

But since Convex can't access localhost, this won't help unless the tunnel forwards it.

### Option 3: Alternative - Client-Side with Cloudflare Tunnel

If you run a Cloudflare tunnel or similar on your machine:
1. Tunnel exposes `localhost:23373` as `https://your-tunnel.com`
2. Browser can fetch images from `https://your-tunnel.com/_matrix/media/...`
3. No Convex proxy needed

### Option 4: Accept Limitation

For now, images won't load. You can:
- Display placeholder icons for image attachments
- Show filename/size info
- Add a "View in Beeper" button that opens the native app

## Current Implementation Status

### ✅ Implemented
- Schema supports attachments
- Sync extracts attachment metadata
- UI component (`ProxiedImage`) handles proxy logic
- Convex HTTP endpoint (`/image-proxy`) ready

### ⚠️ Blocked
- Waiting to confirm if Matrix endpoints work through tunnel
- Images won't load until this is resolved

## Recommendation

**Test the Matrix endpoints first**. If they work through `beeper.bywave.com.au`, images will just work. If not, we need to either:
1. Configure the tunnel to support them, or
2. Implement Option 3/4

## Files Ready

1. `convex/http.ts` - HTTP proxy endpoint
2. `src/components/messages/ProxiedImage.tsx` - Component
3. `src/components/messages/ChatDetail.tsx` - Integration

Everything is implemented and ready to go as soon as Matrix endpoints are accessible!

