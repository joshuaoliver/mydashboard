import { action } from "./_generated/server";
import { v } from "convex/values";
import BeeperDesktop from '@beeper/desktop-api';

// Beeper API configuration
const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

/**
 * Initialize Beeper SDK client
 */
function createBeeperClient() {
  if (!BEEPER_TOKEN) {
    throw new Error("BEEPER_TOKEN environment variable is not set");
  }

  return new BeeperDesktop({
    accessToken: BEEPER_TOKEN,
    baseURL: BEEPER_API_URL,
    maxRetries: 2,
    timeout: 15000,
  });
}

/**
 * Send a message to a Beeper chat
 * Supports replying to specific messages
 */
export const sendMessage = action({
  args: {
    chatId: v.string(),
    text: v.string(),
    replyToMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    chatId?: string;
    pendingMessageId?: string;
    error?: string;
  }> => {
    try {
      console.log(`[Send Message] Sending to chat ${args.chatId}: "${args.text.slice(0, 50)}..."`);

      // Initialize Beeper SDK client
      const client = createBeeperClient();

      // Build request body
      const requestBody: {
        text: string;
        replyToMessageID?: string;
      } = {
        text: args.text,
      };

      // Add reply-to if specified
      if (args.replyToMessageId) {
        requestBody.replyToMessageID = args.replyToMessageId;
        console.log(`[Send Message] Replying to message ${args.replyToMessageId}`);
      }

      // Send message via V1 API
      const response = await client.post(`/v1/chats/${args.chatId}/messages`, {
        body: requestBody,
      }) as any;

      console.log(
        `[Send Message] Success! Pending message ID: ${response.pendingMessageID}`
      );

      return {
        success: true,
        chatId: response.chatID,
        pendingMessageId: response.pendingMessageID,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Send Message] Error: ${errorMsg}`);

      return {
        success: false,
        error: `Failed to send message: ${errorMsg}`,
      };
    }
  },
});

