import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { DexContact } from "./dexActions";

/**
 * Internal mutation to upsert contacts into the database
 * Split from dexSync.ts to avoid self-referential type issues
 */
export const upsertContacts = internalMutation({
  args: {
    contacts: v.array(v.any()), // DexContact array
    forceUpdate: v.optional(v.boolean()), // If true, bypass "unchanged" check and update all contacts
  },
  handler: async (ctx, args) => {
    const dexContacts = args.contacts as DexContact[];
    const forceUpdate = args.forceUpdate ?? false;

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const now = Date.now();

    for (const dexContact of dexContacts) {
      try {
        // First, try to find by dexId (for contacts already synced from Dex)
        let existing = await ctx.db
          .query("contacts")
          .withIndex("by_dex_id", (q) => q.eq("dexId", dexContact.id))
          .first();

        // If not found by dexId AND contact has Instagram, try matching by Instagram username
        // This allows us to "adopt" user-created contacts when Dex sync finds a match
        if (!existing && dexContact.instagram) {
          const instagramMatch = await ctx.db
            .query("contacts")
            .withIndex("by_instagram", (q) => q.eq("instagram", dexContact.instagram))
            .first();
          
          if (instagramMatch) {
            // Check if this is a user-created contact (no dexId)
            if (!instagramMatch.dexId) {
              console.log(`✨ Adopting user-created contact via Instagram match: @${dexContact.instagram} → Dex ID ${dexContact.id}`);
              existing = instagramMatch;
            } else if (instagramMatch.dexId !== dexContact.id) {
              // Instagram username matches but different dexId - this is a conflict
              console.warn(`⚠️ Instagram conflict: @${dexContact.instagram} matches multiple Dex contacts (${instagramMatch.dexId} vs ${dexContact.id})`);
              // Don't adopt - let it create a new contact
              existing = null;
            }
          }
        }

        // Map Dex fields to our schema
        // Dex API returns phones as [{phone_number: "...", label: "..."}]
        // Our schema expects [{phone: "..."}]
        // 
        // Format phone for STORAGE (E.164 format with + prefix)
        // This is different from normalizePhone() in messageHelpers.ts which is for MATCHING
        // 
        // Phone formatting rules:
        // - Australian mobiles: 9-digit starting with 4 → add +61 prefix
        // - Already has + prefix → keep as-is (already in E.164 format)
        // - 10-digit starting with 04 → Australian mobile, convert to +614...
        // - Other formats → keep as-is for now
        const formatPhoneForStorage = (rawPhone: string): string => {
          // Strip all non-digit characters except leading +
          const hasPlus = rawPhone.startsWith('+');
          const digits = rawPhone.replace(/\D/g, '');
          
          // Already in international format
          if (hasPlus && digits.length >= 10) {
            return '+' + digits;
          }
          
          // Australian mobile: 9 digits starting with 4 (e.g., 417248743)
          if (digits.length === 9 && digits.startsWith('4')) {
            return '+61' + digits;
          }
          
          // Australian mobile: 10 digits starting with 04 (e.g., 0417248743)
          if (digits.length === 10 && digits.startsWith('04')) {
            return '+61' + digits.slice(1); // Remove leading 0
          }
          
          // Australian landline: 9 digits starting with area code (2, 3, 7, 8)
          if (digits.length === 9 && ['2', '3', '7', '8'].includes(digits[0])) {
            return '+61' + digits;
          }
          
          // Australian landline: 10 digits starting with 0 + area code
          if (digits.length === 10 && digits.startsWith('0') && ['2', '3', '7', '8'].includes(digits[1])) {
            return '+61' + digits.slice(1); // Remove leading 0
          }
          
          // Return with + prefix if it looks like an international number (11+ digits)
          if (digits.length >= 11) {
            return '+' + digits;
          }
          
          // Unknown format - return digits only (best effort)
          return digits;
        };

        const mappedPhones = dexContact.phones?.length
          ? dexContact.phones.map((p: { phone_number?: string; phone?: string }) => ({
              phone: formatPhoneForStorage(p.phone_number || p.phone || ""),
            })).filter((p: { phone: string }) => p.phone) // Filter out empty phones
          : undefined;

        // Dex API returns emails as [{email: "..."}] which matches our schema
        const mappedEmails = dexContact.emails?.length
          ? dexContact.emails.filter((e: { email?: string }) => e.email)
          : undefined;

        const contactData = {
          dexId: dexContact.id,
          firstName: dexContact.first_name || undefined,
          lastName: dexContact.last_name || undefined,
          description: dexContact.description || undefined,
          instagram: dexContact.instagram || undefined,
          imageUrl: dexContact.image_url || undefined,
          emails: mappedEmails,
          phones: mappedPhones,
          birthday: dexContact.birthday || undefined,
          lastSeenAt: dexContact.last_seen_at || undefined,
          lastSyncedAt: now,
          lastModifiedAt: existing?.lastModifiedAt || now,
        };

        if (existing) {
          // Check if contact was recently modified locally - protect local changes
          const fiveMinutesAgo = now - 5 * 60 * 1000;
          if (existing.lastModifiedAt >= fiveMinutesAgo) {
            skippedCount++;
            continue; // Skip - local changes are too recent
          }

          // Check if Dex data actually changed by comparing updated_at timestamps
          const dexUpdatedAt = dexContact.updated_at ? new Date(dexContact.updated_at).getTime() : 0;
          const existingLastSynced = existing.lastSyncedAt || 0;
          
          // Skip update if Dex hasn't changed since our last sync (unless forceUpdate)
          if (!forceUpdate && dexUpdatedAt <= existingLastSynced) {
            skippedCount++;
            continue; // No changes in Dex since last sync
          }

          // Check if phone numbers changed (triggers rematch)
          const phonesChanged = JSON.stringify(existing.phones) !== JSON.stringify(contactData.phones);
          const instagramChanged = existing.instagram !== contactData.instagram;

          // Contact changed in Dex - update it
          await ctx.db.patch(existing._id, contactData);
          updatedCount++;

          // If phones or instagram changed, trigger rematch for this contact
          if (phonesChanged || instagramChanged) {
            await ctx.scheduler.runAfter(0, internal.contactMutations.rematchChatsForContact, {
              contactId: existing._id,
            });
          }
        } else {
          // New contact - insert it
          const contactId = await ctx.db.insert("contacts", contactData);
          addedCount++;

          // Trigger rematch to link existing chats to this new contact
          await ctx.scheduler.runAfter(0, internal.contactMutations.rematchChatsForContact, {
            contactId,
          });
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `Error syncing contact ${dexContact.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(errorMsg);
      }
    }

    const summary = {
      totalProcessed: dexContacts.length,
      added: addedCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      errorMessages: errors,
      timestamp: now,
    };

    console.log(`Dex sync complete: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped (unchanged)`);

    return summary;
  },
});


