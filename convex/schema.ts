import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
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
    type: v.union(v.literal("single"), v.literal("group")),  // "single" or "group"
    description: v.optional(v.string()),     // Chat description (from API)
    
    // Contact identifiers (for the other person in single chats)
    username: v.optional(v.string()),        // Instagram/Twitter username
    phoneNumber: v.optional(v.string()),     // Phone number for WhatsApp/SMS
    email: v.optional(v.string()),           // Email if available
    participantId: v.optional(v.string()),   // Beeper participant ID
    participantFullName: v.optional(v.string()), // Participant's full display name
    participantImgURL: v.optional(v.string()),   // Participant's profile image (file:// URL from Beeper)
    // Note: Cached image URLs are looked up from cachedImages table at query time
    cannotMessage: v.optional(v.boolean()),      // Whether messaging is disabled/blocked
    participantCount: v.optional(v.number()),    // Total participant count
    
    // Contact matching (pre-computed at sync time for fast queries)
    contactId: v.optional(v.id("contacts")),     // Matched contact from Dex (denormalized for fast lookup)
    contactMatchedAt: v.optional(v.number()),    // When contact was last matched
    
    // Activity tracking
    lastActivity: v.number(),        // Timestamp (converted from ISO)
    unreadCount: v.number(),
    lastMessage: v.optional(v.string()),       // Text of the most recent message
    lastReadMessageSortKey: v.optional(v.string()), // Last read position for pagination
    
    // Status flags
    isArchived: v.boolean(),
    isMuted: v.boolean(),
    isPinned: v.boolean(),
    
    // Sync metadata
    lastSyncedAt: v.number(),              // When we last fetched chat list from Beeper
    lastMessagesSyncedAt: v.optional(v.number()),  // When we last fetched messages for this chat
    syncSource: v.string(),                // "cron", "manual", or "page_load"
    
    // Reply tracking
    lastMessageFrom: v.optional(v.string()),   // "user" or "them" - who sent last message
    needsReply: v.optional(v.boolean()),       // Does user need to reply?
    
    // Message cursor tracking (boundaries of our message window)
    newestMessageSortKey: v.optional(v.string()),  // Newest message sortKey we have
    oldestMessageSortKey: v.optional(v.string()),  // Oldest message sortKey we have
    messageCount: v.optional(v.number()),          // Number of messages in our window
    hasCompleteHistory: v.optional(v.boolean()),   // True if we've fetched all historical messages
    lastFullSyncAt: v.optional(v.number()),        // When we last did a full conversation load
  })
    .index("by_activity", ["lastActivity"])    // Sort by recent
    .index("by_chat_id", ["chatId"])           // Lookup by ID
    .index("by_network", ["network"])          // Filter by platform
    .index("by_username", ["username"])        // Find by Instagram username
    .index("by_phone", ["phoneNumber"])        // Find by WhatsApp/phone number
    .index("by_type_archived", ["type", "isArchived"]) // Fast filter for chat list queries
    .index("by_type_archived_activity", ["type", "isArchived", "lastActivity"]) // Filter + sort by activity
    .index("by_contact", ["contactId"]),       // Find chats by linked contact

  // Beeper messages - cached messages per chat (last 20-30 only)
  beeperMessages: defineTable({
    chatId: v.string(),              // Which chat this message belongs to
    messageId: v.string(),           // Unique message ID from Beeper
    accountID: v.optional(v.string()), // Beeper account ID (optional for backward compatibility)
    text: v.string(),                // Message text
    timestamp: v.number(),           // When message was sent
    sortKey: v.optional(v.string()), // Sortable key for pagination (from API, optional for old messages)
    senderId: v.string(),            // Beeper user ID of sender
    senderName: v.string(),          // Display name of sender
    isFromUser: v.boolean(),         // True if user sent this message (isSender in API)
    isUnread: v.optional(v.boolean()), // True if message is unread
    // Image/media attachments from Beeper
    attachments: v.optional(v.array(v.object({
      type: v.string(),              // "img", "video", "audio", "unknown"
      srcURL: v.string(),            // URL or local file path (may be temporary!)
      mimeType: v.optional(v.string()),     // e.g., "image/png"
      fileName: v.optional(v.string()),     // Original filename
      fileSize: v.optional(v.number()),     // Size in bytes
      isGif: v.optional(v.boolean()),
      isSticker: v.optional(v.boolean()),
      isVoiceNote: v.optional(v.boolean()),  // Is this a voice note?
      posterImg: v.optional(v.string()),     // Video poster frame
      width: v.optional(v.number()),         // Image width in px
      height: v.optional(v.number()),        // Image height in px
    }))),
    // Reactions to this message
    reactions: v.optional(v.array(v.object({
      id: v.string(),                 // Reaction ID
      participantID: v.string(),      // Who reacted
      reactionKey: v.string(),        // Emoji or shortcode
      emoji: v.optional(v.boolean()), // Is it an emoji?
      imgURL: v.optional(v.string()), // Reaction image URL
    }))),
  })
    .index("by_chat", ["chatId", "timestamp"])  // Get messages for chat, sorted by time
    .index("by_message_id", ["messageId"])      // Lookup by message ID
    .index("by_chat_sortKey", ["chatId", "sortKey"]),  // Query by sortKey for cursor pagination

  // Beeper participants - full participant data for chats (single and group)
  beeperParticipants: defineTable({
    chatId: v.string(),              // Which chat this participant belongs to
    participantId: v.string(),       // Beeper participant ID (e.g., "@mattwondra:local-instagram.localhost")
    fullName: v.optional(v.string()),
    username: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    imgURL: v.optional(v.string()),  // Profile image URL
    isSelf: v.boolean(),             // Is this the authenticated user?
    cannotMessage: v.optional(v.boolean()),
    lastSyncedAt: v.number(),        // When this participant was last updated
    // Link to contacts table (matched by username/phone during sync)
    contactId: v.optional(v.id("contacts")), // Reference to matched contact, if any
  })
    .index("by_chat", ["chatId"])              // Get all participants for a chat
    .index("by_participant", ["participantId"]) // Find chats by participant
    .index("by_chat_participant", ["chatId", "participantId"]) // Unique lookup for upsert
    .index("by_contact", ["contactId"]),       // Find all chats/participants for a contact

  // Dex CRM integration - sync contacts from Dex
  contacts: defineTable({
    dexId: v.optional(v.string()), // Dex's internal contact ID for sync tracking (optional for user-created contacts)
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
    // Local-only fields (don't sync to Dex)
    connections: v.optional(v.array(v.string())), // Multi-select relationship types: "Professional", "Friend", "Good friend", "Romantic", "Intimate", "Other"
    notes: v.optional(v.string()), // Local notes (separate from Dex description)
    objective: v.optional(v.string()), // What's the objective with this person?
    // Extended local-only fields
    sex: v.optional(v.array(v.string())), // Sex identifiers (multi-select emoji-based)
    tagIds: v.optional(v.array(v.id("tags"))), // User-defined tags for organizing contacts
    locationIds: v.optional(v.array(v.id("locations"))), // Multiple locations (tags)
    leadStatus: v.optional(v.union(
      v.literal("Talking"),
      v.literal("Planning"),
      v.literal("Dated"),
      v.literal("Connected"),
      v.literal("Current"),
      v.literal("Former")
    )), // Lead status for relationship tracking
    // PIN-protected fields
    privateNotes: v.optional(v.string()), // PIN-protected notes
    intimateConnection: v.optional(v.boolean()), // PIN-protected yes/no
    intimateConnectionDate: v.optional(v.string()), // ISO date string for when intimate connection started
    // Deduplication and cross-platform tracking
    whatsapp: v.optional(v.string()), // Primary WhatsApp phone number for matching
    timezone: v.optional(v.string()), // IANA timezone identifier (e.g., "America/New_York", "Europe/London")
    socialHandles: v.optional(v.array(v.object({
      platform: v.string(),    // "instagram", "whatsapp", "facebook", "phone"
      handle: v.string(),       // Username or phone number
      isPrimary: v.boolean(),   // Current/preferred handle
      addedAt: v.number(),      // Timestamp when added
    }))), // Historical and alternate social media handles
    mergedFrom: v.optional(v.array(v.id("contacts"))), // IDs of contacts merged into this one
    doNotSyncToDex: v.optional(v.boolean()), // Flag for contacts that should not sync to Dex (e.g., iMessage-only contacts)
    // Custom name override
    setName: v.optional(v.string()), // User-set custom name override (displayed with original name in parentheses)
    // Priority slider (1-100)
    priority: v.optional(v.number()), // Priority level 1-100 for contact importance
  })
    .index("by_dex_id", ["dexId"])
    .index("by_instagram", ["instagram"]) // For matching with Beeper Instagram chats
    .index("by_whatsapp", ["whatsapp"]), // For matching with Beeper WhatsApp chats

  // Locations - user-defined locations for contacts
  locations: defineTable({
    name: v.string(), // Location name
    createdAt: v.number(), // Creation timestamp
  })
    .index("by_name", ["name"]),

  // Tags - user-defined tags for organizing contacts
  tags: defineTable({
    name: v.string(), // Tag name
    color: v.optional(v.string()), // Optional color for visual distinction
    createdAt: v.number(), // Creation timestamp
  })
    .index("by_name", ["name"]),

  // User-defined prompts for AI interactions
  prompts: defineTable({
    name: v.string(),              // Unique identifier/key for the prompt
    title: v.string(),             // Display title
    description: v.string(),       // Detailed description of what the prompt does
    createdAt: v.number(),         // Creation timestamp
    updatedAt: v.number(),         // Last update timestamp
  })
    .index("by_name", ["name"]),

  // Global chat list sync state - tracks cursor boundaries
  chatListSync: defineTable({
    key: v.string(),                      // Always "global" (single record)
    newestCursor: v.optional(v.string()), // Newest chat cursor (boundary)
    oldestCursor: v.optional(v.string()), // Oldest chat cursor (boundary)
    lastSyncedAt: v.number(),             // Last sync timestamp
    syncSource: v.string(),               // "cron", "manual", or "page_load"
    totalChats: v.number(),               // Total chats in our window
  })
    .index("by_key", ["key"]),

  // Cached AI reply suggestions - avoid regenerating for same conversation state
  aiReplySuggestions: defineTable({
    chatId: v.string(),                    // Which chat these suggestions are for
    lastMessageId: v.string(),             // ID of the last message when generated
    lastMessageTimestamp: v.number(),      // Timestamp of last message (for validation)
    suggestions: v.array(v.object({        // The AI-generated suggestions (just the reply text)
      reply: v.string(),
    })),
    conversationContext: v.object({        // Context when generated
      lastMessage: v.string(),
      messageCount: v.number(),
    }),
    generatedAt: v.number(),               // When suggestions were generated
    modelUsed: v.string(),                 // Which AI model was used (for tracking)
  })
    .index("by_chat_id", ["chatId"])       // Lookup cached suggestions by chat
    .index("by_chat_and_message", ["chatId", "lastMessageId"]), // Check if cache is valid

  // Cached images - deduplicated storage for Beeper profile/attachment images
  cachedImages: defineTable({
    sourceUrl: v.string(),           // Original file:// URL from Beeper
    convexStorageId: v.string(),     // Convex storage ID
    convexUrl: v.string(),           // Public Convex URL
    contentType: v.string(),         // MIME type (e.g., "image/jpeg")
    fileSize: v.number(),            // Size in bytes
    cachedAt: v.number(),            // When cached to Convex
  })
    .index("by_source_url", ["sourceUrl"]), // Quick lookup by original URL

  // AI Settings - configurable AI models and preferences per use case
  aiSettings: defineTable({
    key: v.string(),                 // Unique setting key (e.g., "reply-suggestions", "contact-summary")
    displayName: v.string(),         // Human-readable name for UI
    description: v.optional(v.string()), // Description of what this setting controls
    modelId: v.string(),             // Model ID (e.g., "google/gemini-3-flash", "openai/gpt-5")
    promptName: v.optional(v.string()), // Reference to prompts table by name (for prompt-based use cases)
    temperature: v.optional(v.number()), // Temperature setting (0-2)
    maxTokens: v.optional(v.number()),   // Max tokens for response
    isEnabled: v.boolean(),          // Whether this AI feature is enabled
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),       // Lookup by setting key

  // ===========================================
  // Stats Dashboard Tables
  // ===========================================

  // Settings - flexible key-value store for integration configs
  settings: defineTable({
    key: v.string(),           // "gmail", "hubstaff", "linear_<workspaceId>"
    type: v.string(),          // "oauth", "api_key", "config"
    value: v.any(),            // Flexible JSON for different setting types
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),

  // Projects - unified concept linking Hubstaff + Linear
  projects: defineTable({
    name: v.string(),
    hubstaffProjectId: v.optional(v.number()),
    hubstaffProjectName: v.optional(v.string()),
    linearWorkspaceId: v.optional(v.string()),
    linearTeamId: v.optional(v.string()),
    linearTeamName: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_hubstaff_project", ["hubstaffProjectId"])
    .index("by_linear_team", ["linearTeamId"]),

  // Gmail Snapshots - historical inbox counts
  gmailSnapshots: defineTable({
    timestamp: v.number(),
    totalInbox: v.number(),
    unread: v.number(),
    primary: v.optional(v.number()),
    social: v.optional(v.number()),
    promotions: v.optional(v.number()),
    updates: v.optional(v.number()),
    forums: v.optional(v.number()),
  })
    .index("by_timestamp", ["timestamp"]),

  // Hubstaff Time Entries - individual time tracking records
  hubstaffTimeEntries: defineTable({
    date: v.string(),                    // YYYY-MM-DD
    hubstaffActivityId: v.optional(v.string()), // Unique activity ID from Hubstaff
    hubstaffUserId: v.number(),
    hubstaffUserName: v.string(),
    projectId: v.optional(v.id("projects")),
    hubstaffProjectId: v.number(),
    hubstaffProjectName: v.string(),
    taskId: v.optional(v.string()),
    taskName: v.optional(v.string()),
    trackedSeconds: v.number(),
    activityPercent: v.optional(v.number()),
    keyboardSeconds: v.optional(v.number()),
    mouseSeconds: v.optional(v.number()),
    billableSeconds: v.optional(v.number()),
    syncedAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_user_date", ["hubstaffUserId", "date"])
    .index("by_project_date", ["hubstaffProjectId", "date"])
    .index("by_activity_id", ["hubstaffActivityId"]),

  // Hubstaff Daily Summary - aggregated stats per day
  hubstaffDailySummary: defineTable({
    date: v.string(),
    hubstaffUserId: v.number(),
    totalSeconds: v.number(),
    totalHours: v.number(),
    projectBreakdown: v.array(v.object({
      projectId: v.number(),
      projectName: v.string(),
      seconds: v.number(),
    })),
    calculatedAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_user_date", ["hubstaffUserId", "date"]),

  // Linear Issues - synced tasks assigned to user
  linearIssues: defineTable({
    linearId: v.string(),              // Linear's issue ID
    identifier: v.string(),            // Human-readable ID like "ENG-123"
    workspaceId: v.string(),
    workspaceName: v.optional(v.string()),
    teamId: v.string(),
    teamName: v.string(),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),                // "backlog", "todo", "in_progress", etc.
    statusType: v.string(),            // "backlog", "unstarted", "started", "completed", "canceled"
    priority: v.number(),              // 0-4
    priorityLabel: v.string(),         // "Urgent", "High", "Medium", "Low", "No priority"
    url: v.string(),
    assigneeId: v.string(),
    assigneeName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    dueDate: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    syncedAt: v.number(),
  })
    .index("by_linear_id", ["linearId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_team", ["teamId"])
    .index("by_status", ["status"])
    .index("by_status_type", ["statusType"])
    .index("by_assignee", ["assigneeId"])
    .index("by_priority", ["priority"]),

  // Linear Workspaces - configured workspaces with API keys
  linearWorkspaces: defineTable({
    workspaceId: v.string(),
    workspaceName: v.string(),
    apiKey: v.string(),                // Personal API key for this workspace
    userId: v.optional(v.string()),    // Auto-detected user ID from API key
    userName: v.optional(v.string()),
    isActive: v.boolean(),
    lastSyncedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace_id", ["workspaceId"]),

  // Linear Issue Stats - hourly snapshots of outstanding issues per project
  // Used for tracking task count trends over time
  linearIssueStats: defineTable({
    timestamp: v.number(),               // Hour timestamp (floored to hour)
    projectId: v.optional(v.id("projects")), // Associated project (if linked)
    projectName: v.optional(v.string()), // Project name for display
    teamId: v.string(),                  // Linear team ID (always present)
    teamName: v.string(),                // Linear team name
    workspaceId: v.string(),             // Linear workspace ID
    workspaceName: v.optional(v.string()),
    
    // Issue counts by status type
    totalActive: v.number(),             // All non-completed/non-cancelled
    backlog: v.number(),                 // statusType === "backlog"
    unstarted: v.number(),               // statusType === "unstarted"
    started: v.number(),                 // statusType === "started"
    
    // Issue counts by priority
    urgent: v.number(),                  // priority === 1
    high: v.number(),                    // priority === 2
    medium: v.number(),                  // priority === 3
    low: v.number(),                     // priority === 4
    noPriority: v.number(),              // priority === 0
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_team_timestamp", ["teamId", "timestamp"])
    .index("by_project_timestamp", ["projectId", "timestamp"]),
});
