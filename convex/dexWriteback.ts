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
    emails: v.optional(v.array(v.object({ email: v.string() }))),
    phones: v.optional(v.array(v.object({ phone: v.string() }))),
    birthday: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      // Build updates object with only provided fields
      const updates: Record<string, unknown> = {};
      if (args.description !== undefined) updates.description = args.description;
      if (args.firstName !== undefined) updates.first_name = args.firstName;
      if (args.lastName !== undefined) updates.last_name = args.lastName;
      if (args.instagram !== undefined) updates.instagram = args.instagram;
      if (args.emails !== undefined) updates.emails = args.emails;
      if (args.phones !== undefined) updates.phones = args.phones;
      if (args.birthday !== undefined) updates.birthday = args.birthday;

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


