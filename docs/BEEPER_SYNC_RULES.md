# Beeper Sync Rules & Message Pagination

## Overview

This document explains how Beeper messages are synced, the rules governing sync behavior, and the new pagination system for loading older messages.

## Sync Rules

### Chat Syncing

**Endpoint**: `/v1/chats/search`

**Rules**:
- Fetches up to **100 chats** per sync
- Uses **time-based filtering** with `lastActivityAfter` parameter
- After first sync, only fetches chats with activity since last sync
- Maintains `lastSyncTimestamp` in-memory cache for efficient filtering

**Implementation**:
```typescript
// First sync: No filter, gets all recent chats
query: { limit: 100 }

// Subsequent syncs: Only chats with new activity
query: { 
  limit: 100,
  lastActivityAfter: new Date(lastSyncTimestamp).toISOString()
}
```

### Message Syncing (Per Chat)

**Endpoint**: `/v1/chats/{chatID}/messages` (improved from `/v0/search-messages`)

**Rules**:
- Messages are synced **conditionally**, not on every chat sync
- Syncs when:
  1. **New chat** - First time seeing this chat
  2. **New activity** - `lastActivity > lastMessagesSyncedAt`
  3. **Manual refresh** - User clicks refresh button
  4. **Page load** - Only for chats with new activity

**Message Limit**: 
- Previously: **20 messages** (search endpoint limit)
- Now: **API default** (typically 50-100+ messages per batch)
- No hard limit on the list endpoint

**Smart Caching**:
```typescript
// Check if messages need syncing
shouldSyncMessages = 
  !existingChat.lastMessagesSyncedAt ||
  chat.lastActivity > existingChat.lastMessagesSyncedAt
```

## Sync Modes

### 1. Page Load Sync (`pageLoadSync`)
- Triggered when user opens `/messages` page
- Uses time-based filtering (`lastActivityAfter`)
- Only syncs messages for chats with new activity
- **forceMessageSync**: `false`
- **bypassCache**: `false`

### 2. Manual Sync (`manualSync`)
- Triggered by refresh button
- Bypasses cache filtering
- Force-syncs messages for ALL chats
- **forceMessageSync**: `true`
- **bypassCache**: `true`

### 3. Cron Sync (Every 10 minutes)
- Background sync via Convex cron
- Uses time-based filtering
- Keeps data fresh without user interaction

## Message Pagination System

### New Capabilities

The system now supports loading older messages beyond the initial sync:

#### 1. Initial Message Load
- When a chat is selected, displays cached messages from database
- If cache is empty or stale, triggers sync action
- Loads recent messages (API default batch size)

#### 2. Load Older Messages
**Action**: `beeperMessageActions.loadOlderMessages`

**Parameters**:
```typescript
{
  chatId: string,
  oldestSortKey: string  // sortKey from oldest visible message
}
```

**Behavior**:
- Fetches messages older than `oldestSortKey`
- Uses `direction: "before"` for pagination
- Caches fetched messages to database
- Returns messages + `hasMore` flag

#### 3. Pagination Flow
```
1. User opens chat
   └─> Display cached messages
   
2. User scrolls to top
   └─> Check if hasMore = true
   └─> Call loadOlderMessages(chatId, oldestSortKey)
   └─> Append older messages to top of list
   └─> Repeat as needed
```

## API Endpoints Used

### Chat Search (`/v1/chats/search`)
```typescript
GET /v1/chats/search
Query params:
  - limit: 100
  - lastActivityAfter: ISO datetime (optional)
  - type: "single" | "group" (optional)
  - unreadOnly: boolean (optional)

Response:
  - items: Chat[]
  - hasMore: boolean
  - oldestCursor: string
  - newestCursor: string
```

### List Messages (`/v1/chats/{chatID}/messages`)
**Improved endpoint** - replaced `/v0/search-messages`

```typescript
GET /v1/chats/{chatID}/messages
Query params:
  - cursor: string (optional, message sortKey)
  - direction: "before" | "after" (optional)

Response:
  - items: Message[]
  - hasMore: boolean
```

**Advantages**:
- No hard 20-message limit
- Proper cursor-based pagination
- Simpler query parameters (no array notation issues)
- Better performance

## Database Schema

### `beeperChats` Table
```typescript
{
  chatId: string,           // Unique chat identifier
  lastActivity: number,     // Timestamp of last activity
  lastSyncedAt: number,     // When chat metadata was last synced
  lastMessagesSyncedAt: number, // When messages were last synced
  lastMessage: string,      // Preview of last message
  lastMessageFrom: "user" | "them",
  needsReply: boolean,      // True if last message was from them
  // ... other fields
}
```

