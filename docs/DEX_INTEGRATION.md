# Dex CRM Integration

This document describes the integration between Dex CRM and your personal dashboard, including setup instructions and usage guidelines.

## Overview

The Dex integration provides a two-way sync system:
- **Periodic Sync**: Every 2 hours, contacts are automatically synced FROM Dex TO Convex
- **Immediate Write-back**: When you edit a contact's description (or other editable fields) in Convex, the changes are immediately written back TO Dex

## Environment Setup

### 1. Get Your Dex API Key

1. Log in to your Dex account
2. Navigate to the API page: https://app.getdex.com/settings/api
3. Copy your API key (it should look like: `4bfb4ccd21e33f0`)

### 2. Add API Key to Convex

1. Open your Convex dashboard: https://dashboard.convex.dev
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add a new environment variable:
   - **Key**: `DEX_API_KEY`
   - **Value**: Your Dex API key (e.g., `4bfb4ccd21e33f0`)
5. Click **Save**

**Important**: Add the API key to ALL environments you want to use (development, production, etc.)

## Database Schema

The `contacts` table stores synced contact information:

| Field | Type | Description |
|-------|------|-------------|
| `dexId` | string | Dex's internal contact ID (used for sync tracking) |
| `firstName` | string (optional) | Contact's first name |
| `lastName` | string (optional) | Contact's last name |
| `description` | string (optional) | **Editable field** - notes about the contact |
| `instagram` | string (optional) | Instagram handle |
| `imageUrl` | string (optional) | Profile image URL |
| `emails` | array (optional) | Array of email objects: `[{email: "user@example.com"}]` |
| `phones` | array (optional) | Array of phone objects: `[{phone: "+1234567890"}]` |
| `birthday` | string (optional) | Birthday date (ISO format) |
| `lastSeenAt` | string (optional) | Last interaction timestamp from Dex |
| `lastSyncedAt` | number | Timestamp when last synced from Dex |
| `lastModifiedAt` | number | Timestamp when last modified locally |

## How It Works

### Automatic Sync (Dex → Convex)

Every 2 hours, a cron job automatically:
1. Fetches all contacts from Dex
2. Updates existing contacts in Convex
3. Adds new contacts from Dex
4. **Protection**: Contacts modified locally within the last 5 minutes are NOT overwritten

### Manual Sync

You can trigger a manual sync at any time:
- Use the test page at `/dex-test` (after running dev server)
- Or call the `triggerManualSync` mutation from the Convex dashboard

### Write-back (Convex → Dex)

When you update a contact's description (or other editable fields):
1. The change is saved immediately in Convex
2. A background task writes the change back to Dex
3. If the write-back fails, the local change persists (check logs for errors)

## API Functions

### Queries (Read Data)

```typescript
// List all contacts with optional search
api.dexQueries.listContacts({ 
  limit: 100, 
  searchTerm: "John" 
})

// Get a single contact by Convex ID
api.dexQueries.getContactById({ 
  contactId: "..." 
})

// Get a single contact by Dex ID
api.dexQueries.getContactByDexId({ 
  dexId: "..." 
})

// Get sync statistics
api.dexQueries.getSyncStats({})
```

### Mutations (Update Data)

```typescript
// Update a contact's description
api.dexSync.updateContactDescription({ 
  contactId: "...", 
  description: "New description" 
})

// Update multiple fields
api.dexSync.updateContact({ 
  contactId: "...", 
  updates: { 
    description: "New description",
    instagram: "newhandle",
    emails: [{ email: "new@email.com" }],
    phones: [{ phone: "+1234567890" }],
    birthday: "1990-01-15"
  } 
})

// Manually trigger a sync
api.dexSync.triggerManualSync({})
```

### Actions (Test/Debug)

```typescript
// Test the Dex API connection and see available fields
api.dexActions.testFetchDexContacts({})

// Manually fetch contacts (for debugging)
api.dexActions.fetchDexContacts({})
```

## Testing the Integration

### 1. Test API Connection

Visit `/dex-test` in your browser to:
- Test the Dex API connection
- See sample contacts
- View all available fields from Dex
- Trigger a manual sync

### 2. Verify Sync

After the first sync:
1. Check the Convex dashboard's Data tab
2. Look for the `contacts` table
3. Verify contacts are being synced

### 3. Test Write-back

1. Update a contact's description via the UI
2. Check the Convex logs to verify write-back started
3. Verify the change appears in Dex

## Troubleshooting

### "DEX_API_KEY environment variable is not set"

- Make sure you've added the API key to Convex environment variables
- Restart your dev server after adding the key
- Check that you're in the correct environment (dev/prod)

### Contacts not syncing

- Check the Convex logs for errors
- Verify your API key is correct
- Try triggering a manual sync
- Check that the cron job is running (Convex dashboard → Crons)

### Write-back not working

- Check the Convex logs for error messages
- Verify the Dex API endpoint accepts PUT requests
- Ensure your API key has write permissions

## Field Mapping

After running the test action, you may discover additional fields from Dex. Update the schema and sync logic to include any fields you want to track.

Common Dex fields:
- `first_name`, `last_name`
- `email`, `phone`
- `company`, `job_title`
- `linkedin`, `twitter`, `instagram`
- `notes`, `description`
- `tags`, `labels`
- `last_contacted`, `date_met`

## Cron Schedule

The sync runs every 2 hours. To change the schedule, edit `convex/crons.ts`:

```typescript
// Every hour
crons.interval("sync-dex-contacts", { hours: 1 }, ...)

// Every 30 minutes
crons.interval("sync-dex-contacts", { minutes: 30 }, ...)

// Daily at midnight
crons.daily("sync-dex-contacts", { hourUTC: 0, minuteUTC: 0 }, ...)
```

## Security Notes

- **Never** commit your API key to git
- Store the key only in Convex environment variables
- The API key grants access to all your Dex data - keep it secure
- Consider using different API keys for dev/production if Dex supports it
