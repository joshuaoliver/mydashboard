"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { generateText } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { createBeeperClient } from "./beeperClient";
import { formatSydneyDateTime } from "./timezone";
import { trackAICost } from "./costs";

// Beeper API configuration (from environment variables)
// Using bywave proxy instead of localhost so Convex (cloud-hosted) can access it
const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

// Default AI model (used if no setting found in database)
const DEFAULT_AI_MODEL = "google/gemini-3-flash" as const;

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

// Note: Previous BeeperMessage interface removed because it was unused

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
  // Fetch ALL cached messages (no pagination) for AI context
  const cachedMessages: { messages: CachedMessage[] } = await ctx.runQuery(api.beeperQueries.getAllCachedMessages, {
    chatId: chatId,
    limit: 100, // Limit to last 100 messages for AI context (prevents token overflow)
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
    })),
    conversationContext: v.object({
      lastMessage: v.string(),
      messageCount: v.number(),
    }),
    importance: v.optional(v.number()), // AI-assessed importance 1-5
    isCached: v.boolean(),
    generatedAt: v.number(),
  }),
  handler: async (ctx, args): Promise<{
    suggestions: Array<{
      reply: string;
    }>;
    conversationContext: {
      lastMessage: string;
      messageCount: number;
    };
    importance?: number;
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
          importance: undefined,
          isCached: false,
          generatedAt: Date.now(),
        };
      }

      // Get the last message to check cache
      const lastMessage = messages[messages.length - 1];
      
      // Track whether user sent the last message - affects suggestion type
      const userSentLast = lastMessage.isFromUser;
      
      // Only check cache if no custom context was provided
      // Custom context = user wants fresh suggestions based on their specific input
      if (!args.customContext) {
        // Try to get cached suggestions for this conversation state
        try {
          const cached: {
            suggestions: Array<{
              reply: string;
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
            console.log(`[generateReplySuggestions] ✅ Using cached suggestions for chat ${args.chatId}`);
            // Fetch current importance from the chat (importance is stored on chat, not in cache)
            const chat = await ctx.runQuery(api.beeperQueries.getChatById, { chatId: args.chatId });
            return {
              ...cached,
              importance: chat?.replyImportance,
            };
          } else {
            console.log(`[generateReplySuggestions] No cache found for message ID: ${lastMessage.id}`);
          }
        } catch (cacheError) {
          console.error(`[generateReplySuggestions] ⚠️ Cache lookup failed:`, cacheError);
          console.log(`[generateReplySuggestions] Falling back to fresh generation`);
        }
      } else {
        console.log(`[generateReplySuggestions] Custom context provided - bypassing cache and generating fresh suggestions`);
      }

      // No cache or last message changed - generate new suggestions
      console.log(`[generateReplySuggestions] Generating new suggestions for chat ${args.chatId}`);

      // Get current time in Sydney for context
      const currentTimeSydney = formatSydneyDateTime(Date.now());

      // Format conversation for AI prompt WITH timestamps
      // This helps the AI understand the temporal context of messages
      const conversationHistory = messages
        .slice(-25) // Use last 25 messages for context
        .map((msg: { isFromUser: boolean; text: string; timestamp: number }) => {
          const role = msg.isFromUser ? "You" : args.chatName;
          const msgTime = formatSydneyDateTime(msg.timestamp);
          return `[${msgTime}] ${role}: ${msg.text}`;
        })
        .join("\n");

      // Get last message for context with timestamp
      const lastMessageText = lastMessage.text;
      const lastMessageTime = formatSydneyDateTime(lastMessage.timestamp);

      // Build contact context with XML structure if available
      // Only include fields that are visible/editable in the contact panel
      let contactContext = "No contact information available";
      if (contact) {
        const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
        const isRomantic = contact.connections?.includes("Romantic");
        
        // Infer gender for romantic connections
        let gender = "";
        if (contact.sex && contact.sex.length > 0) {
          gender = contact.sex.join(", ");
        } else if (isRomantic) {
          gender = "Female (inferred from romantic connection)";
        }
        
        // Get connection type description
        const getConnectionDescription = (type: string): string => {
          switch (type) {
            case "Professional":
            case "Business":
              return "Business-related: Work or business contact. Joshua typically seeks to provide advice or close a deal.";
            case "Friend":
              return "Friend: Someone Joshua has met in person and considers a friend.";
            case "Good friend":
            case "Close Friend":
              return "Close Friend: Someone valuable to Joshua.";
            case "Romantic":
              return "Romantic: Someone Joshua is looking to have an intimate relationship with (casual or serious). Ultimate Man Project principles apply.";
            case "Party":
              return "Party: Someone Joshua knows from social/party settings.";
            default:
              return type;
          }
        };
        
        contactContext = `<name>${contactName || "Unknown"}</name>`;
        
        if (gender) {
          contactContext += `\n<gender>${gender}</gender>`;
        }
        
        // Instagram handle if available
        if (contact.instagram) {
          contactContext += `\n<instagram>@${contact.instagram}</instagram>`;
        }
        
        // Connection types with descriptions
        if (contact.connections && contact.connections.length > 0) {
          contactContext += `\n<connection_types>`;
          contact.connections.forEach((conn: string) => {
            contactContext += `\n  <connection type="${conn}">${getConnectionDescription(conn)}</connection>`;
          });
          contactContext += `\n</connection_types>`;
        }
        
        // Objective - what Joshua wants to achieve with this person
        if (contact.objective) {
          contactContext += `\n<objective>${contact.objective}</objective>`;
        } else if (isRomantic) {
          contactContext += `\n<objective>Go on a date (default romantic objective)</objective>`;
        }
        
        // Lead status for romantic connections
        if (isRomantic && contact.leadStatus) {
          const leadStatusDescriptions: Record<string, string> = {
            "Talking": "Still in talking stage, possibly met through dating app or in person. No formal ask yet.",
            "Planning": "Some reciprocation of interest (e.g., asking to have a drink), but nothing organized yet.",
            "Dated": "Have gone on a one-on-one date.",
            "Connected": "Have gone on a date and hooked up.",
            "Former": "Dated and hooked up but no longer actively seeing each other."
          };
          const description = leadStatusDescriptions[contact.leadStatus] || contact.leadStatus;
          contactContext += `\n<lead_status>${contact.leadStatus}: ${description}</lead_status>`;
        }
        
        // Description from Dex CRM
        if (contact.description) {
          contactContext += `\n<dex_description>${contact.description}</dex_description>`;
        }
        
        // Local notes (visible in contact panel)
        if (contact.notes) {
          contactContext += `\n<notes>${contact.notes}</notes>`;
        }
        
        // Private notes (PIN-protected, highly sensitive)
        if (contact.privateNotes) {
          contactContext += `\n<private_notes>${contact.privateNotes}</private_notes>`;
        }
        
        // Intimate connection flag (PIN-protected)
        if (contact.intimateConnection) {
          contactContext += `\n<intimate_connection>Yes</intimate_connection>`;
        }
        
        // Timezone information if available
        if (contact.timezone) {
          contactContext += `\n<timezone>${contact.timezone}</timezone>`;
        }
      }

      // Build temporal context section - critical for time-aware replies
      // This helps the AI understand when messages were sent relative to now
      // Default to Sydney timezone for recipient if not explicitly set (most contacts are local)
      const recipientTimezone = contact?.timezone || "Australia/Sydney";
      let recipientTime: string;
      try {
        recipientTime = new Date().toLocaleString("en-AU", {
          timeZone: recipientTimezone,
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch (e) {
        // Fallback to Sydney if timezone is invalid
        recipientTime = currentTimeSydney;
      }
      
      let temporalContext = `<temporal_context>
<current_time>${currentTimeSydney}</current_time>
<your_timezone>Australia/Sydney (AEDT/AEST)</your_timezone>
<recipient_timezone>${recipientTimezone}${!contact?.timezone ? " (assumed same as yours)" : ""}</recipient_timezone>
<recipient_current_time>${recipientTime}</recipient_current_time>
<last_message_time>${lastMessageTime}</last_message_time>
</temporal_context>`;

      // Add custom context if provided
      let customContextSection = "";
      if (args.customContext) {
        customContextSection = `<additional_context>
${args.customContext}
</additional_context>`;
      }

      // Determine platform from chat network
      const chat = await ctx.runQuery(api.beeperQueries.getChatById, { chatId: args.chatId });
      const platform = chat?.network === "instagram" ? "Instagram" : chat?.network === "whatsapp" ? "WhatsApp" : "Unknown";

      // Fetch the prompt template from the database
      const promptTemplate = await ctx.runQuery(internal.prompts.getPromptByName, {
        name: "reply-suggestions",
      });

      // Build context about who sent the last message
      const messageFlowContext = userSentLast
        ? `<message_flow>
YOU (Joshua) sent the last message. The suggestions should be FOLLOW-UP messages, not replies.
Examples of good follow-ups:
- Adding context or clarification to what you just said
- Asking a related question
- Sharing something relevant that came to mind
- A natural double-text that continues the conversation

DO NOT suggest messages that repeat or rephrase what you just said.
Your last message was: "${lastMessageText}"
</message_flow>`
        : `<message_flow>
${args.chatName} sent the last message. The suggestions should be REPLIES to their message.
</message_flow>`;

      // Build the prompt from template or fallback to default
      let prompt: string;
      if (promptTemplate) {
        // Replace template variables with actual values
        prompt = promptTemplate.description
          .replace(/\{\{chatName\}\}/g, args.chatName)
          .replace(/\{\{conversationHistory\}\}/g, conversationHistory)
          .replace(/\{\{contactContext\}\}/g, contactContext)
          .replace(/\{\{customContext\}\}/g, customContextSection)
          .replace(/\{\{platform\}\}/g, platform)
          .replace(/\{\{messageCount\}\}/g, messages.length.toString())
          .replace(/\{\{temporalContext\}\}/g, temporalContext)
          .replace(/\{\{messageFlowContext\}\}/g, messageFlowContext);
        
        console.log(`[generateReplySuggestions] Using configured prompt template from database (userSentLast: ${userSentLast})`);
      } else {
        // Fallback to hardcoded prompt if template not found
        console.warn(`[generateReplySuggestions] Prompt template 'reply-suggestions' not found, using fallback`);
        prompt = `You are an AI assistant helping Joshua Oliver (26, male, Sydney) craft contextually appropriate messages.

${temporalContext}

${messageFlowContext}

Contact: ${args.chatName}
Platform: ${platform}
${contactContext}
${customContextSection}

Conversation history (with timestamps):
${conversationHistory}

IMPORTANT TEMPORAL CONTEXT: Consider the time difference between when the last message was sent and the current time. If the conversation happened yesterday or earlier, do NOT suggest messages that would have been appropriate at that time (like "have a good sleep" for a tired message from last night). Instead, suggest messages that are appropriate for NOW.

Suggest 3-4 different message options representing DIFFERENT conversation pathways. Match the relationship context and be natural.

IMPORTANT: DO NOT use em dashes (—) or en dashes (–). Use ellipsis (...) or split into separate sentences. Write like a real person texting with standard keyboard characters only.

Format as JSON:
{
  "suggestions": [
    {
      "reply": "The actual message text"
    }
  ]
}`;
      }

      // Fetch AI settings from database
      const aiSettings = await ctx.runQuery(internal.aiSettings.getSettingInternal, {
        key: "reply-suggestions",
      });
      
      const modelId = aiSettings?.modelId ?? DEFAULT_AI_MODEL;
      const temperature = aiSettings?.temperature ?? 1;
      
      console.log(`[generateReplySuggestions] Using model: ${modelId} (temp: ${temperature})`);

      // Initialize Vercel AI Gateway client
      const gatewayClient = createGateway({
        apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY,
      });

      const result = await generateText({
        model: gatewayClient(modelId),
        prompt: prompt,
        temperature: temperature,
      });

      // Track AI cost
      if (result.usage) {
        const usage = result.usage as { promptTokens?: number; completionTokens?: number };
        await trackAICost(ctx, {
          featureKey: "reply-suggestions",
          fullModelId: modelId,
          usage: {
            promptTokens: usage.promptTokens ?? 0,
            completionTokens: usage.completionTokens ?? 0,
            totalTokens: (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
          },
          threadId: args.chatId,
        });
      }

      // Parse the AI response
      let suggestions;
      let importance: number | undefined;
      try {
        // Strip markdown code blocks if present (OpenAI sometimes wraps JSON in ```json ... ```)
        let cleanedText = result.text.trim();
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const aiResponse = JSON.parse(cleanedText);
        // Map suggestions and strip em dashes (—) and en dashes (–) from replies
        suggestions = (aiResponse.suggestions || []).map((s: any) => ({
          reply: s.reply.replace(/—/g, '-').replace(/–/g, '-'),
        }));
        
        // Extract importance rating (1-5)
        if (typeof aiResponse.importance === 'number') {
          importance = Math.max(1, Math.min(5, Math.round(aiResponse.importance)));
          console.log(`[generateReplySuggestions] AI assessed importance: ${importance}`);
        } else {
          console.log(`[generateReplySuggestions] No importance rating in AI response`);
        }
      } catch (parseError) {
        // If JSON parsing fails, use a fallback
        console.error("Error parsing AI response:", parseError);
        console.error("Raw AI response:", result.text);
        suggestions = [
          {
            reply: "Thanks for your message! I'll get back to you soon.",
          },
        ];
      }
      
      // Save importance to the chat if we got one
      if (importance !== undefined) {
        await ctx.runMutation(internal.beeperMutations.updateReplyImportance, {
          chatId: args.chatId,
          importance,
        });
      }

      const conversationContext = {
        lastMessage: lastMessageText,
        messageCount: messages.length,
      };

      // Only save to cache if this wasn't a custom context request
      // Custom context suggestions are specific to the user's input, not general conversation state
      if (!args.customContext) {
        await ctx.runMutation(internal.aiSuggestions.saveSuggestionsToCache, {
          chatId: args.chatId,
          lastMessageId: lastMessage.id,
          lastMessageTimestamp: lastMessage.timestamp,
          suggestions,
          conversationContext,
          modelUsed: modelId,
        });

        console.log(`[generateReplySuggestions] Saved ${suggestions.length} suggestions to cache for chat ${args.chatId}`);
      } else {
        console.log(`[generateReplySuggestions] Custom context used - skipping cache save`);
      }

      // Return fresh suggestions
      return {
        suggestions,
        conversationContext,
        importance,
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

/**
 * Refresh a single chat from the Beeper API to fix participant data
 * This fetches the chat directly by ID and updates the database
 */
export const refreshChatFromAPI = action({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const client = createBeeperClient();
    
    console.log(`[refreshChatFromAPI] Fetching chat ${args.chatId} from API...`);
    
    try {
      // Fetch the chat by ID
      const chat = await client.chats.retrieve(args.chatId);
      
      if (!chat) {
        return { success: false, error: "Chat not found" };
      }
      
      console.log(`[refreshChatFromAPI] Got chat: ${chat.title}, type: ${chat.type}, participants: ${chat.participants?.total}`);
      console.log(`[refreshChatFromAPI] Participants:`, chat.participants?.items?.map((p: any) => ({
        name: p.fullName,
        username: p.username,
        isSelf: p.isSelf
      })));
      
      // Helper to check if Meta AI
      const isMetaAI = (p: any) => {
        const name = (p.fullName || '').toLowerCase();
        const uname = (p.username || '').toLowerCase();
        return name.includes('meta ai') || uname === 'meta.ai';
      };
      
      // Extract contact info for single chats
      let username: string | undefined;
      let phoneNumber: string | undefined;
      let email: string | undefined;
      let participantId: string | undefined;
      let participantFullName: string | undefined;
      let participantImgURL: string | undefined;
      let cannotMessage: boolean | undefined;
      
      if (chat.type === "single" && chat.participants?.items) {
        // Get all non-self participants
        const otherParticipants = chat.participants.items.filter(
          (p: any) => p.isSelf === false
        );
        
        // Filter out Meta AI
        const realParticipants = otherParticipants.filter(
          (p: any) => !isMetaAI(p)
        );
        
        // Prefer real participants
        const otherPerson = realParticipants.length > 0 
          ? realParticipants[0] 
          : otherParticipants[0];
        
        if (otherPerson) {
          username = otherPerson.username;
          phoneNumber = otherPerson.phoneNumber;
          email = otherPerson.email;
          participantId = otherPerson.id;
          participantFullName = otherPerson.fullName;
          participantImgURL = otherPerson.imgURL;
          cannotMessage = otherPerson.cannotMessage;
          
          console.log(`[refreshChatFromAPI] Found real person: ${participantFullName} (@${username})`);
        }
      }
      
      const now = Date.now();
      const lastActivity = chat.lastActivity ? new Date(chat.lastActivity).getTime() : now;
      const chatType = (chat.type === "single" || chat.type === "group") ? chat.type : "single" as const;
      
      // Update the chat with fresh data
      await ctx.runMutation(internal.beeperSync.upsertChat, {
        chatData: {
          chatId: chat.id,
          localChatID: chat.localChatID || chat.id,
          title: participantFullName || chat.title || "Unknown",
          network: chat.network || chat.accountID || "Unknown",
          accountID: chat.accountID || "",
          type: chatType,
          username,
          phoneNumber,
          email,
          participantId,
          participantFullName,
          participantImgURL,
          cannotMessage,
          participantCount: chat.participants?.total,
          lastActivity,
          unreadCount: chat.unreadCount || 0,
          lastReadMessageSortKey: chat.lastReadMessageSortKey ? String(chat.lastReadMessageSortKey) : undefined,
          isArchived: chat.isArchived || false,
          isMuted: chat.isMuted || false,
          isPinned: chat.isPinned || false,
          lastSyncedAt: now,
          syncSource: "refresh",
        },
      });
      
      // Also sync participants
      if (chat.participants?.items && chat.participants.items.length > 0) {
        await ctx.runMutation(internal.beeperSync.upsertParticipants, {
          chatId: chat.id,
          lastSyncedAt: now,
          participants: chat.participants.items.map((p: any) => ({
            id: p.id,
            fullName: p.fullName,
            username: p.username,
            phoneNumber: p.phoneNumber,
            email: p.email,
            imgURL: p.imgURL,
            isSelf: p.isSelf || false,
            cannotMessage: p.cannotMessage,
          })),
        });
      }
      
      return { 
        success: true, 
        title: participantFullName || chat.title,
        participantFullName,
        username,
      };
    } catch (error) {
      console.error(`[refreshChatFromAPI] Error:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  },
});

