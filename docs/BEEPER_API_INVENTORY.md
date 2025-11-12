# Beeper API Inventory - Current Usage

This document lists all Beeper APIs currently being used in the codebase and how they're being called.

## API Endpoints Currently Used

### 1. Chat List/Search (❌ ISSUE: Wrong Endpoint)

**File**: `convex/beeperSync.ts:267-282`

**Current Implementation**:
```typescript
const response = await client.get('/v1/chats/search', {
  query: {
    limit: 100,
    lastActivityAfter: new Date(lastSyncTimestamp).toISOString(), // Custom filter
  }
}) as any;

const chats = response.items || [];
```

**Purpose**: Fetch list of chats for syncing
- Used in: `syncBeeperChatsInternal` action
- Called from: Cron jobs, manual sync, page load sync
- Frequency: Every 10 minutes (cron) + on-demand

**Issues**:
- ❌ `/v1/chats/search` is NOT the official endpoint
- ❌ Official API is `GET /v1/chats` with different query parameters
- ❌ Not extracting `preview` field (last message preview)

**Official API**: `GET /v1/chats`
- Query params: `accountIDs`, `cursor`, `direction`
- Returns: `items[]`, `hasMore`, `newestCursor`, `oldestCursor`, `preview` (per chat)

---

### 2. Retrieve Single Chat (✅ CORRECT)

**File**: `convex/beeperGlobalSync.ts:103`

**Current Implementation**:
```typescript
const chatResponse = await client.get(`/v1/chats/${encodeURIComponent(chatId)}`) as any;
chatsMap[chatId] = chatResponse;
```

**Purpose**: Fetch detailed metadata for a specific chat
- Used in: `syncLatestMessagesGlobal` action
- Called when: Syncing messages globally and need chat metadata
- Frequency: Once per chat that has new messages

**Status**: ✅ Correct endpoint usage
- Endpoint: `GET /v1/chats/{chatID}`
- Returns: Full chat object with participants, metadata, etc.

---

### 3. List Messages for Chat (✅ CORRECT)

**File**: `convex/beeperSync.ts:390`

**Current Implementation**:
```typescript
const messagesResponse = await client.get(`/v1/chats/${encodeURIComponent(chat.id)}/messages`, {
  query: {
    limit: 200,
    dateAfter: new Date(existingChat.lastMessagesSyncedAt).toISOString(), // Incremental sync
  }
}) as any;

messages = messagesResponse.items || [];
```

**Purpose**: Fetch messages for a specific chat
- Used in: `syncBeeperChatsInternal` action
- Called when: Syncing messages for chats with new activity
- Frequency: Per chat during sync (if `shouldSyncMessages` is true)

**Status**: ✅ Correct endpoint usage
- Endpoint: `GET /v1/chats/{chatID}/messages`
- Query params: `limit`, `dateAfter`, `dateBefore`, `cursor`, `direction`

**Also Used Via SDK**:
```typescript
// convex/beeperSync.ts:378-384
for await (const message of client.messages.list({
  chatID: chat.id,
  dateAfter: new Date(existingChat.lastMessagesSyncedAt).toISOString(),
  limit: 100,
} as any)) {
  allMessages.push(message);
}
```

**Purpose**: Auto-pagination to fetch ALL new messages
- Used in: Incremental message sync
- Benefit: Automatically handles pagination

---

### 4. Search Messages Globally (⚠️ NEEDS VERIFICATION)

**File**: `convex/beeperGlobalSync.ts:92`

**Current Implementation**:
```typescript
for await (const message of client.messages.search(queryParams as any)) {
  messages.push(message);
}
```

**Purpose**: Fetch latest messages across ALL chats in one call
- Used in: `syncLatestMessagesGlobal` action
- Called from: Hybrid sync, global message sync
- Frequency: On-demand (not in cron)

**Status**: ⚠️ SDK method - needs verification
- May be abstraction over `GET /v1/messages/search` endpoint
- Query params: `limit`, `dateAfter`, `chatID`, etc.

**Note**: This is more efficient than per-chat fetching, but we need to verify it matches official API.

---

### 5. Send Message (✅ CORRECT)

**File**: `convex/beeperMessages.ts:121`

**Current Implementation**:
```typescript
const response = await client.post(`/v1/chats/${args.chatId}/messages`, {
  body: {
    text: args.text,
    replyToMessageID: args.replyToMessageId, // Optional
  },
}) as any;
```

**Purpose**: Send a message to a Beeper chat
- Used in: `sendMessage` action
- Called from: Frontend when user sends a message
- Frequency: On-demand (user action)

**Status**: ✅ Correct endpoint usage
- Endpoint: `POST /v1/chats/{chatID}/messages`
- Request body: `text`, `replyToMessageID` (optional)

**Returns**:
- `chatID`: The chat the message was sent to
- `pendingMessageID`: Temporary ID until message is confirmed

---

### 6. Focus Chat (✅ CORRECT)

**File**: `convex/beeperMessages.ts:59`

**Current Implementation**:
```typescript
const response = await client.post(`/v1/focus`, {
  body: {
    chatID: args.chatId,
    draftText: args.draftText, // Optional
  },
}) as any;
```

