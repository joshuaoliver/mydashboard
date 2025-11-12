# Pagination Strategy - Chat List & Messages

## Overview

Smart pagination strategy that only fetches what's needed, when it's needed. No more loading thousands of chats or messages unnecessarily.

## Chat List Pagination

### Three Operations

#### 1. First Sync (Initial Load)
```
User opens app for first time
↓
Fetch: Most recent batch of chats (API default, ~50-100)
Store: newestCursor, oldestCursor
UI: Shows recent chats + "Load More" button
```

**Implementation**:
```typescript
// No cursor provided = API returns most recent chats
const response = await client.get('/v1/chats', {
  query: {} // Empty = most recent
});
```

#### 2. Incremental Sync (Refresh/Cron)
```
Scheduled sync or user pulls to refresh
↓
Fetch: Only NEWER chats (direction: "after")
Store: Update newestCursor only
UI: New chats appear at top
```

**Implementation**:
```typescript
// Get NEWER chats only
const response = await client.get('/v1/chats', {
  query: {
    cursor: syncState.newestCursor,
    direction: "after"
  }
});

// Update only newest boundary
await updateChatListSync({
  newestCursor: response.newestCursor,  // ← Update
  oldestCursor: syncState.oldestCursor, // ← Keep unchanged
});
```

#### 3. Load Older (User Action)
```
User clicks "Load More" button
↓
Fetch: OLDER chats (direction: "before")
Store: Update oldestCursor only
UI: Older chats appended to bottom
```

**Implementation**:
```typescript
// Get OLDER chats
const response = await client.get('/v1/chats', {
  query: {
    cursor: syncState.oldestCursor,
    direction: "before"
  }
});

// Update only oldest boundary
await updateChatListSync({
  newestCursor: syncState.newestCursor, // ← Keep unchanged
  oldestCursor: response.oldestCursor,  // ← Update
});
```

### Window Model

```
API's Full Chat List:
[C1][C2][C3][C4][C5][C6][C7][C8][C9][C10]...

First Sync (no cursor):
        [C1][C2][C3]
         ↑        ↑
   newestCursor  oldestCursor

Incremental Sync (after):
[C0]←── NEW
 ↑
newestCursor updated

Load More (before):
                    [C4][C5]←── OLDER
                            ↑
                      oldestCursor updated
```

## Message Pagination (Per Chat)

### Three Operations

#### 1. Initial Message Sync
```
Chat appears in list or user opens it
↓
Fetch: Last 15 messages (scheduled sync)
  OR: Full history (user manually opens chat)
Store: newestMessageSortKey, oldestMessageSortKey
UI: Shows recent messages
```

**Scheduled Sync** (lightweight):
```typescript
// Just get last 15 for preview
const response = await client.get(`/v1/chats/${chatId}/messages`, {
  query: { limit: 15 }
});
```

**Full Load** (when user opens chat):
```typescript
// Get full history (last year)
const allMessages = [];
for await (const message of client.messages.list({
  chatID: chatId,
  dateAfter: oneYearAgo.toISOString(),
})) {
  allMessages.push(message);
}
// Set hasCompleteHistory = true
```

#### 2. Refresh New Messages
```
Scheduled sync or user in chat
↓
Fetch: Only NEWER messages (direction: "after")
Store: Update newestMessageSortKey only
UI: New messages appear at bottom
```

**Implementation**:
```typescript
// Get NEWER messages only
const response = await client.get(`/v1/chats/${chatId}/messages`, {
  query: {
    cursor: chat.newestMessageSortKey,
    direction: "after"
  }
});

// Update only newest boundary
await updateChatMessageCursors({
  newestMessageSortKey: response.items[0]?.sortKey, // ← Update
  oldestMessageSortKey: chat.oldestMessageSortKey,  // ← Keep
});
```

#### 3. Load Older Messages (Scroll Up)
```
User scrolls to top of conversation
↓
Fetch: OLDER messages (direction: "before")
Store: Update oldestMessageSortKey only
UI: Older messages prepended to top
```

**Implementation**:
```typescript
// Get OLDER messages
const response = await client.get(`/v1/chats/${chatId}/messages`, {
  query: {
    cursor: chat.oldestMessageSortKey,
    direction: "before",
    limit: 50
  }
});

// Update only oldest boundary
await updateChatMessageCursors({
  newestMessageSortKey: chat.newestMessageSortKey, // ← Keep
  oldestMessageSortKey: response.items[0]?.sortKey, // ← Update
  hasCompleteHistory: !response.hasMore, // Mark if reached end
});
```

### Window Model

```
Chat's Full History:
[M1][M2][M3][M4][M5][M6][M7][M8][M9][M10]...

Initial Load (15 most recent):
                [M1][M2][M3]
                 ↑        ↑
           newestSortKey  oldestSortKey

Refresh (after):
[M0]←── NEW
 ↑
newestSortKey updated

Scroll Up (before):
                            [M4][M5]←── OLDER
                                    ↑
                              oldestSortKey updated
```

## API Actions

### Chat List

| Action | Endpoint | Parameters | Updates |
|--------|----------|------------|---------|
| **First Sync** | `GET /v1/chats` | `{}` (empty) | Both cursors |
| **Refresh** | `GET /v1/chats` | `cursor: newestCursor`<br>`direction: "after"` | Newest only |
| **Load More** | `GET /v1/chats` | `cursor: oldestCursor`<br>`direction: "before"` | Oldest only |

