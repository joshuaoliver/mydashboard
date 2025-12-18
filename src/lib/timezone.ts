/**
 * Frontend timezone utilities for Sydney, Australia
 * 
 * All date displays should use these helpers to ensure
 * consistent timezone handling across the application.
 */

const SYDNEY_TIMEZONE = "Australia/Sydney";

/**
 * Format a timestamp for display in Sydney timezone
 * Returns a string like "19 Dec 2025, 2:45 pm"
 */
export function formatSydneyDateTime(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  return date.toLocaleString("en-AU", {
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
export function formatSydneyDate(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  return date.toLocaleString("en-AU", {
    timeZone: SYDNEY_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a timestamp for display in Sydney timezone (short)
 * Returns a string like "19 Dec, 2:45 pm"
 */
export function formatSydneyShort(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  return date.toLocaleString("en-AU", {
    timeZone: SYDNEY_TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
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

/**
 * Format a YYYY-MM-DD date string for display with year
 * Returns a string like "19 Dec 2025"
 */
export function formatDateStringFull(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Get the current Sydney time as a formatted string
 */
export function getSydneyNow(): string {
  return new Date().toLocaleString("en-AU", {
    timeZone: SYDNEY_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
