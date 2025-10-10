# Beeper AI Reply Integration Setup Guide

This guide will help you set up the Beeper AI Reply Integration feature in your dashboard.

## Prerequisites

1. **Beeper Account**: You need access to the Beeper API (already configured with your token)
2. **OpenAI API Key**: Get one from [OpenAI Platform](https://platform.openai.com/api-keys)
3. **Node.js & npm**: Already installed (used for the project)

## Setup Steps

### 1. Beeper API Configuration ✅

**Already Done!** The Beeper API has been configured with:
- API URL: `https://beeper.bywave.com.au/v0`
- Authentication token: Already set in Convex environment variables

No additional Beeper setup needed!

### 2. Configure OpenAI API Key ⚠️

You need to set your OpenAI API key in Convex:

**Option 1: Using CLI (Quickest)**
```bash
npx convex env set OPENAI_API_KEY sk-your_actual_api_key_here
```

**Option 2: Using Dashboard**
1. Go to https://dashboard.convex.dev
2. Select project: **posh-starfish-269**
3. Go to Settings → Environment Variables
4. Add `OPENAI_API_KEY` with your key

**Important**: Replace `sk-your_actual_api_key_here` with your actual OpenAI API key from https://platform.openai.com/api-keys

### 3. Start the Development Server

```bash
npm run dev
```

This will start:
- Vite development server (frontend)
- Convex backend (real-time database and API)

### 4. Access the Messages Tab

Navigate to the Messages tab in your dashboard:
```
http://localhost:5173/messages
```

## Features

### What This Integration Does

1. **Fetch Pending Chats**: Automatically fetches chats from Beeper where the other person sent the last message (you haven't replied yet)

2. **Conversation History**: When you select a chat, it loads the last 20-30 messages for context

3. **AI-Powered Reply Suggestions**: Uses OpenAI GPT-4o-mini to generate 3-4 contextually appropriate reply suggestions, each with:
   - The suggested reply text
   - Style description (e.g., "Casual and friendly", "Professional")
   - Reasoning why this reply works

4. **Copy to Clipboard**: Each suggestion has a copy button for easy use

## UI Layout

The Messages tab features a responsive two-column layout:

- **Left Column**: List of pending chats (conversations awaiting your reply)
  - Shows contact name, last message preview, and timestamp
  - Highlights the selected chat
  - Displays unread count if available

- **Right Column**: Split into two sections
  - **Top Half**: Full conversation history with message bubbles
  - **Bottom Half**: AI-generated reply suggestions with copy buttons

## Troubleshooting

### "Failed to fetch chats from Beeper" Error

**Possible causes:**
1. Beeper API token is invalid or expired
2. Network connectivity issues
3. Beeper API service is down

**Solutions:**
- Verify the Beeper token is correctly set in Convex environment variables
- Check your internet connection
- Check browser console for detailed error messages
- Verify you have access to the Beeper API at https://beeper.bywave.com.au

### "Failed to generate suggestions" Error

**Possible causes:**
1. Missing or invalid OpenAI API key
2. OpenAI API rate limits exceeded
3. Network issues

**Solutions:**
- Verify your `OPENAI_API_KEY` in `.env.local` is correct
- Check OpenAI API usage limits at https://platform.openai.com/usage
- Ensure you have internet connectivity

### No Chats Showing Up

**Possible causes:**
1. All chats have been replied to (you're all caught up! 🎉)
2. Beeper API returned empty results
3. Filtering logic excluded chats

**Solutions:**
- Check if you have any pending messages in Beeper Desktop
- Try the refresh button in the Messages tab
- Check browser console for any errors

## API Rate Limits & Costs

This integration uses OpenAI's GPT-4o-mini model, which is cost-effective:
- **Model**: GPT-4o-mini
- **Approximate cost**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Usage**: Each reply generation uses ~500-1000 tokens (including conversation history)

**Estimated cost per suggestion**: Less than $0.01 per chat

## Database Schema

The integration includes an optional `beeperChats` table for caching:
- `chatId`: Beeper chat ID
- `roomId`: Matrix room ID
- `chatName`: Display name of the contact
- `lastMessageTime`: Timestamp of last message
- `lastMessageFrom`: Sender of last message
- `lastMessageText`: Text of last message
- `userId`: Current user ID
- `repliedAt`: Optional timestamp when you replied

This caching can be used in future enhancements for tracking reply patterns and analytics.

## Future Enhancements

Potential improvements you could add:
1. **Send Reply Directly**: Implement sending replies through Beeper API
2. **Reply History**: Track which suggestions you used
3. **Custom Prompts**: Allow customizing the AI prompt for different conversation styles
4. **Reply Templates**: Save frequently used reply patterns
5. **Scheduled Replies**: Queue replies to send later
6. **Multi-language Support**: Generate replies in different languages
7. **Tone Adjustment**: Slider to adjust formality/casualness of suggestions

## Support

For issues specific to:
- **Beeper API**: Check [Beeper Desktop API Documentation](https://developers.beeper.com/desktop-api/)
- **OpenAI API**: See [OpenAI API Documentation](https://platform.openai.com/docs)
- **Vercel AI SDK**: Visit [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env.local`**: It contains your OpenAI API key
2. **API Key Safety**: Keep your OpenAI API key private
3. **Local API**: Beeper Desktop API only works on localhost (not accessible remotely)
4. **Message Privacy**: Conversation data is sent to OpenAI for suggestion generation

## License

This integration is part of your personal dashboard project.

