import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { trackAICost } from "./costs";

/**
 * Daily Summary Generator
 *
 * Creates end-of-day narrative reports using AI.
 * Runs as a scheduled job (3am local) or on-demand.
 */

// ==========================================
// Helper Functions
// ==========================================

function getYesterdayDate(): string {
  const now = new Date();
  const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
  sydneyTime.setDate(sydneyTime.getDate() - 1);
  return sydneyTime.toISOString().split('T')[0];
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ==========================================
// Queries
// ==========================================

/**
 * Get daily summary by date
 */
export const getSummary = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dailySummaries")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
  },
});

/**
 * Get recent summaries
 */
export const getRecentSummaries = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 7;
    const summaries = await ctx.db
      .query("dailySummaries")
      .collect();

    return summaries
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  },
});

// ==========================================
// Summary Generation
// ==========================================

/**
 * Gather all data needed for summary
 */
export const gatherSummaryData = internalQuery({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    // Get plan
    const plan = await ctx.db
      .query("todayPlans")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    // Get context
    const context = await ctx.db
      .query("dailyContext")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    // Get momentum
    const momentum = await ctx.db
      .query("dailyMomentum")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    // Get sessions for detailed analysis
    const allSessions = await ctx.db.query("timerSessions").collect();
    const daySessions = allSessions.filter(s => {
      const sessionDate = new Date(s.startedAt).toISOString().split('T')[0];
      return sessionDate === args.date;
    });

    // Calculate detailed stats
    const sessionDetails = daySessions.map(s => ({
      taskTitle: s.taskTitle,
      taskType: s.taskType,
      mode: s.mode,
      targetDuration: s.targetDuration,
      actualDuration: s.endedAt ? Math.round((s.endedAt - s.startedAt - s.totalPausedSeconds * 1000) / 60000) : null,
      result: s.result,
      startedAt: new Date(s.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      note: s.resultNote,
    }));

    // Group by task type
    const byType = {
      linear: sessionDetails.filter(s => s.taskType === "linear"),
      todo: sessionDetails.filter(s => s.taskType === "todo"),
      email: sessionDetails.filter(s => s.taskType === "email"),
      adhoc: sessionDetails.filter(s => s.taskType === "adhoc"),
    };

    // Time distribution
    const morningWork = sessionDetails.filter(s => {
      const hour = parseInt(s.startedAt.split(':')[0]);
      return hour < 12;
    });
    const afternoonWork = sessionDetails.filter(s => {
      const hour = parseInt(s.startedAt.split(':')[0]);
      return hour >= 12;
    });

    // Get message snapshots for the day to track messages sent
    const dateStart = new Date(args.date + 'T00:00:00').getTime();
    const dateEnd = new Date(args.date + 'T23:59:59').getTime();

    const allSnapshots = await ctx.db.query("messageSnapshots").collect();
    const daySnapshots = allSnapshots.filter(s =>
      s.timestamp >= dateStart && s.timestamp <= dateEnd
    );
    const messagesSent = daySnapshots.reduce(
      (sum, s) => sum + (s.messagesSentSinceLastSnapshot ?? 0),
      0
    );

    // Get calendar events for the day
    const calendarEvents = await ctx.db
      .query("calendarEvents")
      .withIndex("by_start_time")
      .collect();
    const dayEvents = calendarEvents.filter(e =>
      e.startTime >= dateStart && e.startTime <= dateEnd
    );

    // Get todos completed today
    const completedTodos = await ctx.db
      .query("completedTodos")
      .collect();
    const todosCompletedToday = completedTodos.filter(t =>
      t.completedAt >= dateStart && t.completedAt <= dateEnd
    );

    // Get Hubstaff time entries for the day
    const hubstaffEntries = await ctx.db
      .query("hubstaffTimeEntries")
      .collect();
    const dayHubstaff = hubstaffEntries.filter(entry => entry.date === args.date);
    const hubstaffMinutes = dayHubstaff.reduce(
      (sum, entry) => sum + (entry.trackedSeconds ?? 0) / 60, // trackedSeconds is in seconds
      0
    );
    const hubstaffProjects = [...new Set(dayHubstaff.map(e => e.hubstaffProjectName).filter(Boolean))];

    return {
      date: args.date,
      formattedDate: formatDateForDisplay(args.date),
      context: context ? {
        morningContext: context.morningContext,
        notes: context.contextNotes,
        inferredEnergy: context.inferredEnergy,
        inferredFocus: context.inferredFocus,
      } : null,
      momentum: momentum ? {
        blocksStarted: momentum.blocksStarted,
        blocksCompleted: momentum.blocksCompleted,
        blocksPartial: momentum.blocksPartial,
        blocksSkipped: momentum.blocksSkipped,
        frogAttempts: momentum.frogAttempts,
        frogCompletions: momentum.frogCompletions,
        totalMinutesWorked: momentum.totalMinutesWorked,
        taskTypeBreakdown: momentum.taskTypeBreakdown,
      } : null,
      sessions: {
        total: sessionDetails.length,
        details: sessionDetails,
        byType,
        morningCount: morningWork.length,
        afternoonCount: afternoonWork.length,
      },
      communication: {
        messagesSent,
      },
      calendar: {
        eventsCount: dayEvents.length,
        eventTitles: dayEvents.map(e => e.summary),
      },
      todos: {
        completedCount: todosCompletedToday.length,
        completedTitles: todosCompletedToday.map(t => t.text).slice(0, 10), // Limit for prompt
      },
      hubstaff: {
        trackedMinutes: Math.round(hubstaffMinutes),
        projects: hubstaffProjects,
        entriesCount: dayHubstaff.length,
      },
      planId: plan?._id,
    };
  },
});

