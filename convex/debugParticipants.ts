import { query } from "./_generated/server";
import { v } from "convex/values";

export const getParticipantsForChat = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query("beeperParticipants")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    
    return participants;
  },
});

export const countParticipants = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("beeperParticipants").collect();
    return { count: all.length };
  },
});

export const getMessagesForChat = query({
  args: { chatId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("beeperMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .take(args.limit || 5);
    
    return messages.map(m => ({
      text: m.text?.slice(0, 50),
      senderId: m.senderId,
      senderName: m.senderName,
      timestamp: m.timestamp,
    }));
  },
});

import { action } from "./_generated/server";
import { createBeeperClient } from "./beeperClient";

export const fetchLiveParticipants = action({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const client = createBeeperClient();
    
    // Fetch the chat directly from Beeper API
    const chat = await client.chats.get(args.chatId) as any;
    
    return {
      title: chat.title,
      participants: chat.participants?.items?.map((p: any) => ({
        id: p.id,
        fullName: p.fullName,
        username: p.username,
        phoneNumber: p.phoneNumber,
        isSelf: p.isSelf,
      })),
    };
  },
});
