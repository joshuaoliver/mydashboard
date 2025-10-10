import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
// Note: Auth tables removed - will add back when implementing multi-user support

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  // Dashboard-specific tables
  dashboardItems: defineTable({
    title: v.string(),
    type: v.string(), // "widget", "tool", "data-source"
    config: v.object({
      // Flexible config object for different item types
    }),
    position: v.object({
      x: v.number(),
      y: v.number(),
      width: v.number(),
      height: v.number(),
    }),
    isActive: v.boolean(),
  }),
  
  dataSources: defineTable({
    name: v.string(),
    type: v.string(), // "api", "file", "webhook"
    config: v.object({
      // API endpoints, file paths, webhook URLs, etc.
    }),
    lastSynced: v.optional(v.number()),
  }),

  // Beeper integration - cache chat data and track reply status
  beeperChats: defineTable({
    // Beeper chat identifiers
    chatId: v.string(),              // Unique Beeper chat ID
    localChatID: v.string(),         // Local numeric ID
    
    // Chat metadata
    title: v.string(),               // Contact/group name
    network: v.string(),             // "WhatsApp", "Instagram", etc.
    accountID: v.string(),           // "whatsapp", "instagram", etc.
    type: v.string(),                // "single" or "group"
    
    // Contact identifiers (for the other person in single chats)
    username: v.optional(v.string()),        // Instagram/Twitter username
    phoneNumber: v.optional(v.string()),     // Phone number for WhatsApp/SMS
    email: v.optional(v.string()),           // Email if available
    participantId: v.optional(v.string()),   // Beeper participant ID
    
    // Activity tracking
    lastActivity: v.number(),        // Timestamp (converted from ISO)
    unreadCount: v.number(),
    
    // Status flags
    isArchived: v.boolean(),
    isMuted: v.boolean(),
    isPinned: v.boolean(),
    
    // Sync metadata
    lastSyncedAt: v.number(),              // When we last fetched chat list from Beeper
    lastMessagesSyncedAt: v.optional(v.number()),  // When we last fetched messages for this chat
    syncSource: v.string(),                // "cron", "manual", or "page_load"
    
    // Optional: Reply tracking (for future features)
    lastMessageFrom: v.optional(v.string()),   // Who sent last message
    needsReply: v.optional(v.boolean()),       // Does user need to reply?
  })
    .index("by_activity", ["lastActivity"])    // Sort by recent
    .index("by_chat_id", ["chatId"])           // Lookup by ID
    .index("by_network", ["network"])          // Filter by platform
    .index("by_username", ["username"]),       // Find by Instagram username

  // Beeper messages - cached messages per chat (last 20-30 only)
  beeperMessages: defineTable({
    chatId: v.string(),              // Which chat this message belongs to
    messageId: v.string(),           // Unique message ID from Beeper
    text: v.string(),                // Message text
    timestamp: v.number(),           // When message was sent
    senderId: v.string(),            // Beeper user ID of sender
    senderName: v.string(),          // Display name of sender
    isFromUser: v.boolean(),         // True if user sent this message
  })
    .index("by_chat", ["chatId", "timestamp"])  // Get messages for chat, sorted by time
    .index("by_message_id", ["messageId"]),     // Lookup by message ID

  // Dex CRM integration - sync contacts from Dex
  contacts: defineTable({
    dexId: v.string(), // Dex's internal contact ID for sync tracking
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    description: v.optional(v.string()), // Editable field that syncs back to Dex
    instagram: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    emails: v.optional(v.array(v.object({ email: v.string() }))), // Array of email objects
    phones: v.optional(v.array(v.object({ phone: v.string() }))), // Array of phone objects
    birthday: v.optional(v.string()), // ISO date string
    lastSeenAt: v.optional(v.string()), // ISO timestamp from Dex
    lastSyncedAt: v.number(), // Timestamp when last synced from Dex
    lastModifiedAt: v.number(), // Timestamp when last modified locally
  })
    .index("by_dex_id", ["dexId"]),

  // User-defined prompts for AI interactions
  prompts: defineTable({
    name: v.string(),              // Unique identifier/key for the prompt
    title: v.string(),             // Display title
    description: v.string(),       // Detailed description of what the prompt does
    createdAt: v.number(),         // Creation timestamp
    updatedAt: v.number(),         // Last update timestamp
  })
    .index("by_name", ["name"]),
});
