# Messages Page UX Fixes & Diagnostics

## Changes Made

### 1. ✅ Left Sidebar Wider
- Changed from `w-80` (320px) to `w-96` (384px)

### 2. ✅ Removed Title & Hidden Subtitle
- Removed "Pending Replies" title
- Conversation count and sync time now only show on hover over refresh button
- Uses Tooltip component

### 3. ✅ Contact Panel Shows Searched Username
- When no contact is matched, displays the Instagram username being searched
- Shows in format: `@username`
- Helps debug why matching isn't working

### 4. ✅ Improved Instagram Username Matching
**File: `convex/contactMutations.ts`**

The `findContactByInstagram` query now handles:
- Exact match first
- Try without `@` prefix if username starts with `@`
- Try with `@` prefix if username doesn't have one
- Case-insensitive fallback scan of all contacts

This should fix most @ symbol mismatches between Beeper and Dex.

### 5. ✅ Added Diagnostic Queries
**File: `convex/diagnostics.ts`** (new)

Two diagnostic queries to help debug issues:

#### `checkInstagramUsernames`
Compares Instagram usernames between:
- Beeper chats (`beeperChats` table)
- Dex contacts (`contacts` table)

Returns:
- Count of usernames with/without `@` in each system
- Sample data from each
- List of potential matches with `@` prefix mismatches
- Recommendation if issues found

#### `checkNeedsReply`
Checks why "Unreplied" tab might be empty:
- Shows how many chats have `needsReply = true`
- Shows how many have `needsReply = false`
- Shows how many have `needsReply = undefined`
- Sample of 20 chats with their reply status

## How to Use Diagnostics

### In Convex Dashboard:

1. Go to your Convex dashboard
2. Navigate to "Functions" tab
3. Run these queries:

**Check Instagram Username Mismatches:**
```
diagnostics:checkInstagramUsernames
```

**Check Why Unreplied Tab is Empty:**
```
diagnostics:checkNeedsReply
```

### Expected Findings

#### Issue 1: "Recent activity" instead of message text
**Cause:** `lastMessage` field is `undefined` for existing chats.

**Solution:** Run a manual sync by clicking the refresh button. This will:
- Fetch messages for each chat
- Populate `lastMessage` field
- Set `lastMessageFrom` and `needsReply` fields

#### Issue 2: Unreplied tab is empty
**Cause:** `needsReply` field is `undefined` for existing chats.

**Why:** These fields are only populated when:
- Messages are synced for the first time
- New messages arrive
- User sends a message

**Solution:** Click the refresh button to sync all chats and messages.

#### Issue 3: Contacts not matching
**Cause:** Possible @ prefix mismatch.

**Example:**
- Beeper stores: `@johndoe`
- Dex stores: `johndoe` (without @)

**Solution:** 
1. Run `checkInstagramUsernames` to see mismatches
2. The updated `findContactByInstagram` query now handles this automatically
3. If still not matching, check the output to see exact usernames

## Testing Steps

1. **Click Refresh Button**
   - Should see spinning animation
   - Hover to see sync stats

2. **Check Unreplied Tab**
   - After sync, should see chats where other person sent last message
   - If empty, run `checkNeedsReply` diagnostic

3. **Check Chat Previews**
   - Should show actual message text instead of "Recent activity"
   - If still showing "Recent activity", check if sync completed

4. **Check Contact Matching**
   - Select an Instagram chat
   - Right sidebar should show contact if username matches
   - If shows "No contact matched", check the displayed username
   - Run `checkInstagramUsernames` to see if @ prefix is the issue

## Next Steps if Issues Persist

### If "Unreplied" tab is still empty:
1. Run diagnostic: `diagnostics:checkNeedsReply`
2. Check the output - look at `chatsUndefined` count
3. If high, you need to run a manual sync
4. The sync only updates when messages are fetched

### If "Recent activity" persists:
1. Check if sync is actually completing (no errors)
2. Run diagnostic: `diagnostics:checkNeedsReply`
3. Look at the `sample` array - check `lastMessage` field
4. If `lastMessage` is "(no lastMessage field)", sync hasn't run for those chats

### If contacts not matching:
1. Run diagnostic: `diagnostics:checkInstagramUsernames`
2. Check `potentialMatches` array
3. If mismatches found, the updated query should handle them
4. If no matches found, usernames in Beeper might not exist in Dex

## Files Modified

- `src/routes/messages.tsx` - Sidebar width, tooltip, username passing
- `src/components/messages/ContactPanel.tsx` - Show searched username
- `convex/contactMutations.ts` - Improved username matching
- `convex/diagnostics.ts` - New diagnostic queries

