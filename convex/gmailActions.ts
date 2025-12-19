import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Gmail Actions - OAuth flow and API interactions
 * 
 * OAuth Flow:
 * 1. User configures Client ID + Client Secret in settings
 * 2. Frontend initiates OAuth popup to Google
 * 3. Google redirects back with authorization code
 * 4. This action exchanges code for tokens
 * 5. Tokens stored in settings table
 */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

// ==========================================
// OAuth Actions
// ==========================================

/**
 * Exchange authorization code for tokens
 */
export const exchangeCodeForTokens = action({
  args: {
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    // Get Gmail settings (client ID and secret)
    const settings = await ctx.runQuery(internal.settingsStore.getGmailSettingsInternal, {});
    
    if (!settings?.clientId || !settings?.clientSecret) {
      throw new Error("Gmail OAuth not configured. Please set Client ID and Client Secret first.");
    }

    // Exchange code for tokens
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: args.code,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        redirect_uri: args.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Token exchange failed:", error);
      throw new Error(`Failed to exchange code for tokens: ${response.status}`);
    }

    const tokens = await response.json();
    
    // Store tokens in settings
    await ctx.runMutation(internal.settingsStore.setSettingInternal, {
      key: "gmail",
      type: "oauth",
      value: {
        ...settings,
        refreshToken: tokens.refresh_token || settings.refreshToken, // Keep existing if not returned
        accessToken: tokens.access_token,
        tokenExpiry: Date.now() + (tokens.expires_in * 1000),
        isConfigured: true,
      },
    });

    return { success: true };
  },
});

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = internalAction({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    type GmailSettings = {
      clientId?: string;
      clientSecret?: string;
      refreshToken?: string;
      accessToken?: string;
      tokenExpiry?: number;
      isConfigured?: boolean;
    } | null;
    const settings = await ctx.runQuery(internal.settingsStore.getGmailSettingsInternal, {}) as GmailSettings;
    
    if (!settings?.clientId || !settings?.clientSecret || !settings?.refreshToken) {
      throw new Error("Gmail OAuth not properly configured");
    }

    // Check if token is still valid (with 5 min buffer)
    if (settings.accessToken && settings.tokenExpiry && settings.tokenExpiry > Date.now() + 300000) {
      return settings.accessToken;
    }

    // Refresh the token
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        refresh_token: settings.refreshToken,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Token refresh failed:", error);
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const tokens = await response.json();

    // Update stored tokens
    await ctx.runMutation(internal.settingsStore.setSettingInternal, {
      key: "gmail",
      type: "oauth",
      value: {
        ...settings,
        accessToken: tokens.access_token,
        tokenExpiry: Date.now() + (tokens.expires_in * 1000),
      },
    });

    return tokens.access_token as string;
  },
});

// ==========================================
// Gmail API Actions
// ==========================================

/**
 * Helper to count threads matching a query by paginating through all results.
 * Uses users.threads.list with the q parameter for filtering.
 */
async function countThreads(accessToken: string, query: string): Promise<number> {
  let totalCount = 0;
  let pageToken: string | undefined = undefined;
  
  do {
    const params = new URLSearchParams({
      q: query,
      maxResults: "500", // Max allowed per request
    });
    if (pageToken) {
      params.append("pageToken", pageToken);
    }
    
    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/threads?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to fetch threads for query "${query}":`, error);
      throw new Error(`Failed to fetch threads: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Count threads in this page
    if (data.threads) {
      totalCount += data.threads.length;
    }
    
    pageToken = data.nextPageToken;
  } while (pageToken);
  
  return totalCount;
}

/**
 * Get inbox stats using threads (conversations) instead of individual messages.
 * 
 * Uses users.threads.list API with search queries to get accurate thread counts.
 * A thread is considered unread until all messages within it have been read.
 * 
 * Stats tracked:
 * - totalInbox: Total threads in inbox (query: "in:inbox")
 * - unread: Unread threads in inbox (query: "in:inbox is:unread")
 * - Category counts: Unread threads per category
 */
export const getInboxStats = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    totalInbox: number;
    unread: number;
    primary?: number;
    social?: number;
    promotions?: number;
    updates?: number;
    forums?: number;
  }> => {
    // Get fresh access token
    const accessToken = await ctx.runAction(internal.gmailActions.refreshAccessToken, {}) as string;

    // Fetch thread counts in parallel
    const [totalInbox, unread] = await Promise.all([
      countThreads(accessToken, "in:inbox"),
      countThreads(accessToken, "in:inbox is:unread"),
    ]);

    // For category counts, count unread threads per category
    // Category labels in Gmail: category:primary, category:social, etc.
    const categoryQueries = [
      { key: "primary", query: "in:inbox is:unread category:primary" },
      { key: "social", query: "in:inbox is:unread category:social" },
      { key: "promotions", query: "in:inbox is:unread category:promotions" },
      { key: "updates", query: "in:inbox is:unread category:updates" },
      { key: "forums", query: "in:inbox is:unread category:forums" },
    ];

    const categoryPromises = categoryQueries.map(async ({ key, query }) => {
      try {
        const count = await countThreads(accessToken, query);
        return { key, count };
      } catch (e) {
        console.error(`Error fetching threads for ${key}:`, e);
        return { key, count: 0 };
      }
    });

    const categories = await Promise.all(categoryPromises);
    const categoryMap = Object.fromEntries(
      categories.map((c) => [c.key, c.count])
    );

    console.log("Gmail thread stats fetched:", {
      totalInbox,
      unread,
      categories: categoryMap,
    });

    return {
      totalInbox,
      unread,
      primary: categoryMap["primary"],
      social: categoryMap["social"],
      promotions: categoryMap["promotions"],
      updates: categoryMap["updates"],
      forums: categoryMap["forums"],
    };
  },
});

/**
 * Test Gmail connection
 */
export const testConnection = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    stats: v.optional(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<{ success: boolean; stats?: any; error?: string }> => {
    try {
      const stats: any = await ctx.runAction(internal.gmailActions.getInboxStats, {});
      return {
        success: true,
        stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
