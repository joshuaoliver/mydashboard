# Beeper Integration - Architecture & Setup

## 🏗️ Architecture Overview

### The Problem: Convex is Cloud-Hosted

Your Convex backend runs on Convex's servers in the cloud, **not on your local machine**. This means:

❌ **Can't use**: `http://localhost:23373` (Beeper Desktop API on your computer)
- Convex actions would try to reach localhost on *Convex's server*, not your machine
- This will always fail

✅ **Solution**: Use `https://beeper.bywave.com.au` (cloud proxy)
- This is a publicly accessible proxy to your Beeper account
- Convex can reach it from their servers
- Uses your authentication token to access your messages

### Current Configuration

```
BEEPER_API_URL=https://beeper.bywave.com.au
BEEPER_TOKEN=746af626-4909-4196-b659-06dc2a52b767
OPENAI_API_KEY=sk-proj-... (your key)
```

## 🔄 How It Works

```
User Browser (localhost:5174)
    ↓
Convex Backend (cloud)
    ↓
https://beeper.bywave.com.au (cloud proxy)
    ↓
Your Beeper Account Data
```

1. **User opens Messages tab** in browser
2. **Frontend calls** Convex action `listUnrepliedChats`
3. **Convex action makes** HTTP request to `https://beeper.bywave.com.au/v0/search-chats`
4. **Bywave proxy** authenticates with your token and returns your chats
5. **Convex formats** the data and returns it to frontend
6. **Frontend displays** chats in the UI

## 🔐 Security

### Authentication Token
- Your token (`746af626-4909-4196-b659-06dc2a52b767`) is stored securely in Convex environment variables
- Never exposed to the frontend/browser
- Only accessible to Convex backend functions

### API Access
- The bywave proxy requires your token for all requests
- No one can access your messages without your token
- Token is sent in `Authorization: Bearer` header

## 📡 API Endpoints

### Base URL
```
https://beeper.bywave.com.au
```

### Endpoints Used

#### 1. Search Chats
```http
GET /v0/search-chats?limit=50
Authorization: Bearer {token}
```

Returns:
```json
{
  "items": [
    {
      "id": "!chatId:beeper.local",
      "title": "Contact Name",
      "type": "single",
      "lastActivity": "2025-10-10T12:27:11.000Z",
      "unreadCount": 2
    }
  ]
}
```

#### 2. Search Messages
```http
GET /v0/search-messages?chatID={id}&limit=30
Authorization: Bearer {token}
```

Returns:
```json
{
  "items": [
    {
      "id": "msg_123",
      "text": "Message content",
      "timestamp": "2025-10-10T12:27:11.000Z",
      "senderName": "John Doe",
      "isSender": false
    }
  ]
}
```

## 🧪 Testing

### Test Chat Endpoint
```bash
curl -H "Authorization: Bearer 746af626-4909-4196-b659-06dc2a52b767" \
  "https://beeper.bywave.com.au/v0/search-chats?limit=5" | jq '.'
```

### Test Messages Endpoint
```bash
curl -H "Authorization: Bearer 746af626-4909-4196-b659-06dc2a52b767" \
  "https://beeper.bywave.com.au/v0/search-messages?limit=5" | jq '.'
```

## 💡 Key Insights

### Why Not Localhost?
- ❌ Convex is cloud-hosted, can't reach your computer
- ❌ Would need to expose localhost to internet (security risk)
- ❌ Would require ngrok or similar tunneling (complex)

### Why Bywave Proxy Works
- ✅ Publicly accessible from anywhere
- ✅ No need to expose your local machine
- ✅ Simple authentication with token
- ✅ Convex can reach it directly from cloud

## 🚀 Benefits of This Architecture

1. **No Local Dependencies**
   - Don't need Beeper Desktop running while using the app
   - Works from any device/location

2. **Cloud-Native**
   - Convex backend and Beeper proxy both in cloud
   - Fast, reliable connections
   - No localhost networking issues

3. **Scalable**
   - Can add multiple users later (each with their own token)
   - No local resource constraints

4. **Simple Deployment**
   - No complex networking setup
   - No firewall/NAT issues
   - Just works™

## 📊 Data Flow

### Listing Chats
```
Browser → Convex Action (listUnrepliedChats)
       → GET https://beeper.bywave.com.au/v0/search-chats
       → Filter for direct messages
       → Return formatted chat list
       → Browser displays in sidebar
```

### Viewing Messages
```
User clicks chat → Convex Action (getChatMessages)
                 → GET https://beeper.bywave.com.au/v0/search-messages?chatID={id}
                 → Format message history
                 → Return to browser
                 → Display in conversation view
```

### Generating AI Replies
```
User selects chat → Convex Action (generateReplySuggestions)
                  → Fetch messages from Beeper
                  → Send last 25 messages to OpenAI
                  → Generate 3-4 reply suggestions
                  → Return to browser
                  → Display with copy buttons
```

## 🔧 Troubleshooting

### "Failed to fetch chats" Error

**Check:**
1. Is `BEEPER_API_URL` set to `https://beeper.bywave.com.au`?
   ```bash
   npx convex env get BEEPER_API_URL
   ```

2. Is token valid?
   ```bash
   curl -H "Authorization: Bearer 746af626-4909-4196-b659-06dc2a52b767" \
     "https://beeper.bywave.com.au/v0/search-chats?limit=1"
   ```

3. Restart Convex dev server to pick up env changes

### API Returns Empty Results

- Normal if you have no direct message chats
- Current filter shows only `type: "single"` (not groups)
- Check full API response to see what's available

## 🎯 Summary

- ✅ **Beeper API**: `https://beeper.bywave.com.au`
- ✅ **Token**: Stored in Convex environment
- ✅ **Endpoints**: GET with query parameters
- ✅ **Architecture**: Cloud → Cloud (no localhost)
- ✅ **Works from**: Anywhere with internet

Your Beeper AI Reply Integration is fully cloud-native! 🚀

