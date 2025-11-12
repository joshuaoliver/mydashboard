# ProxiedImage Component - Media Server Setup

**Date**: November 12, 2025  
**Component**: `src/components/messages/ProxiedImage.tsx`  
**Purpose**: Display Beeper profile pictures and message attachments via media server proxy

## Overview

The `ProxiedImage` component converts Beeper's local `file://` URLs into publicly accessible URLs served by your media server.

## How It Works

### URL Transformation

**Input** (from Beeper API):
```
file:///Users/joshuaoliver/Library/Application%20Support/BeeperTexts/media/local.beeper.com/joshuaoliver_z66x2RdfdAwBsbX5fpbXbcZz8RlcKcbrr8suvvXHz3xSSmXbHc6wRF4yDORUuvkV
```

**Output** (served by media server):
```
https://beeperimage.bywave.com.au/local.beeper.com/joshuaoliver_z66x2RdfdAwBsbX5fpbXbcZz8RlcKcbrr8suvvXHz3xSSmXbHc6wRF4yDORUuvkV?token=1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9
```

### Extraction Logic

1. **Decode URL-encoded characters** (spaces, special chars)
2. **Extract path after `/media/`**
   - Result: `local.beeper.com/joshuaoliver_HASH` or `beeper.com/HASH`
3. **Construct proxied URL** with query string authentication
4. **Display** the image from the media server

## Configuration

### Environment Variables

Added to `.env.local`:

```bash
# Beeper Media Server Configuration
VITE_BEEPER_MEDIA_SERVER=https://beeperimage.bywave.com.au
VITE_BEEPER_MEDIA_TOKEN=1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9
```

### Component Configuration

The component reads these values:

```typescript
const BEEPER_MEDIA_SERVER = import.meta.env.VITE_BEEPER_MEDIA_SERVER || 'https://beeperimage.bywave.com.au'
const BEEPER_MEDIA_TOKEN = import.meta.env.VITE_BEEPER_MEDIA_TOKEN || '1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9'
```

**Fallback values** are provided in case environment variables are missing.

## Usage

### Profile Pictures (Chat List)

```tsx
<ProxiedImage
  src={chat.contactImageUrl}  // file:///Users/.../media/...
  alt={chat.name}
  className="w-8 h-8 rounded-full object-cover"
/>
```

### Message Attachments

```tsx
<ProxiedImage
  src={message.attachments[0].srcURL}  // file:///Users/.../media/...
  alt={message.attachments[0].fileName || 'Attachment'}
  className="max-w-full h-auto rounded-lg"
  mimeType={message.attachments[0].mimeType}
/>
```

### Regular HTTP Images

The component also handles regular HTTP/HTTPS URLs without modification:

```tsx
<ProxiedImage
  src="https://example.com/image.jpg"
  alt="External image"
  className="w-full"
/>
```

## Media Server Endpoint Format

### Query String Authentication

The media server uses **query string authentication** (METHOD 2 from your config):

```
GET /{domain}/{filename}?token={auth_token}
```

**Example:**
```
GET /local.beeper.com/joshuaoliver_z66x2...?token=1c265ccc...
```

### Supported Domains

- `local.beeper.com/` - User-specific cached media
- `beeper.com/` - Shared cached media

## Testing

### 1. Test Profile Pictures

Navigate to the Messages page and check if profile pictures load:

```bash
# Open the app
npm run dev

# Navigate to http://localhost:5174/messages
# Check browser DevTools Network tab for image requests
```

**Expected requests:**
```
https://beeperimage.bywave.com.au/local.beeper.com/joshuaoliver_HASH?token=1c265ccc...
```

**Expected response**: `200 OK` with image data

### 2. Test with curl

Test the media server directly:

```bash
# Test a specific image (replace with actual path from your API)
curl "https://beeperimage.bywave.com.au/local.beeper.com/joshuaoliver_z66x2RdfdAwBsbX5fpbXbcZz8RlcKcbrr8suvvXHz3xSSmXbHc6wRF4yDORUuvkV?token=1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9" --output test-image.jpg
```

**Expected**: Image file downloaded successfully

### 3. Test Message Attachments

1. Find a chat with image attachments
2. Open the chat
3. Check if images render correctly
4. Verify in DevTools that URLs are correctly formed

### 4. Fallback Testing

Test error states by using an invalid token:

```typescript
// Temporarily modify component
const BEEPER_MEDIA_TOKEN = 'invalid_token'
```

**Expected**: Error state displayed with "Image unavailable" message

## Component States

### Loading State
```tsx
<div className="flex items-center justify-center bg-gray-100 rounded-lg">
  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
</div>
```

### Error State
```tsx
<div className="flex flex-col items-center justify-center bg-gray-100 rounded-lg p-4">
  <ImageOff className="w-8 h-8 text-gray-400 mb-2" />
  <p className="text-xs text-gray-500">Image unavailable</p>
  <p className="text-xs text-gray-400">{truncatedUrl}...</p>
</div>
```

