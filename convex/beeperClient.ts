import BeeperDesktop from '@beeper/desktop-api';

// Beeper API configuration
const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

/**
 * Initialize Beeper SDK client (v4.2.2+)
 * Configured for your custom endpoint server
 * 
 * Features:
 * - Auto-retry on connection errors, timeouts, and rate limits
 * - Debug logging in development mode
 * - Proper error types for better error handling
 * 
 * Shared across all Beeper-related actions to avoid duplication.
 */
export function createBeeperClient() {
  if (!BEEPER_TOKEN) {
    throw new Error("BEEPER_TOKEN environment variable is not set");
  }

  return new BeeperDesktop({
    accessToken: BEEPER_TOKEN,
    baseURL: BEEPER_API_URL,
    maxRetries: 2, // Retry on 408, 429, 5xx errors
    timeout: 15000, // 15 seconds
    logLevel: process.env.BEEPER_LOG_LEVEL as any || 'warn', // 'debug', 'info', 'warn', 'error', 'off'
  });
}

