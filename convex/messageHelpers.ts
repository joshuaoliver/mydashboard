/**
 * Helper functions for processing Beeper messages and phone number normalization
 */

/**
 * Normalize phone number for consistent matching
 * 
 * Handles various formats and converts to a consistent digits-only format:
 * - +61 411 785 274 -> 61411785274
 * - 0411 785 274 -> 61411785274 (Australian local to international)
 * - (04) 1178-5274 -> 61411785274
 * - 417248743 -> 61417248743 (9-digit Australian mobile)
 * - 61411785274 -> 61411785274
 * 
 * @param phone - The phone number in any format
 * @returns Normalized phone number (digits only, Australian numbers converted to international)
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters (including + prefix)
  let digits = phone.replace(/\D/g, '');
  
  // Handle Australian mobile: 10 digits starting with 0 (e.g., 0411785274)
  // Convert to international: 61411785274
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '61' + digits.slice(1);
  }
  // Handle Australian mobile: 9 digits starting with 4 (e.g., 411785274 or 417248743)
  // This can happen when the + is stripped from +61417248743 stored as 417248743
  // Convert to international: 61411785274
  else if (digits.length === 9 && digits.startsWith('4')) {
    digits = '61' + digits;
  }
  // Handle Australian landline: 9 digits starting with area code (2, 3, 7, 8)
  else if (digits.length === 9 && ['2', '3', '7', '8'].includes(digits[0])) {
    digits = '61' + digits;
  }
  // Handle Australian landline: 10 digits starting with 0 + area code
  else if (digits.length === 10 && digits.startsWith('0') && ['2', '3', '7', '8'].includes(digits[1])) {
    digits = '61' + digits.slice(1);
  }
  
  return digits;
}

/**
 * Extracts the plain text from a message text field.
 * 
 * The Beeper API can return text in two formats:
 * 1. Plain string: "Hello world"
 * 2. JSON object (for iMessage threads): {"text":"Hello world","textEntities":[...]}
 * 
 * This function handles both cases and always returns a plain string.
 * 
 * @param text - The text field from the Beeper API message
 * @returns The plain text string
 */
export function extractMessageText(text: unknown): string {
  // Handle null/undefined
  if (text == null) {
    return "";
  }

  // If it's already a string, check if it's JSON
  if (typeof text === "string") {
    // Empty string
    if (!text.trim()) {
      return "";
    }

    // Check if it looks like JSON (starts with { and ends with })
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        // If it has a text property, use that
        if (typeof parsed === "object" && parsed !== null && "text" in parsed) {
          return typeof parsed.text === "string" ? parsed.text : String(parsed.text ?? "");
        }
        // Otherwise return the original string (it was valid JSON but not our format)
        return text;
      } catch {
        // Not valid JSON, return as-is
        return text;
      }
    }

    // Regular string, return as-is
    return text;
  }

  // If it's an object with a text property (API might pass it already parsed)
  if (typeof text === "object" && text !== null && "text" in text) {
    const textValue = (text as Record<string, unknown>).text;
    return typeof textValue === "string" ? textValue : String(textValue ?? "");
  }

  // Fallback: convert to string
  return String(text);
}

/**
 * Compares two Beeper sortKeys (numeric or alphanumeric).
 * 
 * Beeper sortKeys can be:
 * 1. Sequential integers as strings (e.g., "368278")
 * 2. Millisecond timestamps as strings (e.g., "1766105279134")
 * 3. Alphanumeric strings (e.g., "aaaa1")
 * 
 * This function uses numeric comparison if both are numeric (to handle different 
 * lengths correctly), and falls back to lexicographic (localeCompare) otherwise.
 * 
 * @param a - First sortKey
 * @param b - Second sortKey
 * @returns -1 if a < b, 1 if a > b, 0 if equal
 */
export function compareSortKeys(a: string, b: string): number {
  const aNum = Number(a);
  const bNum = Number(b);
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return aNum - bNum; // Numeric comparison
  }
  return a.localeCompare(b); // Lexicographic fallback
}
