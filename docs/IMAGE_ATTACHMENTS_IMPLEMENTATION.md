# Image Attachments Implementation

## Overview
Full support for receiving, storing, and displaying image attachments from Beeper messages.

## What Was Added

### 1. Database Schema (`convex/schema.ts`)
Added `attachments` field to `beeperMessages` table:

```typescript
attachments: v.optional(v.array(v.object({
  type: v.string(),              // "img", "video", "audio", "unknown"
  srcURL: v.string(),            // URL or local file path
  mimeType: v.optional(v.string()),     // e.g., "image/png"
  fileName: v.optional(v.string()),     // Original filename
  fileSize: v.optional(v.number()),     // Size in bytes
  isGif: v.optional(v.boolean()),
  isSticker: v.optional(v.boolean()),
  width: v.optional(v.number()),        // Image width in px
  height: v.optional(v.number()),       // Image height in px
})))
```

### 2. Sync Logic (`convex/beeperSync.ts`)
- **Message extraction** (lines 337-360): Extracts attachment data from Beeper API responses
- **Message storage**: Stores attachments in database for both new and updated messages

### 3. UI Component (`src/components/messages/ChatDetail.tsx`)
Renders attachments with:
- **Images**: Full image display with lazy loading and error fallback
- **Stickers**: Special label for sticker messages
- **Videos**: Shows video icon and filename
- **Audio**: Shows audio icon and filename
- **Unknown**: Shows generic attachment icon

## Beeper API Response Format

From `/v1/messages/search`, messages include:

```json
{
  "id": "123456",
  "text": "Check this out!",
  "attachments": [
    {
      "type": "img",
      "srcURL": "file:///path/to/image.jpg",
      "mimeType": "image/jpeg",
      "fileName": "photo.jpg",
      "fileSize": 245678,
      "size": {
        "width": 1920,
        "height": 1080
      },
      "isGif": false,
      "isSticker": false
    }
  ]
}
```

## Important Notes

### ⚠️ Temporary URLs
According to Beeper API spec:
> *"srcURL may be temporary or local-only to this device; download promptly if durable access is needed."*

**Current behavior**: We store the URL as-is. Images load directly from Beeper's local storage.

**Future consideration**: If you need persistent image storage, implement a download/caching system:
1. Use the `/v1/assets/download` API endpoint
2. Download images to your own storage
3. Update `srcURL` to point to your cached copy

### Supported Attachment Types
- ✅ **img**: Fully rendered with responsive layout
- ⚠️ **video**: Shows filename only (no player yet)
- ⚠️ **audio**: Shows filename only (no player yet)
- ⚠️ **unknown**: Shows filename only

### Image Rendering Features
- **Lazy loading**: Images load on scroll for performance
- **Error handling**: Shows fallback text if image fails to load
- **Responsive**: Max width 100%, max height 384px
- **Sticker detection**: Special label for stickers

## Testing

To test image attachment support:

1. **Manual sync**: Click the sync button in the Messages page
2. **Find a chat with images**: Look for messages with photo/video attachments
3. **Verify display**: Images should render inline with the message text
4. **Check error handling**: Test with expired/invalid image URLs

## Next Steps (Optional Enhancements)

1. **Video/Audio Players**: Add `<video>` and `<audio>` elements for media playback
2. **Image Modal**: Click to view full-size images
3. **Download Button**: Allow users to download/save attachments
4. **Persistent Caching**: Implement download system for durable storage
5. **GIF Animation**: Special handling for animated GIFs
6. **Image Galleries**: Group multiple images in a grid layout

## Code References

- Schema: `convex/schema.ts` lines 82-104
- Sync logic: `convex/beeperSync.ts` lines 337-363
- UI component: `src/components/messages/ChatDetail.tsx` lines 64-103

