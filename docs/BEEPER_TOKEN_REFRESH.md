# Beeper Token Refresh Guide

**Issue ID**: 91e7dc99-cdc9-4ce7-b039-826627f5bdb0  
**Date**: November 12, 2025  
**Status**: Token Expired - Action Required

## Problem

Your Beeper authentication token has expired, resulting in the following errors:

```
[CONVEX A(beeperSync:syncBeeperChatsInternal)] [ERROR] '[Beeper Sync] Authentication failed - check BEEPER_TOKEN'
[CONVEX A(beeperSync:syncBeeperChatsInternal)] [ERROR] '[Beeper Sync] AuthenticationError: AuthenticationError (401): 401 Token expired'
```

## Root Cause

The `BEEPER_TOKEN` environment variable contains an expired authentication token. Beeper access tokens have a limited lifetime and need to be refreshed periodically.

## Solution

### Step 1: Obtain a New Token

You need to get a fresh authentication token from your Beeper instance. There are several methods depending on your Beeper setup:

#### Method A: Via Beeper Web Interface

1. Navigate to your Beeper instance: `https://beeper.bywave.com.au`
2. Log in to your account
3. Go to **Settings** → **Developer** or **API Tokens**
4. Generate a new access token
5. Copy the token value (it will look like a UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

#### Method B: Via Beeper Desktop API (if running locally)

If you have Beeper Desktop running locally, you can extract the token:

```bash
# On macOS
cat ~/Library/Application\ Support/Beeper/Local\ Storage/leveldb/CURRENT

# On Linux
cat ~/.config/Beeper/Local\ Storage/leveldb/CURRENT

# On Windows
type %APPDATA%\Beeper\Local Storage\leveldb\CURRENT
```

Look for an entry that contains `accessToken` or similar.

#### Method C: Via Your Beeper Admin/Self-Hosted Instance

If you're using a self-hosted Beeper instance:

1. SSH into your Beeper server
2. Access the authentication service
3. Generate a new token for your user account
4. Use the token generation command (specific to your setup)

### Step 2: Update the Token in Convex

Once you have the new token, update it in your Convex environment:

#### Option 1: Using Convex CLI (Recommended)

```bash
# For development environment
npx convex env set BEEPER_TOKEN your_new_token_here

# For production environment (if applicable)
npx convex env set BEEPER_TOKEN your_new_token_here --prod
```

#### Option 2: Using Convex Dashboard

1. Go to https://dashboard.convex.dev
2. Select your project: **posh-starfish-269**
3. Navigate to **Settings** → **Environment Variables**
4. Find the `BEEPER_TOKEN` variable
5. Click **Edit** and paste the new token
6. Click **Save**

### Step 3: Restart Convex Development Server

After updating the token, restart your Convex dev server to apply the changes:

```bash
# Stop the current dev server (Ctrl+C)
# Then restart
npm run dev
```

### Step 4: Verify the Fix

Test the Beeper sync to ensure the new token is working:

1. Open your dashboard at `http://localhost:5173`
2. Navigate to the **Messages** tab
3. Watch the Convex logs for successful sync messages:
   ```
   [Beeper Sync] Synced X chats, Y messages
   ```

## Expected Behavior After Fix

Once the token is updated, you should see logs like:

```
[Beeper Sync] No previous sync - fetching all chats
[Beeper Sync] Received X chats from API
[Beeper Sync] Synced X chats, Y messages (source: cron/manual/page_load)
```

## Preventing Future Token Expiration

### Option 1: Token Rotation Script

Consider creating a script that periodically checks token validity and alerts you before expiration:

```javascript
// scripts/check-beeper-token.js
import BeeperDesktop from '@beeper/desktop-api';

const BEEPER_TOKEN = process.env.BEEPER_TOKEN;
const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";

async function checkToken() {
  try {
    const client = new BeeperDesktop({
      accessToken: BEEPER_TOKEN,
      baseURL: BEEPER_API_URL,
      maxRetries: 0,
      timeout: 5000,
    });
    
    // Test with a simple API call
    const response = await client.get('/v1/chats', { query: { limit: 1 } });
    console.log('✅ Token is valid');
    return true;
  } catch (error) {
    if (error.status === 401) {
      console.error('❌ Token expired or invalid');
      return false;
    }
    throw error;
  }
}

checkToken();
```

Run this script periodically (e.g., daily via cron) to get early warnings.

### Option 2: Implement Token Refresh in Code

If your Beeper instance supports refresh tokens, modify `convex/beeperClient.ts` to handle token refresh:

```typescript
export function createBeeperClient() {
  if (!BEEPER_TOKEN) {
    throw new Error("BEEPER_TOKEN environment variable is not set");
  }

  // TODO: Add refresh token logic here
  // - Check token expiration before each request
  // - Refresh if needed using refresh token
  // - Update stored token

  return new BeeperDesktop({
    accessToken: BEEPER_TOKEN,
    baseURL: BEEPER_API_URL,
    maxRetries: 2,
    timeout: 15000,
    logLevel: process.env.BEEPER_LOG_LEVEL as any || 'warn',
  });
}
```

### Option 3: Set Up Monitoring

Add monitoring to alert you when authentication fails:

1. **Convex Logs**: Set up alerts for "AuthenticationError" in your Convex dashboard
2. **Health Check**: Create a scheduled function to test the token periodically
3. **Notification**: Send email/SMS when the token needs rotation

## Token Security Best Practices

1. **Never commit tokens to git** - Always use environment variables
2. **Rotate tokens regularly** - Set a reminder to update tokens every 30-60 days
3. **Use different tokens for dev/prod** - Separate tokens for each environment
4. **Monitor token usage** - Check Convex logs for authentication errors
5. **Document the refresh process** - Keep this guide updated with your specific setup

## Related Files

- `convex/beeperClient.ts` - Token usage and SDK configuration
- `convex/beeperSync.ts` - Sync logic that uses the token
- `docs/CONVEX_ENV_SETUP.md` - Environment variable setup guide
- `docs/BEEPER_SETUP.md` - General Beeper integration setup

## Troubleshooting

### Token Still Not Working After Update

If you've updated the token but still see 401 errors:

1. **Verify the token format**: Should be a valid UUID or bearer token
2. **Check the API URL**: Ensure `BEEPER_API_URL` is correct
3. **Test the token manually**:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://beeper.bywave.com.au/v1/chats
   ```
4. **Check Beeper service status**: Verify your Beeper instance is running
5. **Restart Convex**: Sometimes a hard restart is needed:
   ```bash
   npx convex dev --clear
   ```

### Getting 403 Instead of 401

If you see 403 (Forbidden) instead of 401:
- Your token is valid but lacks required permissions
- Check your Beeper user role and API permissions
- You may need to regenerate the token with proper scopes

### Connection Timeout

If requests timeout before getting 401:
- Check your network connection to `beeper.bywave.com.au`
- Verify firewall rules allow outbound HTTPS
- Try increasing the timeout in `beeperClient.ts`

## Next Steps

After resolving this issue:

1. ✅ Update the token as described above
2. ✅ Verify sync is working
3. ✅ Set up token expiration monitoring
4. ✅ Document where/how you obtained the new token for future reference
5. ✅ Consider implementing automated token refresh if supported

## Status Update

**Current**: Token expired - sync failing  
**Expected after fix**: Token valid - sync successful  

Update this section once resolved:

- [ ] New token obtained
- [ ] Token updated in Convex
- [ ] Dev server restarted
- [ ] Sync tested and working
- [ ] Monitoring set up (optional)


