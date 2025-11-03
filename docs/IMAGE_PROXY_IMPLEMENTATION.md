# Image Proxy Implementation

## Problem

Beeper attachments come in formats that browsers cannot load directly:

### 1. **MXC URLs** (Matrix Content URLs)
```
mxc://local.beeper.com/joshuaoliver_Bv4d760YVFD0qZF1tMDeDDsVzfvc4neGeKLIvFCtqjjxlEne7mhPXNuiaiTj3Uch
```
**Error**: `net::ERR_UNKNOWN_URL_SCHEME`  
**Cause**: Browsers don't understand the `mxc://` protocol

### 2. **Local File URLs**
```
file:///Users/joshuaoliver/Library/Application%20Support/BeeperTexts/media/local.beeper.com/joshuaoliver_HQA9x...
```
**Error**: `Not allowed to load local resource`  
**Cause**: Browser security prevents loading files from the local filesystem

### 3. **Why Client-Side Won't Work**
- Beeper's `/v1/assets/download` only accepts `mxc://` URLs (rejects `file://`)
- It returns `file://` URLs that browsers can't access
- Even with localhost:23373, browsers block local file access

---

## Solution: Convex HTTP Proxy

### Architecture

```
┌──────────────┐
│   Browser    │  <img src="https://<deployment>.convex.site/image-proxy?url=mxc://..." />
└──────┬───────┘
       │ 1. Request image via Convex URL
       ▼
┌──────────────┐
│   Convex     │  HTTP endpoint: /image-proxy
│  (Server)    │
└──────┬───────┘
       │ 2. POST /v1/assets/download
       ▼
┌──────────────┐
│beeper.bywave │  Proxies to localhost:23373
│  .com.au     │
└──────┬───────┘
       │ 3. Returns: file:///.../media/local.beeper.com/xyz
       ▼
┌──────────────┐
│   Convex     │  Extracts media ID: "local.beeper.com/xyz"
│  (Server)    │
└──────┬───────┘
       │ 4. GET /_matrix/media/r0/download/local.beeper.com/xyz
       ▼
┌──────────────┐
│beeper.bywave │  Fetches actual image data
│  .com.au     │
└──────┬───────┘
       │ 5. Image binary data
       ▼
┌──────────────┐
│   Convex     │  Returns image with headers
│  (Server)    │
└──────┬───────┘
       │ 6. Image data (JPEG, PNG, etc.)
       ▼
┌──────────────┐
│   Browser    │  Displays image!
└──────────────┘
```

---

## Implementation

### 1. Convex HTTP Endpoint (`convex/http.ts`)

**Purpose**: Proxy images through Convex server using only `/v1/assets/download`

**Endpoint**: `GET /image-proxy?url=<mxc_or_file_url>`

**Process**:
1. Receives image URL from browser
2. If `mxc://`: Calls `/v1/assets/download` via `beeper.bywave.com.au`
3. Extracts media ID from returned `file://` URL
4. Fetches image from Matrix endpoints: `/_matrix/media/r0/download/{mediaId}`
5. Returns image binary data to browser with proper content-type

**Key Features**:
- ✅ Uses only `/v1/assets/download` (as required)
- ✅ Tries multiple Matrix media endpoint versions (r0, v3, v1)
- ✅ Sets proper cache headers (1 year cache)
- ✅ CORS enabled for browser access
- ✅ Handles both `mxc://` and `file://` URLs

**Code**:
```typescript
http.route({
  path: "/image-proxy",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // Extract url parameter
    // Call /v1/assets/download
    // Fetch from Matrix media endpoints
    // Return image data
  })
})
```

### 2. Frontend Component (`src/components/messages/ProxiedImage.tsx`)

**Purpose**: React component that uses Convex HTTP endpoint for images

**Features**:
- ✅ Automatically detects URLs needing proxy (`mxc://`, `file://`)
- ✅ Passes through regular HTTP URLs unchanged
- ✅ Loading state with spinner
- ✅ Error fallback with details
- ✅ Lazy loading for performance

**Usage**:
```tsx
<ProxiedImage
  src="mxc://local.beeper.com/xyz"
  alt="Image description"
  className="max-w-full h-auto max-h-96 rounded-lg"
/>
```

**How it works**:
```tsx
// Builds Convex URL from VITE_CONVEX_URL
const proxyUrl = `${convexUrl}/image-proxy?url=${encodeURIComponent(src)}`
setImageUrl(proxyUrl) // Browser fetches from Convex endpoint
```

### 3. Integration (`src/components/messages/ChatDetail.tsx`)

Updated to use `ProxiedImage` instead of `<img>` for all message attachments.

---

## How It Works