/**
 * Generate daily summary using AI
 */
export const generateSummary = internalAction({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    // Gather data
    const data = await ctx.runQuery(internal.dailySummary.gatherSummaryData, { date: args.date });

    if (!data.momentum || data.sessions.total === 0) {
      // No activity to summarize
      const emptyHtml = generateEmptyDayHtml(data.formattedDate);
      await ctx.runMutation(internal.dailySummary.storeSummary, {
        date: args.date,
        htmlContent: emptyHtml,
        summaryText: "No focused work sessions recorded for this day.",
        oneLiner: "A quiet day - rest is part of the journey.",
        modelUsed: "none",
        sections: {
          overview: "No activity recorded",
          workedOn: "",
          momentum: "",
          patterns: "",
          reflection: "A quiet day - rest is part of the journey.",
        },
        planId: data.planId,
      });
      return { success: true, empty: true };
    }

    // Get AI setting for summary generation
    const aiSetting = await ctx.runQuery(internal.aiSettings.getSettingInternal, {
      key: "daily-summary",
    });

    const modelId = aiSetting?.modelId ?? "anthropic/claude-sonnet-4.5";

    // Build prompt
    const prompt = buildSummaryPrompt(data);

    // Call AI to generate summary
    const { generateText } = await import("ai");
    const { createGateway } = await import("@ai-sdk/gateway");

    const gateway = createGateway({
      baseURL: process.env.AI_GATEWAY_URL || "https://gateway.ai.cloudflare.com/v1",
      headers: {
        "cf-aig-authorization": `Bearer ${process.env.CLOUDFLARE_AI_GATEWAY_TOKEN}`,
      },
    });

    const result = await generateText({
      model: gateway(modelId),
      prompt,
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    // Track AI cost
    if (result.usage) {
      const usage = result.usage as { promptTokens?: number; completionTokens?: number };
      await trackAICost(ctx, {
        featureKey: "daily-summary",
        fullModelId: modelId,
        usage: {
          promptTokens: usage.promptTokens ?? 0,
          completionTokens: usage.completionTokens ?? 0,
          totalTokens: (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
        },
        threadId: `daily-summary:${args.date}`,
      });
    }

    // Parse AI response
    const sections = parseSummaryResponse(result.text);

    // Generate HTML
    const htmlContent = generateSummaryHtml(data, sections);

    // Store summary
    await ctx.runMutation(internal.dailySummary.storeSummary, {
      date: args.date,
      htmlContent,
      summaryText: sections.overview,
      oneLiner: sections.reflection,
      modelUsed: modelId,
      sections,
      planId: data.planId,
      momentumId: data.momentum ? undefined : undefined, // Would need to pass ID
      contextId: data.context ? undefined : undefined,
    });

    return { success: true, sections };
  },
});

/**
 * Store generated summary
 */
export const storeSummary = internalMutation({
  args: {
    date: v.string(),
    htmlContent: v.string(),
    summaryText: v.string(),
    oneLiner: v.string(),
    modelUsed: v.string(),
    sections: v.object({
      overview: v.string(),
      workedOn: v.string(),
      momentum: v.string(),
      patterns: v.string(),
      reflection: v.string(),
    }),
    planId: v.optional(v.id("todayPlans")),
    momentumId: v.optional(v.id("dailyMomentum")),
    contextId: v.optional(v.id("dailyContext")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailySummaries")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    const data = {
      date: args.date,
      planId: args.planId,
      momentumId: args.momentumId,
      contextId: args.contextId,
      htmlContent: args.htmlContent,
      summaryText: args.summaryText,
      oneLiner: args.oneLiner,
      modelUsed: args.modelUsed,
      generatedAt: Date.now(),
      sections: args.sections,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("dailySummaries", data);
  },
});

/**
 * Trigger summary generation (manual or scheduled)
 */
export const triggerSummaryGeneration = action({
  args: {
    date: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; sections?: any; empty?: boolean }> => {
    const date = args.date ?? getYesterdayDate();
    return await ctx.runAction(internal.dailySummary.generateSummary, { date });
  },
});

// ==========================================
// Scheduled Job (3am daily)
// ==========================================

/**
 * Scheduled action to generate yesterday's summary
 * Should be called by cron at 3am local time
 */
export const scheduledSummaryGeneration = internalAction({
  args: {},
  handler: async (ctx): Promise<{ skipped?: boolean; success?: boolean; date: string; result?: any }> => {
    const yesterday = getYesterdayDate();

    // Check if summary already exists
    const existing = await ctx.runQuery(internal.dailySummary.getSummaryInternal, { date: yesterday });
    if (existing) {
      console.log(`Summary for ${yesterday} already exists, skipping`);
      return { skipped: true, date: yesterday };
    }

    // Also compute momentum first
    await ctx.runMutation(internal.operatorAI.computeDailyMomentum, { date: yesterday });

    // Generate summary
    const summaryResult = await ctx.runAction(internal.dailySummary.generateSummary, { date: yesterday });

    console.log(`Generated summary for ${yesterday}`);
    return { success: true, date: yesterday, result: summaryResult };
  },
});

export const getSummaryInternal = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dailySummaries")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
  },
});

