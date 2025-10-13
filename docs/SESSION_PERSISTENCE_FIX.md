# Session Persistence Fix

## Issue

After signing in successfully, users were being signed out on every page refresh or dev server reload. This happened because the authentication session wasn't being persisted properly.

## Root Cause

The issue was caused by two problems:

1. **Creating new Convex client instances**: Every time the router was created (including on dev server hot reloads), a new `ConvexQueryClient` instance was created, which didn't have the authentication token from the previous session.

2. **No explicit storage configuration**: The `ConvexAuthProvider` wasn't explicitly configured to use `localStorage` for session persistence.

## Solution

### 1. Singleton Convex Clients (Client-Side)

Made the `ConvexQueryClient` and `QueryClient` singletons on the client-side:

```typescript
// Client-side singleton Convex client (persists across reloads)
let convexQueryClientInstance: ConvexQueryClient | undefined
let queryClientInstance: QueryClient | undefined

function createRouterInstance() {
  // On the client, reuse the same ConvexQueryClient to maintain auth session
  if (typeof document !== 'undefined') {
    if (!convexQueryClientInstance) {
      convexQueryClientInstance = new ConvexQueryClient(CONVEX_URL)
    }
    if (!queryClientInstance) {
      queryClientInstance = new QueryClient({...})
      convexQueryClientInstance.connect(queryClientInstance)
    }
  } else {
    // Server-side: create new instances for each request (SSR safe)
    convexQueryClientInstance = new ConvexQueryClient(CONVEX_URL)
    queryClientInstance = new QueryClient({...})
    convexQueryClientInstance.connect(queryClientInstance)
  }
}
```

**Benefits:**
- Auth tokens persist across hot module reloads
- Faster page loads (no need to re-authenticate)
- Maintains user session through dev server restarts

### 2. Explicit localStorage Configuration

Added explicit `storage` prop to `ConvexAuthProvider`:

```typescript
<ConvexAuthProvider 
  client={convexQueryClient.convexClient}
  storage={typeof window !== 'undefined' ? window.localStorage : undefined}
>
  {children}
</ConvexAuthProvider>
```

**What this does:**
- Explicitly tells Convex Auth to use `localStorage` for token storage
- Tokens persist across page refreshes and browser sessions
- SSR-safe (only uses localStorage on client-side)

## How Session Persistence Works Now

1. **Sign In**: User enters credentials and signs in
2. **Token Storage**: Convex Auth saves the authentication token to `localStorage`
3. **Page Refresh**: On page load:
   - ConvexQueryClient singleton is reused (maintains connection)
   - ConvexAuthProvider reads token from `localStorage`
   - Token is automatically sent with every Convex request
   - User stays authenticated
4. **Sign Out**: Token is removed from `localStorage`

## Testing

To verify session persistence is working:

1. **Sign in** to your account
2. **Refresh the page** (Cmd+R / Ctrl+R)
   - ✅ You should stay signed in
3. **Check localStorage** (DevTools → Application → Local Storage)
   - Look for Convex auth-related keys
   - Should see token data
4. **Restart dev server** and refresh
   - ✅ You should still be signed in
5. **Close and reopen browser**
   - ✅ You should still be signed in

## Token Expiry

By default, Convex Auth tokens expire after:
- **Access tokens**: ~1 hour
- **Refresh tokens**: ~30 days

When the access token expires, Convex Auth automatically:
1. Uses the refresh token to get a new access token
2. Updates the stored token in localStorage
3. Continues the user's session seamlessly

If the refresh token expires (after 30 days of inactivity), the user will need to sign in again.

## Debugging Session Issues

If you're still experiencing sign-out issues:

### Check Browser Storage

1. Open DevTools (F12)
2. Go to **Application** → **Local Storage**
3. Look for keys related to Convex/auth
4. You should see token data after signing in

### Check Console Logs

The root component logs auth state:
```
Auth state: { user: {...}, isAuthenticated: true, isLoading: false, pathname: '/' }
```

If `user` is null or undefined after refresh, there's an issue retrieving the token.

### Clear Storage and Try Again

If tokens are corrupted:
1. Sign out
2. Clear browser storage (DevTools → Application → Clear storage)
3. Sign in again

### Check Network Tab

1. Open DevTools → Network
2. Filter by "convex"
3. Look for authentication headers in requests
4. Should see `Authorization: Bearer <token>` after sign-in

## Files Modified

- `src/router.tsx` - Made Convex clients singletons, added localStorage config

## Related Documentation

- Convex Auth session management: https://labs.convex.dev/auth
- Session tracking: https://stack.convex.dev/track-sessions-without-cookies

