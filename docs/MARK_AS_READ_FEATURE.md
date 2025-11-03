# Mark as Read/Unread Feature

## Overview

Added "Mark as Read" and "Mark as Unread" functionality to chat management, similar to the existing archive feature. This allows users to manually manage the read state of chats in the dashboard.

## Implementation

### Backend (Convex)

#### 1. Actions (`convex/chatActions.ts`)

**New Public Actions:**

```typescript
export const markChatAsRead = action({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.beeperMutations.markChatAsRead, {
      chatId: args.chatId,
    });
    return { success: true };
  },
});

export const markChatAsUnread = action({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.beeperMutations.markChatAsUnread, {
      chatId: args.chatId,
    });
    return { success: true };
  },
});
```

#### 2. Mutations (`convex/beeperMutations.ts`)

**New Internal Mutations:**

```typescript
export const markChatAsRead = internalMutation({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();
    
    if (!chat) {
      throw new Error(`Chat ${args.chatId} not found`);
    }

    await ctx.db.patch(chat._id, {
      unreadCount: 0,
    });

    return { success: true, chatId: args.chatId };
  },
});

export const markChatAsUnread = internalMutation({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("beeperChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();
    
    if (!chat) {
      throw new Error(`Chat ${args.chatId} not found`);
    }

    await ctx.db.patch(chat._id, {
      unreadCount: 1,
    });

    return { success: true, chatId: args.chatId };
  },
});
```

### Frontend

#### 1. Route Handlers (`src/routes/messages.tsx`)

**Imported Actions:**
```typescript
const markChatAsRead = useAction(api.chatActions.markChatAsRead)
const markChatAsUnread = useAction(api.chatActions.markChatAsUnread)
```

**New Handler Functions:**
```typescript
const handleMarkAsRead = async (chatId: string) => {
  try {
    await markChatAsRead({ chatId })
  } catch (err) {
    console.error('Failed to mark chat as read:', err)
    setError(err instanceof Error ? err.message : 'Failed to mark chat as read')
  }
}

const handleMarkAsUnread = async (chatId: string) => {
  try {
    await markChatAsUnread({ chatId })
  } catch (err) {
    console.error('Failed to mark chat as unread:', err)
    setError(err instanceof Error ? err.message : 'Failed to mark chat as unread')
  }
}
```

**Passed to Components:**
```typescript
<ChatListItem
  // ... other props
  onMarkAsRead={handleMarkAsRead}
  onMarkAsUnread={handleMarkAsUnread}
/>
```

#### 2. UI Component (`src/components/messages/ChatListItem.tsx`)

**New Props:**
```typescript
interface ChatListItemProps {
  // ... existing props
  onMarkAsRead?: (chatId: string) => void
  onMarkAsUnread?: (chatId: string) => void
}
```

**New Imports:**
```typescript
import { Mail, MailOpen } from 'lucide-react'
```

**New Button in UI:**
```tsx
{/* Action buttons - shown on hover */}
<div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
  {/* Mark as read/unread button */}
  {(onMarkAsRead || onMarkAsUnread) && (
    <Button
      variant="ghost"
      size="sm"
      onClick={hasUnread ? handleMarkAsReadClick : handleMarkAsUnreadClick}
      className="h-8 w-8 p-0"
      title={hasUnread ? "Mark as read" : "Mark as unread"}
    >
      {hasUnread ? (
        <MailOpen className="h-4 w-4" />
      ) : (
        <Mail className="h-4 w-4" />
      )}
    </Button>
  )}
  
  {/* Archive button */}
  {onArchive && (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleArchiveClick}
      className="h-8 w-8 p-0"
      title={isArchived ? "Unarchive chat" : "Archive chat"}
    >
      {isArchived ? (
        <ArchiveRestore className="h-4 w-4" />
      ) : (
        <Archive className="h-4 w-4" />
      )}
    </Button>
  )}
</div>
```

## How It Works

### Mark as Read
1. User opens a chat with unread messages (unreadCount > 0)
2. Chat header shows "Mark read" button with MailOpen icon
3. Clicking it calls `markChatAsRead({ chatId })`
4. Backend sets `unreadCount` to 0 in the database
5. UI updates immediately (chat no longer shows as unread)

### Mark as Unread
1. User opens a chat with no unread messages (unreadCount = 0)
2. Chat header shows "Mark unread" button with Mail icon
3. Clicking it calls `markChatAsUnread({ chatId })`
4. Backend sets `unreadCount` to 1 in the database
5. UI updates immediately (chat shows as unread)

## UI Behavior

### Visual Indicators

**Unread Chat (in list):**
- Blue dot on avatar
- Blue background tint
- Bold text for name and message
- Blue unread count badge

**Read Chat (in list):**
- No blue dot
- Normal background
- Regular font weight
- No unread badge

### Button Location

Buttons appear in the **chat header** (when viewing a chat):
```
[Chat Name and Info]     [Mark read/unread] [Archive]
```

The mark as read/unread button dynamically shows:
- **"Mark read"** with MailOpen icon when chat has unread messages
- **"Mark unread"** with Mail icon when chat has no unread messages

Both buttons use the same styling for consistency.

## Important Notes

### Local State Only

This implementation manages the **local unread state** in the dashboard's database:
- It doesn't send read receipts to Beeper or the underlying chat networks
- It's purely for managing the visual state in your dashboard
- Actual read receipts are handled when you view messages in Beeper

### Sync Behavior

When syncing chats from Beeper:
- The unread count from Beeper will overwrite local changes
- If you manually mark a chat as read, it will be marked unread again on the next sync if Beeper shows it as unread
- This is expected behavior - the source of truth is Beeper

### Use Cases

**Good for:**
- Clearing visual clutter in your dashboard
- Manually managing inbox state
- Marking chats you've dealt with via another app
- Quick inbox zero workflows

**Not for:**
- Sending read receipts to chat participants
- Affecting Beeper's native read state
- Syncing read state across devices

## Testing

### To Test Mark as Read
1. Find a chat with unread messages (has blue badge in list)
2. Click on the chat to open it
3. In the chat header, click "Mark read" button (MailOpen icon)
4. Unread count should go to 0
5. Chat should no longer have blue styling in the list

### To Test Mark as Unread
1. Find a chat with no unread messages
2. Click on the chat to open it
3. In the chat header, click "Mark unread" button (Mail icon)
4. Unread count should show 1
5. Chat should show blue styling in the list

## Files Modified

1. **`convex/chatActions.ts`** - Added public actions
2. **`convex/beeperMutations.ts`** - Added internal mutations
3. **`src/routes/messages.tsx`** - Added handlers and chat header buttons

## Related Features

- Archive/Unarchive (similar pattern)
- Chat filtering by unread status
- Unread tab in messages view
- Reply suggestions for unread chats

## Future Enhancements

Possible improvements:
- Bulk mark as read (select multiple chats)
- Keyboard shortcuts (e.g., `Shift+U` for mark unread)
- Context menu with mark as read option
- Auto-mark as read when chat is viewed
- Preserve manual read state across syncs (add flag to distinguish manual vs sync)

## Status

✅ **Implemented** - Mark as read/unread functionality working  
✅ **UI Complete** - Buttons show on hover with proper icons  
✅ **No Errors** - All linter checks passing  
✅ **Follows Patterns** - Consistent with archive implementation

