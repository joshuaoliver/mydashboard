import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Google Calendar Integration
 *
 * Provides read-only access to Google Calendar events to calculate free time blocks.
 * Uses OAuth2 for authentication.
 */

// ==========================================
// Settings Queries & Mutations
// ==========================================

/**
 * Get Google Calendar settings (public)
 */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("googleCalendarSettings").first();

    if (!settings) {
      return {
        isConfigured: false,
        calendarId: null,
        lastSyncedAt: null,
      };
    }

    return {
      isConfigured: settings.isConfigured,
      calendarId: settings.calendarId,
      lastSyncedAt: settings.lastSyncedAt,
    };
  },
});

/**
 * Get full settings (internal)
 */
export const getSettingsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("googleCalendarSettings").first();
  },
});

/**
 * Save OAuth tokens after successful authentication
 */
export const saveOAuthTokens = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresIn: v.number(),
    calendarId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const tokenExpiresAt = now + args.expiresIn * 1000;

    const existing = await ctx.db.query("googleCalendarSettings").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt,
        calendarId: args.calendarId ?? existing.calendarId,
        isConfigured: true,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("googleCalendarSettings", {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt,
      calendarId: args.calendarId ?? "primary",
      isConfigured: true,
    });

    return id;
  },
});

/**
 * Save OAuth tokens (internal - for HTTP callback)
 */
export const saveOAuthTokensInternal = internalMutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.number(),
    calendarId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const tokenExpiresAt = now + args.expiresIn * 1000;

    const existing = await ctx.db.query("googleCalendarSettings").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken ?? existing.refreshToken,
        tokenExpiresAt,
        calendarId: args.calendarId ?? existing.calendarId,
        isConfigured: true,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("googleCalendarSettings", {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken ?? "",
      tokenExpiresAt,
      calendarId: args.calendarId ?? "primary",
      isConfigured: true,
    });

    return id;
  },
});

/**
 * Update access token (internal - for token refresh)
 */
export const updateAccessToken = internalMutation({
  args: {
    accessToken: v.string(),
    expiresIn: v.number(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("googleCalendarSettings").first();
    if (!settings) throw new Error("Calendar not configured");

    await ctx.db.patch(settings._id, {
      accessToken: args.accessToken,
      tokenExpiresAt: Date.now() + args.expiresIn * 1000,
    });
  },
});

/**
 * Disconnect Google Calendar
 */
export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("googleCalendarSettings").first();
    if (settings) {
      await ctx.db.delete(settings._id);
    }

    // Also clear calendar events
    const events = await ctx.db.query("calendarEvents").collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    return { success: true };
  },
});

// ==========================================
// Calendar Event Queries
// ==========================================

/**
 * Get calendar events for a date range
 */
export const getEvents = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_start_time")
      .collect();

    return events.filter(
      (e) => e.startTime >= args.startTime && e.startTime <= args.endTime
    );
  },
});

/**
 * Get today's events
 */
export const getTodayEvents = query({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_start_time")
      .collect();

    return events
      .filter((e) => e.startTime >= startOfDay && e.startTime < endOfDay)
      .sort((a, b) => a.startTime - b.startTime);
  },
});

// ==========================================
// Sync Actions
// ==========================================

/**
 * Store calendar events (internal)
 */
