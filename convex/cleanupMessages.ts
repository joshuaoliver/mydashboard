/**
 * One-time cleanup script to remove duplicate messages
 * 
 * The issue: messageIds were being duplicated across multiple chats
 * This script clears all messages so they can resync correctly
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const clearAllMessages = mutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const messages = await ctx.db.query("beeperMessages").collect();
    
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    
    console.log(`[cleanupMessages] Deleted ${messages.length} corrupted messages`);
    
    return {
      deleted: messages.length,
      message: "Messages cleared. They will resync on next page load or manual refresh.",
    };
  },
});

export const clearAllChats = mutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const chats = await ctx.db.query("beeperChats").collect();
    
    for (const chat of chats) {
      await ctx.db.delete(chat._id);
    }
    
    console.log(`[cleanupMessages] Deleted ${chats.length} chats`);
    
    return {
      deleted: chats.length,
      message: "Chats cleared. They will resync on next page load or manual refresh.",
    };
  },
});

