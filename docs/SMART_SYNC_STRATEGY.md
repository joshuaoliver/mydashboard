# Smart Sync Strategy - Avoiding Redundant Data Fetches

## Current State Analysis

### What We're Already Doing ✅

1. **Storing to Convex Database**:
   - `beeperChats` table: Chat metadata
   - `beeperMessages` table: Messages per chat
   
2. **Tracking Sync State**:
   - `lastSyncedAt`: When chat was last synced
   - `lastMessagesSyncedAt`: When messages were last fetched
   - `lastActivity`: Last activity timestamp from API

3. **Conditional Message Syncing**:
   ```typescript
   shouldSyncMessages = 
     !existingChat.lastMessagesSyncedAt ||
     chat.lastActivity > existingChat.lastMessagesSyncedAt
   ```

### What We're Missing ❌

1. **In-Memory Cache Only** (Lost on Restart):
   ```typescript
   let lastSyncTimestamp: number | null = null; // ❌ Not persistent
   ```

2. **Not Using API Cursors**: The Beeper API returns:
   ```typescript
   {
     items: Chat[],
     hasMore: boolean,
     newestCursor: string,  // ❌ Not storing this
     oldestCursor: string   // ❌ Not storing this
   }
   ```

3. **Fetching ALL Chats Every Time**: Even if only 1 chat changed

## Smart Sync Strategy

### Strategy 1: Cursor-Based Chat List Sync (BEST)

**How it works**:
```
First Sync:  Fetch all chats → Store newestCursor
             ↓
Next Sync:   Only fetch chats newer than newestCursor
             ↓
Result:      Only new/updated chats fetched!
```

**Implementation**:

#### Step 1: Add Cursor Tracking to Database

```typescript
// In schema.ts - Add new table
syncState: defineTable({
  entity: v.string(),        // "chat_list" or "chat_messages:{chatId}"
  newestCursor: v.optional(v.string()),
  oldestCursor: v.optional(v.string()),
  lastSyncedAt: v.number(),
  syncSource: v.string(),
})
  .index("by_entity", ["entity"]),
```

#### Step 2: Use Cursors for Chat List

```typescript
// In beeperSync.ts
export const syncBeeperChatsInternal = internalAction({
  handler: async (ctx, args) => {
    const client = createBeeperClient();
    
    // 1. Get last sync state from database (not in-memory!)
    const syncState = await ctx.runQuery(internal.syncState.getSyncState, {
      entity: "chat_list"
    });
    
    // 2. Use cursor from last sync
    const queryParams: any = {};
    if (syncState?.newestCursor && !args.bypassCache) {
      // Only fetch chats newer than our last cursor
      queryParams.cursor = syncState.newestCursor;
      queryParams.direction = "after"; // Get newer chats
      
      console.log(`[Smart Sync] Using cursor: ${syncState.newestCursor}`);
      console.log(`[Smart Sync] Only fetching chats with new activity`);
    }
    
    // 3. Fetch from API
    const response = await client.get('/v1/chats', {
      query: queryParams
    }) as any;
    
    const chats = response.items || [];
    console.log(`[Smart Sync] Fetched ${chats.length} chats (not ${allChatsCount}!)`);
    
    // 4. Save new cursor for next sync
    await ctx.runMutation(internal.syncState.updateSyncState, {
      entity: "chat_list",
      newestCursor: response.newestCursor,
      oldestCursor: response.oldestCursor,
      lastSyncedAt: Date.now(),
      syncSource: args.syncSource,
    });
    
    // 5. Process chats...
  }
});
```

**Benefits**:
- ✅ **Fetch only new/updated chats** (not all 100+ chats every time)
- ✅ **Persistent across restarts** (stored in database)
- ✅ **Uses official API pagination** (cursor-based)
- ✅ **Dramatically reduces API calls**

### Strategy 2: Smart Message Deduplication (ALREADY DOING)

**Current Logic** (Already Optimal):
```typescript
// In syncChatMessages mutation
const existingMessage = await ctx.db
  .query("beeperMessages")
  .withIndex("by_message_id", (q) => q.eq("messageId", msg.messageId))
  .first();

if (existingMessage) {
  skippedCount++; // ✅ Skip, already have it
} else {
  await ctx.db.insert("beeperMessages", msg); // ✅ Only insert new
  insertedCount++;
}
```

**Why it's smart**:
- Messages are immutable (never change)
- Using unique `messageId` index for fast lookups
- Only inserts NEW messages, skips duplicates

### Strategy 3: Per-Chat Message Cursors

**Current**: Fetching last 15 messages per chat every time

**Smarter**: Track cursor per chat

```typescript
// In schema.ts - Add to beeperChats table
beeperChats: defineTable({
  // ... existing fields
  messagesNewestCursor: v.optional(v.string()),  // NEW
  messagesOldestCursor: v.optional(v.string()),  // NEW
})
```

**Implementation**:
```typescript
// Only fetch messages NEWER than our cursor
const messagesResponse = await client.get(
  `/v1/chats/${chat.id}/messages`,
  {
    query: {
      cursor: existingChat.messagesNewestCursor, // Resume from here
      direction: "after", // Only newer messages
    }
  }
);

// Update cursor for next sync
await ctx.db.patch(chatDocId, {
  messagesNewestCursor: messagesResponse.newestCursor,
  lastMessagesSyncedAt: now,
});
```

