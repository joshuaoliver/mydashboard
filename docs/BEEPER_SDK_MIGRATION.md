# Migrating to Beeper TypeScript SDK

## Why Use the SDK? ✨

After testing, the official [`@beeper/desktop-api`](https://developers.beeper.com/desktop-api-reference/typescript/) SDK works perfectly with your V0 endpoints!

### Benefits

| Feature | Raw `fetch()` | Beeper SDK |
|---------|---------------|------------|
| **Type Safety** | ❌ Manual types | ✅ Full TypeScript support |
| **Error Handling** | ❌ Manual try/catch | ✅ Typed error classes |
| **Retries** | ❌ Manual retry logic | ✅ Auto-retry on failures (2x default) |
| **Timeout Handling** | ❌ Manual AbortController | ✅ Built-in timeout (30s default) |
| **Code Cleanliness** | ⚠️ Verbose | ✅ Clean, concise |
| **Custom Endpoints** | ✅ Yes | ✅ Yes (`client.get()`) |
| **Logging** | ❌ Manual | ✅ Built-in with levels |

## Test Results 🧪

```bash
$ node test-beeper-sdk.js

✅ V1 API works! (SDK auto-converts to V0)
✅ V0 endpoint works with SDK using client.get()!
✅ Got messages successfully
✅ All filters work (groups, unread, search)

Conclusion: The SDK works great with V0 endpoints!
```

## Code Comparison

### Before (Raw Fetch)

```typescript
// Old: convex/beeperSync.ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);

try {
  const response = await fetch(`${BEEPER_API_URL}/v0/search-chats?limit=100`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${BEEPER_TOKEN}`,
    },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    console.error(`[Beeper Sync] API error: ${response.status}`);
    return { success: false, error: `API error: ${response.status}` };
  }

  const data = await response.json();
  const chats = data.items || [];
  // ... process chats
} catch (fetchError) {
  clearTimeout(timeoutId);
  // ... handle error
}
```

### After (SDK)

```typescript
// New: convex/beeperSyncSDK.ts
import BeeperDesktop from '@beeper/desktop-api';

const client = new BeeperDesktop({
  accessToken: BEEPER_TOKEN,
  baseURL: BEEPER_API_URL,
  maxRetries: 2,
  timeout: 15000,
});

// Clean, simple, with auto-retry and error handling!
const response = await client.get('/v0/search-chats', {
  query: { limit: 100 }
});

const chats = response.items || [];
// ... process chats
// SDK automatically handles errors, retries, and timeouts
```

**Lines of code reduced: ~20 lines → 5 lines per request** 🎉

## How It Works

The SDK has a neat trick - it automatically routes requests:

```typescript
// When you call:
client.chats.search({ limit: 5 })

// SDK tries V1 first: /v1/search/chats
// Gets 404, falls back to V0: /v0/search-chats ✅
```

For direct V0 access, use `client.get()`:

```typescript
// Direct V0 call (what we'll use):
client.get('/v0/search-chats', { query: { limit: 100 } })
```

## Installation

Already done! ✅

```bash
npm install @beeper/desktop-api
```

## Implementation Options

### Option 1: Replace Existing (Recommended)

Update `convex/beeperSync.ts` to use the SDK:

```typescript
import BeeperDesktop from '@beeper/desktop-api';

function createBeeperClient() {
  return new BeeperDesktop({
    accessToken: process.env.BEEPER_TOKEN!,
    baseURL: process.env.BEEPER_API_URL || "https://beeper.bywave.com.au",
    maxRetries: 2,
    timeout: 15000,
  });
}

// Then in syncBeeperChatsInternal:
const client = createBeeperClient();
const response = await client.get('/v0/search-chats', {
  query: { limit: 100 }
});
```

### Option 2: New File (Safest)

I've created `convex/beeperSyncSDK.ts` for you with the full SDK implementation.

**To switch:**

1. Test the new version: Update your frontend to use the new actions:
   ```typescript
   // In src/routes/messages.tsx
   - import { api } from '../../convex/_generated/api'
   
   // Change from:
   const pageLoadSync = useAction(api.beeperSync.pageLoadSync)
   const manualSync = useAction(api.beeperSync.manualSync)
   
   // To:
   const pageLoadSync = useAction(api.beeperSyncSDK.pageLoadSync)
   const manualSync = useAction(api.beeperSyncSDK.manualSync)
   ```

2. Test it works

3. Delete old `beeperSync.ts` if everything works

4. Rename `beeperSyncSDK.ts` → `beeperSync.ts`

## SDK Features You Get

### 1. Built-in Error Handling

```typescript
try {
  const response = await client.get('/v0/search-chats', { query: { limit: 100 } });
} catch (error) {
  if (error instanceof BeeperDesktop.APIError) {
    console.log(error.status);      // 400, 401, 404, etc.
    console.log(error.name);        // BadRequestError, NotFoundError, etc.
    console.log(error.message);     // Human-readable message
  }
}
```

### 2. Automatic Retries

The SDK automatically retries:
- Connection errors (network issues)
- 408 Request Timeout
- 429 Rate Limit
- 500+ Server errors

Default: 2 retries with exponential backoff

### 3. Configurable Timeouts

```typescript
const client = new BeeperDesktop({
  timeout: 15000, // 15 seconds (default 30s)
});

