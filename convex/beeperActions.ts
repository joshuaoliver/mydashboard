"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
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
  returns: v.object({
    chats: v.array(v.object({
      id: v.string(),
      roomId: v.string(),
      name: v.string(),
      network: v.string(),
      accountID: v.string(),
      lastMessage: v.string(),
      lastMessageTime: v.number(),
      unreadCount: v.number(),
    })),
  }),
  handler: async (_ctx) => {
    try {
      // Note: Auth disabled for now - this is a personal dashboard
      // const identity = await ctx.auth.getUserIdentity();
      // const userMxid = identity?.subject;

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

// Type for message returned from cache
interface CachedMessage {
  id: string;
  text: string;
  timestamp: number;
  sender: string;
  senderName: string;
  isFromUser: boolean;
}

/**
 * Helper function to fetch messages from cached database
 * Uses the same messages the user sees in the UI for consistency
 * Shared by both getChatMessages and generateReplySuggestions
 */
async function fetchChatMessages(ctx: any, chatId: string): Promise<CachedMessage[]> {
  // Fetch from cached database instead of API
  const cachedMessages: { messages: CachedMessage[] } = await ctx.runQuery(api.beeperQueries.getCachedMessages, {
    chatId: chatId,
  });

  return cachedMessages.messages || [];
}

/**
 * Get conversation history for a specific chat
 * Fetches the last 20-30 messages for AI context
 */
export const getChatMessages = action({
  args: {
    chatId: v.string(),
  },
  returns: v.object({
    messages: v.array(v.object({
      id: v.string(),
      text: v.string(),
      timestamp: v.number(),
      sender: v.string(),
      senderName: v.string(),
      isFromUser: v.boolean(),
    })),
  }),
  handler: async (ctx, args): Promise<{ messages: CachedMessage[] }> => {
    try {
      // Note: Auth disabled for now - this is a personal dashboard
      // const identity = await ctx.auth.getUserIdentity();
      // const userMxid = identity?.subject;

      const messages: CachedMessage[] = await fetchChatMessages(ctx, args.chatId);

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
 * Generate AI-powered reply suggestions with smart caching
 * 
 * Checks cache first - only regenerates if last message has changed
 * This saves OpenAI API calls and provides instant results for unchanged conversations
 * 
 * Uses OpenAI via Vercel AI SDK to analyze conversation and suggest replies
 */
export const generateReplySuggestions = action({
  args: {
    chatId: v.string(),
    chatName: v.string(),
    instagramUsername: v.optional(v.string()),
    customContext: v.optional(v.string()), // NEW: Allow custom context/instructions
  },
  returns: v.object({
    suggestions: v.array(v.object({
      reply: v.string(),
      style: v.string(),
      reasoning: v.string(),
    })),
    conversationContext: v.object({
      lastMessage: v.string(),
      messageCount: v.number(),
    }),
    isCached: v.boolean(),
    generatedAt: v.number(),
  }),
  handler: async (ctx, args): Promise<{
    suggestions: Array<{
      reply: string;
      style: string;
      reasoning: string;
    }>;
    conversationContext: {
      lastMessage: string;
      messageCount: number;
    };
    isCached: boolean;
    generatedAt: number;
  }> => {
    try {
      // Note: Auth disabled for now - this is a personal dashboard
      // const identity = await ctx.auth.getUserIdentity();
      // const userMxid = identity?.subject;

      // Try to find matching contact by Instagram username
      let contact = null;
      if (args.instagramUsername) {
        contact = await ctx.runQuery(api.contactMutations.findContactByInstagram, {
          username: args.instagramUsername,
        });
      }

      // Fetch the conversation history from cached database
      const messages = await fetchChatMessages(ctx, args.chatId);
      console.log(`[generateReplySuggestions] Found ${messages.length} cached messages for chat ${args.chatId}`);

      if (messages.length === 0) {
        return {
          suggestions: [],
          conversationContext: {
            lastMessage: "",
            messageCount: 0,
          },
          isCached: false,
          generatedAt: Date.now(),
        };
      }

      // Get the last message to check cache
      const lastMessage = messages[messages.length - 1];
      
      // Try to get cached suggestions for this conversation state
      const cached: {
        suggestions: Array<{
          reply: string;
          style: string;
          reasoning: string;
        }>;
        conversationContext: {
          lastMessage: string;
          messageCount: number;
        };
        isCached: boolean;
        generatedAt: number;
      } | null = await ctx.runQuery(internal.aiSuggestions.getCachedSuggestions, {
        chatId: args.chatId,
        lastMessageId: lastMessage.id,
      });

      // If we have valid cached suggestions, return them immediately
      if (cached) {
        console.log(`[generateReplySuggestions] Using cached suggestions for chat ${args.chatId}`);
        return cached;
      }

      // No cache or last message changed - generate new suggestions
      console.log(`[generateReplySuggestions] Generating new suggestions for chat ${args.chatId}`);

      // Format conversation for AI prompt
      const conversationHistory = messages
        .slice(-25) // Use last 25 messages for context
        .map((msg: { isFromUser: boolean; text: string }) => {
          const role = msg.isFromUser ? "You" : args.chatName;
          return `${role}: ${msg.text}`;
        })
        .join("\n");

      // Get last message for context
      const lastMessageText = lastMessage.text;

      // Build contact context if available
      let contactContext = "";
      if (contact) {
        const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
        contactContext = `\n\nContact Information:`;
        if (contactName) contactContext += `\n- Name: ${contactName}`;
        if (contact.connection) contactContext += `\n- Connection type: ${contact.connection}`;
        if (contact.description) contactContext += `\n- Description: ${contact.description}`;
        if (contact.notes) contactContext += `\n- Notes: ${contact.notes}`;
      }

      // Add Ultimate Man Project principles for romantic connections
      let guidanceNotes = "";
      if (contact?.connection === "Romantic") {
        guidanceNotes = `\n\nIMPORTANT: This is a romantic connection. Follow Ultimate Man Project principles for texting:
- Match the length and energy of their messages
- Be authentic and genuine
- Don't over-invest or chase
- Lead with confidence
- Keep it light and playful when appropriate`;
      }

      // Add custom context if provided
      let customContextSection = "";
      if (args.customContext) {
        customContextSection = `\n\nADDITIONAL CONTEXT/INSTRUCTIONS:
${args.customContext}`;
      }

      // Generate reply suggestions using OpenAI
      const prompt = `You are a helpful assistant that suggests thoughtful, contextually appropriate replies to messages.

Given the following conversation history with ${args.chatName}, suggest 3-4 different reply options that:
- Match the conversation's tone and context
- Are natural and authentic
- Vary in style (casual/formal, brief/detailed, etc.)
- Consider the relationship and conversation history
- Match the length and style of previous messages in the conversation${contactContext}${guidanceNotes}${customContextSection}

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
      let suggestions;
      try {
        // Strip markdown code blocks if present (OpenAI sometimes wraps JSON in ```json ... ```)
        let cleanedText = result.text.trim();
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const aiResponse = JSON.parse(cleanedText);
        suggestions = aiResponse.suggestions || [];
      } catch (parseError) {
        // If JSON parsing fails, use a fallback
        console.error("Error parsing AI response:", parseError);
        console.error("Raw AI response:", result.text);
        suggestions = [
          {
            reply: "Thanks for your message! I'll get back to you soon.",
            style: "Polite acknowledgment",
            reasoning: "A safe, professional response while you consider a more detailed reply",
          },
        ];
      }

      const conversationContext = {
        lastMessage: lastMessageText,
        messageCount: messages.length,
      };

      // Save suggestions to cache for future use
      await ctx.runMutation(internal.aiSuggestions.saveSuggestionsToCache, {
        chatId: args.chatId,
        lastMessageId: lastMessage.id,
        lastMessageTimestamp: lastMessage.timestamp,
        suggestions,
        conversationContext,
        modelUsed: "gpt-4o-mini",
      });

      console.log(`[generateReplySuggestions] Saved ${suggestions.length} suggestions to cache for chat ${args.chatId}`);

      // Return fresh suggestions
      return {
        suggestions,
        conversationContext,
        isCached: false,
        generatedAt: Date.now(),
      };
    } catch (error) {
      console.error("Error generating reply suggestions:", error);
      throw new Error(
        `Failed to generate suggestions: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Send a message to Beeper (stub), then cache locally for instant UI.
 * Replace the fetch call with real Beeper send endpoint when available.
 */
export const sendMessage = action({
  args: {
    chatId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO: Implement actual Beeper send API call here when endpoint available.
    // For now, we optimistically save locally so the UI updates immediately.
    await ctx.runMutation(internal.beeperMutations.saveUserMessage, {
      chatId: args.chatId,
      text: args.text,
    });

    return { success: true };
  },
});

