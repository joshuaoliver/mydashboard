import { action } from "./_generated/server";
import { v } from "convex/values";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

// Beeper API configuration (from environment variables)
// Using bywave proxy instead of localhost so Convex (cloud-hosted) can access it
const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

// Type definitions for Beeper API responses
interface BeeperChat {
  id: string;
  localChatID?: string;
  title: string;
  network?: string;        // e.g., "Instagram", "WhatsApp"
  accountID?: string;      // e.g., "instagram", "whatsapp"
  type: "single" | "group";
  lastActivity: string;
  unreadCount?: number;
  isArchived?: boolean;
  isMuted?: boolean;
  participants?: {
    items: Array<{
      id: string;
      isSelf: boolean;
    }>;
  };
}

interface BeeperMessage {
  id: string;
  messageID: string;
  timestamp: string;
  senderID: string;
  senderName: string;
  text: string;
  isSender: boolean;
  chatID: string;
}

/**
 * List chats where the user hasn't replied yet
 * Fetches chats from Beeper API and filters for:
 * - Primary inbox chats
 * - Last message is from the other person (not the user)
 */
export const listUnrepliedChats = action({
  args: {},
  handler: async (ctx) => {
    try {
      // Note: Auth disabled for now - this is a personal dashboard
      // const identity = await ctx.auth.getUserIdentity();
      // const userMxid = identity?.subject;
      const userMxid = undefined; // Will be set when auth is enabled

      // Fetch chats from Beeper API using search endpoint (GET with query params)
      const response = await fetch(`${BEEPER_API_URL}/v0/search-chats?limit=50`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${BEEPER_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Beeper API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const chats: BeeperChat[] = data.items || [];

      // Filter for direct message chats only (not groups)
      // TODO: Add filtering for "awaiting reply" by checking last message sender
      const directChats = chats
        .filter((chat) => {
          // Only include direct message chats (type: "single")
          return chat.type === "single" && !chat.isArchived;
        })
        .sort((a, b) => {
          // Sort by most recent activity
          const timeA = new Date(a.lastActivity).getTime();
          const timeB = new Date(b.lastActivity).getTime();
          return timeB - timeA;
        })
        .slice(0, 20); // Return top 20 most recent chats

      // Format response
      return {
        chats: directChats.map((chat) => ({
          id: chat.id,
          roomId: chat.localChatID || chat.id,
          name: chat.title || "Unknown",
          network: chat.network || chat.accountID || "Unknown", // e.g., "Instagram", "WhatsApp"
          accountID: chat.accountID || "", // e.g., "instagram", "whatsapp"
          lastMessage: "Recent activity", // We'll get actual messages when chat is selected
          lastMessageTime: new Date(chat.lastActivity).getTime(),
          unreadCount: chat.unreadCount || 0,
        })),
      };
    } catch (error) {
      console.error("Error fetching Beeper chats:", error);
      throw new Error(
        `Failed to fetch chats from Beeper: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Helper function to fetch messages from Beeper API
 * Shared by both getChatMessages and generateReplySuggestions
 */
async function fetchChatMessages(chatId: string, userMxid?: string) {
  const response = await fetch(
    `${BEEPER_API_URL}/v0/search-messages?chatID=${encodeURIComponent(chatId)}&limit=30`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BEEPER_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Beeper API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const messages: BeeperMessage[] = data.items || [];

  // Format messages for display
  return messages
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) // Chronological order
    .map((msg) => ({
      id: msg.id,
      text: msg.text || "",
      timestamp: new Date(msg.timestamp).getTime(),
      sender: msg.senderID,
      senderName: msg.senderName || msg.senderID,
      isFromUser: msg.isSender,
    }));
}

/**
 * Get conversation history for a specific chat
 * Fetches the last 20-30 messages for AI context
 */
export const getChatMessages = action({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Note: Auth disabled for now - this is a personal dashboard
      // const identity = await ctx.auth.getUserIdentity();
      // const userMxid = identity?.subject;
      const userMxid = undefined;

      const messages = await fetchChatMessages(args.chatId, userMxid);

      return { messages };
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      throw new Error(
        `Failed to fetch messages: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Generate AI-powered reply suggestions
 * Uses OpenAI via Vercel AI SDK to analyze conversation and suggest replies
 */
export const generateReplySuggestions = action({
  args: {
    chatId: v.string(),
    chatName: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Note: Auth disabled for now - this is a personal dashboard
      // const identity = await ctx.auth.getUserIdentity();
      // const userMxid = identity?.subject;
      const userMxid = undefined;

      // Fetch the conversation history
      const messages = await fetchChatMessages(args.chatId, userMxid);

      if (messages.length === 0) {
        return {
          suggestions: [],
          error: "No messages found in this conversation",
        };
      }

      // Format conversation for AI prompt
      const conversationHistory = messages
        .slice(-25) // Use last 25 messages for context
        .map((msg: { isFromUser: boolean; text: string }) => {
          const role = msg.isFromUser ? "You" : args.chatName;
          return `${role}: ${msg.text}`;
        })
        .join("\n");

      // Get last message to understand context
      const lastMessage = messages[messages.length - 1];
      const lastMessageText = lastMessage.text;

      // Generate reply suggestions using OpenAI
      const prompt = `You are a helpful assistant that suggests thoughtful, contextually appropriate replies to messages.

Given the following conversation history with ${args.chatName}, suggest 3-4 different reply options that:
- Match the conversation's tone and context
- Are natural and authentic
- Vary in style (casual/formal, brief/detailed, etc.)
- Consider the relationship and conversation history

Conversation history:
${conversationHistory}

The most recent message from ${args.chatName} was: "${lastMessageText}"

For each suggestion, provide:
1. The suggested reply text
2. A brief explanation of the tone/style (e.g., "Casual and friendly", "Professional and brief")

Format your response as JSON with this structure:
{
  "suggestions": [
    {
      "reply": "The actual reply text here",
      "style": "Description of tone/style",
      "reasoning": "Brief explanation of why this reply works"
    }
  ]
}`;

      // Initialize OpenAI client
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const result = await generateText({
        model: openai("gpt-4o-mini"), // Using GPT-4o-mini for cost-effectiveness
        prompt: prompt,
        temperature: 0.8, // Slightly higher for creative variety
      });

      // Parse the AI response
      try {
        const aiResponse = JSON.parse(result.text);
        return {
          suggestions: aiResponse.suggestions || [],
          conversationContext: {
            lastMessage: lastMessageText,
            messageCount: messages.length,
          },
        };
      } catch (parseError) {
        // If JSON parsing fails, return a fallback
        console.error("Error parsing AI response:", parseError);
        return {
          suggestions: [
            {
              reply: "Thanks for your message! I'll get back to you soon.",
              style: "Polite and acknowledgment",
              reasoning: "A safe, professional response while you consider a more detailed reply",
            },
          ],
          conversationContext: {
            lastMessage: lastMessageText,
            messageCount: messages.length,
          },
        };
      }
    } catch (error) {
      console.error("Error generating reply suggestions:", error);
      throw new Error(
        `Failed to generate suggestions: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

