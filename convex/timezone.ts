/**
 * Timezone utilities for Sydney, Australia
 * 
 * All date calculations should use these helpers to ensure
 * consistent timezone handling across the application.
 */

const SYDNEY_TIMEZONE = "Australia/Sydney";

/**
 * Get the current date in Sydney timezone as YYYY-MM-DD string
 */
export function getSydneyDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: SYDNEY_TIMEZONE });
}

/**
 * Get today's date in Sydney timezone as YYYY-MM-DD
 */
export function getTodaySydney(): string {
  return getSydneyDateString(new Date());
}

/**
 * Get yesterday's date in Sydney timezone as YYYY-MM-DD
 */
export function getYesterdaySydney(): string {
  const now = new Date();
  // Get current Sydney date, then subtract a day
  const sydneyNow = new Date(now.toLocaleString("en-US", { timeZone: SYDNEY_TIMEZONE }));
  sydneyNow.setDate(sydneyNow.getDate() - 1);
  return getSydneyDateString(sydneyNow);
}

/**
 * Get a date N days ago in Sydney timezone as YYYY-MM-DD
 */
export function getDaysAgoSydney(days: number): string {
  const now = new Date();
  const sydneyNow = new Date(now.toLocaleString("en-US", { timeZone: SYDNEY_TIMEZONE }));
  sydneyNow.setDate(sydneyNow.getDate() - days);
  return getSydneyDateString(sydneyNow);
}

/**
 * Format a timestamp for display in Sydney timezone
 * Returns a string like "19 Dec 2025, 2:45 pm"
 */
export function formatSydneyDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-AU", {
    timeZone: SYDNEY_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a timestamp for display in Sydney timezone (date only)
 * Returns a string like "19 Dec 2025"
 */
export function formatSydneyDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-AU", {
    timeZone: SYDNEY_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a YYYY-MM-DD date string for display
 * Returns a string like "19 Dec"
 */
export function formatDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}
