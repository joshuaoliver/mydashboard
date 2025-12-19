import { v } from "convex/values";
import { mutation, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { DexContact } from "./dexActions";

/**
 * Main sync action - fetches from Dex and calls mutation to update DB
 * This is called by the cron job
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const syncContactsFromDex = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    totalProcessed: number;
    added: number;
    updated: number;
    skipped: number;
    errors: number;
    errorMessages: string[];
    timestamp: number;
  }> => {
    try {
      console.log("Starting Dex contacts sync...");
      
      // Fetch contacts from Dex
      const result = await ctx.runAction(api.dexActions.fetchDexContacts, {});
      const dexContacts: DexContact[] = result.contacts;

      // Call mutation to update the database (in separate module)
      const syncResult = await ctx.runMutation(internal.dexUpsert.upsertContacts, {
        contacts: dexContacts,
      });

      return syncResult;
    } catch (error) {
      console.error("Error in syncContactsFromDex:", error);
      throw new Error(
        `Failed to sync contacts from Dex: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Force sync - bypasses "unchanged" check to re-process all contacts
 * Useful when phone normalization logic changes
 */
export const syncContactsFromDexForced = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    totalProcessed: number;
    added: number;
    updated: number;
    skipped: number;
    errors: number;
    errorMessages: string[];
    timestamp: number;
  }> => {
    try {
      console.log("Starting FORCED Dex contacts sync (will update all contacts)...");
      
      // Fetch contacts from Dex
      const result = await ctx.runAction(api.dexActions.fetchDexContacts, {});
      const dexContacts: DexContact[] = result.contacts;

      // Call mutation with forceUpdate=true to bypass "unchanged" check
      const syncResult = await ctx.runMutation(internal.dexUpsert.upsertContacts, {
        contacts: dexContacts,
        forceUpdate: true,
      });

      return syncResult;
    } catch (error) {
      console.error("Error in syncContactsFromDexForced:", error);
      throw new Error(
        `Failed to force sync contacts from Dex: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

// Upsert moved to convex/dexUpsert.ts

/**
 * Update contact description (or other editable fields) in Convex
 * This triggers an immediate write-back to Dex
 */
export const updateContactDescription = mutation({
  args: {
    contactId: v.id("contacts"),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Get the contact to find its dexId
      const contact = await ctx.db.get(args.contactId);
      
      if (!contact) {
        throw new Error(`Contact ${args.contactId} not found`);
      }

      const now = Date.now();

      // Update locally first
      await ctx.db.patch(args.contactId, {
        description: args.description,
        lastModifiedAt: now,
      });

      // Trigger write-back to Dex (non-blocking) - only if contact has dexId
      // We use scheduler to make this async and not block the mutation
      const dexId = contact.dexId;
      if (dexId) {
        await ctx.scheduler.runAfter(0, internal.dexWriteback.writeToDex, {
          dexId: dexId,
          description: args.description,
        });
      }

      return { success: true, contactId: args.contactId };
    } catch (error) {
      console.error("Error updating contact description:", error);
      throw new Error(
        `Failed to update contact: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Internal action to write changes back to Dex
 * Called via scheduler to avoid blocking the main update
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const writeToDex = internalAction({
  args: {
    dexId: v.string(),
    description: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    instagram: v.optional(v.string()),
    // Note: We intentionally do NOT write back phones or emails
    // These come from the user's address book and should only be read, not modified
    birthday: v.optional(v.string()),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    try {
      console.log(`Writing changes to Dex for contact ${args.dexId}...`);
      
      // Build updates object with only provided fields
      const updates: any = {};
      if (args.description !== undefined) updates.description = args.description;
      if (args.firstName !== undefined) updates.first_name = args.firstName;
      if (args.lastName !== undefined) updates.last_name = args.lastName;
      if (args.instagram !== undefined) updates.instagram = args.instagram;
      if (args.birthday !== undefined) updates.birthday = args.birthday;
      // Note: phones and emails are read-only from address book - never write back
      
      // Call the Dex update action
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ctx.runAction(api.dexActions.updateDexContact, {
        dexId: args.dexId,
        updates,
      }) as any;

      if (!result.success) {
        console.error(`Failed to write to Dex: ${result.error}`);
      } else {
        console.log(`Successfully wrote changes to Dex for contact ${args.dexId}`);
      }

      return result;
    } catch (error) {
      console.error(`Error writing to Dex for contact ${args.dexId}:`, error);
      // Don't throw - we want to log the error but not fail the mutation
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Update multiple fields for a contact
 * Useful for bulk edits or when we want to update more than just description
 */
export const updateContact = mutation({
  args: {
    contactId: v.id("contacts"),
    updates: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      description: v.optional(v.string()),
      instagram: v.optional(v.string()),
      emails: v.optional(v.array(v.object({ email: v.string() }))),
      phones: v.optional(v.array(v.object({ phone: v.string() }))),
      birthday: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    try {
      // Get the contact to find its dexId
      const contact = await ctx.db.get(args.contactId);
      
      if (!contact) {
        throw new Error(`Contact ${args.contactId} not found`);
      }

      const now = Date.now();

      // Update locally first
      await ctx.db.patch(args.contactId, {
        ...args.updates,
        lastModifiedAt: now,
      });

      // Trigger write-back to Dex (non-blocking) - only if contact has dexId
      // Note: We only write back editable fields, not phones/emails (from address book)
      const dexId = contact.dexId;
      if (dexId) {
        await ctx.scheduler.runAfter(0, internal.dexWriteback.writeToDex, {
          dexId: dexId,
          description: args.updates.description,
          firstName: args.updates.firstName,
          lastName: args.updates.lastName,
          instagram: args.updates.instagram,
          birthday: args.updates.birthday,
        });
      }

      return { success: true, contactId: args.contactId };
    } catch (error) {
      console.error("Error updating contact:", error);
      throw new Error(
        `Failed to update contact: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Manually trigger a sync (useful for testing or on-demand sync)
 */
// triggerManualSync moved to convex/dexAdmin.ts