export const storeEvents = internalMutation({
  args: {
    events: v.array(
      v.object({
        eventId: v.string(),
        summary: v.string(),
        description: v.optional(v.string()),
        startTime: v.number(),
        endTime: v.number(),
        duration: v.number(),
        isAllDay: v.boolean(),
        location: v.optional(v.string()),
        attendees: v.optional(v.array(v.string())),
        status: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const event of args.events) {
      // Check if event exists
      const existing = await ctx.db
        .query("calendarEvents")
        .withIndex("by_event_id", (q) => q.eq("eventId", event.eventId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...event,
          syncedAt: now,
        });
      } else {
        await ctx.db.insert("calendarEvents", {
          ...event,
          syncedAt: now,
        });
      }
    }

    // Update last synced timestamp
    const settings = await ctx.db.query("googleCalendarSettings").first();
    if (settings) {
      await ctx.db.patch(settings._id, {
        lastSyncedAt: now,
      });
    }
  },
});

/**
 * Sync calendar events from Google Calendar API
 * This is a placeholder - actual implementation requires Google API calls
 */
export const syncCalendarEvents = internalAction({
  args: {
    date: v.optional(v.string()), // YYYY-MM-DD, defaults to today
  },
  handler: async (ctx, args): Promise<{ success: boolean; count?: number; error?: string }> => {
    const settings = await ctx.runQuery(internal.googleCalendar.getSettingsInternal, {});

    if (!settings?.isConfigured || !settings?.accessToken) {
      return { success: false, error: "Calendar not configured" };
    }

    try {
      // Check if token needs refresh
      if (settings.tokenExpiresAt < Date.now()) {
        // Token refresh would happen here
        // For now, return error indicating re-auth needed
        return { success: false, error: "Token expired - please re-authenticate" };
      }

      // Get date range
      const targetDate = args.date ?? new Date().toISOString().split("T")[0];
      const [year, month, day] = targetDate.split("-").map(Number);

      const startOfDay = new Date(year, month - 1, day, 0, 0, 0).toISOString();
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59).toISOString();

      // Fetch events from Google Calendar API
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          settings.calendarId
        )}/events?` +
          new URLSearchParams({
            timeMin: startOfDay,
            timeMax: endOfDay,
            singleEvents: "true",
            orderBy: "startTime",
          }),
        {
          headers: {
            Authorization: `Bearer ${settings.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: "Token invalid - please re-authenticate" };
        }
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();

      // Transform events
      const events = (data.items || []).map((item: {
        id: string;
        summary?: string;
        description?: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        location?: string;
        attendees?: Array<{ email: string }>;
        status: string;
      }) => {
        const startTime = item.start.dateTime
          ? new Date(item.start.dateTime).getTime()
          : new Date(item.start.date!).getTime();
        const endTime = item.end.dateTime
          ? new Date(item.end.dateTime).getTime()
          : new Date(item.end.date!).getTime();

        return {
          eventId: item.id,
          summary: item.summary || "(No title)",
          description: item.description,
          startTime,
          endTime,
          duration: Math.round((endTime - startTime) / (1000 * 60)),
          isAllDay: !item.start.dateTime,
          location: item.location,
          attendees: item.attendees?.map((a) => a.email),
          status: item.status,
        };
      });

      // Store events
      await ctx.runMutation(internal.googleCalendar.storeEvents, { events });

      return { success: true, count: events.length };
    } catch (error) {
      console.error("Calendar sync error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Manual sync trigger (public)
 */
export const triggerSync = action({
  args: {
    date: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; count?: number; error?: string }> => {
    return await ctx.runAction(internal.googleCalendar.syncCalendarEvents, {
      date: args.date,
    });
  },
});

// ==========================================
// Demo/Development Helpers
// ==========================================

/**
 * Create sample calendar events for testing
 * This is useful when Google Calendar isn't configured
 */
export const createSampleEvents = mutation({
  args: {
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const targetDate = args.date ?? now.toISOString().split("T")[0];
    const [year, month, day] = targetDate.split("-").map(Number);

    // Sample events for the day
    const sampleEvents = [
      {
        summary: "Team standup",
        startHour: 9,
        startMinute: 0,
        durationMinutes: 30,
      },
      {
        summary: "Client call",
        startHour: 10,
        startMinute: 30,
        durationMinutes: 60,
      },
      {
        summary: "Lunch",
        startHour: 12,
        startMinute: 30,
        durationMinutes: 60,
      },
      {
        summary: "Design review",
        startHour: 14,
        startMinute: 0,
        durationMinutes: 45,
      },
      {
        summary: "1:1 with manager",
        startHour: 16,
        startMinute: 0,
        durationMinutes: 30,
      },
    ];

    const syncedAt = Date.now();

    for (const event of sampleEvents) {
      const startTime = new Date(
        year,
        month - 1,
        day,
        event.startHour,
        event.startMinute
      ).getTime();
      const endTime = startTime + event.durationMinutes * 60 * 1000;

      const eventId = `sample_${event.summary.replace(/\s+/g, "_").toLowerCase()}_${targetDate}`;

      // Check if already exists
      const existing = await ctx.db
        .query("calendarEvents")
        .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
        .first();

      if (!existing) {
        await ctx.db.insert("calendarEvents", {
          eventId,
          summary: event.summary,
          startTime,
          endTime,
          duration: event.durationMinutes,
          isAllDay: false,
          status: "confirmed",
          syncedAt,
        });
      }
    }

    return { created: sampleEvents.length };
  },
});
