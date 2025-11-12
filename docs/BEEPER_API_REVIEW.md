# Beeper API Usage Review

## Executive Summary

After reviewing the codebase against the [official Beeper Desktop API documentation](https://developers.beeper.com/desktop-api-reference/resources/chats/methods/list), I've identified several critical issues:

1. **❌ Using non-existent endpoint**: `/v1/chats/search` doesn't exist in the official API
2. **❌ Missing chat metadata**: Not extracting `preview` (last message preview) from chat list responses
3. **⚠️ Incomplete metadata sync**: Not using all available fields from the `/v1/chats` endpoint
4. **✅ Correct endpoints**: Message listing, sending, and focus endpoints are correct

## Current Beeper APIs Being Used

### 1. Chat List Endpoint (❌ INCORRECT)

**Current Code**: `convex/beeperSync.ts:280`
```typescript
const response = await client.get('/v1/chats/search', {
  query: queryParams
}) as any;
```

**Problem**: `/v1/chats/search` is **NOT** a documented endpoint in the Beeper API.

**Official API**: `GET /v1/chats` (List chats)
- **Documentation**: https://developers.beeper.com/desktop-api-reference/resources/chats/methods/list
- **Query Parameters**:
  - `accountIDs` (optional array): Limit to specific account IDs
  - `cursor` (optional string): Pagination cursor
  - `direction` (optional "after" | "before"): Pagination direction

**What We're Missing**:
- The `/v1/chats` endpoint returns a `preview` field with the last message preview
- This includes `text`, `senderName`, `timestamp`, `attachments`, etc.
- We're not extracting this preview data to update chat metadata

### 2. Chat Retrieval Endpoint (✅ CORRECT)

**Current Code**: `convex/beeperGlobalSync.ts:103`
```typescript
const chatResponse = await client.get(`/v1/chats/${encodeURIComponent(chatId)}`) as any;
```

**Status**: ✅ Correct endpoint usage
- **Endpoint**: `GET /v1/chats/{chatID}`
- **Documentation**: https://developers.beeper.com/desktop-api-reference/resources/chats/methods/retrieve

### 3. Message List Endpoint (✅ CORRECT)

**Current Code**: `convex/beeperSync.ts:390`
```typescript
const messagesResponse = await client.get(`/v1/chats/${encodeURIComponent(chat.id)}/messages`, {
  query: messageQueryParams
}) as any;
```

**Status**: ✅ Correct endpoint usage
- **Endpoint**: `GET /v1/chats/{chatID}/messages`
- **Documentation**: https://developers.beeper.com/desktop-api-reference/resources/messages/methods/list

### 4. Send Message Endpoint (✅ CORRECT)

**Current Code**: `convex/beeperMessages.ts:121`
```typescript
const response = await client.post(`/v1/chats/${args.chatId}/messages`, {
  body: requestBody,
}) as any;
```

**Status**: ✅ Correct endpoint usage
- **Endpoint**: `POST /v1/chats/{chatID}/messages`
- **Documentation**: https://developers.beeper.com/desktop-api-reference/resources/messages/methods/send

### 5. Focus Endpoint (✅ CORRECT)

**Current Code**: `convex/beeperMessages.ts:59`
```typescript
const response = await client.post(`/v1/focus`, {
  body: requestBody,
}) as any;
```

**Status**: ✅ Correct endpoint usage
- **Endpoint**: `POST /v1/focus`
- **Documentation**: https://developers.beeper.com/desktop-api-reference/resources/$client/methods/focus

### 6. SDK Methods (⚠️ NEEDS VERIFICATION)

**Current Code**: Multiple locations using SDK methods:
- `client.messages.list()` - Auto-pagination for messages
- `client.messages.search()` - Global message search

**Status**: ⚠️ These SDK methods may be abstractions over the HTTP endpoints, but need verification they match the official API structure.

## Critical Issues

### Issue 1: Wrong Endpoint for Chat List

**Location**: `convex/beeperSync.ts:267-282`

**Current**:
```typescript
// V1 API: /v1/chats/search supports lastActivityAfter and lastActivityBefore
const queryParams: any = {
  limit: 100,
};

if (useFilter && lastSyncTimestamp) {
  queryParams.lastActivityAfter = new Date(lastSyncTimestamp).toISOString();
}

const response = await client.get('/v1/chats/search', {
  query: queryParams
}) as any;
```

**Should Be**:
```typescript
// Official API: GET /v1/chats with cursor-based pagination
const queryParams: any = {
  // Note: Official API doesn't support lastActivityAfter filter
  // Need to use cursor-based pagination instead
};

const response = await client.get('/v1/chats', {
  query: queryParams
}) as any;
```

**Impact**: 
- May be working if your custom server supports `/v1/chats/search`, but it's not the official API
- Won't work with standard Beeper Desktop installations
- Missing official pagination support (`cursor`, `direction`)

### Issue 2: Not Extracting Chat Preview Data

**Location**: `convex/beeperSync.ts:295-339`

**Current**: We extract basic chat fields but ignore the `preview` field:

```typescript
const chatData = {
  chatId: chat.id,
  localChatID: chat.localChatID || chat.id,
  title: chat.title || "Unknown",
  // ... other fields
  // ❌ Missing: preview.text (last message text)
  // ❌ Missing: preview.senderName (last message sender)
  // ❌ Missing: preview.timestamp (last message time)
};
```

**Should Extract**:
```typescript
// Extract preview data if available
const preview = chat.preview;
if (preview) {
  chatData.lastMessage = preview.text || undefined;
  chatData.lastMessageFrom = preview.isSender ? "user" : "them";
  // Update lastActivity if preview timestamp is newer
  const previewTime = new Date(preview.timestamp).getTime();
  if (previewTime > lastActivity) {
    chatData.lastActivity = previewTime;
  }
}
```

**Impact**:
- Chat metadata may be stale (not using latest preview from API)
- Missing last message text in chat list
- May need to fetch messages unnecessarily when preview already has the data

### Issue 3: Incomplete Chat Metadata Extraction

**Location**: `convex/beeperSync.ts:295-339`

**Missing Fields** from `/v1/chats` response:
- `description` - Chat description
- `lastReadMessageSortKey` - Last read position
- `participants.hasMore` - Whether there are more participants
- `participants.total` - Total participant count

**Current Extraction**:
```typescript
const chatData = {
  // ✅ Extracted
  chatId: chat.id,
  title: chat.title,
  network: chat.network,
  accountID: chat.accountID,
  type: chat.type,
  lastActivity: new Date(chat.lastActivity).getTime(),
  unreadCount: chat.unreadCount || 0,
  isArchived: chat.isArchived || false,
  isMuted: chat.isMuted || false,
  isPinned: chat.isPinned || false,
  
  // ❌ Missing
  // description: chat.description,
  // lastReadMessageSortKey: chat.lastReadMessageSortKey,
  // participantCount: chat.participants?.total,
};
```

## Recommended Fixes

### Fix 1: Use Official `/v1/chats` Endpoint

Replace `/v1/chats/search` with `/v1/chats` and implement cursor-based pagination:

```typescript
// Use official endpoint
const response = await client.get('/v1/chats', {
  query: {
    // Use cursor-based pagination instead of date filtering
    cursor: cursor, // from previous response
    direction: 'before', // or 'after'
  }
}) as any;

// Extract pagination cursors
const { newestCursor, oldestCursor, hasMore } = response;
```

### Fix 2: Extract Preview Data

Update chat data extraction to include preview:

```typescript
// Extract preview if available
const preview = chat.preview;
let lastMessage = chatData.lastMessage;
let lastMessageFrom = chatData.lastMessageFrom;

if (preview) {
  lastMessage = preview.text || undefined;
  lastMessageFrom = preview.isSender ? "user" : "them";
  
  // Use preview timestamp if it's newer
  const previewTime = new Date(preview.timestamp).getTime();
  if (previewTime > chatData.lastActivity) {
    chatData.lastActivity = previewTime;
  }
}

const chatData = {
  // ... existing fields
  lastMessage,
  lastMessageFrom,
  needsReply: lastMessageFrom === "them",
};
```

### Fix 3: Store Additional Metadata

Add missing fields to schema and extraction:

```typescript
// In schema.ts
beeperChats: defineTable({
  // ... existing fields
  description: v.optional(v.string()),
  lastReadMessageSortKey: v.optional(v.string()),
  participantCount: v.optional(v.number()),
})

// In beeperSync.ts
const chatData = {
  // ... existing fields
  description: chat.description,
  lastReadMessageSortKey: chat.lastReadMessageSortKey,
  participantCount: chat.participants?.total,
};
```

## API Endpoint Summary

| Endpoint | Method | Status | Location | Notes |
|----------|--------|--------|----------|-------|
| `/v1/chats` | GET | ❌ Wrong | `beeperSync.ts:280` | Using `/v1/chats/search` instead |
| `/v1/chats/{chatID}` | GET | ✅ Correct | `beeperGlobalSync.ts:103` | Retrieving single chat |
| `/v1/chats/{chatID}/messages` | GET | ✅ Correct | `beeperSync.ts:390` | Listing messages |
| `/v1/chats/{chatID}/messages` | POST | ✅ Correct | `beeperMessages.ts:121` | Sending messages |
| `/v1/focus` | POST | ✅ Correct | `beeperMessages.ts:59` | Focusing chat |

## Next Steps

1. **Replace `/v1/chats/search` with `/v1/chats`**
2. **Implement cursor-based pagination** instead of date filtering
3. **Extract `preview` data** from chat list responses
4. **Update schema** to store additional metadata fields
5. **Test with official Beeper Desktop API** to ensure compatibility

## References

- [Beeper Desktop API - List Chats](https://developers.beeper.com/desktop-api-reference/resources/chats/methods/list)
- [Beeper Desktop API - Retrieve Chat](https://developers.beeper.com/desktop-api-reference/resources/chats/methods/retrieve)
- [Beeper Desktop API - List Messages](https://developers.beeper.com/desktop-api-reference/resources/messages/methods/list)
- [Beeper Desktop API - Send Message](https://developers.beeper.com/desktop-api-reference/resources/messages/methods/send)

