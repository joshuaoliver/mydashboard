import { components } from "./_generated/api";
import { CostComponent } from "neutral-cost";
import type { ActionCtx } from "./_generated/server";

/**
 * Neutral Cost Component for AI Usage Tracking
 *
 * Tracks costs for all AI features in the dashboard:
 * - Reply Suggestions
 * - Chat Agent
 * - Daily Summaries
 * - Voice Notes
 * - Thread Title Generation
 *
 * Pricing is fetched from models.dev API via updatePricingData action.
 */
export const costs = new CostComponent(components.neutralCost, {
  // No markup multipliers for personal dashboard - tracking actual costs only
  // Add providerMarkupMultiplier or modelMarkupMultiplier here if needed for billing
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a full model ID (provider/model-name) into separate providerId and modelId
 * Example: "google/gemini-3-flash" -> { providerId: "google", modelId: "gemini-3-flash" }
 */
export function parseModelId(fullModelId: string): {
  providerId: string;
  modelId: string;
} {
  const [providerId, ...rest] = fullModelId.split("/");
  return { providerId, modelId: rest.join("/") };
}

/**
 * AI Feature keys for categorizing costs
 */
export type AIFeatureKey =
  | "reply-suggestions"
  | "chat-agent"
  | "daily-summary"
  | "voice-notes"
  | "thread-title";

/**
 * Track AI cost for a feature
 *
 * @param ctx - Convex action context
 * @param args - Cost tracking parameters
 */
export async function trackAICost(
  ctx: ActionCtx,
  args: {
    featureKey: AIFeatureKey;
    fullModelId: string; // e.g., "google/gemini-3-flash"
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    threadId?: string; // Optional thread context (chatId, agentThreadId, etc.)
    messageId?: string; // Optional message context
    userId?: string; // Optional user ID for multi-tenant tracking
  }
): Promise<void> {
  try {
    const { providerId, modelId } = parseModelId(args.fullModelId);

    // Use feature key as threadId if no specific thread provided
    // This allows grouping costs by feature type
    const threadId = args.threadId ?? `feature:${args.featureKey}`;

    // Generate a unique messageId if not provided
    const messageId =
      args.messageId ?? `${args.featureKey}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    await costs.addAICost(ctx, {
      messageId,
      userId: args.userId,
      threadId,
      usage: args.usage,
      modelId,
      providerId,
    });

    console.log(
      `[costs] Tracked AI cost: feature=${args.featureKey}, model=${args.fullModelId}, ` +
        `tokens=${args.usage.totalTokens}, thread=${threadId}`
    );
  } catch (error) {
    // Cost tracking should never fail the main operation
    console.error(`[costs] Failed to track AI cost:`, error);
  }
}

// ============================================================================
// Client API Exports
// ============================================================================

/**
 * Export client API methods for querying costs from the frontend
 *
 * Usage in frontend:
 * ```tsx
 * import { useQuery, useAction } from "convex/react";
 * import { api } from "../convex/_generated/api";
 *
 * const allPricing = useQuery(api.costs.getAllPricing);
 * const syncPricing = useAction(api.costs.updatePricingData);
 * ```
 */
export const {
  // AI Cost Queries
  getAICostsByThread,
  getAICostsByUser,
  getTotalAICostsByUser,
  getTotalAICostsByThread,
  getAICostByMessageId,
  // Tool Cost Queries
  getToolCostsByThread,
  getToolCostsByUser,
  getTotalToolCostsByUser,
  getTotalToolCostsByThread,
  // Pricing Queries
  getAllPricing,
  getPricingByProvider,
  searchPricingByModelName,
  getAllToolPricing,
  getToolPricingByProvider,
  // Markup Queries
  getMarkupMultiplier,
  getMarkupMultiplierById,
  // Actions
  addAICost,
  addToolCost,
  updatePricingData,
} = costs.clientApi();
