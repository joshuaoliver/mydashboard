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

// ==========================================
// Calendar List Management
// ==========================================

/**
 * Get all available calendars (public)
 */
export const getCalendars = query({
  args: {},
  handler: async (ctx) => {
    const calendars = await ctx.db.query("googleCalendars").collect();
    return calendars.sort((a, b) => {
      // Primary calendar first, then by summary
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return a.summary.localeCompare(b.summary);
    });
  },
});

/**
 * Get enabled calendars (internal)
 */
export const getEnabledCalendarsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const calendars = await ctx.db
      .query("googleCalendars")
      .withIndex("by_enabled", (q) => q.eq("isEnabled", true))
      .collect();
    return calendars;
  },
});

/**
 * Toggle a calendar's enabled status
 */
export const toggleCalendar = mutation({
  args: {
    calendarId: v.string(),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const calendar = await ctx.db
      .query("googleCalendars")
      .withIndex("by_calendar_id", (q) => q.eq("calendarId", args.calendarId))
      .first();

    if (!calendar) {
      throw new Error("Calendar not found");
    }

    await ctx.db.patch(calendar._id, { isEnabled: args.isEnabled });
    
    // If disabling, optionally delete events from this calendar
    if (!args.isEnabled) {
      const events = await ctx.db
        .query("calendarEvents")
        .withIndex("by_calendar", (q) => q.eq("calendarId", args.calendarId))
        .collect();
      
      for (const event of events) {
        await ctx.db.delete(event._id);
      }
    }

    return { success: true };
  },
});

/**
 * Store calendars list (internal)
 */
