import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Find potential duplicate contacts
 * Returns contacts that might be the same person based on:
 * - Same Instagram username (in current or socialHandles)
 * - Same WhatsApp number (in current or phones/socialHandles)
 * - Similar name with one matching handle
 */
export const findDuplicates = query({
  args: {
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      return [];
    }

    const duplicates: Array<{
      contactId: string;
      contact: any;
      matchReason: string;
      confidence: "high" | "medium" | "low";
    }> = [];

    const normalizePhone = (phone: string) => phone.replace(/[\s\-\(\)]/g, '');
    const normalizeName = (name: string) => name.toLowerCase().trim();

    // Get all other contacts (excluding this one and any already merged)
    const allContacts = await ctx.db
      .query("contacts")
      .filter((q) => q.neq(q.field("_id"), args.contactId))
      .collect();

    const contactFullName = normalizeName(
      [contact.firstName, contact.lastName].filter(Boolean).join(" ")
    );

    for (const other of allContacts) {
      // Skip if this contact was already merged into the current one
      if (contact.mergedFrom?.includes(other._id)) {
        continue;
      }
      // Skip if the other contact was merged into this one
      if (other.mergedFrom?.includes(args.contactId)) {
        continue;
      }

      let matchReason = "";
      let confidence: "high" | "medium" | "low" = "low";

      // HIGH CONFIDENCE: Same Instagram username
      if (contact.instagram && other.instagram === contact.instagram) {
        matchReason = `Same Instagram: @${contact.instagram}`;
        confidence = "high";
      }

      // HIGH CONFIDENCE: Same WhatsApp number
      else if (contact.whatsapp && other.whatsapp === contact.whatsapp) {
        matchReason = `Same WhatsApp: ${contact.whatsapp}`;
        confidence = "high";
      }

      // HIGH CONFIDENCE: Instagram in socialHandles matches
      else if (contact.instagram && other.socialHandles) {
        const handleMatch = other.socialHandles.find(
          (h) => h.platform === "instagram" && h.handle === contact.instagram
        );
        if (handleMatch) {
          matchReason = `Instagram @${contact.instagram} in old handles`;
          confidence = "high";
        }
      }

      // HIGH CONFIDENCE: WhatsApp in socialHandles matches
      else if (contact.whatsapp && other.socialHandles) {
        const handleMatch = other.socialHandles.find(
          (h) => h.platform === "whatsapp" && normalizePhone(h.handle) === normalizePhone(contact.whatsapp!)
        );
        if (handleMatch) {
          matchReason = `WhatsApp ${contact.whatsapp} in old handles`;
          confidence = "high";
        }
      }

      // MEDIUM CONFIDENCE: Phone number in phones array matches
      else if (contact.phones && other.phones) {
        const contactPhones = new Set(contact.phones.map((p) => normalizePhone(p.phone)));
        const matchingPhone = other.phones.find((p) => contactPhones.has(normalizePhone(p.phone)));
        if (matchingPhone) {
          matchReason = `Matching phone: ${matchingPhone.phone}`;
          confidence = "medium";
        }
      }

      // MEDIUM CONFIDENCE: Similar name + one social handle matches
      else if (contactFullName) {
        const otherFullName = normalizeName(
          [other.firstName, other.lastName].filter(Boolean).join(" ")
        );
        
        // Names are similar (fuzzy match)
        const namesSimilar = contactFullName.includes(otherFullName) || 
                             otherFullName.includes(contactFullName) ||
                             contactFullName === otherFullName;

        if (namesSimilar) {
          // Check if any handle matches
          const instagramMatches = contact.instagram && other.instagram === contact.instagram;
          const whatsappMatches = contact.whatsapp && other.whatsapp === contact.whatsapp;
          
          if (instagramMatches || whatsappMatches) {
            matchReason = `Similar name + matching handle`;
            confidence = "medium";
          }
        }
      }

      // Add to duplicates if any match found
      if (matchReason) {
        duplicates.push({
          contactId: other._id,
          contact: other,
          matchReason,
          confidence,
        });
      }
    }

    // Sort by confidence (high first)
    duplicates.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    });

    return duplicates;
  },
});

/**
 * Get all contacts that might be duplicates across the entire database
 * Useful for bulk cleanup
 */
export const findAllDuplicates = query({
  args: {},
  handler: async (ctx) => {
    const allContacts = await ctx.db.query("contacts").collect();
    const duplicateGroups: Array<{
      contacts: any[];
      matchReason: string;
    }> = [];

    const normalizePhone = (phone: string) => phone.replace(/[\s\-\(\)]/g, '');
    const processed = new Set<string>();

    // Group by Instagram username
    const instagramGroups = new Map<string, any[]>();
    for (const contact of allContacts) {
      if (contact.instagram) {
        const group = instagramGroups.get(contact.instagram) || [];
        group.push(contact);
        instagramGroups.set(contact.instagram, group);
      }
    }

    for (const [instagram, contacts] of instagramGroups) {
      if (contacts.length > 1) {
        duplicateGroups.push({
          contacts,
          matchReason: `Same Instagram: @${instagram}`,
        });
        contacts.forEach((c) => processed.add(c._id));
      }
    }

    // Group by WhatsApp number
    const whatsappGroups = new Map<string, any[]>();
    for (const contact of allContacts) {
      if (contact.whatsapp && !processed.has(contact._id)) {
        const normalized = normalizePhone(contact.whatsapp);
        const group = whatsappGroups.get(normalized) || [];
        group.push(contact);
        whatsappGroups.set(normalized, group);
      }
    }

    for (const [whatsapp, contacts] of whatsappGroups) {
      if (contacts.length > 1) {
        duplicateGroups.push({
          contacts,
          matchReason: `Same WhatsApp: ${whatsapp}`,
        });
      }
    }

    return {
      totalGroups: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.contacts.length, 0),
      groups: duplicateGroups,
    };
  },
});