### Success State
```tsx
<img
  src={proxiedUrl}
  alt={alt}
  className={className}
  loading="lazy"
  onError={fallbackHandler}
/>
```

## Error Handling

### Common Errors

**1. Invalid file:// URL format**
```
Error: Invalid file:// URL format - missing /media/ path
```
**Cause**: URL doesn't contain `/media/` directory  
**Fix**: Verify Beeper API is returning correct URLs

**2. Media server authentication failed**
```
HTTP 401 Unauthorized
```
**Cause**: Invalid or missing token  
**Fix**: Check `VITE_BEEPER_MEDIA_TOKEN` in `.env.local`

**3. Media server unreachable**
```
Failed to load image: Network error
```
**Cause**: Media server down or incorrect URL  
**Fix**: Verify `VITE_BEEPER_MEDIA_SERVER` URL is correct

**4. File not found on media server**
```
HTTP 404 Not Found
```
**Cause**: File doesn't exist on the media server  
**Fix**: Check if Beeper Desktop has synced the media

## Security Considerations

### ⚠️ Token Storage

The media token is currently stored in:
- `.env.local` (not committed to git - ✅ Good)
- Component fallback (visible in source - ⚠️ Acceptable for localhost)

**For production:**
- Move token to environment variable only
- Remove hardcoded fallback
- Consider using server-side proxy instead

### 🔒 Token Rotation

The media token should be rotated periodically:

1. Generate new token on media server
2. Update `.env.local`
3. Restart dev server

### 🌐 CORS Configuration

The media server must allow requests from your frontend:

```
Access-Control-Allow-Origin: http://localhost:5174
Access-Control-Allow-Origin: https://yourdomain.com
```

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| HTTPS URLs | ✅ | ✅ | ✅ | ✅ |
| Query string auth | ✅ | ✅ | ✅ | ✅ |
| Lazy loading | ✅ | ✅ | ✅ | ✅ |
| Error fallback | ✅ | ✅ | ✅ | ✅ |

## Performance Optimization

### Current Optimizations

1. **Lazy loading**: `loading="lazy"` attribute
2. **Instant transformation**: No async API calls
3. **Error boundaries**: Graceful degradation
4. **Caching**: Browser caches images by URL

### Future Enhancements

1. **Image CDN**: Add CDN in front of media server
2. **WebP conversion**: Serve modern formats
3. **Responsive images**: `srcset` for different sizes
4. **Placeholder images**: BlurHash or skeleton loaders
5. **Prefetching**: Preload visible images

## Troubleshooting

### Images Not Loading

**Check 1: Network Tab**
```
Open DevTools → Network → Filter: Img
Look for requests to beeperimage.bywave.com.au
```

**Check 2: Console Errors**
```
[ProxiedImage] Error: ...
```

**Check 3: Token Validity**
```bash
# Test token with curl
curl "https://beeperimage.bywave.com.au/local.beeper.com/test?token=YOUR_TOKEN"
```

**Check 4: Media Server Status**
```bash
# Check if server is running
curl https://beeperimage.bywave.com.au/health
```

### Images Load Slowly

**Possible causes:**
1. Media server far from your location (latency)
2. Large image files (not optimized)
3. Slow network connection

**Solutions:**
1. Add CDN in front of media server
2. Implement image optimization on media server
3. Show loading state to users

### CORS Errors

```
Access to fetch at 'https://beeperimage.bywave.com.au/...' 
from origin 'http://localhost:5174' has been blocked by CORS policy
```

**Fix**: Update media server CORS settings to allow your origin

## Related Files

- `src/components/messages/ProxiedImage.tsx` - Component implementation
- `src/components/messages/ChatListItem.tsx` - Uses ProxiedImage for profile pics
- `src/components/messages/ChatDetail.tsx` - Uses ProxiedImage for attachments
- `src/components/contacts/ContactPanel.tsx` - Uses ProxiedImage for contact photos
- `.env.local` - Environment variables (not in git)
- `beeper-media-config.txt` - Server configuration reference

## Changelog

### November 12, 2025 - Complete Rewrite
- ✅ Removed old MXC URL resolution logic
- ✅ Added direct file:// → HTTPS conversion
- ✅ Implemented query string authentication
- ✅ Added environment variable configuration
- ✅ Improved error handling and states
- ✅ Added comprehensive documentation

### Previous Implementation
- ❌ Used Beeper Desktop API (`localhost:23373`)
- ❌ Required local file permissions
- ❌ Didn't work reliably

## Next Steps

1. ✅ Component updated
2. ✅ Environment variables configured
3. ✅ Documentation created
4. ⏳ **Test in browser** - Load Messages page and verify images
5. ⏳ **Check DevTools** - Verify network requests are correct
6. ⏳ **Test error states** - Verify fallbacks work
7. ⏳ **Production deployment** - Move to production when ready

---

**Ready to test!** Restart your dev server and navigate to `/messages` to see profile pictures loading. 🚀


