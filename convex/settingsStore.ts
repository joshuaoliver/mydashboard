import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";

/**
 * Settings Store - flexible key-value storage for integration configs
 * 
 * Keys follow convention:
 * - "gmail" - Gmail OAuth tokens and config
 * - "hubstaff" - Hubstaff refresh token, org ID, selected user
 * - "linear_<workspaceId>" - Linear workspace config (deprecated, use linearWorkspaces table)
 */

// ==========================================
// Queries
// ==========================================

/**
 * Get a setting by key
 */
export const getSetting = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return setting;
  },
});

/**
 * Get all settings (for admin/debug)
 */
export const listSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").collect();
    return settings;
  },
});

/**
 * Get settings by type
 */
export const getSettingsByType = query({
  args: { type: v.string() },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("settings").collect();
    return settings.filter((s) => s.type === args.type);
  },
});

// ==========================================
// Internal Queries (for actions/crons)
// ==========================================

export const getSettingInternal = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return setting;
  },
});

// ==========================================
// Mutations
// ==========================================

/**
 * Set a setting (upsert)
 */
export const setSetting = mutation({
  args: {
    key: v.string(),
    type: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.type,
        value: args.value,
        updatedAt: now,
      });
      return existing._id;
    } else {
      const id = await ctx.db.insert("settings", {
        key: args.key,
        type: args.type,
        value: args.value,
        updatedAt: now,
      });
      return id;
    }
  },
});

/**
 * Update just the value of a setting (partial update)
 */
export const updateSettingValue = mutation({
  args: {
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!existing) {
      throw new Error(`Setting with key "${args.key}" not found`);
    }

    await ctx.db.patch(existing._id, {
      value: args.value,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

/**
 * Delete a setting
 */
export const deleteSetting = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});

// ==========================================
// Internal Mutations (for actions/crons)
// ==========================================

export const setSettingInternal = internalMutation({
  args: {
    key: v.string(),
    type: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.type,
        value: args.value,
        updatedAt: now,
      });
      return existing._id;
    } else {
      const id = await ctx.db.insert("settings", {
        key: args.key,
        type: args.type,
        value: args.value,
        updatedAt: now,
      });
      return id;
    }
  },
});

export const updateSettingValueInternal = internalMutation({
  args: {
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!existing) {
      throw new Error(`Setting with key "${args.key}" not found`);
    }

    await ctx.db.patch(existing._id, {
      value: args.value,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

// ==========================================
// Type-specific helpers
// ==========================================

/**
 * Get Gmail settings specifically
 */
export const getGmailSettings = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "gmail"))
      .first();
    
    if (!setting) return null;
    
    return setting.value as {
      clientId?: string;
      clientSecret?: string;
      refreshToken?: string;
      accessToken?: string;
      tokenExpiry?: number;
      isConfigured?: boolean;
    };
  },
});

/**
 * Get Hubstaff settings specifically
 */
export const getHubstaffSettings = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "hubstaff"))
      .first();
    
    if (!setting) return null;
    
    return setting.value as {
      refreshToken?: string;
      accessToken?: string;
      tokenExpiry?: number;
      organizationId?: number;
      organizationName?: string;
      selectedUserId?: number;
      selectedUserName?: string;
      isConfigured?: boolean;
    };
  },
});

// Internal versions for actions
export const getGmailSettingsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "gmail"))
      .first();
    
    if (!setting) return null;
    
    return setting.value as {
      clientId?: string;
      clientSecret?: string;
      refreshToken?: string;
      accessToken?: string;
      tokenExpiry?: number;
      isConfigured?: boolean;
    };
  },
});

export const getHubstaffSettingsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "hubstaff"))
      .first();
    
    if (!setting) return null;
    
    return setting.value as {
      refreshToken?: string;
      accessToken?: string;
      tokenExpiry?: number;
      organizationId?: number;
      organizationName?: string;
      selectedUserId?: number;
      selectedUserName?: string;
      isConfigured?: boolean;
    };
  },
});
