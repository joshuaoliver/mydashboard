# Beeper API Findings & Analysis

## Executive Summary

After testing the Beeper API directly, we've discovered that **only the V0 endpoints work** on your custom Beeper server (`https://beeper.bywave.com.au`). The official V1 API documented by Beeper doesn't exist on this server.

## What Works ✅

### Endpoints

1. **`/v0/search-chats`** - Main chat listing/search endpoint
2. **`/v0/search-messages`** - Get messages for a specific chat

### Query Parameters (All Working!)

| Parameter | Values | Description | Example |
|-----------|--------|-------------|---------|
| `limit` | 1-100+ | Number of results | `?limit=100` |
| `type` | `single`, `group` | Filter by chat type | `?type=single` |
| `unreadOnly` | `true`, `false` | Only unread chats | `?unreadOnly=true` |
| `inbox` | `primary`, `archive` | Filter by inbox | `?inbox=primary` |
| `query` | text string | Search chat names | `?query=karen` |

## What Doesn't Work ❌

- All `/v1/` endpoints (return 404)
- `/v1/chats` (list)
- `/v1/search/chats` (search)
- `/v1/chats/{chatID}` (retrieve)

The official Beeper Desktop API documentation doesn't match your server's implementation.

## Your Current Stats 📊

```
Total Chats: 50+
Chats with Unread: 26
Total Unread Messages: 244

Networks:
├─ Instagram: 38 chats (32 single, 6 group)
├─ WhatsApp: 8 chats (4 single, 4 group)
├─ Facebook/Messenger: 2 chats (2 group)
├─ LinkedIn: 1 chat (1 single)
└─ Beeper (Matrix): 1 chat (1 group)
```

Top unread chats:
1. Degens Offical OG - 117 unread (Instagram)
2. Sydney Comedy School - 65 unread (WhatsApp)
3. Jasons party angels - 25 unread (Instagram)

## Data Structure

### Chat Object

```json
{
  "id": "!chatID:beeper.local",
  "localChatID": "91434",
  "accountID": "instagramgo",
  "network": "Instagram",
  "title": "Contact Name",
  "type": "single",  // or "group"
  "participants": {
    "items": [
      {
        "id": "@user_id:beeper.local",
        "username": "instagramhandle",
        "phoneNumber": "+61424592979",
        "fullName": "Display Name",
        "email": "email@example.com",
        "imgURL": "file:///path/to/local/image",
        "cannotMessage": true,
        "isSelf": false
      }
    ],
    "hasMore": false,
    "total": 2
  },
  "lastActivity": "2025-10-10T12:26:02.615Z",
  "unreadCount": 0,
  "lastReadMessageSortKey": 336085,
  "isArchived": false,
  "isMuted": false,
  "isPinned": false
}
```

### Key Differences: Group vs Single

| Field | Single Chat | Group Chat |
|-------|-------------|------------|
| `type` | `"single"` | `"group"` |
| `participants.total` | Always 2 (you + other) | 3+ participants |
| `participants.hasMore` | `false` | May be `true` if >5 participants |
| `participants.items` | All participants | First 5 participants |

### Profile Images 🖼️

- **Available**: Yes! In `participants[].imgURL`
- **Format**: `file:///Users/joshuaoliver/Library/Application Support/BeeperTexts/media/...`
- **Type**: Local files on your machine (Beeper Desktop cache)
- **Access**: These are real file paths you can access
- **Coverage**: ~49 out of 50 chats have profile images

Example path:
```
file:///Users/joshuaoliver/Library/Application%20Support/BeeperTexts/media/local.beeper.com/joshuaoliver_YZBbLs8anKhvuNiquBfupQionCFZhrxVp1nBFuyZyVats3GTqL9nYJhlf5wGEkd1
```

### Message Object

```json
{
  "id": "146301",
  "text": "Message content",
  "timestamp": "2025-10-10T13:43:34.000Z",
  "senderID": "@user:beeper.local",
  "senderName": "Display Name",
  "isSender": false,
  "attachments": []  // Array if message has attachments
}
```

## Recommendations for Your Dashboard

### 1. Continue Using V0 Endpoints ✅

Your current implementation is correct! Stay with `/v0/search-chats`.

```typescript
// Current (GOOD):
`${BEEPER_API_URL}/v0/search-chats?limit=100`

// Don't change to V1 (doesn't exist on your server)
```

### 2. Increase Limit for Better Coverage

You're currently using `limit=100`, which is good. Consider going higher if you want more chats:

```typescript
`${BEEPER_API_URL}/v0/search-chats?limit=200`
```

### 3. Add Type Filtering (Optional)

If you only want direct messages, not groups:

```typescript
`${BEEPER_API_URL}/v0/search-chats?limit=100&type=single`
```

### 4. Add Unread Filtering (Optional)

For a "needs reply" inbox:

```typescript
`${BEEPER_API_URL}/v0/search-chats?limit=100&unreadOnly=true`
```

### 5. Handle Groups Properly

Update your UI to handle group chats:

```typescript
// In your chat display logic
if (chat.type === 'group') {
  // Show participant count
  const count = chat.participants.total;
  const preview = chat.participants.items
    .filter(p => !p.isSelf)
    .slice(0, 3)
    .map(p => p.fullName)
    .join(', ');
  
  subtitle = `${count} participants: ${preview}${chat.participants.hasMore ? '...' : ''}`;
}
```

### 6. Profile Images (Optional)

If you want to display profile pictures:

```typescript
// Extract image URL from chat
const getProfileImage = (chat) => {
  if (chat.type === 'single') {
    const otherPerson = chat.participants.items.find(p => !p.isSelf);
    return otherPerson?.imgURL;
  } else {
    // For groups, maybe show first non-self participant's image
    const firstPerson = chat.participants.items.find(p => !p.isSelf);
    return firstPerson?.imgURL;
  }
};

// Use in your UI
<img src={getProfileImage(chat)} alt={chat.title} />
```

**Note**: These are `file://` URLs. You'll need to:
- Either copy them to your `public/` folder
- Or use a Node.js server to serve them
- Or use a library that can handle local file URLs

### 7. Network-Specific Badges

Add visual indicators for different networks:

```typescript
const networkIcons = {
  'Instagram': '📷',
  'WhatsApp': '💬',
  'Facebook/Messenger': '💙',
  'LinkedIn': '💼',
  'Beeper (Matrix)': '🐝'
};
```

### 8. Smart Filtering Options

Add UI filters:
- "All Chats" → `?limit=100`
- "Needs Reply" → `?limit=100&unreadOnly=true`
- "Direct Messages" → `?limit=100&type=single`
- "Group Chats" → `?limit=100&type=group`
- "Instagram Only" → Custom filter on `network` field after fetching

### 9. Message Sync Strategy

Your current strategy (sync messages for chats with `unreadCount > 0`) is good! Consider:

```typescript
// Priority sync: Unread chats first
const sortedChats = chats.sort((a, b) => b.unreadCount - a.unreadCount);

// Sync messages for top N unread chats
const chatsToSync = sortedChats.filter(c => c.unreadCount > 0).slice(0, 20);
```

### 10. Add Search Feature (Future)

The API supports text search:

```typescript
// Search for specific person or keyword
`${BEEPER_API_URL}/v0/search-chats?query=${searchTerm}&limit=50`
```

## Updated Code Examples

### Better Chat Sync (convex/beeperSync.ts)

```typescript
// Enhanced with better filtering and group support
const response = await fetch(
  `${BEEPER_API_URL}/v0/search-chats?` + new URLSearchParams({
    limit: '100',
    type: 'any',  // or 'single' for direct messages only
    // unreadOnly: 'true',  // Optional: only unread chats
    // inbox: 'primary',    // Optional: exclude archived
  }),
  {
    method: "GET",
    headers: { "Authorization": `Bearer ${BEEPER_TOKEN}` },
  }
);
```

### Enhanced Chat Display (UI)

```typescript
interface EnhancedChat {
  id: string;
  title: string;
  type: 'single' | 'group';
  network: string;
  unreadCount: number;
  participantCount?: number;  // For groups
  participantPreview?: string;  // "Alice, Bob, Charlie..."
  profileImageURL?: string;
  username?: string;  // Instagram handle
  phoneNumber?: string;  // WhatsApp number
  lastActivity: number;
}
```

## Testing Scripts

I've created two test scripts for you:

1. **`test-beeper-api.js`** - Tests all endpoints to see what works
2. **`test-beeper-detailed.js`** - Detailed analysis of data structure

Run them anytime:
```bash
node test-beeper-api.js
node test-beeper-detailed.js
```

## Security Notes

⚠️ **Your Beeper token is visible in these test scripts** - consider:
1. Delete the test scripts when done exploring
2. Or move token to environment variable
3. Don't commit these scripts to git (already in .gitignore hopefully)

## Next Steps

1. ✅ **Keep using V0 endpoints** - they work great!
2. ✅ **Increase limit to 100+** - get more chats per sync
3. 🔄 **Add group chat UI** - show participant counts
4. 🔄 **Consider profile images** - they're available if you want them
5. 🔄 **Add filtering options** - unread only, single/group, network
6. 🔄 **Add search feature** - use `?query=` parameter

## Questions Answered

### Q: Which API should we use - search or list?
**A:** Use `/v0/search-chats` (it's the only one that works on your server!)

### Q: How do we get images?
**A:** Images are in `participants[].imgURL` - they're local `file://` paths from Beeper Desktop cache.

### Q: How do we handle groups?
**A:** Check `chat.type === 'group'` and display `participants.total` count. Show preview of first few participants from `participants.items`.

### Q: Can we filter by network, unread, etc?
**A:** Yes! Use query parameters: `?type=single`, `?unreadOnly=true`, `?inbox=primary`

## Conclusion

Your current implementation is already using the right endpoint! The main improvements would be:

1. Handle both single and group chats in the UI
2. Optionally display profile images
3. Add filtering options (unread, type, network)
4. Increase limit for more coverage

The V0 API gives you everything you need. Don't worry about V1 - it doesn't exist on your server.

