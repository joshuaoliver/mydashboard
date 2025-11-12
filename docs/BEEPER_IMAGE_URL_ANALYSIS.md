# Beeper API Image URL Analysis

**Date**: November 12, 2025  
**API Version**: v1  
**Endpoint Tested**: `/v1/chats`

## Summary of Findings

Based on direct API calls to your Beeper instance, here's how image URLs work:

### 📸 Profile Pictures (Instagram/Facebook/WhatsApp)

Profile images are returned in the `participants.items[].imgURL` field and use **local file:// URLs**.

## Image URL Formats

### Format 1: local.beeper.com (Most Common)
```
file:///Users/joshuaoliver/Library/Application Support/BeeperTexts/media/local.beeper.com/joshuaoliver_{HASH}
```

**Example:**
```json
{
  "id": "@instagramgo_116018263120443:beeper.local",
  "fullName": "katherine",
  "imgURL": "file:///Users/joshuaoliver/Library/Application%20Support/BeeperTexts/media/local.beeper.com/joshuaoliver_z66x2RdfdAwBsbX5fpbXbcZz8RlcKcbrr8suvvXHz3xSSmXbHc6wRF4yDORUuvkV",
  "username": "katherinetc02"
}
```

**Breakdown:**
- **Protocol**: `file://` (local filesystem)
- **Path**: `/Users/joshuaoliver/Library/Application Support/BeeperTexts/media/`
- **Domain**: `local.beeper.com/` (directory name, not web domain)
- **Format**: `joshuaoliver_{RANDOM_HASH}`
- **No extension** - Beeper determines type from file content

### Format 2: beeper.com (Less Common)
```
file:///Users/joshuaoliver/Library/Application Support/BeeperTexts/media/beeper.com/{HASH}
```

**Example:**
```json
{
  "id": "@instagramgo_101746224559542:beeper.local",
  "fullName": "Chris Walker",
  "imgURL": "file:///Users/joshuaoliver/Library/Application%20Support/BeeperTexts/media/beeper.com/4d55b8cb8ccdd837e297b89730bc5ea8175f1007",
  "username": "chris_walker_dj"
}
```

**Breakdown:**
- **Protocol**: `file://` (local filesystem)
- **Domain**: `beeper.com/` (directory name)
- **Format**: Just a hash, no username prefix
- **Shorter hash** - looks like SHA1 (40 chars)

## Instagram-Specific Data

For Instagram chats, you get:

```json
{
  "accountID": "instagramgo",
  "network": "Instagram",
  "participants": {
    "items": [
      {
        "id": "@instagramgo_116018263120443:beeper.local",
        "fullName": "katherine",
        "imgURL": "file:///...",
        "username": "katherinetc02",  // ← Instagram username here!
        "isVerified": false,
        "isSelf": false
      }
    ]
  }
}
```

### Instagram Profile Picture URL Construction

**❌ You DON'T get direct Instagram profile URLs from the API**

The API only provides:
1. ✅ `username` - Instagram handle (e.g., "katherinetc02")
2. ✅ `imgURL` - Local cached file path
3. ✅ `fullName` - Display name

**To get the actual Instagram profile picture URL**, you would need to:

**Option A: Use Instagram's public profile picture URL pattern**
```
https://www.instagram.com/{username}/
```
Then scrape or use Instagram's API to get the profile pic URL.

**Option B: Construct Instagram profile pic URL (unofficial)**
```
https://i.instagram.com/api/v1/users/web_profile_info/?username={username}
```
This returns JSON with profile data including `profile_pic_url`.

**Option C: Use local cached file** (What Beeper does)
The `imgURL` field points to a locally cached copy that Beeper downloaded from Instagram.

## WhatsApp Profile Pictures

Similar structure, but uses phone numbers instead of usernames:

```json
{
  "id": "@whatsapp_61404550806:beeper.local",
  "fullName": "Trevor ODEO",
  "phoneNumber": "+61404550806",  // ← WhatsApp identifier
  "isVerified": false,
  "isSelf": false
  // Note: imgURL may not be present if profile pic not set
}
```

## Facebook/Messenger Profile Pictures

```json
{
  "id": "@facebookgo_663746925:beeper.local",
  "fullName": "Elli Esber",
  "imgURL": "file:///...",
  "isVerified": false
  // Note: No username field, just numeric ID in the participant ID
}
```

## Message Attachments (Images in Messages)

Based on the schema and previous testing, message attachments follow a similar pattern:

```json
{
  "attachments": [
    {
      "type": "img",
      "srcURL": "file:///Users/joshuaoliver/Library/Application Support/BeeperTexts/media/...",
      "mimeType": "image/jpeg",
      "fileName": "IMG_1234.jpg",
      "fileSize": 245678,
      "width": 1920,
      "height": 1080,
      "isGif": false,
      "isSticker": false
    }
  ]
}
```

### Attachment Types
- `img` - Images (JPEG, PNG, GIF, WebP)
- `video` - Video files
- `audio` - Audio/voice messages
- `unknown` - Other file types

## Key Insights

### 1. **All Images Are Local File URLs**
```
file:///Users/joshuaoliver/Library/Application Support/BeeperTexts/media/...
```

**Implications:**
- ✅ Fast access (local filesystem)
- ✅ Works offline
- ✅ Beeper handles caching/syncing
- ❌ URLs won't work in browser directly
- ❌ Need to proxy through Beeper Desktop API

### 2. **Two Storage Locations**
- `local.beeper.com/` - User-specific cached files
- `beeper.com/` - Shared cached files (maybe synced from server?)