### Messages

| Action | Endpoint | Parameters | Updates |
|--------|----------|------------|---------|
| **Initial** | `GET /v1/chats/{id}/messages` | `limit: 15` | Both sortKeys |
| **Refresh** | `GET /v1/chats/{id}/messages` | `cursor: newestSortKey`<br>`direction: "after"` | Newest only |
| **Scroll Up** | `GET /v1/chats/{id}/messages` | `cursor: oldestSortKey`<br>`direction: "before"` | Oldest only |

## Frontend Integration

### Chat List UI

```tsx
// Component state
const [hasMoreOlderChats, setHasMoreOlderChats] = useState(true);

// Load more button
<Button onClick={async () => {
  const result = await loadOlderChats.mutate({});
  setHasMoreOlderChats(result.hasMore);
}}>
  {hasMoreOlderChats ? "Load More Chats" : "No More Chats"}
</Button>
```

### Messages UI (Infinite Scroll)

```tsx
// Detect scroll to top
const handleScroll = async (e) => {
  if (e.target.scrollTop === 0 && !chat.hasCompleteHistory) {
    const result = await loadOlderMessages.mutate({
      chatId: currentChatId
    });
    if (!result.hasMore) {
      // Reached beginning of conversation
      setHasCompleteHistory(true);
    }
  }
};

<div onScroll={handleScroll} className="messages-container">
  {chat.hasCompleteHistory && (
    <div className="beginning-marker">
      Beginning of conversation
    </div>
  )}
  {messages.map(msg => <Message key={msg.id} {...msg} />)}
</div>
```

## Gap Prevention

### Chat List Gaps

**Prevented by**:
- Always tracking both `newestCursor` and `oldestCursor`
- Only updating newest during incremental syncs
- Only updating oldest during "Load More"
- Never allowing cursors to cross or overlap

### Message Gaps

**Prevented by**:
- Tracking both `newestMessageSortKey` and `oldestMessageSortKey`
- Setting `hasCompleteHistory` flag when reaching end
- Using sortKey-based pagination (guaranteed ordering)
- Message deduplication (skip already-stored messages)

## Performance Benefits

### Chat List

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| First load | ALL chats (100+) | Initial batch (~50) | **50%** ⬇️ |
| Refresh | ALL chats (100+) | New chats only (1-5) | **95%** ⬇️ |
| Load more | N/A | On-demand (50 at a time) | User controlled |

### Messages

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| Sync | 15 every time | Only new messages (1-3) | **80%** ⬇️ |
| View chat | 15 messages | Full history on-demand | User controlled |
| Scroll up | N/A | 50 at a time | Infinite scroll |

## Complete Flow Example

### User Opens App for First Time

1. **Chat List Initial Load**:
   ```
   Fetch: Most recent 50 chats
   Store: newestCursor, oldestCursor
   UI: Show 50 chats + "Load More" button
   ```

2. **User Opens a Chat**:
   ```
   Trigger: loadFullConversation
   Fetch: All messages from last year (auto-paginated)
   Store: newestSortKey, oldestSortKey, hasCompleteHistory=true
   UI: Show full conversation
   ```

3. **Background Sync (10 min later)**:
   ```
   Chat List: Fetch newer chats only (direction: "after")
   Messages: Fetch newer messages for active chats
   Store: Update newest cursors only
   UI: New items appear automatically
   ```

4. **User Scrolls Up in Chat**:
   ```
   Detect: scrollTop === 0 && !hasCompleteHistory
   Fetch: Older messages (direction: "before", limit: 50)
   Store: Update oldestSortKey
   UI: Prepend older messages to top
   ```

5. **User Clicks "Load More Chats"**:
   ```
   Trigger: loadOlderChats
   Fetch: Older chats (direction: "before")
   Store: Update oldestCursor
   UI: Append older chats to bottom
   ```

## Files

- **Backend Actions**: `convex/beeperPagination.ts`
  - `loadOlderChats()` - Paginate chat list backward
  - `loadOlderMessages()` - Paginate messages backward

- **Sync Logic**: `convex/beeperSync.ts`
  - Incremental syncs use `direction: "after"`
  - First sync loads initial batch (no cursor)

- **Message Load**: `convex/beeperMessages.ts`
  - `loadFullConversation()` - Full history on-demand

## Key Principles

1. ✅ **Never load everything** - Always paginate
2. ✅ **Incremental by default** - Only fetch new data
3. ✅ **User-triggered history** - Load older on-demand
4. ✅ **Track both boundaries** - Know our window exactly
5. ✅ **Prevent gaps** - Update only one cursor at a time
6. ✅ **Complete flag** - Know when we have everything

## Testing

### Chat List Pagination
- [ ] First sync loads initial batch (not all chats)
- [ ] "Load More" button appears if hasMore = true
- [ ] Clicking "Load More" loads older chats
- [ ] Incremental sync only fetches new chats
- [ ] No duplicate chats appear

### Message Pagination
- [ ] Opening chat loads full history
- [ ] Scrolling up loads older messages
- [ ] "Beginning of conversation" shows when complete
- [ ] New messages appear automatically during sync
- [ ] No duplicate messages appear

### Gap Prevention
- [ ] Run `detectGaps` query returns no issues
- [ ] Cursors are always stored correctly
- [ ] Window boundaries never cross
- [ ] Complete history flag is accurate