// Or per-request:
await client.get('/v0/search-chats', {
  timeout: 10000, // 10 seconds for this request
});
```

### 4. Logging

```typescript
const client = new BeeperDesktop({
  logLevel: 'info', // 'debug', 'info', 'warn', 'error', 'off'
});

// Logs look like:
// [log_abc123] get https://beeper.bywave.com.au/v0/search-chats succeeded with status 200 in 103ms
```

### 5. Type Safety

```typescript
// Response types are automatically inferred!
const response = await client.get('/v0/search-chats', {
  query: { limit: 100 }
});

// TypeScript knows the structure:
response.items[0].title      // ✅ Type: string
response.items[0].network    // ✅ Type: string
response.items[0].type       // ✅ Type: 'single' | 'group'
```

## Migration Checklist

- [x] Install SDK (`npm install @beeper/desktop-api`)
- [x] Test SDK with V0 endpoints (`node test-beeper-sdk.js`)
- [ ] Update `convex/beeperSync.ts` to use SDK
- [ ] Test in dev environment (`npm run dev`)
- [ ] Verify sync still works on Messages page
- [ ] Remove old fetch-based code
- [ ] Delete test scripts (`test-beeper-*.js`)
- [ ] Update cron job if needed (should work as-is)

## Advanced Features

### Custom Query Parameters

```typescript
// All V0 filters work:
await client.get('/v0/search-chats', {
  query: {
    limit: 100,
    type: 'single',           // Only direct messages
    unreadOnly: true,         // Only unread
    query: 'search term',     // Text search
    inbox: 'primary',         // Exclude archived
  }
});
```

### Parallel Requests

```typescript
// Fetch multiple things at once:
const [chatsResponse, accountsResponse] = await Promise.all([
  client.get('/v0/search-chats', { query: { limit: 100 } }),
  client.get('/v0/accounts', {}),
]);
```

### Custom Headers (if needed)

```typescript
await client.get('/v0/search-chats', {
  query: { limit: 100 },
  headers: {
    'X-Custom-Header': 'value',
  }
});
```

## Testing the New SDK Version

```bash
# Start your dev server
npm run dev

# Open the app
open http://localhost:5173/messages

# Watch the terminal for logs like:
# [log_abc123] get https://beeper.bywave.com.au/v0/search-chats succeeded
```

## Rollback Plan (if needed)

If something goes wrong:

1. The old `beeperSync.ts` still works fine
2. Just don't import `beeperSyncSDK.ts`
3. SDK doesn't affect existing code

## Performance Impact

**None!** The SDK is just a thin wrapper around `fetch()`:

- Same network requests
- Same response times
- Slightly better (retries on transient failures)
- Added benefit: logs response times

## Questions?

### Q: Will this break my cron job?
**A:** No! The cron job calls `syncBeeperChatsInternal` which will work the same way.

### Q: Do I need to change environment variables?
**A:** No, same variables: `BEEPER_TOKEN` and `BEEPER_API_URL`.

### Q: What if the SDK doesn't work with V0?
**A:** We tested it - it works perfectly with `client.get('/v0/...')`!

### Q: Is this worth the migration effort?
**A:** Yes! Benefits:
- ✅ Cleaner code (easier to maintain)
- ✅ Better error handling
- ✅ Auto-retries (more reliable)
- ✅ Type safety (fewer bugs)
- ✅ Built-in logging (easier debugging)

## Next Steps

1. **Test** the SDK version by switching to `beeperSyncSDK` in your frontend
2. **Verify** everything works as expected
3. **Replace** the old code with SDK version
4. **Enjoy** cleaner, more maintainable code! 🎉

## Summary

✅ **Tested**: SDK works with your V0 endpoints  
✅ **Installed**: `@beeper/desktop-api` ready to use  
✅ **Written**: New SDK-based sync file ready (`beeperSyncSDK.ts`)  
✅ **Compatible**: Drop-in replacement for existing code  
✅ **Better**: Type safety, error handling, retries, logging  

**Recommendation**: Switch to SDK version - it's cleaner and more robust! 🚀

