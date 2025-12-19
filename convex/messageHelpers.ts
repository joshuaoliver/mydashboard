/**
 * Helper functions for processing Beeper messages
 */

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
          return typeof parsed.text === "string" ? parsed.text : String(parsed.text);
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
