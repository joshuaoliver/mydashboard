import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * List contacts with cursor-based pagination and search
 * Uses efficient database-level pagination for large contact lists
 * 
 * @param cursor - Pagination cursor (from previous response)
 * @param limit - Number of contacts per page (default 50, max 100)
 * @param searchTerm - Optional search filter (searches name, instagram, email, phone)
 */
export const listContactsPaginated = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 50, 100); // Cap at 100 for performance
    
    // For search, we need to filter in memory (Convex doesn't support LIKE queries)
    // But we still use pagination to limit memory usage
    if (args.searchTerm && args.searchTerm.trim().length > 0) {
      const searchLower = args.searchTerm.toLowerCase().trim();
      
      // Fetch all contacts for search (unavoidable for text search)
      // But only return paginated results
      const allContacts = await ctx.db.query("contacts").collect();
      
      // Filter by search term
      const filtered = allContacts.filter((contact) => {
        const firstName = contact.firstName?.toLowerCase() || "";
        const lastName = contact.lastName?.toLowerCase() || "";
        const description = contact.description?.toLowerCase() || "";
        const instagram = contact.instagram?.toLowerCase() || "";
        const email = contact.emails?.[0]?.email?.toLowerCase() || "";
        const phone = contact.phones?.[0]?.phone || "";
        
        return (
          firstName.includes(searchLower) ||
          lastName.includes(searchLower) ||
          description.includes(searchLower) ||
          instagram.includes(searchLower) ||
          email.includes(searchLower) ||
          phone.includes(searchLower)
        );
      });
      
      // Sort by last name, then first name
      filtered.sort((a, b) => {
        const aLast = a.lastName?.toLowerCase() || "";
        const bLast = b.lastName?.toLowerCase() || "";
        const aFirst = a.firstName?.toLowerCase() || "";
        const bFirst = b.firstName?.toLowerCase() || "";
        
        if (aLast !== bLast) return aLast.localeCompare(bLast);
        return aFirst.localeCompare(bFirst);
      });
      
      // Simple offset-based pagination for search results
      const offset = args.cursor ? parseInt(args.cursor, 10) : 0;
      const page = filtered.slice(offset, offset + limit);
      const nextOffset = offset + limit;
      
      return {
        contacts: page,
        nextCursor: nextOffset < filtered.length ? String(nextOffset) : null,
        total: filtered.length,
      };
    }
    
    // For non-search queries, use efficient Convex pagination
    // Order by _creationTime (default) which is indexed
    const paginatedResult = await ctx.db
      .query("contacts")
      .order("desc") // Most recently added first
      .paginate({ numItems: limit, cursor: args.cursor ?? null });
    
    // Get total count (cached query, fast for Convex)
    const totalContacts = await ctx.db.query("contacts").collect();
    
    return {
      contacts: paginatedResult.page,
      nextCursor: paginatedResult.isDone ? null : paginatedResult.continueCursor,
      total: totalContacts.length,
    };
  },
});

/**
 * List all contacts with optional filtering and pagination
 * Returns contacts sorted by last name, then first name
 * 
 * @deprecated Use listContactsPaginated for better performance with large contact lists
 */
export const listContacts = query({
  args: {
    limit: v.optional(v.number()),
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    
    // Fetch all contacts (we'll filter in memory for simple search)
    let contacts = await ctx.db
      .query("contacts")
      .collect();

    // Apply search filter if provided
    if (args.searchTerm) {
      const searchLower = args.searchTerm.toLowerCase();
      contacts = contacts.filter((contact) => {
        const firstName = contact.firstName?.toLowerCase() || "";
        const lastName = contact.lastName?.toLowerCase() || "";
        const description = contact.description?.toLowerCase() || "";
        const instagram = contact.instagram?.toLowerCase() || "";
        
        return (
          firstName.includes(searchLower) ||
          lastName.includes(searchLower) ||
          description.includes(searchLower) ||
          instagram.includes(searchLower)
        );
      });
    }

    // Sort by last name, then first name
    contacts.sort((a, b) => {
      const aLast = a.lastName?.toLowerCase() || "";
      const bLast = b.lastName?.toLowerCase() || "";
      const aFirst = a.firstName?.toLowerCase() || "";
      const bFirst = b.firstName?.toLowerCase() || "";
      
      if (aLast !== bLast) {
        return aLast.localeCompare(bLast);
      }
      return aFirst.localeCompare(bFirst);
    });

    // Apply limit
    const limitedContacts = contacts.slice(0, limit);

    return {
      contacts: limitedContacts,
      total: contacts.length,
      hasMore: contacts.length > limit,
    };
  },
});

/**
 * Get a single contact by its Convex ID
 */
export const getContactById = query({
  args: {
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    
    if (!contact) {
      throw new Error(`Contact ${args.contactId} not found`);
    }

    return contact;
  },
});

/**
 * Get a single contact by its Dex ID
 * Useful for looking up contacts by their external Dex identifier
 */
export const getContactByDexId = query({
  args: {
    dexId: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_dex_id", (q) => q.eq("dexId", args.dexId))
      .first();

    if (!contact) {
      throw new Error(`Contact with dexId ${args.dexId} not found`);
    }

    return contact;
  },
});

/**
 * Get contacts by Instagram handle
 * Useful for social media integrations
 */
export const getContactsByInstagram = query({
  args: {
    instagram: v.string(),
  },
  handler: async (ctx, args) => {
    const contacts = await ctx.db
      .query("contacts")
      .filter((q) => q.eq(q.field("instagram"), args.instagram))
      .collect();

    return { contacts };
  },
});

/**
 * Get recently synced contacts
 * Returns contacts that were synced within the last N hours
 */
export const getRecentlySyncedContacts = query({
  args: {
    hoursAgo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoursAgo = args.hoursAgo || 24;
    const cutoffTime = Date.now() - hoursAgo * 60 * 60 * 1000;

    const contacts = await ctx.db
      .query("contacts")
      .filter((q) => q.gte(q.field("lastSyncedAt"), cutoffTime))
      .collect();

    return {
      contacts,
      count: contacts.length,
      cutoffTime,
    };
  },
});

/**
 * Get recently modified contacts (locally)
 * Returns contacts that were modified in Convex within the last N hours
 */
export const getRecentlyModifiedContacts = query({
  args: {
    hoursAgo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoursAgo = args.hoursAgo || 24;
    const cutoffTime = Date.now() - hoursAgo * 60 * 60 * 1000;

    const contacts = await ctx.db
      .query("contacts")
      .filter((q) => q.gte(q.field("lastModifiedAt"), cutoffTime))
      .collect();

    return {
      contacts,
      count: contacts.length,
      cutoffTime,
    };
  },
});

/**
 * Get sync statistics
 * Returns useful stats about the contact sync state
 */
export const getSyncStats = query({
  args: {},
  handler: async (ctx) => {
    const allContacts = await ctx.db.query("contacts").collect();
    
    if (allContacts.length === 0) {
      return {
        totalContacts: 0,
        lastSyncTime: null,
        contactsModifiedSinceSync: 0,
      };
    }

    // Find the most recent sync time
    const lastSyncTime = Math.max(...allContacts.map((c) => c.lastSyncedAt));
    
    // Count contacts modified since last sync
    const contactsModifiedSinceSync = allContacts.filter(
      (c) => c.lastModifiedAt > c.lastSyncedAt
    ).length;

    return {
      totalContacts: allContacts.length,
      lastSyncTime,
      contactsModifiedSinceSync,
    };
  },
});

