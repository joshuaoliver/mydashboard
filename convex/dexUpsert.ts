import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { DexContact } from "./dexActions";

/**
 * Internal mutation to upsert contacts into the database
 * Split from dexSync.ts to avoid self-referential type issues
 */
export const upsertContacts = internalMutation({
  args: {
    contacts: v.array(v.any()), // DexContact array
  },
  handler: async (ctx, args) => {
    const dexContacts = args.contacts as DexContact[];

    let addedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const now = Date.now();

    for (const dexContact of dexContacts) {
      try {
        // Check if contact already exists by dexId
        const existing = await ctx.db
          .query("contacts")
          .withIndex("by_dex_id", (q) => q.eq("dexId", dexContact.id))
          .first();

        // Map Dex fields to our schema
        const contactData = {
          dexId: dexContact.id,
          firstName: dexContact.first_name || undefined,
          lastName: dexContact.last_name || undefined,
          description: dexContact.description || undefined,
          instagram: dexContact.instagram || undefined,
          imageUrl: dexContact.image_url || undefined,
          emails: dexContact.emails || undefined,
          phones: dexContact.phones || undefined,
          birthday: dexContact.birthday || undefined,
          lastSeenAt: dexContact.last_seen_at || undefined,
          lastSyncedAt: now,
          lastModifiedAt: existing?.lastModifiedAt || now,
        };

        if (existing) {
          // Only update if our local version wasn't recently modified
          const fiveMinutesAgo = now - 5 * 60 * 1000;
          if (existing.lastModifiedAt < fiveMinutesAgo) {
            await ctx.db.patch(existing._id, contactData);
            updatedCount++;
          }
        } else {
          await ctx.db.insert("contacts", contactData);
          addedCount++;
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `Error syncing contact ${dexContact.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(errorMsg);
      }
    }

    return {
      totalProcessed: dexContacts.length,
      added: addedCount,
      updated: updatedCount,
      errors: errorCount,
      errorMessages: errors,
      timestamp: now,
    };
  },
});