// ==========================================
// Prompt Building
// ==========================================

interface SummaryData {
  date: string;
  formattedDate: string;
  context: {
    morningContext?: string;
    notes: Array<{ text: string; timestamp: number }>;
    inferredEnergy?: string;
    inferredFocus?: string;
  } | null;
  momentum: {
    blocksStarted: number;
    blocksCompleted: number;
    blocksPartial: number;
    blocksSkipped: number;
    frogAttempts: number;
    frogCompletions: number;
    totalMinutesWorked: number;
    taskTypeBreakdown: { todo: number; linear: number; email: number; adhoc: number };
  } | null;
  sessions: {
    total: number;
    details: Array<{
      taskTitle: string;
      taskType: string;
      mode: string;
      targetDuration: number;
      actualDuration: number | null;
      result?: string;
      startedAt: string;
      note?: string;
    }>;
    byType: Record<string, unknown[]>;
    morningCount: number;
    afternoonCount: number;
  };
  communication: {
    messagesSent: number;
  };
  calendar: {
    eventsCount: number;
    eventTitles: string[];
  };
  todos: {
    completedCount: number;
    completedTitles: string[];
  };
}

function buildSummaryPrompt(data: SummaryData): string {
  const contextSection = data.context
    ? `
ENERGY CONTEXT:
${data.context.morningContext ? `Morning note: "${data.context.morningContext}"` : "No morning context set"}
${data.context.notes.length > 0 ? `Additional notes during day:\n${data.context.notes.map(n => `- "${n.text}"`).join('\n')}` : ""}
${data.context.inferredEnergy ? `Inferred energy: ${data.context.inferredEnergy}` : ""}
${data.context.inferredFocus ? `Inferred focus: ${data.context.inferredFocus}` : ""}
`
    : "No energy context recorded for this day.";

  const momentumSection = data.momentum
    ? `
MOMENTUM STATS:
- Blocks started: ${data.momentum.blocksStarted}
- Blocks completed: ${data.momentum.blocksCompleted}
- Blocks partial: ${data.momentum.blocksPartial}
- Blocks skipped: ${data.momentum.blocksSkipped}
- Total minutes worked: ${data.momentum.totalMinutesWorked}
- Frog attempts: ${data.momentum.frogAttempts}
- Frog completions: ${data.momentum.frogCompletions}
- Task breakdown: Linear=${data.momentum.taskTypeBreakdown.linear}, Todos=${data.momentum.taskTypeBreakdown.todo}, Email=${data.momentum.taskTypeBreakdown.email}, Life=${data.momentum.taskTypeBreakdown.adhoc}
`
    : "No momentum data available.";

  const sessionsSection = data.sessions.total > 0
    ? `
WORK SESSIONS (${data.sessions.total} total):
${data.sessions.details.map(s => `- ${s.startedAt}: "${s.taskTitle}" (${s.taskType}, ${s.mode === 'frog' ? '🐸 FROG' : 'normal'}) - ${s.actualDuration ?? s.targetDuration}min - ${s.result || 'unknown'}${s.note ? ` - "${s.note}"` : ""}`).join('\n')}

TIME DISTRIBUTION:
- Morning sessions: ${data.sessions.morningCount}
- Afternoon sessions: ${data.sessions.afternoonCount}
`
    : "No work sessions recorded.";

  const communicationSection = data.communication.messagesSent > 0
    ? `
COMMUNICATION:
- Messages sent: ${data.communication.messagesSent}
`
    : "";

  const calendarSection = data.calendar.eventsCount > 0
    ? `
CALENDAR EVENTS (${data.calendar.eventsCount} total):
${data.calendar.eventTitles.slice(0, 5).map(t => `- ${t}`).join('\n')}${data.calendar.eventsCount > 5 ? `\n- ... and ${data.calendar.eventsCount - 5} more` : ''}
`
    : "";

  const todosSection = data.todos.completedCount > 0
    ? `
TODOS COMPLETED (${data.todos.completedCount} total):
${data.todos.completedTitles.map(t => `- ${t}`).join('\n')}
`
    : "";

  return `You are generating a daily reflection summary for a personal productivity system. The tone should be supportive, neutral, and focused on patterns rather than judgment.

DATE: ${data.formattedDate}

${contextSection}

${momentumSection}

${sessionsSection}
${communicationSection}
${calendarSection}
${todosSection}

Generate a daily summary with these exact sections (use the headers exactly as shown):

OVERVIEW:
[1-2 sentences describing the overall day - what the main focus was, general energy/productivity]

WORKED ON:
[Bullet list of what was accomplished, grouped by type if helpful. Keep it factual.]

MOMENTUM:
[Note the key stats: blocks started vs completed, frog attempts, time worked. Frame positively - "You showed up for X blocks" rather than "You only did X"]

PATTERNS:
[1-2 observations about when work happened, what worked well, any notable patterns. Be insightful but not preachy.]

REFLECTION:
[One sentence that captures the day's essence in a supportive way. This should feel encouraging regardless of productivity level. Examples:
- "Despite low energy, you showed up consistently and protected focus."
- "A day of steady progress across multiple fronts."
- "You tackled the hard things early when energy was high."
- "A quieter day - rest is part of sustainable momentum."]

Keep the entire response under 400 words. Be concise but insightful.`;
}