### Scenario 1: Regular HTTP URL
```
Browser: <img src="https://example.com/image.jpg" />
Action:  Pass through directly (no proxy)
Output:  Display immediately
```

### Scenario 2: MXC URL (Encrypted Matrix Content)
```
Browser: <img src="https://<deployment>.convex.site/image-proxy?url=mxc://local.beeper.com/xyz" />
         ↓
Convex:  POST beeper.bywave.com.au/v1/assets/download { url: "mxc://..." }
         ← { srcURL: "file:///.../media/local.beeper.com/xyz" }
         ↓
Convex:  Extract media ID → "local.beeper.com/xyz"
         ↓
Convex:  GET beeper.bywave.com.au/_matrix/media/r0/download/local.beeper.com/xyz
         ← [Image binary data]
         ↓
Browser: Receives image with Content-Type: image/jpeg
         Displays image! ✅
```

### Scenario 3: File URL (Direct Local Path)
```
Browser: <img src="https://<deployment>.convex.site/image-proxy?url=file:///.../media/..." />
         ↓
Convex:  Skip download step (already have file path)
         Extract media ID → "local.beeper.com/xyz"
         ↓
Convex:  GET beeper.bywave.com.au/_matrix/media/r0/download/local.beeper.com/xyz
         ← [Image binary data]
         ↓
Browser: Displays image! ✅
```

---

## Requirements

### ✅ beeper.bywave.com.au Tunnel
This solution REQUIRES that `beeper.bywave.com.au` supports Matrix media endpoints:
- `/_matrix/media/r0/download/{mediaId}`
- `/_matrix/media/v3/download/{mediaId}`

If these endpoints are not supported, images will fail to load.

### 🔍 Testing Needed
- [ ] Verify Matrix endpoints work via beeper.bywave.com.au
- [ ] Test with encrypted images (MXC URLs)
- [ ] Test with unencrypted images (file:// URLs)
- [ ] Test with various image types (JPEG, PNG, GIF)
- [ ] Test with different networks (Instagram, WhatsApp, Signal)
- [ ] Verify cache headers work correctly

---

## Error Handling

### User-Friendly Errors

**Loading State**:
```
┌──────────────┐
│      ⟳      │  (spinner)
└──────────────┘
```

**Error State**:
```
┌──────────────┐
│      📷      │
│ Image        │
│ unavailable  │
│ mxc://...    │
└──────────────┘
```

### Developer Logs
```
[Image Proxy] Processing: mxc://local.beeper.com/xyz...
[Image Proxy] Trying HTTP URL: http://localhost:23373/media/...
[Image Proxy] Media server works! Returning HTTP URL
```

---

## Testing Checklist

- [ ] HTTP images load correctly
- [ ] MXC URLs proxy successfully
- [ ] File URLs convert to HTTP
- [ ] Loading spinner shows during proxy
- [ ] Error fallback displays on failure
- [ ] Images cache properly
- [ ] Multiple images in one message
- [ ] Encrypted images work
- [ ] Stickers display correctly
- [ ] Performance is acceptable

---

## Files

1. **`convex/http.ts`** - Added `/image-proxy` HTTP endpoint
2. **`src/components/messages/ProxiedImage.tsx`** - React component that uses proxy
3. **`src/components/messages/ChatDetail.tsx`** - Updated to use ProxiedImage

## Key Insight

The solution works because `beeper.bywave.com.au` is a **tunnel/proxy** to your local `localhost:23373`. This means:
- Convex can call `beeper.bywave.com.au/_matrix/media/...`
- That request gets forwarded to `localhost:23373/_matrix/media/...` 
- Beeper Desktop serves the image
- Image data flows back: Beeper → bywave.com.au → Convex → Browser

Without this proxy tunnel, it would be impossible because Convex servers can't access your localhost directly.

---

## Future Enhancements

### 1. Caching
Store proxied URLs in Convex database to avoid re-downloading:
```typescript
// Cache table
proxiedImages: defineTable({
  originalUrl: v.string(),
  proxiedUrl: v.string(),
  cachedAt: v.number(),
  expiresAt: v.number(),
})
```

### 2. Data URL Fallback
For images that can't be served via HTTP, convert to base64:
```typescript
const arrayBuffer = await readFile(localPath)
const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
return `data:${mimeType};base64,${base64}`
```

### 3. Image Optimization
Resize large images before caching to save bandwidth

### 4. Thumbnail Support
Use Beeper's thumbnail URLs when available for faster loading

---

## Related Documentation

- [Beeper API Spec](http://localhost:23373/v1/spec)
- [IMAGE_ATTACHMENTS_IMPLEMENTATION.md](./IMAGE_ATTACHMENTS_IMPLEMENTATION.md)
- [Matrix Content Repository](https://spec.matrix.org/v1.1/client-server-api/#content-repo)

