import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * List all prompts ordered by creation time (most recent first)
 * Requires authentication
 */
export const listPrompts = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("prompts"),
      _creationTime: v.number(),
      name: v.string(),
      title: v.string(),
      description: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    
    const prompts = await ctx.db
      .query("prompts")
      .order("desc")
      .collect();
    return prompts;
  },
});

/**
 * Get a single prompt by ID
 * Requires authentication
 */
export const getPrompt = query({
  args: { id: v.id("prompts") },
  returns: v.union(
    v.object({
      _id: v.id("prompts"),
      _creationTime: v.number(),
      name: v.string(),
      title: v.string(),
      description: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    
    return await ctx.db.get(args.id);
  },
});

/**
 * Create a new prompt
 * Requires authentication
 */
export const createPrompt = mutation({
  args: {
    name: v.string(),
    title: v.string(),
    description: v.string(),
  },
  returns: v.id("prompts"),
  handler: async (ctx, args) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    
    const now = Date.now();
    
    // Check if a prompt with this name already exists
    const existing = await ctx.db
      .query("prompts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    
    if (existing) {
      throw new Error(`A prompt with the name "${args.name}" already exists`);
    }
    
    return await ctx.db.insert("prompts", {
      name: args.name,
      title: args.title,
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing prompt
 * Requires authentication
 */
export const updatePrompt = mutation({
  args: {
    id: v.id("prompts"),
    name: v.string(),
    title: v.string(),
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Prompt not found");
    }
    
    // Check if another prompt with this name exists (excluding current one)
    if (existing.name !== args.name) {
      const duplicate = await ctx.db
        .query("prompts")
        .withIndex("by_name", (q) => q.eq("name", args.name))
        .first();
      
      if (duplicate) {
        throw new Error(`A prompt with the name "${args.name}" already exists`);
      }
    }
    
    await ctx.db.patch(args.id, {
      name: args.name,
      title: args.title,
      description: args.description,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});

/**
 * Delete a prompt
 * Requires authentication
 */
export const deletePrompt = mutation({
  args: { id: v.id("prompts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Prompt not found");
    }
    
    await ctx.db.delete(args.id);
    return null;
  },
});

