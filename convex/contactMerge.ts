import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Merge two contact records into one
 * Combines all data, preserving local customizations from primary
 */
export const mergeContacts = mutation({
  args: {
    primaryId: v.id("contacts"),   // Contact to keep
    duplicateId: v.id("contacts"), // Contact to merge and remove
  },
  handler: async (ctx, args) => {
    const primary = await ctx.db.get(args.primaryId);
    const duplicate = await ctx.db.get(args.duplicateId);

    if (!primary) {
      throw new Error(`Primary contact ${args.primaryId} not found`);
    }
    if (!duplicate) {
      throw new Error(`Duplicate contact ${args.duplicateId} not found`);
    }

    // Build combined socialHandles array
    const combinedHandles: Array<{
      platform: string;
      handle: string;
      isPrimary: boolean;
      addedAt: number;
    }> = [];

    const now = Date.now();

    // Add primary's current handles
    if (primary.instagram) {
      combinedHandles.push({
        platform: "instagram",
        handle: primary.instagram,
        isPrimary: true,
        addedAt: primary.socialHandles?.find(h => h.handle === primary.instagram)?.addedAt || now,
      });
    }
    if (primary.whatsapp) {
      combinedHandles.push({
        platform: "whatsapp",
        handle: primary.whatsapp,
        isPrimary: true,
        addedAt: primary.socialHandles?.find(h => h.handle === primary.whatsapp)?.addedAt || now,
      });
    }

    // Add duplicate's current handles (marked as non-primary)
    if (duplicate.instagram && duplicate.instagram !== primary.instagram) {
      combinedHandles.push({
        platform: "instagram",
        handle: duplicate.instagram,
        isPrimary: false,
        addedAt: duplicate.socialHandles?.find(h => h.handle === duplicate.instagram)?.addedAt || now,
      });
    }
    if (duplicate.whatsapp && duplicate.whatsapp !== primary.whatsapp) {
      combinedHandles.push({
        platform: "whatsapp",
        handle: duplicate.whatsapp,
        isPrimary: false,
        addedAt: duplicate.socialHandles?.find(h => h.handle === duplicate.whatsapp)?.addedAt || now,
      });
    }

    // Add existing socialHandles from both (dedupe by handle)
    const existingHandles = new Set<string>();
    for (const handle of combinedHandles) {
      existingHandles.add(handle.handle);
    }

    // Add from primary's socialHandles
    if (primary.socialHandles) {
      for (const handle of primary.socialHandles) {
        if (!existingHandles.has(handle.handle)) {
          combinedHandles.push(handle);
          existingHandles.add(handle.handle);
        }
      }
    }

    // Add from duplicate's socialHandles  
    if (duplicate.socialHandles) {
      for (const handle of duplicate.socialHandles) {
        if (!existingHandles.has(handle.handle)) {
          combinedHandles.push({ ...handle, isPrimary: false }); // Mark as non-primary
          existingHandles.add(handle.handle);
        }
      }
    }

    // Combine mergedFrom arrays
    const combinedMergedFrom = [
      ...(primary.mergedFrom || []),
      args.duplicateId,
      ...(duplicate.mergedFrom || []),
    ];

    // Merge emails and phones (dedupe)
    const emailSet = new Set<string>();
    const combinedEmails: Array<{ email: string }> = [];
    
    for (const email of [...(primary.emails || []), ...(duplicate.emails || [])]) {
      if (!emailSet.has(email.email)) {
        combinedEmails.push(email);
        emailSet.add(email.email);
      }
    }

    const phoneSet = new Set<string>();
    const combinedPhones: Array<{ phone: string }> = [];
    
    for (const phone of [...(primary.phones || []), ...(duplicate.phones || [])]) {
      if (!phoneSet.has(phone.phone)) {
        combinedPhones.push(phone);
        phoneSet.add(phone.phone);
      }
    }

    // Update primary contact with merged data
    await ctx.db.patch(args.primaryId, {
      // Prefer primary's core data, but fill gaps from duplicate
      firstName: primary.firstName || duplicate.firstName,
      lastName: primary.lastName || duplicate.lastName,
      description: primary.description || duplicate.description,
      imageUrl: primary.imageUrl || duplicate.imageUrl,
      birthday: primary.birthday || duplicate.birthday,
      
      // Merged contact info
      emails: combinedEmails.length > 0 ? combinedEmails : undefined,
      phones: combinedPhones.length > 0 ? combinedPhones : undefined,
      
      // Keep primary's local-only fields (notes, connections, leadStatus, etc.)
      // These represent user's customization and should not be overwritten
      
      // Deduplication tracking
      socialHandles: combinedHandles.length > 0 ? combinedHandles : undefined,
      mergedFrom: combinedMergedFrom,
      
      lastModifiedAt: now,
    });

    // Delete the duplicate contact
    await ctx.db.delete(args.duplicateId);

    return {
      success: true,
      primaryId: args.primaryId,
      deletedId: args.duplicateId,
      mergedHandles: combinedHandles.length,
    };
  },
});

