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
    isBlocked: v.optional(v.boolean()),
    
    // Sync metadata
    lastSyncedAt: v.number(),              // When we last fetched chat list from Beeper
    lastMessagesSyncedAt: v.optional(v.number()),  // When we last fetched messages for this chat
    syncSource: v.string(),                // "cron", "manual", or "page_load"
    
    // Reply tracking
    lastMessageFrom: v.optional(v.string()),   // "user" or "them" - who sent last message
    needsReply: v.optional(v.boolean()),       // Does user need to reply?
    
    // AI-assessed reply importance (1-5 scale)
    replyImportance: v.optional(v.number()),          // 1=Low, 2=Normal, 3=Moderate, 4=High, 5=Urgent
    replyImportanceUpdatedAt: v.optional(v.number()), // When importance was last assessed by AI
    
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
    // Send status tracking (for messages sent from this app)
    status: v.optional(v.union(
      v.literal("sending"),    // In queue, awaiting API call
      v.literal("sent"),       // API confirmed (pendingMessageId received)
      v.literal("failed")      // Send failed
    )),
    pendingMessageId: v.optional(v.string()),  // Beeper's pending message ID
    errorMessage: v.optional(v.string()),      // Error message if send failed
  })
    .index("by_chat", ["chatId", "timestamp"])  // Get messages for chat, sorted by time
    .index("by_message_id", ["messageId"])      // Lookup by message ID
    .index("by_chat_sortKey", ["chatId", "sortKey"])  // Query by sortKey for cursor pagination
    .index("by_user_timestamp", ["isFromUser", "timestamp"])  // User's sent messages by actual send time
    .index("by_pending_message_id", ["pendingMessageId"]),  // Lookup by pending message ID (for dedup during sync)

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
      v.literal("Potential"),
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
    // Pre-computed normalized phones for O(1) matching
    // Contains digits-only normalized versions of all phone numbers (whatsapp + phones array)
    // e.g., ["61417248743", "61411785274"] - Australian numbers normalized to international format
    normalizedPhones: v.optional(v.array(v.string())),
  })
    .index("by_dex_id", ["dexId"])
    .index("by_instagram", ["instagram"]) // For matching with Beeper Instagram chats
    .index("by_whatsapp", ["whatsapp"]) // For matching with Beeper WhatsApp chats
    .index("by_lead_status", ["leadStatus"]), // For dating kanban board filter
    // Note: normalizedPhones is an array field used for fast in-memory matching
    // Convex doesn't support array-contains queries via index, so we filter + includes()

  // Locations - user-defined locations for contacts
  locations: defineTable({
    name: v.string(), // Location name (city, country, or region)
    latitude: v.optional(v.number()), // Latitude coordinate
    longitude: v.optional(v.number()), // Longitude coordinate
    createdAt: v.number(), // Creation timestamp
    useCount: v.optional(v.number()), // Track how many times this location is assigned
  })
    .index("by_name", ["name"])
    .index("by_use_count", ["useCount"]),

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
    syncLockId: v.optional(v.string()),   // ID of sync instance holding lock
    syncLockAt: v.optional(v.number()),   // Timestamp when lock was acquired
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
    // Single action item - AI-extracted todo from conversation (if any found)
    actionItem: v.optional(v.string()),
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
    // Sent email tracking
    sentSinceLastSnapshot: v.optional(v.number()), // Emails sent since previous snapshot
    totalSentThreads: v.optional(v.number()),      // Total threads in sent folder (for reference)
  })
    .index("by_timestamp", ["timestamp"]),

  // Message Snapshots - historical Beeper chat stats
  // Tracks chat counts across all networks (iMessage, WhatsApp, Instagram, etc.)
  messageSnapshots: defineTable({
    timestamp: v.number(),
    // Total counts across all networks
    totalChats: v.number(),             // Total number of chats
    archivedChats: v.number(),          // Chats that are archived
    activeChats: v.number(),            // Chats that are not archived
    needsReplyChats: v.number(),        // Chats where last message is from them (awaiting our reply)
    mutedChats: v.number(),             // Chats that are muted
    pinnedChats: v.number(),            // Chats that are pinned
    // Breakdown by network
    imessageChats: v.optional(v.number()),
    whatsappChats: v.optional(v.number()),
    instagramChats: v.optional(v.number()),
    facebookChats: v.optional(v.number()),
    telegramChats: v.optional(v.number()),
    otherNetworkChats: v.optional(v.number()),
    // Reply tracking
    needsReplyImessage: v.optional(v.number()),
    needsReplyWhatsapp: v.optional(v.number()),
    needsReplyInstagram: v.optional(v.number()),
    needsReplyFacebook: v.optional(v.number()),
    needsReplyTelegram: v.optional(v.number()),
    needsReplyOther: v.optional(v.number()),
    // Sent message tracking
    messagesSentSinceLastSnapshot: v.optional(v.number()), // Messages sent by user since previous snapshot
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

  // ===========================================
  // Notes / Documents Tables
  // ===========================================

  // Note documents - stores full editor content
  todoDocuments: defineTable({
    title: v.string(),
    content: v.string(),           // Tiptap JSON stringified
    projectId: v.optional(v.id("projects")), // Associated project
    todoCount: v.number(),         // Denormalized for sidebar
    completedCount: v.number(),    // Denormalized for sidebar
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_updated", ["updatedAt"])
    .index("by_project", ["projectId"]),

  // Individual todo items - extracted from documents
  todoItems: defineTable({
    documentId: v.id("todoDocuments"),
    projectId: v.optional(v.id("projects")), // Inherited from parent document
    text: v.string(),
    isCompleted: v.boolean(),
    isFrog: v.optional(v.boolean()),  // Task being avoided - eat the frog first!
    order: v.number(),             // Position in document
    nodeId: v.string(),            // Tiptap node ID for matching
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    // Source tracking - when created from a conversation
    sourceChatId: v.optional(v.string()),        // Beeper chat ID
    sourceContactId: v.optional(v.id("contacts")), // Dex contact reference
    sourceContactName: v.optional(v.string()),   // Denormalized contact name
  })
    .index("by_document", ["documentId"])
    .index("by_completed", ["isCompleted"])
    .index("by_document_order", ["documentId", "order"])
    .index("by_project", ["projectId"])
    .index("by_frog", ["isFrog"]),

  // Frog status for Linear issues (separate table since issues are synced from external)
  frogLinearIssues: defineTable({
    linearId: v.string(),          // The Linear issue ID
    markedAt: v.number(),          // When it was marked as a frog
  })
    .index("by_linear_id", ["linearId"]),

  // Permanent record of completed todos (immutable historical record)
  completedTodos: defineTable({
    // Original reference (may no longer exist)
    originalTodoId: v.optional(v.id("todoItems")),
    originalDocumentId: v.optional(v.id("todoDocuments")),
    originalNodeId: v.optional(v.string()),

    // Snapshot of the todo at completion time
    text: v.string(),
    projectId: v.optional(v.id("projects")),
    projectName: v.optional(v.string()),      // Snapshot in case project is deleted
    documentTitle: v.optional(v.string()),    // Snapshot in case document is deleted

    // Timestamps
    todoCreatedAt: v.number(),                // When the original todo was created
    completedAt: v.number(),                  // When it was completed
  })
    .index("by_completed", ["completedAt"])
    .index("by_project", ["projectId"])
    .index("by_original_todo", ["originalTodoId"]),

  // ===========================================
  // Today Plan Feature Tables
  // ===========================================

  // Google Calendar settings for OAuth
  googleCalendarSettings: defineTable({
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
    calendarId: v.string(),                   // Primary calendar ID (legacy, kept for compatibility)
    isConfigured: v.boolean(),
    lastSyncedAt: v.optional(v.number()),
  }),

  // Available calendars from Google (cached after fetching)
  googleCalendars: defineTable({
    calendarId: v.string(),                   // Google Calendar ID (e.g., "primary", email, etc.)
    summary: v.string(),                      // Calendar name/title
    description: v.optional(v.string()),      // Calendar description
    backgroundColor: v.optional(v.string()),  // Calendar color from Google
    foregroundColor: v.optional(v.string()),
    accessRole: v.string(),                   // "owner", "writer", "reader", "freeBusyReader"
    primary: v.optional(v.boolean()),         // Is this the user's primary calendar?
    isEnabled: v.boolean(),                   // Whether to sync events from this calendar
    lastFetchedAt: v.number(),                // When we last fetched calendar list
  })
    .index("by_calendar_id", ["calendarId"])
    .index("by_enabled", ["isEnabled"]),

  // Calendar events (fetched from Google Calendar)
  calendarEvents: defineTable({
    eventId: v.string(),                      // Google Calendar event ID
    calendarId: v.optional(v.string()),       // Which calendar this event belongs to
    summary: v.string(),                      // Event title
    description: v.optional(v.string()),
    startTime: v.number(),                    // Unix timestamp
    endTime: v.number(),                      // Unix timestamp
    duration: v.number(),                     // Duration in minutes
    isAllDay: v.boolean(),
    location: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())),
    status: v.string(),                       // "confirmed", "tentative", "cancelled"
    syncedAt: v.number(),
  })
    .index("by_start_time", ["startTime"])
    .index("by_event_id", ["eventId"])
    .index("by_calendar", ["calendarId"]),

  // Today Plan - main document for each day
  todayPlans: defineTable({
    date: v.string(),                         // YYYY-MM-DD format
    // Cached free blocks (regenerated on calendar sync)
    freeBlocks: v.array(v.object({
      id: v.string(),                         // Unique block ID
      startTime: v.number(),                  // Unix timestamp
      endTime: v.number(),                    // Unix timestamp
      duration: v.number(),                   // Duration in minutes
      label: v.optional(v.string()),          // Optional context label (e.g., "Before meeting")
    })),
    // @deprecated - use isFrog on todoItems or frogLinearIssues table instead
    frogTaskId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_date", ["date"]),

  // Ad-hoc life items (breakfast, lunch, gym, etc.)
  // These are constraints/context for AI suggestions
  adhocItems: defineTable({
    planId: v.id("todayPlans"),               // Which day this belongs to
    text: v.string(),                         // "Get breakfast", "Gym", "Lunch", etc.
    estimatedDuration: v.optional(v.number()), // Duration in minutes (optional)
    preferredTime: v.optional(v.number()),    // Preferred start time (optional)
    isCompleted: v.boolean(),
    completedAt: v.optional(v.number()),
    order: v.number(),                        // Display order
    createdAt: v.number(),
  })
    .index("by_plan", ["planId"]),

  // Block assignments - which task is assigned to which block
  blockAssignments: defineTable({
    planId: v.id("todayPlans"),
    blockId: v.string(),                      // References freeBlocks[].id
    // Task source and reference
    taskType: v.union(
      v.literal("todo"),                      // From todoItems
      v.literal("linear"),                    // From linearIssues
      v.literal("adhoc"),                     // From adhocItems
      v.literal("email")                      // Email block (bounded)
    ),
    taskId: v.string(),                       // ID reference (todoItem._id, linearId, adhocItem._id)
    // Snapshot of task info (for display)
    taskTitle: v.string(),
    taskDuration: v.number(),                 // Allocated minutes for this block
    // Status
    status: v.union(
      v.literal("suggested"),                 // AI suggested
      v.literal("assigned"),                  // User confirmed
      v.literal("in_progress"),               // Currently working
      v.literal("completed"),                 // Finished
      v.literal("skipped")                    // User skipped
    ),
    // AI suggestion metadata
    aiConfidence: v.optional(v.number()),     // 0-1 confidence score
    aiReason: v.optional(v.string()),         // Why AI suggested this
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_plan", ["planId"])
    .index("by_block", ["planId", "blockId"]),

  // Timer sessions - tracks active work sessions
  timerSessions: defineTable({
    planId: v.id("todayPlans"),
    blockId: v.optional(v.string()),          // Which block (if any)
    assignmentId: v.optional(v.id("blockAssignments")),
    // Task info (snapshot)
    taskType: v.string(),
    taskId: v.string(),
    taskTitle: v.string(),
    // Session config
    mode: v.union(
      v.literal("normal"),                    // Regular timer
      v.literal("frog")                       // Frog mode (forced hard task)
    ),
    targetDuration: v.number(),               // Planned duration in minutes
    // Timing
    startedAt: v.number(),
    pausedAt: v.optional(v.number()),         // If paused
    endedAt: v.optional(v.number()),          // When completed
    totalPausedSeconds: v.number(),           // Accumulated pause time
    // Result
    result: v.optional(v.union(
      v.literal("completed"),
      v.literal("partial"),
      v.literal("skipped")
    )),
    resultNote: v.optional(v.string()),       // User note on completion
    isActive: v.boolean(),
  })
    .index("by_plan", ["planId"])
    .index("by_active", ["isActive"]),

  // AI block suggestions cache
  aiBlockSuggestions: defineTable({
    planId: v.id("todayPlans"),
    blockId: v.string(),
    // Suggestions (up to 3)
    suggestions: v.array(v.object({
      taskType: v.string(),
      taskId: v.string(),
      taskTitle: v.string(),
      suggestedDuration: v.number(),
      confidence: v.number(),
      reason: v.string(),
    })),
    // Context when generated
    contextHash: v.string(),                  // Hash of work pool state for cache invalidation
    generatedAt: v.number(),
    modelUsed: v.string(),
  })
    .index("by_plan_block", ["planId", "blockId"]),

  // Email blocks - predefined email task templates
  emailBlocks: defineTable({
    title: v.string(),                        // "Reply to newest 5", "Triage inbox", etc.
    description: v.optional(v.string()),
    duration: v.number(),                     // Minutes
    isDefault: v.boolean(),                   // Show by default in suggestions
    order: v.number(),
  }),

  // ===========================================
  // Operator Intelligence Layer
  // ===========================================

  // Daily energy/context notes (free-form text input)
  dailyContext: defineTable({
    date: v.string(),                         // YYYY-MM-DD
    planId: v.optional(v.id("todayPlans")),   // Link to today's plan
    // Morning context (set at start of day)
    morningContext: v.optional(v.string()),   // "Low energy, still want to make progress"
    // Inline notes throughout the day
    contextNotes: v.array(v.object({
      text: v.string(),
      timestamp: v.number(),
    })),
    // AI-inferred state (updated as context changes)
    inferredEnergy: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    )),
    inferredFocus: v.optional(v.union(
      v.literal("scattered"),
      v.literal("moderate"),
      v.literal("deep")
    )),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_date", ["date"]),

  // Momentum tracking - daily stats
  dailyMomentum: defineTable({
    date: v.string(),                         // YYYY-MM-DD
    planId: v.optional(v.id("todayPlans")),
    // Block stats
    blocksStarted: v.number(),
    blocksCompleted: v.number(),
    blocksPartial: v.number(),
    blocksSkipped: v.number(),
    // Time stats
    totalMinutesPlanned: v.number(),
    totalMinutesWorked: v.number(),
    averageBlockDuration: v.number(),
    // Frog stats
    frogAttempts: v.number(),
    frogCompletions: v.number(),
    // Task type breakdown
    taskTypeBreakdown: v.object({
      todo: v.number(),
      linear: v.number(),
      email: v.number(),
      adhoc: v.number(),
    }),
    // Timing patterns
    firstBlockStartedAt: v.optional(v.number()),
    lastBlockEndedAt: v.optional(v.number()),
    averageTimeToStart: v.optional(v.number()), // Avg seconds from block start to session start
    // Computed at end of day
    computedAt: v.number(),
  })
    .index("by_date", ["date"]),

  // Task skip history (for weighted selection decay)
  taskSkipHistory: defineTable({
    taskType: v.string(),
    taskId: v.string(),
    taskTitle: v.string(),
    skippedAt: v.number(),
    skipCount: v.number(),                    // How many times skipped recently
    lastOfferedAt: v.number(),                // When it was last suggested
  })
    .index("by_task", ["taskType", "taskId"])
    .index("by_skipped", ["skippedAt"]),

  // Daily summary reports (HTML)
  dailySummaries: defineTable({
    date: v.string(),                         // YYYY-MM-DD
    planId: v.optional(v.id("todayPlans")),
    momentumId: v.optional(v.id("dailyMomentum")),
    contextId: v.optional(v.id("dailyContext")),
    // Generated content
    htmlContent: v.string(),                  // Full HTML report
    summaryText: v.string(),                  // Plain text version
    oneLiner: v.string(),                     // Single reflection line
    // AI metadata
    modelUsed: v.string(),
    generatedAt: v.number(),
    // Report sections (for partial updates)
    sections: v.object({
      overview: v.string(),
      workedOn: v.string(),
      momentum: v.string(),
      patterns: v.string(),
      reflection: v.string(),
    }),
  })
    .index("by_date", ["date"]),

  // Planned tasks - explicit user-scheduled tasks on the calendar
  // These are tasks the user deliberately dragged from Work Pool onto the calendar
  plannedTasks: defineTable({
    date: v.string(),                         // YYYY-MM-DD format
    // Task reference
    taskType: v.union(
      v.literal("todo"),                      // From todoItems
      v.literal("linear"),                    // From linearIssues
      v.literal("adhoc")                      // From adhocItems
    ),
    taskId: v.string(),                       // ID reference
    // Scheduled time
    startTime: v.number(),                    // Unix timestamp
    endTime: v.number(),                      // Unix timestamp
    duration: v.number(),                     // Duration in minutes
    // Snapshot of task info (for display even if original is deleted)
    taskTitle: v.string(),
    taskPriority: v.optional(v.number()),
    projectName: v.optional(v.string()),
    // Status
    status: v.union(
      v.literal("scheduled"),                 // Planned on calendar
      v.literal("in_progress"),               // Currently working
      v.literal("completed"),                 // Finished
      v.literal("cancelled")                  // Removed from plan
    ),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_date_start", ["date", "startTime"])
    .index("by_task", ["taskType", "taskId"]),

  // Active execution state (singleton for current session)
  executionState: defineTable({
    // Current session info
    isActive: v.boolean(),
    sessionId: v.optional(v.id("timerSessions")),
    planId: v.optional(v.id("todayPlans")),
    // Current task
    currentTask: v.optional(v.object({
      type: v.string(),
      id: v.string(),
      title: v.string(),
      startedAt: v.number(),
      targetDuration: v.number(),
    })),
    // Next suggestions (pre-computed for fast display)
    nextSuggestions: v.array(v.object({
      taskType: v.string(),
      taskId: v.string(),
      taskTitle: v.string(),
      weight: v.number(),                     // Weighted score
      duration: v.number(),
      reason: v.string(),
    })),
    // Weighted candidate pool
    candidatePool: v.array(v.object({
      taskType: v.string(),
      taskId: v.string(),
      taskTitle: v.string(),
      weight: v.number(),
      factors: v.object({
        priority: v.number(),
        deadline: v.number(),
        frogBonus: v.number(),
        skipDecay: v.number(),
        durationFit: v.number(),
      }),
    })),
    updatedAt: v.number(),
  }),

  // ===========================================
  // Agent Chat Feature Tables
  // ===========================================

  // Agent threads - conversation threads for the AI assistant
  agentThreads: defineTable({
    title: v.optional(v.string()),           // Thread title (auto-generated or user-set)
    userId: v.string(),                       // User who owns this thread
    agentThreadId: v.optional(v.string()),   // ID of the thread in the agent component (created on first message)
    lastMessageAt: v.optional(v.number()),   // Timestamp of last message
    messageCount: v.number(),                 // Number of messages in thread
    modelId: v.optional(v.string()),         // User-selected model for this thread (e.g., "openai/gpt-4o")
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_recent", ["userId", "lastMessageAt"])
    .index("by_agent_thread", ["agentThreadId"]),

  // Pending actions awaiting user approval (human-in-the-loop)
  agentPendingActions: defineTable({
    threadId: v.string(),                     // Which chat thread this belongs to
    messageId: v.optional(v.string()),        // Which message triggered this action
    actionType: v.union(
      v.literal("message_contact"),           // Send a message to someone
      v.literal("create_todo"),               // Create a todo item
      v.literal("create_reminder"),           // Set a reminder
      v.literal("add_to_note"),               // Add content to a note
      v.literal("schedule_task"),             // Schedule a task on calendar
      v.literal("other")                      // Other action types
    ),
    title: v.string(),                        // Short action title for display
    description: v.optional(v.string()),      // Detailed description of the action
    actionData: v.any(),                      // Action-specific data (contact info, todo text, etc.)
    status: v.union(
      v.literal("pending"),                   // Awaiting user approval
      v.literal("approved"),                  // User approved, ready to execute
      v.literal("rejected"),                  // User rejected
      v.literal("executed")                   // Successfully executed
    ),
    createdAt: v.number(),
    executedAt: v.optional(v.number()),       // When the action was executed
  })
    .index("by_thread", ["threadId"])
    .index("by_status", ["status"])
    .index("by_thread_status", ["threadId", "status"]),

  // Voice notes - stored audio recordings for transcription
  voiceNotes: defineTable({
    threadId: v.string(),                     // Which thread this belongs to
    storageId: v.id("_storage"),              // Convex storage ID for the audio file
    transcription: v.optional(v.string()),    // Transcribed text
    durationSeconds: v.optional(v.number()),  // Duration in seconds
    status: v.union(
      v.literal("pending"),                   // Waiting to be transcribed
      v.literal("transcribing"),              // Currently being transcribed
      v.literal("completed"),                 // Successfully transcribed
      v.literal("failed")                     // Transcription failed
    ),
    errorMessage: v.optional(v.string()),     // Error message if failed
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_status", ["status"]),

  // Pending voice transcriptions from navbar recording
  pendingVoiceTranscriptions: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    status: v.union(
      v.literal("pending"),
      v.literal("transcribing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    threadId: v.optional(v.string()),         // Set when chat is created
    transcription: v.optional(v.string()),    // Set when transcription completes
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),
});
