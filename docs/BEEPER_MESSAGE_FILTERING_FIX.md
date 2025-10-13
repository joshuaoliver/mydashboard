# Beeper Message Filtering Bug Fix

## Date
October 11, 2025

## Problem

All chats in the frontend were displaying the exact same messages, regardless of which conversation was selected. When clicking on different chats, users would see identical message lists instead of the messages specific to that conversation.

## Root Cause

The `/v0/search-messages` API endpoint was being called with incorrect parameters:

**Incorrect (what we were doing):**
```typescript
client.get('/v0/search-messages', {
  query: {
    chatID: chat.id,  // ❌ Wrong: singular, string
    limit: 30,
  }
})
```

The API was ignoring the `chatID` parameter entirely and returning the most recent messages across ALL chats, which is why every conversation showed the same messages.

## Solution

After reviewing the Beeper API spec, we discovered that:

1. The parameter is `chatIDs` (plural), not `chatID` (singular)
2. It must be an **array**, not a string
3. In GET requests, arrays must use bracket notation: `chatIDs[]=value`

**Correct implementation:**
```typescript
const messagesUrl = `${BEEPER_API_URL}/v0/search-messages?chatIDs[]=${encodeURIComponent(chat.id)}&limit=30`;

const messagesResponse = await fetch(messagesUrl, {
  method: "GET",
  headers: { "Authorization": `Bearer ${BEEPER_TOKEN}` },
  signal: controller.signal,
});
```

## Files Modified

### `/convex/beeperSync.ts`
- Changed from SDK call to direct `fetch` for messages endpoint
- Updated parameter from `chatID` (singular) to `chatIDs[]` (array notation)
- Added proper error handling and timeout management

## Verification

After the fix:
- ✅ Synced 850 messages across 50 different chats
- ✅ Each chat now displays its own unique messages
- ✅ No duplicate messages across chats
- ✅ Messages properly filtered by conversation

### Example Results

**Before Fix:**
- Chat "Kaan's bucks": Message IDs 146456, 146455, 146454
- Chat "Natasha T": Message IDs 146456, 146455, 146454 (SAME!)

**After Fix:**
- Chat "Kaan's bucks": Message IDs 146455, 146454, 146453 (Group chat messages)
- Chat "William": Message IDs 133062, 134266, 134609 (Different messages!)

## API Documentation Reference

From the Beeper API spec (`/v0/spec`):

```json
"chatIDs": {
  "type": "array",
  "items": {
    "type": "string"
  },
  "description": "Limit search to specific Beeper chat IDs.",
  "example": [
    "!NCdzlIaMjZUmvmvyHU:beeper.com",
    "1231073"
  ]
}
```

## Technical Notes

### Why Not Use the SDK?

The Beeper TypeScript SDK doesn't properly handle array query parameters. When passing `chatIDs: [chat.id]`, the SDK converts it to a string, causing the API to reject it with:

```json
{
  "code": "invalid_type",
  "expected": "array",
  "received": "string",
  "message": "Expected array, received string"
}
```

### URL Encoding

For GET requests with array parameters, the correct format is:
- `?chatIDs[]=value1&chatIDs[]=value2`

For a single value:
- `?chatIDs[]=!khWQX0HPLJWnpriC2xIm:beeper.local`

The brackets `[]` indicate to the API that this is an array parameter.

## Lessons Learned

1. **Always check the API spec** - The OpenAPI spec at `/v0/spec` is authoritative
2. **Test parameter formats** - GET arrays require special notation (`[]`)
3. **SDK limitations** - Sometimes direct `fetch` is more reliable than SDKs
4. **Verify data distribution** - Check that data is actually different across entities

## Related Files

- `convex/beeperSync.ts` - Message sync logic
- `convex/beeperQueries.ts` - Query functions (unchanged, worked correctly)
- `src/routes/messages.tsx` - Frontend display (unchanged, worked correctly)

## Status

✅ **RESOLVED** - All chats now display their correct, unique messages.

