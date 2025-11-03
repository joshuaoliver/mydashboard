# Contact Creation and Auto-Linking

## Overview

This feature allows users to create contacts manually when messaging someone who isn't yet in the Dex CRM system. When the Dex sync runs later (every 2 hours), it automatically links the manually-created contact with the matching Dex contact based on Instagram username.

## User Flow

### 1. Message from Unknown Contact
When a user receives a message from someone not in their Dex contacts:

```
┌─────────────────────────────────┐
│  [Chat Interface]               │
│  Instagram DM from @username    │
│                                 │
│  [Contact Panel]                │
│  No contact matched             │
│  Searched for: @username        │
│  Not found in Dex contacts      │
│                                 │
│  [Create Contact] Button        │
└─────────────────────────────────┘
```

### 2. Manual Contact Creation
User clicks "Create Contact":
- Creates a contact record with Instagram username
- **No `dexId` yet** (this is the key - it marks it as user-created)
- Contact immediately appears in the panel
- User can start adding notes, connections, etc.

### 3. Automatic Linking (Dex Sync)
When Dex sync runs (every 2 hours via cron):

```
Dex Sync Process:
1. Fetch all contacts from Dex API
2. For each Dex contact:
   a. Try to find by dexId (normal case)
   b. If not found AND has Instagram username:
      → Search local contacts by Instagram
      → If found AND no dexId (user-created):
         ✨ ADOPT: Add dexId + merge Dex data
      → If found AND different dexId:
         ⚠️ CONFLICT: Skip (Instagram used by multiple Dex contacts)
3. Update contact with Dex data:
   - firstName, lastName, description
   - imageUrl, emails, phones, birthday
   - lastSeenAt
4. Preserve local-only fields:
   - notes, connections, privateNotes
   - sex, locationId, intimateConnection
```

## Implementation Details

### Schema Change
```typescript
// contacts table
dexId: v.optional(v.string()), // Optional - user-created contacts don't have this yet
```

**Before:** `dexId: v.string()` (required)
**After:** `dexId: v.optional(v.string())` (optional)

This simple change enables the entire feature.

### New Mutation: `createContact`
**File:** `convex/contactMutations.ts`

```typescript
export const createContact = mutation({
  args: {
    instagram: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicates by Instagram
    // Create contact without dexId
    // Return contactId
  },
});
```

**Key Features:**
- Prevents duplicate Instagram usernames
- No `dexId` assigned (signals user-created contact)
- Sets `lastSyncedAt` and `lastModifiedAt` timestamps

### Enhanced Upsert Logic
**File:** `convex/dexUpsert.ts`

```typescript
// First, try to find by dexId (normal case)
let existing = await ctx.db
  .query("contacts")
  .withIndex("by_dex_id", (q) => q.eq("dexId", dexContact.id))
  .first();

// If not found by dexId AND contact has Instagram, try Instagram match
if (!existing && dexContact.instagram) {
  const instagramMatch = await ctx.db
    .query("contacts")
    .withIndex("by_instagram", (q) => q.eq("instagram", dexContact.instagram))
    .first();
  
  if (instagramMatch && !instagramMatch.dexId) {
    // ✨ Adopt user-created contact
    console.log(`Adopting user-created contact via Instagram match: @${dexContact.instagram}`);
    existing = instagramMatch;
  } else if (instagramMatch && instagramMatch.dexId !== dexContact.id) {
    // ⚠️ Conflict: Instagram matches multiple Dex contacts
    existing = null;
  }
}
```

**Adoption Process:**
1. Finds user-created contact by Instagram username
2. Checks `!instagramMatch.dexId` to confirm it's user-created
3. Updates the contact with:
   - `dexId` (now linked!)
   - All Dex fields (name, description, image, etc.)
   - Preserves local-only fields (notes, connections, etc.)

### UI Changes
**File:** `src/components/messages/ContactPanel.tsx`

**Added:**
- `createContactMutation` hook
- `handleCreateContact()` handler
- "Create Contact" button in "No contact matched" state
- Helper text explaining auto-linking

**UI States:**
```
No Match Found:
┌──────────────────────────────────┐
│ No contact matched               │
│ Searched for: @username          │
│ Not found in Dex contacts        │
│ [Create Contact]                 │
│ "Create now, sync later..."      │
└──────────────────────────────────┘

After Creation:
┌──────────────────────────────────┐
│ @username                        │
│ [Local Notes] (immediately editable)
│ Connection Direction: []         │
│ Sex: []                          │
│ ...                              │
└──────────────────────────────────┘

After Dex Sync:
┌──────────────────────────────────┐
│ John Doe                         │ ← Name filled in from Dex
│ @username                        │
│ [Local Notes] (preserved)        │ ← User's notes kept
│ Description: "..." (from Dex)    │ ← Dex data added
│ Connection Direction: []         │ ← Local data preserved
└──────────────────────────────────┘
```

