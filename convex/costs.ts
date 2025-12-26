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
  | "voice-transcription"
  | "thread-title";

/**
 * Default user ID for single-user dashboard
 * Used to group all costs under a consistent user for querying
 */
export const DASHBOARD_USER_ID = "dashboard-user";

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
    userId?: string; // Optional user ID for multi-tenant tracking (defaults to DASHBOARD_USER_ID)
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

    // Always use DASHBOARD_USER_ID for single-user dashboard unless explicitly provided
    const userId = args.userId ?? DASHBOARD_USER_ID;

    await costs.addAICost(ctx, {
      messageId,
      userId,
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

/**
 * Track transcription cost for voice notes
 * OpenAI Whisper is priced at $0.006 per minute of audio
 *
 * @param ctx - Convex action context
 * @param args - Transcription tracking parameters
 */
export async function trackTranscriptionCost(
  ctx: ActionCtx,
  args: {
    durationSeconds: number;
    threadId?: string;
    messageId?: string;
    userId?: string;
  }
): Promise<void> {
  try {
    // Whisper pricing: $0.006 per minute = $0.0001 per second
    // We'll approximate this as "tokens" for the neutral-cost component
    // 1 second ≈ 1 "token" for tracking purposes, with cost calculated separately
    const durationMinutes = args.durationSeconds / 60;
    const estimatedCost = durationMinutes * 0.006;

    // Generate a unique messageId if not provided
    const messageId =
      args.messageId ??
      `voice-transcription-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Always use DASHBOARD_USER_ID for single-user dashboard unless explicitly provided
    const userId = args.userId ?? DASHBOARD_USER_ID;

    const threadId = args.threadId ?? "feature:voice-transcription";

    // Track as AI cost using pseudo-tokens based on duration
    // Using totalTokens = seconds to give a sense of scale
    await costs.addAICost(ctx, {
      messageId,
      userId,
      threadId,
      usage: {
        promptTokens: Math.round(args.durationSeconds),
        completionTokens: 0,
        totalTokens: Math.round(args.durationSeconds),
      },
      modelId: "whisper-1",
      providerId: "openai",
    });

    console.log(
      `[costs] Tracked transcription cost: duration=${args.durationSeconds}s, ` +
        `estimatedCost=$${estimatedCost.toFixed(4)}, thread=${threadId}`
    );
  } catch (error) {
    // Cost tracking should never fail the main operation
    console.error(`[costs] Failed to track transcription cost:`, error);
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