### 3. **No File Extensions**
Files are identified by hash, no extension:
```
joshuaoliver_z66x2RdfdAwBsbX5fpbXbcZz8RlcKcbrr8suvvXHz3xSSmXbHc6wRF4yDORUuvkV
```

Beeper determines file type from:
- MIME type in attachment metadata
- Magic number/file header inspection
- Context (profile pic vs message attachment)

### 4. **Instagram Username Available**
```json
{
  "username": "katherinetc02",  // ← Use this!
  "fullName": "katherine"
}
```

**How to use:**
- ✅ Display "@katherinetc02" in UI
- ✅ Link to `https://instagram.com/katherinetc02`
- ✅ Search/filter by username
- ❌ Can't get live profile pic URL without Instagram API

## How We're Currently Handling This

### In `beeperSync.ts` (Lines 319-334)
```typescript
// Extract contact info for single chats
let username: string | undefined;
let phoneNumber: string | undefined;
let email: string | undefined;
let participantId: string | undefined;

if (chat.type === "single" && chat.participants?.items) {
  const otherPerson = chat.participants.items.find(
    (p: any) => p.isSelf === false
  );

  if (otherPerson) {
    username = otherPerson.username;       // ← Instagram username
    phoneNumber = otherPerson.phoneNumber; // ← WhatsApp phone
    email = otherPerson.email;             // ← Email if available
    participantId = otherPerson.id;
  }
}
```

### In `beeperQueries.ts` (Mapping for Frontend)
```typescript
// We extract imgURL and pass it to frontend
contactImageUrl: otherPerson?.imgURL,
username: otherPerson?.username,
phoneNumber: otherPerson?.phoneNumber,
```

### In Frontend `messages.tsx`
```tsx
{selectedChat.contactImageUrl ? (
  <img
    src={selectedChat.contactImageUrl}
    alt={selectedChat.name}
    className="w-8 h-8 rounded-full object-cover"
  />
) : (
  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400">
    {selectedChat.name.charAt(0).toUpperCase()}
  </div>
)}
```

## The Problem: file:// URLs Don't Work in Browser

**Current issue:**
```html
<img src="file:///Users/joshuaoliver/Library/..." />
```

**Browser security** blocks `file://` URLs for security reasons.

## Solutions

### Solution 1: Beeper Desktop API Proxy (Current)

We already have `ProxiedImage` component that should handle this:

```tsx
<ProxiedImage
  src={att.srcURL}
  alt={att.fileName || 'Image attachment'}
  className="max-w-full h-auto"
  mimeType={att.mimeType}
/>
```

**How it works:**
1. Detects `file://` URL
2. Extracts file path
3. Calls Beeper Desktop API: `GET /media/file?path={encodedPath}`
4. API reads local file and serves it
5. Component displays the image

### Solution 2: Convex File Storage (Alternative)

Upload images to Convex storage and serve from there:

**Pros:**
- ✅ Works everywhere (web, mobile)
- ✅ CDN-backed (fast)
- ✅ Persistent storage

**Cons:**
- ❌ Uses Convex storage quota
- ❌ Need to upload on sync
- ❌ Duplicates data

### Solution 3: Direct Instagram Profile Pics (For Display Only)

For profile pictures specifically, construct Instagram URL:

```typescript
// If it's Instagram and we have username
if (chat.network === 'Instagram' && chat.username) {
  profilePicUrl = `https://www.instagram.com/${chat.username}/`
  // Or use Instagram API if available
}
```

## Recommendation

**For Profile Pictures:**
1. ✅ Use `ProxiedImage` with local `file://` URLs
2. ✅ Fallback to initials if image fails to load
3. ✅ Display Instagram username as `@{username}`
4. ✅ Link username to Instagram profile

**For Message Attachments:**
1. ✅ Use `ProxiedImage` for all images
2. ✅ Show loading state while fetching
3. ✅ Handle errors gracefully
4. ✅ Cache in browser once loaded

## Testing the ProxiedImage Component

Check if it's working:

```tsx
// In ChatListItem or ContactPanel
<ProxiedImage
  src={contactImageUrl}  // file:///Users/...
  alt={name}
  className="w-8 h-8 rounded-full"
/>
```

If images aren't showing, check:
1. Is Beeper Desktop API running?
2. Is `/media/file` endpoint accessible?
3. Are file paths being correctly URL-encoded?
4. Check browser console for errors

## URL Encoding Issues

File paths need proper encoding:

```typescript
// ❌ Wrong
file:///Users/joshuaoliver/Library/Application Support/...

// ✅ Correct
file:///Users/joshuaoliver/Library/Application%20Support/...
```

The API already returns properly encoded URLs, but double-check when passing to ProxiedImage.

## Summary

**For your questions:**

1. **Are we getting back images?**
   - ✅ YES - Profile pics in `participants[].imgURL`
   - ✅ YES - Message attachments in `messages[].attachments[]`
   - ⚠️ They're `file://` URLs (local paths)

2. **What format are the URLs?**
   - `file:///Users/.../BeeperTexts/media/{domain}/{hash}`
   - Two domains: `local.beeper.com/` and `beeper.com/`
   - No file extensions

3. **How to get Instagram profile URL?**
   - ✅ You get `username` field (e.g., "katherinetc02")
   - ❌ No direct profile pic URL from API
   - ✅ Can construct: `https://instagram.com/{username}`
   - ✅ Can scrape/API for actual profile pic URL
   - ✅ OR use Beeper's cached `imgURL` via proxy

**Bottom line:** Use `ProxiedImage` component to display all images from Beeper API, and you'll have profile pictures working correctly!


