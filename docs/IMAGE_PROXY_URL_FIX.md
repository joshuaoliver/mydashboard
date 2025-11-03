# Image Proxy URL Fix

## Issue Found

The image proxy implementation was using an **incorrect base URL** for Convex HTTP endpoints.

### What Was Wrong

**Location**: `src/components/messages/ProxiedImage.tsx` (line 59-60)

**Incorrect Code**:
```typescript
const baseUrl = convexUrl.replace('/api', '') // Remove /api suffix
const proxyUrl = `${baseUrl}/image-proxy?url=${encodeURIComponent(src)}`
```

**Problem**: 
- Was converting `https://abc123.convex.cloud/api` → `https://abc123.convex.cloud/image-proxy`
- This is **wrong** because Convex HTTP routes are served from `.convex.site`, not `.convex.cloud`

### What Should Be Used

According to Convex architecture:
- **API endpoints**: `https://<deployment>.convex.cloud/api` (for queries/mutations)
- **HTTP routes**: `https://<deployment>.convex.site` (for custom HTTP endpoints)
- **Site URL**: Available via `process.env.CONVEX_SITE_URL` in backend code

## Fix Applied

**Corrected Code**:
```typescript
// Convert: https://abc123.convex.cloud/api → https://abc123.convex.site
const siteUrl = convexUrl.replace('.convex.cloud/api', '.convex.site')
const proxyUrl = `${siteUrl}/image-proxy?url=${encodeURIComponent(src)}`
```

### Changes Made

1. **`src/components/messages/ProxiedImage.tsx`**
   - Fixed URL construction to properly convert `.convex.cloud/api` → `.convex.site`
   - Updated comment to reflect correct domain

2. **`docs/IMAGE_PROXY_IMPLEMENTATION.md`**
   - Updated all example URLs to use `.convex.site` instead of `.convex.cloud`
   - Fixed documentation to show correct URL format

## How It Works Now

### URL Transformation

```
Input:  import.meta.env.VITE_CONVEX_URL
        ↓
        "https://abc123.convex.cloud/api"
        ↓
Replace: ".convex.cloud/api" → ".convex.site"
        ↓
Output: "https://abc123.convex.site"
        ↓
Append: "/image-proxy?url=mxc://..."
        ↓
Final:  "https://abc123.convex.site/image-proxy?url=mxc://..."
```

### Complete Flow

```
Browser → https://abc123.convex.site/image-proxy?url=mxc://...
          ↓
Convex HTTP endpoint (/image-proxy)
          ↓
Beeper API (convert mxc:// → file://)
          ↓
Extract media ID
          ↓
Fetch from Matrix media endpoints
          ↓
Return image to browser
```

## Environment Variables Reference

| Variable | Scope | Example | Purpose |
|----------|-------|---------|---------|
| `VITE_CONVEX_URL` | Frontend | `https://abc123.convex.cloud/api` | API endpoint for queries/mutations |
| `CONVEX_SITE_URL` | Backend | `https://abc123.convex.site` | Site URL for HTTP routes |

### Why We Don't Use CONVEX_SITE_URL Directly

- `CONVEX_SITE_URL` is a **server-side** environment variable (only available in Convex backend)
- Frontend code cannot access `process.env.CONVEX_SITE_URL`
- Solution: Derive it from `VITE_CONVEX_URL` by string replacement

## Testing

To verify the fix works:

1. Navigate to `/messages` page
2. Open a chat with image attachments
3. Check browser network tab - image requests should go to:
   ```
   https://<deployment>.convex.site/image-proxy?url=mxc://...
   ```
4. Images should load correctly through the proxy

## Related Files

- `src/components/messages/ProxiedImage.tsx` - Frontend component
- `convex/http.ts` - Backend HTTP endpoint (`/image-proxy`)
- `convex/auth.config.ts` - Uses `CONVEX_SITE_URL` for auth domain
- `docs/IMAGE_PROXY_IMPLEMENTATION.md` - Implementation documentation
- `docs/IMAGE_PROXY_SOLUTION.md` - Solution overview

## Best Practices

When working with Convex URLs:

1. **For API calls** (queries, mutations, actions):
   - Use `VITE_CONVEX_URL` directly
   - Example: `https://abc123.convex.cloud/api`

2. **For HTTP routes** (custom endpoints):
   - Convert to site URL: `.convex.cloud/api` → `.convex.site`
   - Example: `https://abc123.convex.site/my-endpoint`

3. **In backend code**:
   - Use `process.env.CONVEX_SITE_URL` when available
   - Example: Auth domain configuration

## Status

✅ **Fixed** - Image proxy now uses correct Convex site URL
✅ **Documented** - Updated all documentation references
✅ **No linter errors** - Code passes all checks

