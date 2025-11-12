# Beeper API Field Audit - Complete Comparison

## Chat Object Fields

### From API Spec (Response)

```typescript
{
  // Chat identifiers
  id: string,
  accountID: string,
  network: string,
  localChatID: string,
  
  // Chat metadata
  title: string,
  description: string,
  type: "single" | "group",
  
  // Participants
  participants: {
    hasMore: boolean,
    items: Participant[],
    total: number
  },
  
  // Activity tracking
  lastActivity: string (ISO datetime),
  lastReadMessageSortKey: string,
  unreadCount: number,
  
  // Status flags
  isArchived: boolean,
  isMuted: boolean,
  isPinned: boolean,
  
  // Preview (last message)
  preview?: {
    id: string,
    accountID: string,
    chatID: string,
    senderID: string,
    sortKey: string,
    timestamp: string,
    text?: string,
    senderName?: string,
    isSender?: boolean,
    isUnread?: boolean,
    attachments?: Attachment[],
    reactions?: Reaction[]
  }
}
```

### What We're Currently Extracting

✅ **Extracting correctly**:
- `id` → `chatId`
- `accountID` → `accountID`
- `network` → `network`
- `localChatID` → `localChatID`
- `title` → `title`
- `description` → `description`
- `type` → `type`
- `lastActivity` → `lastActivity` (converted to number)
- `unreadCount` → `unreadCount`
- `isArchived` → `isArchived`
- `isMuted` → `isMuted`
- `isPinned` → `isPinned`
- `lastReadMessageSortKey` → `lastReadMessageSortKey` (converted to string)
- `participants.total` → `participantCount`

✅ **Preview extraction**:
- `preview.text` → `lastMessage`
- `preview.isSender` → Used to set `lastMessageFrom` and `needsReply`
- `preview.timestamp` → `previewTimestamp` (logged but not stored)

❌ **Missing fields**:
- `participants.hasMore` - Not extracted or stored
- Preview fields not stored:
  - `preview.id` - Message ID of preview
  - `preview.sortKey` - SortKey of preview message
  - `preview.attachments` - Preview attachments
  - `preview.reactions` - Reactions on preview message

## Participant Object Fields

### From API Spec

```typescript
{
  id: string,                 // "@username:server"
  cannotMessage: boolean,     // Can we message this person?
  email: string,              // Email address
  fullName: string,           // Display name
  imgURL: string,             // Profile image URL
  isSelf: boolean,            // Is this the current user?
  phoneNumber: string,        // Phone number
  username: string            // Username/handle
}
```

### What We're Currently Extracting

✅ **Extracting correctly**:
- `username` → `username`
- `phoneNumber` → `phoneNumber`
- `email` → `email`
- `id` → `participantId`

❌ **Missing fields**:
- `cannotMessage` - Whether we can message this participant
- `fullName` - Display name (we use chat.title instead)
- `imgURL` - Profile image URL (using Dex contact images instead)
- `isSelf` - Only used for filtering, not stored

## Message Object Fields (Preview)

### From API Spec

```typescript
preview?: {
  id: string,
  accountID: string,
  chatID: string,
  senderID: string,
  sortKey: string,            // ← Important for pagination!
  timestamp: string,
  text?: string,
  senderName?: string,
  isSender?: boolean,
  isUnread?: boolean,
  attachments?: Attachment[],
  reactions?: Reaction[]
}
```

### What We're Currently Using

✅ **Using**:
- `text` → `lastMessage`
- `isSender` → Calculate `lastMessageFrom` and `needsReply`
- `timestamp` → Logged for debugging

❌ **Not using**:
- `id` - Message ID (could use to track which message is preview)
- `sortKey` - Could use as newest message cursor!
- `senderName` - Preview sender name
- `attachments` - Preview has attachments
- `reactions` - Reactions on preview message
- `isUnread` - Is preview unread?

## Critical Missing: Preview SortKey! 🚨

**Issue**: We're not extracting `preview.sortKey`

**Why this matters**:
The preview contains the **sortKey of the newest message**! We should use this as our `newestMessageSortKey`:

```typescript
if (preview) {
  lastMessage = preview.text;
  lastMessageFrom = preview.isSender ? "user" : "them";
  needsReply = !preview.isSender;
  
  // ← MISSING: Store preview.sortKey as newestMessageSortKey!
  newestMessageSortKey = preview.sortKey;
}
```

This would let us:
1. Know the newest message sortKey without fetching any messages
2. Use it as cursor for incremental message sync
3. Avoid fetching messages at all if preview is sufficient!

## Recommendations

### Priority 1: Extract Preview SortKey (HIGH)

```typescript
// In beeperSync.ts
const preview = chat.preview;
let lastMessage: string | undefined;
let lastMessageFrom: "user" | "them" | undefined;
let needsReply: boolean | undefined;
let newestMessageSortKey: string | undefined;  // ADD THIS

if (preview) {
  lastMessage = preview.text || undefined;
  lastMessageFrom = preview.isSender ? "user" : "them";
  needsReply = !preview.isSender;
  newestMessageSortKey = preview.sortKey;  // ← ADD THIS!
}

const chatData = {
  // ... existing fields
  newestMessageSortKey,  // ← ADD THIS
};
```

### Priority 2: Add Missing Participant Fields (MEDIUM)

```typescript
// Add to schema.ts
beeperChats: defineTable({
  // ... existing
  participantFullName: v.optional(v.string()),
  participantImgURL: v.optional(v.string()),
  cannotMessage: v.optional(v.boolean()),
})

// Extract in sync
if (otherPerson) {
  username = otherPerson.username;
  phoneNumber = otherPerson.phoneNumber;
  email = otherPerson.email;
  participantId = otherPerson.id;
  participantFullName = otherPerson.fullName;  // ADD
  participantImgURL = otherPerson.imgURL;      // ADD
  cannotMessage = otherPerson.cannotMessage;    // ADD
}
```

### Priority 3: Store Preview Details (LOW)

```typescript
// Add to schema.ts if needed
beeperChats: defineTable({
  // ... existing
  previewMessageId: v.optional(v.string()),
  previewHasAttachments: v.optional(v.boolean()),
  previewIsUnread: v.optional(v.boolean()),
})
```

## Impact Analysis

### High Priority: Preview SortKey

**Without it**:
- Must fetch 15 messages every sync (even if nothing changed)
- Can't detect if there are new messages efficiently
- More API calls

**With it**:
- Skip message fetch if preview.sortKey matches our stored sortKey
- Only fetch messages when there's actually new activity
- Significantly fewer API calls

### Medium Priority: Participant Fields

**Useful for**:
- `fullName` - Better display names (currently using chat.title)
- `imgURL` - Profile images (currently using Dex contacts)
- `cannotMessage` - Know if messaging is blocked/disabled

### Low Priority: Preview Details

**Useful for**:
- `previewMessageId` - Track which message is shown as preview
- `attachments` - Show attachment indicator in chat list
- `isUnread` - Additional unread state tracking

## Action Items

Should I:
1. Add `preview.sortKey` extraction (critical for efficiency)
2. Add participant detail fields (fullName, imgURL, cannotMessage)
3. Update the sync logic to skip message fetch if preview.sortKey matches?

