# Convex Action vs Mutation Fix ✅

## The Problem

Got error: `Can't use setTimeout in queries and mutations. Can't use fetch() in queries and mutations.`

**Root Cause**: I was using `fetch()` and `setTimeout()` inside an `internalMutation`, but in Convex:
- ❌ **Mutations** can only read/write database (no external APIs, no setTimeout)
- ✅ **Actions** can call external APIs, use setTimeout, but can't directly access `ctx.db`

## The Solution

Split the sync logic into proper layers:

### Architecture Change

**Before (WRONG)**:
```
internalMutation syncBeeperChatsInternal
  ├─ fetch() from Beeper API ❌ (not allowed!)
  ├─ setTimeout() for timeout ❌ (not allowed!)
  └─ ctx.db.insert/patch ✅ (allowed)
```

**After (CORRECT)**:
```
internalAction syncBeeperChatsInternal
  ├─ fetch() from Beeper API ✅ (allowed in actions!)
  ├─ setTimeout() for timeout ✅ (allowed in actions!)
  └─ calls mutations to write to DB:
      ├─ ctx.runMutation(upsertChat) → writes chat to DB
      └─ ctx.runMutation(syncChatMessages) → writes messages to DB
```

### New File Structure

**`convex/beeperSync.ts`**:

1. **`upsertChat` (internalMutation)** - Writes chat to database
   - Takes chat data as input
   - Checks if chat exists
   - Updates or inserts
   - Returns `{ chatDocId, shouldSyncMessages }`

2. **`syncChatMessages` (internalMutation)** - Writes messages to database
   - Takes messages array as input
   - Deletes old messages for chat
   - Inserts new messages
   - Updates `lastMessagesSyncedAt`

3. **`syncBeeperChatsInternal` (internalAction)** - Orchestrates sync
   - Fetches from Beeper API (allowed!)
   - Uses setTimeout for timeouts (allowed!)
   - Calls mutations to write to database
   - Handles all errors gracefully

4. **`manualSync` & `pageLoadSync` (public actions)**
   - Call the internal action
   - Return results to frontend

## Key Changes Made

### 1. Changed Function Type
```typescript
// Before
export const syncBeeperChatsInternal = internalMutation({
  
// After  
export const syncBeeperChatsInternal = internalAction({
```

### 2. Created Helper Mutations
```typescript
export const upsertChat = internalMutation({
  args: { chatData: v.object({...}) },
  handler: async (ctx, args) => {
    // Can use ctx.db here!
    const existing = await ctx.db.query(...).first()
    if (existing) {
      await ctx.db.patch(...)
    } else {
      await ctx.db.insert(...)
    }
    return { chatDocId, shouldSyncMessages }
  }
})

export const syncChatMessages = internalMutation({
  args: { chatId, messages, chatDocId, lastMessagesSyncedAt },
  handler: async (ctx, args) => {
    // Can use ctx.db here!
    await ctx.db.delete(...)
    await ctx.db.insert(...)
    await ctx.db.patch(...)
  }
})
```

### 3. Call Mutations from Action
```typescript
// In the action (can't use ctx.db directly)
const { chatDocId, shouldSyncMessages } = await ctx.runMutation(
  internal.beeperSync.upsertChat,
  { chatData }
)

if (shouldSyncMessages) {
  const messageCount = await ctx.runMutation(
    internal.beeperSync.syncChatMessages,
    { chatId, messages, chatDocId, lastMessagesSyncedAt }
  )
}
```

### 4. Updated Public Actions
```typescript
// Changed from runMutation to runAction
export const manualSync = action({
  handler: async (ctx) => {
    const result = await ctx.runAction(  // Was runMutation
      internal.beeperSync.syncBeeperChatsInternal,
      { syncSource: "manual" }
    )
    return result
  }
})
```

## Convex Function Types Explained

| Type | Can Use | Can't Use | Use Case |
|------|---------|-----------|----------|
| **Query** | `ctx.db` (read only) | Write to DB, fetch(), setTimeout | Fast reads, reactive |
| **Mutation** | `ctx.db` (read/write) | fetch(), setTimeout | Write to database |
| **Action** | fetch(), setTimeout, runMutation, runQuery | `ctx.db` directly | External APIs, long operations |

## Why This Architecture?

### Separation of Concerns
- **Action**: Handles external world (Beeper API, timeouts)
- **Mutations**: Handle database writes (ACID transactions)

### Benefits
1. ✅ **Type Safety**: Convex enforces what you can do where
2. ✅ **Transactional**: Mutations are atomic
3. ✅ **Cacheable**: Queries are automatically cached
4. ✅ **Clear Boundaries**: External vs internal operations

### Data Flow
```
Cron/Frontend
    ↓ calls
Public Action (manualSync/pageLoadSync)
    ↓ calls
Internal Action (syncBeeperChatsInternal)
    ├─ fetch from Beeper API
    ├─ prepare data
    ↓ calls
Internal Mutations (upsertChat, syncChatMessages)
    └─ write to Convex database
```

## Testing

The fix is complete! Now:
```bash
npm run dev
```

Should work without errors. The sync will:
1. ✅ Fetch from Beeper API (in action)
2. ✅ Use timeouts (in action)
3. ✅ Write to database (via mutations)
4. ✅ Handle errors gracefully
5. ✅ Return status to frontend

## Files Modified

1. ✅ `convex/beeperSync.ts`
   - Changed `syncBeeperChatsInternal` from mutation → action
   - Created `upsertChat` mutation
   - Created `syncChatMessages` mutation
   - Updated to call mutations via `ctx.runMutation`
   - Updated public actions to use `ctx.runAction`

2. ✅ `convex/crons.ts`
   - No changes needed (already calling the internal function correctly)

## Summary

**Problem**: Used external APIs in mutations (not allowed)  
**Solution**: Use actions for external APIs, mutations for database writes  
**Result**: Clean separation, proper error handling, follows Convex best practices

Now your sync system is architecturally correct and should work perfectly! 🎉