function parseSummaryResponse(text: string): {
  overview: string;
  workedOn: string;
  momentum: string;
  patterns: string;
  reflection: string;
} {
  const sections: Record<string, string> = {
    overview: "",
    workedOn: "",
    momentum: "",
    patterns: "",
    reflection: "",
  };

  const sectionMap: Record<string, string> = {
    "OVERVIEW": "overview",
    "WORKED ON": "workedOn",
    "MOMENTUM": "momentum",
    "PATTERNS": "patterns",
    "REFLECTION": "reflection",
  };

  let currentSection = "";

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    // Check if this is a section header
    let foundSection = false;
    for (const [header, key] of Object.entries(sectionMap)) {
      if (trimmed.toUpperCase().startsWith(header)) {
        currentSection = key;
        foundSection = true;
        // Check if there's content on the same line
        const afterHeader = trimmed.substring(header.length).replace(/^[:\s]+/, '');
        if (afterHeader) {
          sections[currentSection] = afterHeader;
        }
        break;
      }
    }

    if (!foundSection && currentSection && trimmed) {
      sections[currentSection] += (sections[currentSection] ? '\n' : '') + trimmed;
    }
  }

  return sections as {
    overview: string;
    workedOn: string;
    momentum: string;
    patterns: string;
    reflection: string;
  };
}

