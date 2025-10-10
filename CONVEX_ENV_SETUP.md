# Setting Up Convex Environment Variables

## Required Environment Variables

Your Beeper integration requires three environment variables to be configured in Convex:

1. **BEEPER_API_URL** - The Beeper API endpoint
2. **BEEPER_TOKEN** - Your Beeper authentication token
3. **OPENAI_API_KEY** - Your OpenAI API key for AI suggestions

## Setup Status

✅ **BEEPER_API_URL** - Already set to `https://beeper.bywave.com.au/v0`  
✅ **BEEPER_TOKEN** - Already configured  
⚠️ **OPENAI_API_KEY** - You need to set this

## How to Set Your OpenAI API Key

### Method 1: Using Convex CLI (Quickest)

```bash
# Set your OpenAI API key for development
npx convex env set OPENAI_API_KEY your_actual_openai_api_key_here

# For production environment (optional), add --prod flag
npx convex env set OPENAI_API_KEY your_actual_openai_api_key_here --prod
```

**Important**: Replace `your_actual_openai_api_key_here` with your real API key from https://platform.openai.com/api-keys

### Method 2: Using Convex Dashboard

1. Go to https://dashboard.convex.dev
2. Select your project: **posh-starfish-269**
3. Go to **Settings → Environment Variables**
4. Add: `OPENAI_API_KEY` with your actual OpenAI API key
5. Save the changes

## Security Notes

⚠️ **Important**:
- Environment variables in Convex are stored securely on Convex servers
- They are **NOT** accessible from the frontend/client code
- They are only available in backend functions (queries, mutations, actions)
- Never commit sensitive tokens to git
- Each Convex environment (dev/prod) has its own set of environment variables

## Verification

After setting the environment variables, verify they're working:

1. **Check the Convex logs**:
   ```bash
   npx convex dev
   ```

2. **Test the integration**:
   - Start your app with `npm run dev`
   - Navigate to the Messages tab
   - If the environment variables are set correctly, you should see your Beeper chats load

3. **Troubleshooting**:
   - If you see "Failed to fetch chats", check that:
     - BEEPER_TOKEN is set correctly
     - BEEPER_API_URL is accessible
     - You have restarted the Convex dev server after setting variables

## Variable Details

### BEEPER_API_URL
- **Value**: `https://beeper.bywave.com.au/v0`
- **Purpose**: Base URL for Beeper API endpoints
- **Type**: Public (not sensitive, but configured as env var for flexibility)

### BEEPER_TOKEN
- **Value**: `746af626-4909-4196-b659-06dc2a52b767`
- **Purpose**: Authentication token for Beeper API
- **Type**: **SECRET** - Never share or commit this
- **Note**: This authenticates all API requests to Beeper

### OPENAI_API_KEY
- **Value**: Get from https://platform.openai.com/api-keys
- **Purpose**: Authenticate requests to OpenAI for AI reply generation
- **Type**: **SECRET** - Never share or commit this
- **Format**: Starts with `sk-` followed by random characters

## How These Variables Are Used

In your `convex/beeperActions.ts` file:

```typescript
// Backend code - environment variables are accessed via process.env
const BEEPER_API_URL = process.env.BEEPER_API_URL;
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Used in API requests
fetch(`${BEEPER_API_URL}/chats`, {
  headers: {
    "Authorization": `Bearer ${BEEPER_TOKEN}`
  }
})
```

## Next Steps

After setting up the environment variables:

1. ✅ Make sure all three variables are set in Convex dashboard
2. ✅ Restart your Convex dev server: `npm run dev`
3. ✅ Test the Messages tab at `http://localhost:5173/messages`
4. ✅ You should see your Beeper chats and AI suggestions working!

## FAQ

**Q: Do I need a .env.local file?**  
A: No! Since we're using Convex actions for all external API calls, the environment variables only need to be set in Convex (not in your local project). The frontend never directly accesses these secrets.

**Q: What if I change the environment variables?**  
A: You'll need to redeploy your Convex functions. If using `npx convex dev`, it should auto-reload. Otherwise, run the dev command again.

**Q: Can I use different tokens for dev vs production?**  
A: Yes! Convex supports separate environment variables for each environment. Set them independently in the dashboard or use the `--prod` flag with the CLI.

**Q: How do I rotate/change my Beeper token?**  
A: Simply update the BEEPER_TOKEN value in the Convex dashboard or via CLI, and restart your Convex dev server.