### `beeperMessages` Table
```typescript
{
  chatId: string,          // Links to parent chat
  messageId: string,       // Unique message identifier
  timestamp: number,       // Message timestamp
  text: string,
  senderId: string,
  senderName: string,
  isFromUser: boolean,
  attachments: Attachment[], // Optional
}
```

**Indexes**:
- `by_chat`: (chatId, timestamp) - For fast message queries per chat
- Supports efficient pagination queries

## Performance Benefits

### Before
- ❌ 20 messages max per chat
- ❌ Using search endpoint (less efficient)
- ❌ No pagination support
- ❌ Can't load message history

### After
- ✅ 50-100+ messages per batch (API default)
- ✅ Using dedicated list endpoint
- ✅ Full pagination support
- ✅ Can load entire message history
- ✅ Messages cached in database
- ✅ Instant subsequent loads from cache

## Frontend Integration

### Current Query (Existing)
```typescript
const cachedMessagesData = useQuery(
  api.beeperQueries.getCachedMessages,
  selectedChatId ? { chatId: selectedChatId } : "skip"
)
```

### With Pagination (Recommended Addition)
```typescript
// Load older messages when scrolling to top
const loadOlderMessages = useAction(api.beeperMessageActions.loadOlderMessages)

const handleLoadMore = async () => {
  if (!hasMore || isLoading) return
  
  const oldestMessage = messages[0]
  const result = await loadOlderMessages({
    chatId: selectedChatId,
    oldestSortKey: oldestMessage.sortKey
  })
  
  // Prepend older messages to list
  setMessages([...result.messages, ...messages])
  setHasMore(result.hasMore)
}
```

## Testing the Changes

### Test Message Sync Limits
1. Open a chat with >50 messages
2. Check database: `db.beeperMessages.filter(m => m.chatId === "chatId").length`
3. Should see 50-100+ messages (not limited to 20)

### Test Pagination
1. Open a chat with >100 messages
2. Scroll to top of message list
3. Trigger `loadOlderMessages` action
4. Verify older messages load
5. Check `hasMore` flag for more pages

### Test Sync Behavior
```bash
# Check last sync timestamp
console.log(lastSyncTimestamp)

# Trigger manual sync
await manualSync()

# Check messages were synced
db.beeperMessages.count()

# Trigger page load sync (should use filter)
await pageLoadSync()
```

## Configuration

### Environment Variables
```bash
BEEPER_API_URL=https://beeper.bywave.com.au
BEEPER_TOKEN=your_token_here
```

### Sync Settings
```typescript
// In beeperSync.ts
const CHAT_LIMIT = 100          // Max chats per sync
const MESSAGE_TIMEOUT = 15000   // 15 second timeout
const SDK_RETRIES = 2           // Retry failed requests 2 times
```

## Troubleshooting

### Messages Not Loading
1. Check if chat sync happened: `db.beeperChats.find(chat)`
2. Check message count: `db.beeperMessages.filter(m => m.chatId === chatId).length`
3. Check sync timestamp: `chat.lastMessagesSyncedAt`
4. Trigger manual sync to force reload

### Pagination Not Working
1. Verify `sortKey` is present in messages
2. Check `hasMore` flag from API
3. Ensure `oldestSortKey` is passed correctly
4. Check API response for cursor validity

### Performance Issues
- Use database queries (fast) over API calls (slow)
- Cache messages aggressively
- Only sync when needed (check `lastMessagesSyncedAt`)
- Use pagination to load incrementally

## Future Improvements

1. **Real-time Updates**: Listen for new messages via webhooks/SSE
2. **Optimistic UI**: Show sent messages immediately before API confirms
3. **Message Search**: Full-text search across cached messages
4. **Media Handling**: Better image/video attachment support
5. **Batch Operations**: Mark multiple chats as read
6. **Smart Preloading**: Preload messages for likely-to-open chats

## Summary

The Beeper sync system is now:
- ✅ **Smarter**: Only syncs when needed (time-based filtering)
- ✅ **Faster**: Uses cached database queries
- ✅ **More Complete**: Loads 50-100+ messages instead of 20
- ✅ **Scalable**: Supports loading entire message history via pagination
- ✅ **Efficient**: Avoids redundant API calls

