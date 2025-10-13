import { query } from "./_generated/server";

/**
 * Diagnostic query to check Instagram usernames in beeperChats vs contacts
 * Helps identify mismatches like "@username" vs "username"
 */
export const checkInstagramUsernames = query({
  handler: async (ctx) => {
    // Get all beeper chats with Instagram usernames
    const beeperChats = await ctx.db
      .query("beeperChats")
      .filter((q) => 
        q.and(
          q.eq(q.field("network"), "Instagram"),
          q.neq(q.field("username"), undefined)
        )
      )
      .collect();

    // Get all contacts with Instagram handles
    const contacts = await ctx.db
      .query("contacts")
      .filter((q) => q.neq(q.field("instagram"), undefined))
      .collect();

    // Build comparison data
    const beeperUsernames = beeperChats.map((chat) => ({
      chatId: chat.chatId,
      title: chat.title,
      username: chat.username,
      hasAt: chat.username?.startsWith("@") || false,
    }));

    const contactUsernames = contacts.map((contact) => ({
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      instagram: contact.instagram,
      hasAt: contact.instagram?.startsWith("@") || false,
    }));

    // Check for potential matches (with and without @)
    const potentialMatches: Array<{
      beeperUsername: string;
      contactInstagram: string;
      beeperChatTitle: string;
      contactName: string;
      mismatchType: string;
    }> = [];

    for (const beeper of beeperUsernames) {
      if (!beeper.username) continue;

      for (const contact of contactUsernames) {
        if (!contact.instagram) continue;

        const bUsername = beeper.username.toLowerCase().replace(/^@/, "");
        const cUsername = contact.instagram.toLowerCase().replace(/^@/, "");

        if (bUsername === cUsername) {
          // They match without @, but check if original format differs
          if (beeper.username !== contact.instagram) {
            potentialMatches.push({
              beeperUsername: beeper.username,
              contactInstagram: contact.instagram,
              beeperChatTitle: beeper.title,
              contactName: contact.name,
              mismatchType: "@-prefix mismatch",
            });
          }
        }
      }
    }

    return {
      beeperInstagramChats: {
        count: beeperUsernames.length,
        withAt: beeperUsernames.filter((b) => b.hasAt).length,
        withoutAt: beeperUsernames.filter((b) => !b.hasAt).length,
        sample: beeperUsernames.slice(0, 10),
      },
      dexContacts: {
        count: contactUsernames.length,
        withAt: contactUsernames.filter((c) => c.hasAt).length,
        withoutAt: contactUsernames.filter((c) => !c.hasAt).length,
        sample: contactUsernames.slice(0, 10),
      },
      potentialMatches,
      recommendation:
        potentialMatches.length > 0
          ? "Found @ prefix mismatches! Consider normalizing usernames."
          : "No @ prefix issues found.",
    };
  },
});

/**
 * Check needsReply status for debugging why Unreplied tab is empty
 */
export const checkNeedsReply = query({
  handler: async (ctx) => {
    const chats = await ctx.db
      .query("beeperChats")
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "single"),
          q.eq(q.field("isArchived"), false)
        )
      )
      .order("desc")
      .take(20);

    return {
      totalChats: chats.length,
      chatsNeedingReply: chats.filter((c) => c.needsReply === true).length,
      chatsNoReply: chats.filter((c) => c.needsReply === false).length,
      chatsUndefined: chats.filter((c) => c.needsReply === undefined).length,
      sample: chats.map((chat) => ({
        title: chat.title,
        network: chat.network,
        needsReply: chat.needsReply,
        lastMessageFrom: chat.lastMessageFrom,
        lastMessage: chat.lastMessage || "(no lastMessage field)",
        lastActivity: new Date(chat.lastActivity).toLocaleString(),
      })),
    };
  },
});

