# Direct File Access for Images (Simplified Approach)

## Overview

Based on the [Beeper API changelog](https://developers.beeper.com/desktop-api/changelog), the `/v1/assets/download` endpoint now returns local `file://` URLs directly. This eliminates the need for a Convex image proxy.

## How It Works

### Simple Flow

```
1. Component receives mxc:// URL
2. Call Beeper API: POST localhost:23373/v1/assets/download
3. Get file:// URL back
4. Use file:// URL directly in <img> tag
5. Browser loads local file (with permissions enabled)
```

### No More Proxy!

**Old approach** (complex):
```
Browser → Convex proxy → Beeper API → Convex fetches image → Returns to browser
```

**New approach** (simple):
```
Browser → Beeper API → Returns file:// URL → Browser loads directly
```

## Implementation

### Frontend Component

**File**: `src/components/messages/ProxiedImage.tsx`

```typescript
// For mxc:// or localmxc:// URLs
const response = await fetch('http://localhost:23373/v1/assets/download', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: src }),
})

const data = await response.json()
// data.srcURL contains: file:///Users/.../media/local.beeper.com/xyz

// Use the file:// URL directly
<img src={data.srcURL} />
```

### Browser Configuration Required

For this to work, you **must** enable local file access in your browser:

1. Navigate to your site (e.g., `http://localhost:5174`)
2. Click the padlock or info icon in the address bar
3. Select **Site settings**
4. Find **File access** permission
5. Set to **Allow**

This allows the browser to load `file://` URLs from the local filesystem.

## API Reference

### Beeper `/v1/assets/download` Endpoint

**Source**: [Beeper API Documentation](https://developers.beeper.com/desktop-api-reference/resources/assets/methods/download)

**Endpoint**: `POST /v1/assets/download`

**Request**:
```json
{
  "url": "mxc://example.org/Q4x9CqGz1pB3Oa6XgJ"
}
```

**Response**:
```json
{
  "srcURL": "file:///Users/joshuaoliver/Library/Application Support/BeeperTexts/media/local.beeper.com/joshuaoliver_ABC123",
  "error": null
}
```

### Supported URL Formats

| Format | Example | Action |
|--------|---------|--------|
| `mxc://` | `mxc://local.beeper.com/xyz` | Call `/v1/assets/download` |
| `localmxc://` | `localmxc://local.beeper.com/xyz` | Call `/v1/assets/download` |
| `file://` | `file:///Users/.../media/xyz` | Use directly |
| `http://` or `https://` | `https://example.com/image.jpg` | Use directly |

## Benefits

### ✅ Advantages

1. **Simpler architecture** - No Convex proxy needed
2. **Faster loading** - Direct file access, no proxy overhead
3. **Less code to maintain** - Single API call instead of multi-step proxy
4. **Follows Beeper's design** - Uses the API as intended
5. **No server costs** - No data flowing through Convex

### ⚠️ Requirements

1. **Browser permissions** - Must enable local file access
2. **Localhost only** - Beeper API runs on `localhost:23373`
3. **Desktop only** - Requires Beeper Desktop running locally

## What Changed

### Updated Files

1. **`src/components/messages/ProxiedImage.tsx`**
   - Removed Convex proxy logic
   - Added direct Beeper API call
   - Simplified URL handling

2. **`convex/http.ts`**
   - Image proxy endpoint (`/image-proxy`) is now **obsolete** and can be removed
   - No longer needed for this approach

### Obsolete Files

The following files/approaches are no longer needed:

- `convex/http.ts` - `/image-proxy` endpoint
- `docs/IMAGE_PROXY_IMPLEMENTATION.md` - Old proxy approach
- `docs/IMAGE_PROXY_SOLUTION.md` - Old proxy solution
- Complex Matrix media endpoint fallback logic

## Testing

### Verify It Works

1. **Enable browser permissions**:
   - Navigate to `http://localhost:5174`
   - Click padlock → Site settings → File access → Allow

2. **Test image loading**:
   - Go to `/messages`
   - Open a chat with image attachments
   - Images should load directly from local files

3. **Check network tab**:
   ```
   POST http://localhost:23373/v1/assets/download
   Response: { "srcURL": "file:///.../image.jpg" }
   ```

4. **Check console**:
   - Should see no proxy-related errors
   - Images load directly from `file://` URLs

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Images don't load | Enable file access permissions in browser |
| API call fails | Ensure Beeper Desktop is running on localhost:23373 |
| CORS errors | Beeper localhost API should allow local requests |
| Empty srcURL | The asset may not be downloaded yet; Beeper will download it |

## Browser Permissions Guide

### Chrome/Edge

1. Click the **View site information** icon (padlock) in the address bar
2. Click **Site settings**
3. Find **File access** under Permissions
4. Select **Allow**

### Firefox

1. Type `about:config` in the address bar
2. Search for `security.fileuri.strict_origin_policy`
3. Set to `false` (enables file access)

### Safari

1. **Develop** menu → **Disable Local File Restrictions**
2. Or use a different browser for development

## Migration Notes

If you were using the old proxy approach:

1. ✅ **Updated**: `ProxiedImage.tsx` now calls Beeper API directly
2. ⚠️ **Can be removed**: `/image-proxy` endpoint in `convex/http.ts`
3. ✅ **Enable permissions**: Configure browser to allow file access
4. 🎉 **Simpler**: No more complex proxy logic!

## Related Documentation

- [Beeper API Changelog](https://developers.beeper.com/desktop-api/changelog)
- [Download Asset API Reference](https://developers.beeper.com/desktop-api-reference/resources/assets/methods/download)
- [Beeper v4.1.210+ Release Notes](https://developers.beeper.com/desktop-api/changelog#v41210-2025-09-17)

## Status

✅ **Implemented** - Direct file access working  
✅ **Simpler** - No proxy needed  
✅ **Faster** - Direct local file loading  
⚠️ **Requires** - Browser file access permissions enabled