function generateSummaryHtml(data: SummaryData, sections: ReturnType<typeof parseSummaryResponse>): string {
  const completionRate = data.momentum
    ? Math.round((data.momentum.blocksCompleted / Math.max(1, data.momentum.blocksStarted)) * 100)
    : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Summary - ${data.formattedDate}</title>
  <style>
    :root {
      --bg: #1a1a2e;
      --card: #16213e;
      --text: #e8e8e8;
      --muted: #a0a0a0;
      --accent: #0f3460;
      --highlight: #e94560;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      max-width: 640px;
      margin: 0 auto;
      padding: 2rem 1rem;
      line-height: 1.6;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .date {
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }
    .section {
      background: var(--card);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }
    .section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 0.75rem;
    }
    .section-content {
      font-size: 0.95rem;
    }
    .section-content ul {
      margin: 0;
      padding-left: 1.25rem;
    }
    .section-content li {
      margin-bottom: 0.25rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--highlight);
    }
    .stat-label {
      font-size: 0.75rem;
      color: var(--muted);
    }
    .reflection {
      background: linear-gradient(135deg, var(--accent), var(--card));
      border-left: 3px solid var(--highlight);
    }
    .reflection .section-content {
      font-style: italic;
      font-size: 1.1rem;
    }
  </style>
</head>
<body>
  <h1>Daily Summary</h1>
  <p class="date">${data.formattedDate}</p>

  ${data.momentum ? `
  <div class="stats-grid">
    <div class="stat">
      <div class="stat-value">${data.momentum.blocksStarted}</div>
      <div class="stat-label">Blocks Started</div>
    </div>
    <div class="stat">
      <div class="stat-value">${completionRate}%</div>
      <div class="stat-label">Completion</div>
    </div>
    <div class="stat">
      <div class="stat-value">${data.momentum.totalMinutesWorked}m</div>
      <div class="stat-label">Focused Time</div>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Overview</div>
    <div class="section-content">${sections.overview || 'No overview available.'}</div>
  </div>

  <div class="section">
    <div class="section-title">What You Worked On</div>
    <div class="section-content">${formatWorkedOn(sections.workedOn)}</div>
  </div>

  <div class="section">
    <div class="section-title">Momentum</div>
    <div class="section-content">${sections.momentum || 'No momentum data.'}</div>
  </div>

  <div class="section">
    <div class="section-title">Patterns Noted</div>
    <div class="section-content">${sections.patterns || 'No patterns identified.'}</div>
  </div>

  <div class="section reflection">
    <div class="section-title">Reflection</div>
    <div class="section-content">"${sections.reflection}"</div>
  </div>

  <p style="text-align: center; color: var(--muted); font-size: 0.8rem; margin-top: 2rem;">
    Generated at ${new Date().toLocaleTimeString()}
  </p>
</body>
</html>`;
}

function formatWorkedOn(content: string): string {
  if (!content) return '<p>No work items recorded.</p>';

  // Convert markdown-style bullets to HTML
  const lines = content.split('\n').filter(l => l.trim());
  const items = lines.map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);

  if (items.length === 0) return '<p>No work items recorded.</p>';

  return `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
}

function generateEmptyDayHtml(formattedDate: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Summary - ${formattedDate}</title>
  <style>
    :root {
      --bg: #1a1a2e;
      --card: #16213e;
      --text: #e8e8e8;
      --muted: #a0a0a0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      max-width: 640px;
      margin: 0 auto;
      padding: 2rem 1rem;
      line-height: 1.6;
      text-align: center;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .date { color: var(--muted); margin-bottom: 2rem; }
    .message {
      background: var(--card);
      border-radius: 12px;
      padding: 2rem;
      margin-top: 2rem;
    }
    .reflection {
      font-style: italic;
      font-size: 1.1rem;
      margin-top: 1rem;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <h1>Daily Summary</h1>
  <p class="date">${formattedDate}</p>
  <div class="message">
    <p>No focused work sessions were recorded for this day.</p>
    <p class="reflection">"A quiet day - rest is part of the journey."</p>
  </div>
</body>
</html>`;
}
