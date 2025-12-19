import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Internal action to write changes back to Dex
 * Kept in separate module to avoid self-references in type generation
 */
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
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      // Build updates object with only provided fields
      // Map our schema format back to Dex API format
      const updates: Record<string, unknown> = {};
      if (args.description !== undefined) updates.description = args.description;
      if (args.firstName !== undefined) updates.first_name = args.firstName;
      if (args.lastName !== undefined) updates.last_name = args.lastName;
      if (args.instagram !== undefined) updates.instagram = args.instagram;
      if (args.birthday !== undefined) updates.birthday = args.birthday;
      // Note: phones and emails are read-only from address book - never write back

      const result = await ctx.runAction(api.dexActions.updateDexContact, {
        dexId: args.dexId,
        updates,
      });

      return { success: result.success, error: result.success ? undefined : result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});


