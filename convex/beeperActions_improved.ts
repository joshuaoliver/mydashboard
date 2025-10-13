"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

// Beeper API configuration (from environment variables)
// Using bywave proxy instead of localhost so Convex (cloud-hosted) can access it
const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

// Helper to check for required env vars at runtime
function requireBeeperToken(): string {
  if (!BEEPER_TOKEN) {
    throw new Error("BEEPER_TOKEN environment variable is required");
  }
  return BEEPER_TOKEN;
}

// ============================================================================
// VALIDATORS (Source of truth for types)
// ============================================================================

const chatOutputValidator = v.object({
  id: v.string(),
  roomId: v.string(),
  name: v.string(),
  network: v.string(),
  accountID: v.string(),
  lastMessage: v.string(),
  lastMessageTime: v.number(),
  unreadCount: v.number(),
});

const messageOutputValidator = v.object({
  id: v.string(),
  text: v.string(),
  timestamp: v.number(),
  sender: v.string(),
  senderName: v.string(),
  isFromUser: v.boolean(),
});

const replySuggestionValidator = v.object({
  reply: v.string(),
  style: v.string(),
  reasoning: v.string(),
});

// ============================================================================
// TYPE DEFINITIONS (Beeper API responses)
// ============================================================================

interface BeeperChat {
  id: string;
  localChatID?: string;
  title: string;
  network?: string;
  accountID?: string;
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper function to fetch messages from Beeper API
 * Shared by multiple actions to avoid duplication
 */
async function fetchChatMessages(chatId: string) {
  const url = `${BEEPER_API_URL}/v0/search-messages?chatID=${encodeURIComponent(chatId)}&limit=30`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${requireBeeperToken()}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unable to read error response");
    throw new Error(
      `Beeper API error (${response.status} ${response.statusText}): ${errorText}`
    );
  }

  const data = await response.json();
  const messages: BeeperMessage[] = data.items || [];

  // Format messages for display (chronological order)
  return messages
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((msg) => ({
      id: msg.id,
      text: msg.text || "",
      timestamp: new Date(msg.timestamp).getTime(),
      sender: msg.senderID,
      senderName: msg.senderName || msg.senderID,
      isFromUser: msg.isSender,
    }));
}

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * List chats where the user hasn't replied yet
 * 
 * Fetches chats from Beeper API and filters for:
 * - Primary inbox chats (not archived)
 * - Direct messages only (type: "single")
 * - Sorted by most recent activity
 * 
 * @returns Array of chat objects with formatted data
 */
export const listUnrepliedChats = action({
  args: {},
  returns: v.object({
    chats: v.array(chatOutputValidator),
  }),
  handler: async (_ctx) => {
    try {
      // Note: Auth disabled for now - this is a personal dashboard
      // const identity = await ctx.auth.getUserIdentity();
      // const userMxid = identity?.subject;

      // Fetch chats from Beeper API
      const response = await fetch(`${BEEPER_API_URL}/v0/search-chats?limit=50`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${requireBeeperToken()}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unable to read error response");
        throw new Error(
          `Beeper API error (${response.status} ${response.statusText}): ${errorText}`
        );
      }

      const data = await response.json();
      const chats: BeeperChat[] = data.items || [];

      // Filter for direct message chats only (not groups, not archived)
      const directChats = chats
        .filter((chat) => chat.type === "single" && !chat.isArchived)
        .sort((a, b) => {
          // Sort by most recent activity
          const timeA = new Date(a.lastActivity).getTime();
          const timeB = new Date(b.lastActivity).getTime();
          return timeB - timeA;
        })
        .slice(0, 20); // Return top 20 most recent chats

      // Format response according to validator
      return {
        chats: directChats.map((chat) => ({
          id: chat.id,
          roomId: chat.localChatID || chat.id,
          name: chat.title || "Unknown",
          network: chat.network || chat.accountID || "Unknown",
          accountID: chat.accountID || "",
          lastMessage: "Recent activity",
          lastMessageTime: new Date(chat.lastActivity).getTime(),
          unreadCount: chat.unreadCount || 0,
        })),
      };
    } catch (error) {
      // Enhanced error logging
      console.error("[listUnrepliedChats] Error:", error);
      
      // Distinguish between network errors and API errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          `Network error: Unable to connect to Beeper API at ${BEEPER_API_URL}`
        );
      }
      
      throw new Error(
        `Failed to fetch chats: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Get conversation history for a specific chat
 * 
 * Fetches the last 30 messages from Beeper API
 * Used for displaying conversation and providing AI context
 * 
 * @param chatId - Unique identifier for the chat
 * @returns Array of formatted message objects
 */
export const getChatMessages = action({
  args: {
    chatId: v.string(),
  },
  returns: v.object({
    messages: v.array(messageOutputValidator),
  }),
  handler: async (_ctx, args) => {
    try {
      // Note: Auth disabled for now - this is a personal dashboard
      // const identity = await ctx.auth.getUserIdentity();
      // const userMxid = identity?.subject;

      const messages = await fetchChatMessages(args.chatId);

      return { messages };
    } catch (error) {
      console.error("[getChatMessages] Error:", error);
      
      throw new Error(
        `Failed to fetch messages for chat ${args.chatId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  },
});

/**
 * Generate AI-powered reply suggestions
 * 
 * Analyzes conversation history using OpenAI GPT-4o-mini
 * and suggests 3-4 contextually appropriate reply options
 * 
 * @param chatId - Unique identifier for the chat
 * @param chatName - Display name of the chat participant
 * @returns Array of reply suggestions with style and reasoning
 */
export const generateReplySuggestions = action({
  args: {
    chatId: v.string(),
    chatName: v.string(),
  },
  returns: v.object({
    suggestions: v.array(replySuggestionValidator),
    conversationContext: v.object({
      lastMessage: v.string(),
      messageCount: v.number(),
    }),
  }),
  handler: async (_ctx, args) => {
    try {
      // Validate OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }

      // Note: Auth disabled for now - this is a personal dashboard
      // const identity = await ctx.auth.getUserIdentity();
      // const userMxid = identity?.subject;

      // Fetch the conversation history
      const messages = await fetchChatMessages(args.chatId);

      if (messages.length === 0) {
        return {
          suggestions: [],
          conversationContext: {
            lastMessage: "",
            messageCount: 0,
          },
        };
      }

      // Format conversation for AI prompt
      const conversationHistory = messages
        .slice(-25) // Use last 25 messages for context
        .map((msg) => {
          const role = msg.isFromUser ? "You" : args.chatName;
          return `${role}: ${msg.text}`;
        })
        .join("\n");

      // Get last message for context
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
3. A brief explanation of why this reply works

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
        model: openai("gpt-4o-mini"),
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
        console.error("[generateReplySuggestions] Error parsing AI response:", parseError);
        console.error("[generateReplySuggestions] Raw AI response:", result.text);
        
        return {
          suggestions: [
            {
              reply: "Thanks for your message! I'll get back to you soon.",
              style: "Polite acknowledgment",
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
      console.error("[generateReplySuggestions] Error:", error);
      
      // Check for OpenAI-specific errors
      if (error instanceof Error) {
        if (error.message.includes("API key")) {
          throw new Error("OpenAI API key is invalid or not configured");
        }
        if (error.message.includes("rate limit")) {
          throw new Error("OpenAI rate limit exceeded. Please try again later.");
        }
      }
      
      throw new Error(
        `Failed to generate suggestions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  },
});

