import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Available models via Vercel AI Gateway
// Keep this list updated as new models become available
export const AVAILABLE_MODELS = [
  // Google Gemini
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash", provider: "Google", description: "Frontier intelligence at Flash speed - fast & smart" },
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro (Preview)", provider: "Google", description: "Most capable Gemini model" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", description: "Previous gen, fast and cost-effective" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", description: "Previous gen, high quality" },
  
  // Anthropic Claude
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", provider: "Anthropic", description: "Latest balanced model - smart & efficient" },
  { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5", provider: "Anthropic", description: "Most capable Claude model" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", description: "Previous balanced model" },
  { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet", provider: "Anthropic", description: "Reliable and capable" },
  
  // OpenAI
  { id: "openai/gpt-5.2", name: "GPT-5.2", provider: "OpenAI", description: "OpenAI's newest model" },
  { id: "openai/gpt-5", name: "GPT-5", provider: "OpenAI", description: "OpenAI's flagship" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", description: "Fast multimodal model" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", description: "Fast and cheap" },
  { id: "openai/o3", name: "o3", provider: "OpenAI", description: "Advanced reasoning model" },
  
  // DeepSeek
  { id: "deepseek/deepseek-v3.1", name: "DeepSeek V3.1", provider: "DeepSeek", description: "Latest DeepSeek model" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek", description: "Reasoning model" },
  
  // xAI Grok
  { id: "xai/grok-4", name: "Grok 4", provider: "xAI", description: "xAI's latest model" },
  { id: "xai/grok-3", name: "Grok 3", provider: "xAI", description: "Fast and capable" },
  
  // Meta Llama
  { id: "meta/llama-4-maverick", name: "Llama 4 Maverick", provider: "Meta", description: "Latest Llama model" },
  { id: "meta/llama-3.3-70b", name: "Llama 3.3 70B", provider: "Meta", description: "Large open model" },
  
  // Mistral
  { id: "mistral/mistral-large", name: "Mistral Large", provider: "Mistral", description: "Most capable Mistral" },
  { id: "mistral/mistral-medium", name: "Mistral Medium", provider: "Mistral", description: "Balanced Mistral model" },
] as const;

// Default AI settings for each use case
export const DEFAULT_SETTINGS = {
  "chat-agent": {
    displayName: "Chat Agent",
    description: "The AI model used for the chat assistant",
    modelId: "google/gemini-3-flash",
    promptName: undefined,
    temperature: 0.7,
    isEnabled: true,
  },
  "reply-suggestions": {
    displayName: "Reply Suggestions",
    description: "AI-powered reply suggestions for messages",
    modelId: "google/gemini-3-flash",
    promptName: "reply-suggestions",
    temperature: 1,
    isEnabled: true,
  },
  "contact-summary": {
    displayName: "Contact Summary",
    description: "Generate summaries of conversation history with contacts",
    modelId: "google/gemini-3-flash",
    promptName: "contact-summary",
    temperature: 1,
    isEnabled: true,
  },
  "message-compose": {
    displayName: "Message Composer",
    description: "AI assistance for composing new messages",
    modelId: "google/gemini-3-flash",
    promptName: "message-compose",
    temperature: 1,
    isEnabled: true,
  },
  "thread-title-generation": {
    displayName: "Thread Title Generation",
    description: "Auto-generate conversation titles from first message",
    modelId: "google/gemini-3-flash",
    promptName: undefined,
    temperature: 0.7,
    isEnabled: true,
  },
} as const;

/**
 * List all AI settings
 */
export const listSettings = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("aiSettings"),
      _creationTime: v.number(),
      key: v.string(),
      displayName: v.string(),
      description: v.optional(v.string()),
      modelId: v.string(),
      promptName: v.optional(v.string()),
      temperature: v.optional(v.number()),
      maxTokens: v.optional(v.number()),
      isEnabled: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("aiSettings").collect();
  },
});

/**
 * Get a specific AI setting by key
 */
export const getSetting = query({
  args: { key: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("aiSettings"),
      _creationTime: v.number(),
      key: v.string(),
      displayName: v.string(),
      description: v.optional(v.string()),
      modelId: v.string(),
      promptName: v.optional(v.string()),
      temperature: v.optional(v.number()),
      maxTokens: v.optional(v.number()),
      isEnabled: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

/**
 * Get AI setting by key (internal - for use in actions)
 */
export const getSettingInternal = internalQuery({
  args: { key: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("aiSettings"),
      _creationTime: v.number(),
      key: v.string(),
      displayName: v.string(),
      description: v.optional(v.string()),
      modelId: v.string(),
      promptName: v.optional(v.string()),
      temperature: v.optional(v.number()),
      maxTokens: v.optional(v.number()),
      isEnabled: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

/**
 * Update an AI setting (or create if doesn't exist)
 */
export const updateSetting = mutation({
  args: {
    key: v.string(),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    modelId: v.optional(v.string()),
    promptName: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    isEnabled: v.optional(v.boolean()),
  },
  returns: v.id("aiSettings"),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const existing = await ctx.db
      .query("aiSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (existing) {
      // Update existing setting
      const updates: Record<string, any> = { updatedAt: now };
      if (args.displayName !== undefined) updates.displayName = args.displayName;
      if (args.description !== undefined) updates.description = args.description;
      if (args.modelId !== undefined) updates.modelId = args.modelId;
      if (args.promptName !== undefined) updates.promptName = args.promptName;
      if (args.temperature !== undefined) updates.temperature = args.temperature;
      if (args.maxTokens !== undefined) updates.maxTokens = args.maxTokens;
      if (args.isEnabled !== undefined) updates.isEnabled = args.isEnabled;
      
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      // Create new setting with defaults
      const defaultConfig = DEFAULT_SETTINGS[args.key as keyof typeof DEFAULT_SETTINGS];
      
      return await ctx.db.insert("aiSettings", {
        key: args.key,
        displayName: args.displayName ?? defaultConfig?.displayName ?? args.key,
        description: args.description ?? defaultConfig?.description,
        modelId: args.modelId ?? defaultConfig?.modelId ?? "google/gemini-3-flash",
        promptName: args.promptName ?? defaultConfig?.promptName,
        temperature: args.temperature ?? defaultConfig?.temperature ?? 1,
        maxTokens: args.maxTokens,
        isEnabled: args.isEnabled ?? defaultConfig?.isEnabled ?? true,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Initialize default AI settings
 * Creates settings for all known use cases if they don't exist
 */
export const initializeDefaults = mutation({
  args: {},
  returns: v.object({
    created: v.array(v.string()),
    skipped: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const created: string[] = [];
    const skipped: string[] = [];
    const now = Date.now();

    for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await ctx.db
        .query("aiSettings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();

      if (!existing) {
        await ctx.db.insert("aiSettings", {
          key,
          displayName: config.displayName,
          description: config.description,
          modelId: config.modelId,
          promptName: config.promptName,
          temperature: config.temperature,
          isEnabled: config.isEnabled,
          createdAt: now,
          updatedAt: now,
        });
        created.push(key);
      } else {
        skipped.push(key);
      }
    }

    return { created, skipped };
  },
});

/**
 * Get available models list (for UI dropdowns)
 */
export const getAvailableModels = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      provider: v.string(),
      description: v.string(),
    })
  ),
  handler: async () => {
    return AVAILABLE_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      description: m.description,
    }));
  },
});

/**
 * Delete an AI setting
 */
export const deleteSetting = mutation({
  args: { key: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});