**Benefits**:
- ✅ **Only fetch NEW messages** (not last 15 every time)
- ✅ **Resume from where we left off**
- ✅ **Zero duplicate fetches**

### Strategy 4: Preview Data Optimization (ALREADY DOING)

**Current Implementation** (Already Optimal):
```typescript
const preview = chat.preview;
if (preview) {
  lastMessage = preview.text;
  lastMessageFrom = preview.isSender ? "user" : "them";
  needsReply = !preview.isSender;
}
```

**Why it's smart**:
- Chat list API includes last message preview
- No need to fetch messages just to get last message text
- Saves API calls for chats we're not actively viewing

## Recommended Implementation Priority

### Priority 1: Add Cursor Tracking (HIGH IMPACT)

**Files to Create/Modify**:

1. **Create**: `convex/syncState.ts`
```typescript
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getSyncState = internalQuery({
  args: { entity: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("syncState")
      .withIndex("by_entity", (q) => q.eq("entity", args.entity))
      .first();
  },
});

export const updateSyncState = internalMutation({
  args: {
    entity: v.string(),
    newestCursor: v.optional(v.string()),
    oldestCursor: v.optional(v.string()),
    lastSyncedAt: v.number(),
    syncSource: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncState")
      .withIndex("by_entity", (q) => q.eq("entity", args.entity))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("syncState", args);
    }
  },
});
```

2. **Update**: `convex/schema.ts`
```typescript
syncState: defineTable({
  entity: v.string(),        // "chat_list" or "chat:{chatId}"
  newestCursor: v.optional(v.string()),
  oldestCursor: v.optional(v.string()),
  lastSyncedAt: v.number(),
  syncSource: v.string(),
})
  .index("by_entity", ["entity"]),
```

3. **Update**: `convex/beeperSync.ts`
- Replace in-memory `lastSyncTimestamp` with database query
- Use cursors for pagination
- Store cursors after each sync

### Priority 2: Per-Chat Message Cursors (MEDIUM IMPACT)

**Files to Modify**:

1. **Update**: `convex/schema.ts`
```typescript
beeperChats: defineTable({
  // ... existing fields
  messagesNewestCursor: v.optional(v.string()),
  messagesOldestCursor: v.optional(v.string()),
})
```

2. **Update**: `convex/beeperSync.ts`
```typescript
// When fetching messages, use cursor
if (existingChat?.messagesNewestCursor) {
  messageQueryParams.cursor = existingChat.messagesNewestCursor;
  messageQueryParams.direction = "after";
}

// After syncing, save new cursor
await ctx.db.patch(chatDocId, {
  messagesNewestCursor: messagesResponse.newestCursor,
});
```

### Priority 3: Message Count Limits (LOW PRIORITY)

Already implemented - fetching only 15 messages per chat is good for scheduled syncs.

## Impact Analysis

### Current Behavior (After Our Recent Changes)

**Scheduled Sync (Every 10 min)**:
```
- Fetch: 100 chats (even if only 1 changed)
- For each active chat: Fetch 15 messages
- Total API calls: 1 (chat list) + N (messages) = 1-20 calls
```

**With Smart Sync (Cursor-Based)**:
```
- Fetch: Only chats with new activity (maybe 1-5 chats)
- For each active chat: Only NEW messages (maybe 1-3 messages)
- Total API calls: 1 (chat list) + N (messages) = 1-5 calls
```

### Potential Savings

| Metric | Current | With Cursors | Savings |
|--------|---------|--------------|---------|
| **Chat list data** | 100 chats | 1-5 chats | **95-99%** |
| **Message fetches** | 15 per chat | 1-3 new only | **80-90%** |
| **API calls per sync** | 10-20 | 2-5 | **75%** |
| **Data transfer** | ~500KB | ~50KB | **90%** |

## Quick Wins (Can Implement Now)

### Win 1: Store Cursors in Database

Replace this:
```typescript
let lastSyncTimestamp: number | null = null; // ❌ In-memory
```

With this:
```typescript
// Query from database
const syncState = await ctx.runQuery(internal.syncState.getSyncState, {
  entity: "chat_list"
}); // ✅ Persistent
```

### Win 2: Use `direction: "after"` for Messages

Instead of fetching last 15 messages:
```typescript
limit: 15 // ❌ Always fetches 15
```

Use cursor to fetch only NEW:
```typescript
cursor: existingChat.messagesNewestCursor,
direction: "after" // ✅ Only new messages since last sync
```

### Win 3: Respect `hasMore` Flag

The API tells us if there are more results:
```typescript
if (response.hasMore) {
  // More chats/messages available
  // Can fetch next page if needed
}
```

## Summary

**What you should implement**:

1. ✅ **Create `syncState` table** to store cursors persistently
2. ✅ **Use cursor-based pagination** for chat list
3. ✅ **Store message cursors per chat** to only fetch new messages
4. ✅ **Replace in-memory cache** with database queries

**Expected outcome**:
- **90% reduction** in data transferred
- **75% reduction** in API calls
- **Faster syncs** (less data to process)
- **More scalable** (works with thousands of chats)
- **Persistent** (survives restarts)

Would you like me to implement the cursor-based sync strategy?

