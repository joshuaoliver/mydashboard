# AI Suggestions Smart Caching System

## Overview

Implemented intelligent caching for AI reply suggestions that only regenerates when the conversation changes. This provides instant results and saves OpenAI API calls.

## How It Works

### 1. Cache Check on Chat Selection
When a user selects a chat, the system:
1. Auto-triggers AI suggestion generation
2. Checks Convex database for cached suggestions
3. Compares cached last message ID with current last message
4. Returns cached suggestions if conversation unchanged
5. Generates fresh suggestions only if needed

### 2. Smart Cache Invalidation
Cache is automatically invalid when:
- New message is received in the chat
- Last message ID changes
- No cached suggestions exist

### 3. Benefits
- ⚡ **Instant results** - No waiting for OpenAI API
- 💰 **Cost savings** - Reduces API calls significantly
- 🎯 **Smart** - Only regenerates when conversation changes
- ♻️ **Automatic** - No manual cache management needed

## Architecture

### Database Schema (`convex/schema.ts`)

```typescript
aiReplySuggestions: defineTable({
  chatId: v.string(),                    // Which chat
  lastMessageId: v.string(),             // Last message when generated
  lastMessageTimestamp: v.number(),      // For validation
  suggestions: v.array(v.object({        // The AI suggestions
    reply: v.string(),
    style: v.string(),
    reasoning: v.string(),
  })),
  conversationContext: v.object({
    lastMessage: v.string(),
    messageCount: v.number(),
  }),
  generatedAt: v.number(),               // When generated
  modelUsed: v.string(),                 // Which AI model
})
  .index("by_chat_id", ["chatId"])
  .index("by_chat_and_message", ["chatId", "lastMessageId"])
```

### API Functions (`convex/aiSuggestions.ts`)

1. **`getCachedSuggestions`** (Query)
   - Checks if valid cached suggestions exist
   - Returns cached suggestions or null
   - Used by frontend to check cache status

2. **`saveSuggestionsToCache`** (Internal Mutation)
   - Saves/updates cached suggestions
   - Called by `generateReplySuggestions` after generating
   - Upserts: updates existing or creates new

3. **`hasCachedSuggestions`** (Query)
   - Quick check if any cache exists for a chat
   - Useful for UI indicators

4. **`clearCachedSuggestions`** (Mutation)
   - Manually clear cache for a chat
   - For "force refresh" features

### Updated Action (`convex/beeperActions.ts`)

```typescript
export const generateReplySuggestions = action({
  args: { chatId: v.string(), chatName: v.string() },
  handler: async (ctx, args) => {
    // 1. Fetch messages
    const messages = await fetchChatMessages(args.chatId);
    const lastMessage = messages[messages.length - 1];
    
    // 2. Check cache
    const cached = await ctx.runQuery(
      internal.aiSuggestions.getCachedSuggestions,
      { chatId: args.chatId, lastMessageId: lastMessage.id }
    );
    
    // 3. Return cached if valid
    if (cached) {
      console.log("Using cached suggestions");
      return cached;
    }
    
    // 4. Generate fresh suggestions
    const suggestions = await generateWithOpenAI(...);
    
    // 5. Save to cache
    await ctx.runMutation(
      internal.aiSuggestions.saveSuggestionsToCache,
      { chatId, lastMessageId, suggestions, ... }
    );
    
    return { suggestions, isCached: false, generatedAt: Date.now() };
  }
});
```

## Frontend Integration

### Auto-Trigger on Chat Selection

```typescript
// messages.tsx
useEffect(() => {
  if (cachedMessagesData) {
    setChatMessages(cachedMessagesData.messages || [])
    
    // Auto-generate AI suggestions when chat is selected
    // Checks cache first automatically
    handleGenerateAISuggestions()
  }
}, [selectedChatId, cachedMessagesData])
```

### UI Indicators

The `ReplySuggestions` component now shows:

**Cached Badge** (Green):
```
[💾 Cached]
```
- Instant results from cache
- Shows generation timestamp

**Fresh Badge** (Blue):
```
[⚡ Fresh]
```
- Just generated from OpenAI
- New suggestions

## User Experience

### First Time Viewing Chat
```
1. User clicks chat
2. UI shows "Generating..."
3. OpenAI generates suggestions (2-3s)
4. Suggestions appear with "Fresh" badge
5. Suggestions saved to cache
```

### Returning to Same Chat
```
1. User clicks chat again
2. Suggestions appear instantly (<100ms)
3. Shows "Cached" badge with timestamp
4. No OpenAI API call
```