**Purpose**: Open/focus a chat in Beeper Desktop
- Used in: `focusChat` action
- Called from: Frontend "Open in Beeper" button
- Frequency: On-demand (user action)

**Status**: ✅ Correct endpoint usage
- Endpoint: `POST /v1/focus`
- Request body: `chatID`, `draftText` (optional), `messageID` (optional)

**Returns**:
- `success`: boolean indicating if focus was successful

---

### 7. Load Full Conversation (✅ CORRECT - Uses SDK)

**File**: `convex/beeperMessages.ts:189-195`

**Current Implementation**:
```typescript
const allMessages: any[] = [];
for await (const message of client.messages.list({
  chatID: roomId,
  dateAfter: oneYearAgo.toISOString(),
  limit: 100,
} as any)) {
  allMessages.push(message);
}
```

**Purpose**: Load entire conversation history (last year)
- Used in: `loadFullConversation` action
- Called from: Frontend when user requests full history
- Frequency: On-demand (user action)

**Status**: ✅ Uses SDK auto-pagination correctly
- SDK method: `client.messages.list()`
- Automatically paginates to fetch all messages

---

## SDK Methods vs Direct HTTP Calls

### SDK Methods Used

1. **`client.messages.list()`** - Auto-pagination for messages
   - Used in: `beeperSync.ts:378`, `beeperMessages.ts:189`
   - Wraps: `GET /v1/chats/{chatID}/messages`

2. **`client.messages.search()`** - Global message search
   - Used in: `beeperGlobalSync.ts:92`
   - Wraps: `GET /v1/messages/search` (needs verification)

3. **`client.get()`** - Generic GET request
   - Used in: `beeperSync.ts:280`, `beeperGlobalSync.ts:103`
   - Wraps: Various GET endpoints

4. **`client.post()`** - Generic POST request
   - Used in: `beeperMessages.ts:59`, `beeperMessages.ts:121`
   - Wraps: Various POST endpoints

### Direct HTTP Calls

None - all calls go through the Beeper SDK client.

---

## Data Flow Summary

### Chat Sync Flow

```
1. syncBeeperChatsInternal (beeperSync.ts)
   ↓
2. GET /v1/chats/search ❌ (should be /v1/chats)
   ↓
3. For each chat:
   - Upsert chat metadata
   - If shouldSyncMessages:
     - GET /v1/chats/{chatID}/messages (or SDK auto-pagination)
     - Store messages
```

### Global Message Sync Flow

```
1. syncLatestMessagesGlobal (beeperGlobalSync.ts)
   ↓
2. client.messages.search() ⚠️ (SDK method)
   ↓
3. For each unique chatId:
   - GET /v1/chats/{chatID} (fetch metadata)
   - Upsert chat
   - Store messages
```

### Hybrid Sync Flow

```
1. hybridSync (beeperGlobalSync.ts)
   ↓
2. Step 1: syncBeeperChatsInternal (chat list)
   ↓
3. Step 2: syncLatestMessagesGlobal (messages)
```

---

## Issues Summary

### Critical Issues

1. **Wrong Endpoint**: Using `/v1/chats/search` instead of `/v1/chats`
   - **Impact**: May not work with standard Beeper installations
   - **Fix**: Replace with `/v1/chats` and use cursor pagination

2. **Missing Preview Data**: Not extracting `preview` field from chat list
   - **Impact**: Chat metadata may be stale, unnecessary message fetches
   - **Fix**: Extract `preview.text`, `preview.senderName`, `preview.timestamp`

3. **Incomplete Metadata**: Not storing all available chat fields
   - **Impact**: Missing useful metadata like `description`, `lastReadMessageSortKey`
   - **Fix**: Extract and store additional fields

### Minor Issues

1. **SDK Method Verification**: `client.messages.search()` needs verification
   - **Impact**: May not match official API structure
   - **Fix**: Verify against official docs or use direct HTTP calls

2. **Date Filtering**: Using `lastActivityAfter` which may not be supported
   - **Impact**: May not filter correctly
   - **Fix**: Use cursor-based pagination instead

---

## Recommendations

1. **Replace `/v1/chats/search` with `/v1/chats`**
   - Use cursor-based pagination
   - Extract `preview` data from responses

2. **Extract Preview Data**
   - Update `lastMessage` from `preview.text`
   - Update `lastMessageFrom` from `preview.isSender`
   - Use `preview.timestamp` if newer than `lastActivity`

3. **Store Additional Metadata**
   - Add `description`, `lastReadMessageSortKey` to schema
   - Extract and store participant counts

4. **Verify SDK Methods**
   - Check if `client.messages.search()` matches official API
   - Consider using direct HTTP calls for better control

5. **Test with Official API**
   - Ensure compatibility with standard Beeper Desktop
   - Verify pagination works correctly

---

## References

- [Beeper Desktop API Documentation](https://developers.beeper.com/desktop-api-reference)
- [List Chats API](https://developers.beeper.com/desktop-api-reference/resources/chats/methods/list)
- [Retrieve Chat API](https://developers.beeper.com/desktop-api-reference/resources/chats/methods/retrieve)
- [List Messages API](https://developers.beeper.com/desktop-api-reference/resources/messages/methods/list)
- [Send Message API](https://developers.beeper.com/desktop-api-reference/resources/messages/methods/send)

