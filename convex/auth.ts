import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { ConvexError } from "convex/values";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      profile(params) {
        // Hardcoded restriction: Only allow josh@bywave.com.au to sign up
        const email = params.email as string;
        if (email !== 'josh@bywave.com.au') {
          throw new ConvexError('This account is for personal use only. Sign-ups are restricted.');
        }
        return {
          email: email,
        };
      },
    }),
  ],
});

// Query to get the current authenticated user
// Uses recommended getAuthUserId() from Convex Auth docs
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    // Debug: Log authentication attempt
    console.log("currentUser query called");
    
    // Check if there's auth info in the context
    const authInfo = await ctx.auth.getUserIdentity();
    console.log("Auth identity:", authInfo ? "Found" : "None", authInfo?.tokenIdentifier);
    
    const userId = await getAuthUserId(ctx);
    console.log("User ID from getAuthUserId:", userId);
    
    if (userId === null) {
      return null;
    }
    
    const user = await ctx.db.get(userId);
    console.log("User document:", user ? "Found" : "Not found");
    return user;
  },
});