## Data Merge Strategy

### Dex Fields (Updated on Sync)
These come from Dex and overwrite local data:
- `dexId`
- `firstName`, `lastName`
- `description`
- `instagram`
- `imageUrl`
- `emails`, `phones`
- `birthday`
- `lastSeenAt`

### Local-Only Fields (Preserved)
These are set by user and never sync to Dex:
- `notes` (local notes)
- `connections` (relationship types)
- `sex` (multi-select)
- `privateNotes` (PIN-protected)
- `locationId` (user's location tagging)
- `intimateConnection` (PIN-protected)
- `leadStatus` (dating pipeline status)

### Timestamps
- `lastSyncedAt` - Updated on each Dex sync
- `lastModifiedAt` - Updated when user edits locally

## Edge Cases

### Conflict Detection
**Problem:** What if Instagram username matches multiple Dex contacts?

**Solution:**
```typescript
if (instagramMatch && instagramMatch.dexId !== dexContact.id) {
  console.warn(`Instagram conflict: @${username} matches multiple Dex contacts`);
  existing = null; // Don't adopt, create new contact
}
```

This prevents incorrectly linking contacts when:
- Instagram username was recycled
- Multiple Dex contacts share the same Instagram (data error in Dex)

### Duplicate Prevention
The `createContact` mutation checks for existing Instagram usernames:

```typescript
const existing = await ctx.db
  .query("contacts")
  .withIndex("by_instagram", (q) => q.eq("instagram", args.instagram))
  .first();

if (existing) {
  return { contactId: existing._id, existed: true };
}
```

User gets the existing contact if they try to create a duplicate.

### Recent Local Edits Protection
The sync respects the 5-minute protection window:

```typescript
const fiveMinutesAgo = now - 5 * 60 * 1000;
if (existing.lastModifiedAt >= fiveMinutesAgo) {
  skippedCount++;
  continue; // Skip - local changes are too recent
}
```

This prevents overwriting user's edits if Dex sync runs right after they save.

## Testing Scenarios

### Scenario 1: Create → Sync → Link
1. ✅ Receive Instagram DM from @newperson
2. ✅ Click "Create Contact"
3. ✅ Add notes: "Met at conference"
4. ✅ Dex sync runs (wait up to 2 hours or trigger manually)
5. ✅ Contact gets firstName, lastName, image from Dex
6. ✅ Notes preserved

### Scenario 2: Already Exists
1. ✅ Click "Create Contact" for @existinguser
2. ✅ System returns existing contact (no duplicate)

### Scenario 3: No Instagram Username
1. ✅ Chat has no Instagram username
2. ✅ "Create Contact" button not shown
3. ✅ Message: "No Instagram username available"

### Scenario 4: Conflict Handling
1. ✅ User creates contact for @username
2. ✅ Dex has TWO contacts with @username
3. ✅ First sync matches and adopts
4. ✅ Second sync detects conflict, creates new contact

## Manual Sync (for Testing)

To test without waiting 2 hours:

```typescript
// In Convex dashboard or via action
await ctx.runAction(internal.dexSync.syncContactsFromDex, {});
```

Or trigger via admin UI (if implemented).

## Logs to Watch

When sync runs, look for:
```
✨ Adopting user-created contact via Instagram match: @username → Dex ID abc123
```

This confirms the auto-linking worked!

## Future Enhancements

### Phone Number Matching
Currently only matches by Instagram. Could also match by:
- Phone number (WhatsApp chats)
- Email (if available)

### Match Confidence Score
For uncertain matches, could:
- Show "Possible match" in UI
- Ask user to confirm linking
- Use fuzzy matching on names

### Bulk Import
Allow users to:
- Import contacts from CSV
- All start without `dexId`
- Auto-link on next sync

### Conflict Resolution UI
When conflicts detected:
- Show user both contacts
- Let them choose which to keep
- Merge fields manually

## Related Files

### Backend
- `convex/schema.ts` - Schema definition (dexId optional)
- `convex/contactMutations.ts` - createContact mutation
- `convex/dexUpsert.ts` - Auto-linking logic
- `convex/dexSync.ts` - Sync orchestration
- `convex/crons.ts` - Scheduled sync (every 2 hours)

### Frontend
- `src/components/messages/ContactPanel.tsx` - Create contact UI
- `src/routes/messages.tsx` - Messages page (passes searchedUsername)

### Documentation
- `docs/DEX_INTEGRATION.md` - Dex API overview
- `docs/CONNECTION_TYPES.md` - Local-only fields

