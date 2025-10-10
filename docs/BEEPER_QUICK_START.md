# Beeper Integration - Quick Start

## ✅ Configuration Complete!

The Beeper API integration has been configured with the correct endpoints:
- **API URL**: `http://localhost:23373`
- **Token**: Configured in Convex
- **Endpoints**: Updated to use `/v0/search-chats` and `/v0/search-messages`

## 🔧 Requirements

### 1. Beeper Desktop Must Be Running

The Beeper API runs locally on your computer. You need:

1. **Install Beeper Desktop** (if not already installed)
   - Download from: https://www.beeper.com/

2. **Enable the Desktop API**:
   - Open Beeper Desktop
   - Go to **Settings → Developers**
   - Enable the API
   - The server will start on `http://localhost:23373`

3. **Get Your API Token** (already have: `746af626-4909-4196-b659-06dc2a52b767`)
   - Found in Settings → Developers → API Token

### 2. Verify Beeper API is Running

Test in your terminal:
```bash
curl -H "Authorization: Bearer 746af626-4909-4196-b659-06dc2a52b767" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}' \
  http://localhost:23373/v0/search-chats
```

You should see your chats returned.

## 🚀 Using the Integration

Once Beeper Desktop is running with the API enabled:

1. **Start your dev server**:
   ```bash
   npm run dev
   ```

2. **Visit**: http://localhost:5174/messages

3. **You should see**:
   - List of chats where you haven't replied (left sidebar)
   - Click a chat to see the conversation
   - AI-generated reply suggestions appear automatically

## 🔍 Troubleshooting

### "Failed to fetch chats from Beeper" Error

**Problem**: Beeper Desktop API is not running

**Solutions**:
1. Make sure Beeper Desktop app is open
2. Go to Settings → Developers in Beeper
3. Verify "Enable API" is checked
4. Check the API is accessible: `curl http://localhost:23373/v0/search-chats`

### "404 Not Found" Errors

**Problem**: Using wrong API endpoints

**Solution**: Already fixed! The code now uses:
- `/v0/search-chats` for listing chats
- `/v0/search-messages` for getting messages

### Port Already in Use (5174)

**Problem**: Another app is using port 5174

**Solution**: Change the port in `vite.config.ts`:
```typescript
server: {
  port: 5175, // or any other available port
}
```

## 📊 How It Works

1. **Fetch Chats**: Calls `/v0/search-chats` to get all your chats
2. **Filter**: Shows only chats where the other person sent the last message
3. **Get Messages**: When you click a chat, calls `/v0/search-messages` with `chatID`
4. **AI Analysis**: Sends last 25 messages to OpenAI GPT-4o-mini
5. **Generate Replies**: Returns 3-4 contextual reply suggestions
6. **Copy & Send**: Click copy button to use any suggestion

## 💰 Cost

- **Beeper API**: Free (runs locally)
- **OpenAI**: ~$0.001 per chat (less than a penny!)

## 🎉 Ready!

Everything is configured and ready to use. Just make sure Beeper Desktop is running and visit:

**http://localhost:5174/messages**

Enjoy your AI-powered messaging assistant! 🚀

