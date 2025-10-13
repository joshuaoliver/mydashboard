import { action } from "./_generated/server";
import { v } from "convex/values";

// Dex API configuration
const DEX_API_URL = "https://api.getdex.com/api/rest";
const DEX_API_KEY = process.env.DEX_API_KEY;

// Type definitions for Dex API responses
export interface DexContact {
  id: string;
  first_name?: string;
  last_name?: string;
  description?: string;
  instagram?: string;
  image_url?: string;
  // Additional fields we'll discover from the API
  [key: string]: any;
}

/**
 * Test action to fetch contacts from Dex API and inspect the response structure
 * This helps us understand what fields are available before finalizing the schema
 */
export const testFetchDexContacts = action({
  args: {},
  handler: async (ctx) => {
    try {
      if (!DEX_API_KEY) {
        throw new Error("DEX_API_KEY environment variable is not set");
      }

      console.log("Fetching contacts from Dex API...");
      
      const response = await fetch(`${DEX_API_URL}/contacts`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-dex-api-key": DEX_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dex API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Log the structure for inspection
      console.log("Dex API Response:", JSON.stringify(data, null, 2));
      
      // Return sample contact(s) to understand the structure
      const contacts = Array.isArray(data) ? data : data.contacts || data.data || [];
      const sampleSize = Math.min(3, contacts.length);
      
      return {
        totalContacts: contacts.length,
        sampleContacts: contacts.slice(0, sampleSize),
        availableFields: contacts.length > 0 ? Object.keys(contacts[0]) : [],
        rawResponse: data,
      };
    } catch (error) {
      console.error("Error testing Dex API:", error);
      throw new Error(
        `Failed to fetch contacts from Dex: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Fetch all contacts from Dex API with pagination
 * Returns an array of all contact objects
 */
export const fetchDexContacts = action({
  args: {},
  handler: async (ctx) => {
    try {
      if (!DEX_API_KEY) {
        throw new Error("DEX_API_KEY environment variable is not set");
      }

      const allContacts: DexContact[] = [];
      const LIMIT = 100; // Fetch 100 contacts per request
      let offset = 0;
      let hasMore = true;

      console.log("Starting paginated fetch from Dex API...");

      while (hasMore) {
        const response = await fetch(
          `${DEX_API_URL}/contacts?limit=${LIMIT}&offset=${offset}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-hasura-dex-api-key": DEX_API_KEY,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Dex API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        // Handle different possible response structures
        const pageContacts: DexContact[] = Array.isArray(data) 
          ? data 
          : data.contacts || data.data || [];

        allContacts.push(...pageContacts);
        
        console.log(`Fetched page at offset ${offset}: ${pageContacts.length} contacts`);

        // Check if we got fewer contacts than the limit (meaning we're done)
        if (pageContacts.length < LIMIT) {
          hasMore = false;
        } else {
          offset += LIMIT;
          // Small delay to respect rate limits (100ms between requests)
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Successfully fetched ${allContacts.length} total contacts from Dex`);
      
      return { contacts: allContacts };
    } catch (error) {
      console.error("Error fetching Dex contacts:", error);
      throw new Error(
        `Failed to fetch contacts from Dex: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Update a single contact in Dex
 * Sends updated fields back to Dex API
 */
export const updateDexContact = action({
  args: {
    dexId: v.string(),
    updates: v.object({
      description: v.optional(v.string()),
      first_name: v.optional(v.string()),
      last_name: v.optional(v.string()),
      instagram: v.optional(v.string()),
      emails: v.optional(v.array(v.object({ email: v.string() }))),
      phones: v.optional(v.array(v.object({ phone: v.string() }))),
      birthday: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    try {
      if (!DEX_API_KEY) {
        throw new Error("DEX_API_KEY environment variable is not set");
      }

      console.log(`Updating contact ${args.dexId} in Dex...`);

      const response = await fetch(`${DEX_API_URL}/contacts`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-dex-api-key": DEX_API_KEY,
        },
        body: JSON.stringify({
          id: args.dexId,
          ...args.updates,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dex API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`Successfully updated contact ${args.dexId} in Dex`);
      
      return { success: true, data };
    } catch (error) {
      console.error(`Error updating Dex contact ${args.dexId}:`, error);
      // Return error info but don't throw - we want local changes to persist
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