### When New Message Arrives
```
1. User clicks chat with new message
2. UI shows "Generating..."
3. OpenAI generates fresh suggestions
4. Shows "Fresh" badge
5. New suggestions replace old cache
```

## Cache Statistics

### Expected Performance

| Scenario | Time | API Call | Badge |
|----------|------|----------|-------|
| First view | 2-3s | Yes ✅ | Fresh |
| Return visit (no new msg) | <100ms | No ❌ | Cached |
| Return visit (new msg) | 2-3s | Yes ✅ | Fresh |

### Cost Savings Example

Assume:
- 50 chats per day
- Average 3 views per chat before new message
- Cost: $0.002 per generation

**Without Caching**:
- 50 chats × 3 views = 150 API calls/day
- Cost: $0.30/day = $9/month

**With Caching**:
- 50 unique chats = 50 API calls/day
- Cost: $0.10/day = $3/month
- **Savings: 67% ($6/month)**

## Code Flow

```
User Selects Chat
       ↓
handleGenerateAISuggestions()
       ↓
generateReplySuggestions (action)
       ↓
Fetch Messages
       ↓
Get Last Message ID
       ↓
getCachedSuggestions (query)
       ├─ Cache Hit → Return Cached ✅
       └─ Cache Miss → Generate Fresh ↓
              ↓
       Call OpenAI API
              ↓
       Parse Suggestions
              ↓
       saveSuggestionsToCache (mutation)
              ↓
       Return Fresh Suggestions ✅
```

## Files Changed

### Backend
1. ✅ `convex/schema.ts` - Added `aiReplySuggestions` table
2. ✅ `convex/aiSuggestions.ts` - Cache management functions (NEW)
3. ✅ `convex/beeperActions.ts` - Updated `generateReplySuggestions`

### Frontend
1. ✅ `src/routes/messages.tsx` - Auto-trigger on chat selection
2. ✅ `src/components/messages/ReplySuggestions.tsx` - Cache indicators

## Testing Checklist

### Manual Testing
- [ ] Select chat first time - shows "Fresh" badge
- [ ] Select same chat again - shows "Cached" badge instantly
- [ ] Send new message - generates fresh suggestions
- [ ] Switch between chats - each uses its own cache
- [ ] Check console logs for cache hits/misses

### Expected Console Logs

**Cache Hit**:
```
✅ Using cached suggestions for John Doe
[generateReplySuggestions] Using cached suggestions for chat abc123
```

**Cache Miss**:
```
🔄 Generated fresh suggestions for John Doe
[generateReplySuggestions] Generating new suggestions for chat abc123
[generateReplySuggestions] Saved 3 suggestions to cache for chat abc123
```

## Future Enhancements

### 1. Cache Expiry
Add TTL (time-to-live) for suggestions:
```typescript
// Invalidate cache after 24 hours
if (cached && Date.now() - cached.generatedAt > 24 * 60 * 60 * 1000) {
  // Regenerate
}
```

### 2. Manual Refresh Button
Allow users to force regeneration:
```typescript
<Button onClick={clearAndRegenerate}>
  Force Refresh
</Button>
```

### 3. Cache Analytics
Track cache hit/miss rates:
```typescript
// Add to schema
cacheStats: defineTable({
  date: v.string(),
  hits: v.number(),
  misses: v.number(),
  savingsUSD: v.number(),
})
```

### 4. Prefetching
Preload suggestions for visible chats:
```typescript
// When user hovers over chat
onChatHover(chatId) {
  // Prefetch in background
  prefetchSuggestions(chatId)
}
```

## Key Benefits Summary

✅ **Performance**: Instant results from cache  
✅ **Cost**: 67% reduction in API calls  
✅ **Smart**: Only regenerates when needed  
✅ **Automatic**: Zero user intervention  
✅ **Transparent**: Visual indicators show source  
✅ **Reliable**: Convex handles consistency  

## Convex Best Practices Followed

✅ Return validators on all functions  
✅ Internal mutations for database writes  
✅ Actions call mutations via `ctx.runMutation`  
✅ Queries for cache lookups  
✅ Indexes for efficient lookups  
✅ Proper error handling  
✅ TypeScript types aligned with validators  

---

**Status**: ✅ Fully Implemented & Ready to Test  
**Impact**: High (Performance + Cost Savings)  
**Complexity**: Medium (Smart caching logic)  
**Maintainability**: High (Clean architecture)