export const storeCalendars = internalMutation({
  args: {
    calendars: v.array(
      v.object({
        calendarId: v.string(),
        summary: v.string(),
        description: v.optional(v.string()),
        backgroundColor: v.optional(v.string()),
        foregroundColor: v.optional(v.string()),
        accessRole: v.string(),
        primary: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const calendar of args.calendars) {
      const existing = await ctx.db
        .query("googleCalendars")
        .withIndex("by_calendar_id", (q) => q.eq("calendarId", calendar.calendarId))
        .first();

      if (existing) {
        // Update but preserve isEnabled setting
        await ctx.db.patch(existing._id, {
          ...calendar,
          lastFetchedAt: now,
        });
      } else {
        // New calendar - enable primary by default, others disabled
        await ctx.db.insert("googleCalendars", {
          ...calendar,
          isEnabled: calendar.primary ?? false,
          lastFetchedAt: now,
        });
      }
    }
  },
});

/**
 * Fetch available calendars from Google Calendar API
 */
export const fetchCalendars = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; count?: number; error?: string }> => {
    const settings = await ctx.runQuery(internal.googleCalendar.getSettingsInternal, {});

    if (!settings?.isConfigured || !settings?.accessToken) {
      return { success: false, error: "Calendar not configured" };
    }

    try {
      if (settings.tokenExpiresAt < Date.now()) {
        return { success: false, error: "Token expired - please re-authenticate" };
      }

      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
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

      const calendars = (data.items || []).map((item: {
        id: string;
        summary: string;
        description?: string;
        backgroundColor?: string;
        foregroundColor?: string;
        accessRole: string;
        primary?: boolean;
      }) => ({
        calendarId: item.id,
        summary: item.summary,
        description: item.description,
        backgroundColor: item.backgroundColor,
        foregroundColor: item.foregroundColor,
        accessRole: item.accessRole,
        primary: item.primary,
      }));

      await ctx.runMutation(internal.googleCalendar.storeCalendars, { calendars });

      return { success: true, count: calendars.length };
    } catch (error) {
      console.error("Fetch calendars error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Refresh calendar list (public trigger)
 */
export const refreshCalendarList = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; count?: number; error?: string }> => {
    return await ctx.runAction(internal.googleCalendar.fetchCalendars, {});
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

    // Clear calendar events
    const events = await ctx.db.query("calendarEvents").collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    // Clear cached calendar list
    const calendars = await ctx.db.query("googleCalendars").collect();
    for (const calendar of calendars) {
      await ctx.db.delete(calendar._id);
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
 * Now includes deletion of events that are no longer in the sync response
 */
export const storeEvents = internalMutation({
  args: {
    events: v.array(
      v.object({
        eventId: v.string(),
        calendarId: v.optional(v.string()),
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
    // For deletion: specify the date range and calendar being synced
    syncContext: v.optional(v.object({
      calendarId: v.string(),
      startTime: v.number(),  // Start of sync range
      endTime: v.number(),    // End of sync range
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const syncedEventIds = new Set(args.events.map(e => e.eventId));

    // Upsert all events from the sync
    for (const event of args.events) {
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

    // Delete events that are no longer in Google Calendar for this date range
    if (args.syncContext) {
      const { calendarId, startTime, endTime } = args.syncContext;
      
      // Get all events in this date range for this calendar
      const existingEvents = await ctx.db
        .query("calendarEvents")
        .withIndex("by_start_time")
        .collect();
      
      // Filter to events in the sync range that belong to this calendar
      const eventsInRange = existingEvents.filter(e => 
        e.startTime >= startTime && 
        e.startTime < endTime &&
        (e.calendarId === calendarId || (!e.calendarId && calendarId === "primary"))
      );
      
      // Delete events not in the sync response
      let deletedCount = 0;
      for (const event of eventsInRange) {
        if (!syncedEventIds.has(event.eventId)) {
          await ctx.db.delete(event._id);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`[Calendar Sync] Deleted ${deletedCount} removed events from ${calendarId}`);
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
 * Fetches events from all enabled calendars and removes deleted events
 */
export const syncCalendarEvents = internalAction({
  args: {
    date: v.optional(v.string()), // YYYY-MM-DD, defaults to today
  },
  handler: async (ctx, args): Promise<{ success: boolean; count?: number; error?: string; deletedCount?: number }> => {
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

      const startOfDayDate = new Date(year, month - 1, day, 0, 0, 0);
      const endOfDayDate = new Date(year, month - 1, day, 23, 59, 59);
      const startOfDay = startOfDayDate.toISOString();
      const endOfDay = endOfDayDate.toISOString();
      const startTime = startOfDayDate.getTime();
      const endTime = endOfDayDate.getTime();

      // Get enabled calendars (or fall back to primary/settings calendar)
      const enabledCalendars = await ctx.runQuery(internal.googleCalendar.getEnabledCalendarsInternal, {});
      
      // If no calendars are configured, use the legacy calendarId
      const calendarsToSync = enabledCalendars.length > 0 
        ? enabledCalendars.map(c => c.calendarId)
        : [settings.calendarId];

      let totalCount = 0;
      const allEvents: Array<{
        eventId: string;
        calendarId: string;
        summary: string;
        description?: string;
        startTime: number;
        endTime: number;
        duration: number;
        isAllDay: boolean;
        location?: string;
        attendees?: string[];
        status: string;
      }> = [];

      // Sync from each enabled calendar
      for (const calendarId of calendarsToSync) {
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            calendarId
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
          console.error(`[Calendar Sync] Error fetching ${calendarId}: ${response.status}`);
          continue; // Skip this calendar but continue with others
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
          const eventStartTime = item.start.dateTime
            ? new Date(item.start.dateTime).getTime()
            : new Date(item.start.date!).getTime();
          const eventEndTime = item.end.dateTime
            ? new Date(item.end.dateTime).getTime()
            : new Date(item.end.date!).getTime();

          return {
            eventId: item.id,
            calendarId,
            summary: item.summary || "(No title)",
            description: item.description,
            startTime: eventStartTime,
            endTime: eventEndTime,
            duration: Math.round((eventEndTime - eventStartTime) / (1000 * 60)),
            isAllDay: !item.start.dateTime,
            location: item.location,
            attendees: item.attendees?.map((a) => a.email),
            status: item.status,
          };
        });

        allEvents.push(...events);
        totalCount += events.length;

        // Store events for this calendar with sync context for deletion
        await ctx.runMutation(internal.googleCalendar.storeEvents, { 
          events,
          syncContext: {
            calendarId,
            startTime,
            endTime,
          },
        });
      }

      return { success: true, count: totalCount };
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
