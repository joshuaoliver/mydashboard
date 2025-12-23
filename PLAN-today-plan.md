# Today Plan Feature - Implementation Plan

## Overview

A "Today Plan" view that generates an on-demand daily plan by combining:
1. Calendar events (read-only) → Free time blocks
2. Work Pool (Todos + Linear + Ad-hoc life items)
3. AI-powered "Next Up" suggestions for each free block

**Key Principle:** No calendar writing. Purely in-app guidance.

---

## Phase 1: Database Schema & Core Data Layer

### 1.1 Schema Updates (`convex/schema.ts`)

Add these new tables:

```typescript
// Ad-hoc life items (breakfast, gym, lunch, etc.)
adHocItems: defineTable({
  userId: v.id("users"),
  text: v.string(),                    // "Get breakfast", "Gym", "Lunch"
  date: v.string(),                    // YYYY-MM-DD
  estimatedMinutes: v.optional(v.number()), // ~60 for gym
  preferredTime: v.optional(v.string()),    // "12:30" for lunch
  isCompleted: v.boolean(),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_user_date", ["userId", "date"])
  .index("by_date", ["date"]),

// Calendar events (synced from Google Calendar)
calendarEvents: defineTable({
  userId: v.id("users"),
  externalId: v.string(),              // Google Calendar event ID
  title: v.string(),
  startTime: v.number(),               // Unix timestamp
  endTime: v.number(),
  date: v.string(),                    // YYYY-MM-DD for indexing
  isAllDay: v.boolean(),
  location: v.optional(v.string()),
  description: v.optional(v.string()),
  syncedAt: v.number(),
})
  .index("by_user_date", ["userId", "date"])
  .index("by_external_id", ["externalId"]),

// Computed free time blocks (regenerated daily)
freeBlocks: defineTable({
  userId: v.id("users"),
  date: v.string(),                    // YYYY-MM-DD
  startTime: v.number(),               // Unix timestamp
  endTime: v.number(),
  durationMinutes: v.number(),
  contextLabel: v.optional(v.string()), // "Before meeting", "After lunch"
  suggestions: v.array(v.object({       // Cached AI suggestions
    type: v.union(v.literal("todo"), v.literal("linear"), v.literal("adhoc"), v.literal("email")),
    itemId: v.optional(v.string()),
    title: v.string(),
    estimatedMinutes: v.number(),
    reason: v.optional(v.string()),
  })),
  generatedAt: v.number(),
})
  .index("by_user_date", ["userId", "date"]),

// Block execution tracking
blockSessions: defineTable({
  userId: v.id("users"),
  freeBlockId: v.id("freeBlocks"),
  taskType: v.string(),                 // "todo", "linear", "adhoc", "email", "frog"
  taskId: v.optional(v.string()),
  taskTitle: v.string(),
  plannedMinutes: v.number(),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  actualMinutes: v.optional(v.number()),
  outcome: v.optional(v.union(
    v.literal("done"),
    v.literal("partial"),
    v.literal("skipped")
  )),
  notes: v.optional(v.string()),
})
  .index("by_user_date", ["userId", "freeBlockId"]),

// Frog tags (tasks marked as "hard/important")
frogTags: defineTable({
  taskType: v.union(v.literal("todo"), v.literal("linear")),
  taskId: v.string(),                   // todoItems._id or linearIssues.linearId
  userId: v.id("users"),
  createdAt: v.number(),
})
  .index("by_task", ["taskType", "taskId"])
  .index("by_user", ["userId"]),
```

### 1.2 Extend Existing Tables

**`todoItems` table** - add optional fields:
```typescript
estimatedMinutes: v.optional(v.number()),  // For time-based planning
dueDate: v.optional(v.string()),           // YYYY-MM-DD
```

**`linearIssues` table** - verify existing fields:
- Already has: `priority`, `status`, `dueDate`
- May need: `estimatedMinutes` (from Linear estimate field)

---

## Phase 2: Backend Convex Functions

### 2.1 Ad-hoc Items (`convex/adHocItems.ts`)

```typescript
// Queries
getTodayAdHocItems()           // Get all items for today
getPendingAdHocItems(date)     // Get incomplete items

// Mutations
createAdHocItem({ text, estimatedMinutes?, preferredTime? })
updateAdHocItem(id, updates)
toggleAdHocComplete(id)
deleteAdHocItem(id)
```

### 2.2 Calendar Sync (`convex/calendarSync.ts`)

```typescript
// Actions (external API calls)
syncTodayCalendarEvents()      // Fetch from Google Calendar API
                               // Store to calendarEvents table

// Queries
getTodayEvents()               // All events for today
getEventsForDateRange(start, end)
```

**Calendar API Integration Pattern:**
- Use existing Gmail OAuth token (if available) or add Google Calendar scope
- Fetch events for today + tomorrow (for context)
- Store with `externalId` for deduplication

### 2.3 Free Blocks Generator (`convex/freeBlocks.ts`)

```typescript
// Queries
getTodayFreeBlocks()           // Computed free time slots

// Actions
generateFreeBlocks(date)       // Core logic:
  1. Get calendar events for date
  2. Get ad-hoc items with preferred times
  3. Define working hours (e.g., 7:00 - 22:00)
  4. Calculate gaps between events
  5. Filter blocks < 15 minutes
  6. Label blocks based on surrounding events
  7. Store to freeBlocks table

// Internal helpers
labelBlock(block, prevEvent, nextEvent)  // "Before meeting", "Post-lunch"
```

### 2.4 Work Pool Aggregator (`convex/workPool.ts`)

```typescript
// Query: Unified work pool
getWorkPool(date) → {
  todos: [
    { id, text, projectName, priority, estimatedMinutes, dueDate, isFrog }
  ],
  linear: [
    { id, title, priority, status, estimatedMinutes, dueDate, isFrog }
  ],
  adhoc: [
    { id, text, estimatedMinutes, preferredTime, isCompleted }
  ],
  emailBlocks: [
    { type: "email-triage", title: "Triage inbox", minutes: 15 },
    { type: "email-reply", title: "Reply to newest 5", minutes: 15 },
    { type: "email-deep", title: "Deep email admin", minutes: 45 },
  ]
}
```

### 2.5 AI Suggestions Engine (`convex/todayPlanAI.ts`)

```typescript
// Action: Generate suggestions for a free block
generateBlockSuggestions(blockId) → [
  { type: "todo", itemId: "...", title: "...", minutes: 20, reason: "Due today" },
  { type: "linear", itemId: "...", title: "...", minutes: 40, reason: "High priority" },
  { type: "email", title: "Email triage", minutes: 15 }
]

// AI Prompt Logic:
// Input context:
//   - Block duration (30m / 60m / 90m)
//   - Work pool items with priorities
//   - Ad-hoc constraints (breakfast pending, lunch at 12:30)
//   - Time of day (morning = deep work, afternoon = admin)
//   - Previous blocks today (avoid suggesting same thing twice)

// Output: Ranked shortlist of 1-3 items that fit

// Mutation: Cache suggestions
cacheSuggestions(blockId, suggestions)

// Query: Get cached suggestions
getCachedSuggestions(blockId)
```

### 2.6 Frog Mode (`convex/frogMode.ts`)

```typescript
// Mutations
tagAsFrog(taskType, taskId)
untagFrog(taskType, taskId)

// Queries
getFroggedItems()              // All items tagged as frog
getTodayFrog()                 // Suggested frog for today
                               // Logic: Frog-tagged + overdue/high-priority + fits block

// Action
generateFrogPrepStep(frogId, blockMinutes)
  // If frog is too big for block, suggest smallest start:
  // "Open doc + write first 5 bullet points"
  // "Create ticket breakdown"
  // "Draft first reply"
```

### 2.7 Block Sessions (`convex/blockSessions.ts`)

```typescript
// Mutations
startSession(blockId, taskType, taskId, plannedMinutes)
endSession(sessionId, outcome, notes?)
pauseSession(sessionId)
swapTask(sessionId, newTaskType, newTaskId)

// Queries
getActiveSession()             // Currently running session
getTodaySessions()             // All sessions today
getCompletionStats(dateRange)  // For learning/improving estimates
```

---

## Phase 3: Frontend Components

### 3.1 Route Structure

```
src/routes/_authenticated/
  today.tsx                    # Main Today Plan layout
  today/
    index.tsx                  # Default view (redirects or shows plan)
```

**Add to `dashboard-layout.tsx`:**
- Navigation item: "Today" with calendar icon
- Keyboard shortcut: 'd' for today

### 3.2 Store (`src/stores/useTodayPlanStore.ts`)

```typescript
interface TodayPlanStore {
  // UI State
  selectedBlockId: string | null
  setSelectedBlockId: (id: string | null) => void

  // Active session
  activeSessionId: string | null
  setActiveSessionId: (id: string | null) => void

  // Timer state
  timerRunning: boolean
  timerSeconds: number
  startTimer: () => void
  pauseTimer: () => void
  resetTimer: () => void

  // View preferences
  showCompletedBlocks: boolean
  toggleShowCompleted: () => void
}
```

### 3.3 Component Hierarchy

```
src/components/today/
  TodayPlanHeader.tsx          # Date, stats (completed/total), refresh button

  FreeBlockList.tsx            # List of all free blocks
    FreeBlockCard.tsx          # Individual block with suggestions
      SuggestionItem.tsx       # Single suggestion row
      BlockActions.tsx         # Start, Shuffle, Frog buttons

  WorkPoolPanel.tsx            # Right sidebar: full work pool
    TodoPoolSection.tsx        # Filtered todos
    LinearPoolSection.tsx      # Filtered Linear issues
    AdHocSection.tsx           # Quick-add for life items
      AdHocInput.tsx           # "Lunch at 12:30" parser

  ActiveSessionView.tsx        # Focused execution UI
    SessionTimer.tsx           # Countdown timer
    TaskDetails.tsx            # Current task info
    SessionControls.tsx        # Done, Pause, Swap
    MicroWrapUp.tsx            # End-of-block prompt

  FrogModePanel.tsx            # Frog selection and start
    FrogList.tsx               # All frog-tagged items
    FrogPrepSuggestion.tsx     # When frog is too big

  CalendarStrip.tsx            # Visual timeline of today
    EventBlock.tsx             # Calendar event display
    FreeBlockIndicator.tsx     # Clickable free time slot
```

### 3.4 Key UI Patterns

**Free Block Card:**
```
┌─────────────────────────────────────────┐
│ 11:00 - 12:00 (60m)                     │
│ ─────────────────────────────────────── │
│ Context: Before standup meeting         │
│                                         │
│ ○ 20m — Email triage                    │
│ ○ 40m — Linear: REC-123 (Fix caching)   │
│ ○ 30m — Todo: Call accountant           │
│                                         │
│ [▶ Start]  [🔀 Shuffle]  [🐸 Frog]      │
└─────────────────────────────────────────┘
```

**Active Session View (Start Mode):**
```
┌─────────────────────────────────────────┐
│           ⏱️  23:45                      │
│                                         │
│ Linear: REC-123                         │
│ Fix caching issue in message panel      │
│                                         │
│ [Link to Linear] [Notes]                │
│                                         │
│ [✓ Done]  [⏸ Pause]  [↔ Swap]          │
└─────────────────────────────────────────┘
```

**Ad-hoc Quick Add:**
```
┌─────────────────────────────────────────┐
│ + Add life item...                      │
│                                         │
│ Examples: "Lunch at 12:30"              │
│           "Gym ~60m"                    │
│           "Pick up groceries"           │
└─────────────────────────────────────────┘
```

---

## Phase 4: AI Integration

### 4.1 AI Settings Extension

Add to `convex/aiSettings.ts`:
```typescript
{
  key: "today-plan-suggestions",
  displayName: "Today Plan Suggestions",
  modelId: "google/gemini-2.5-flash",  // Fast, efficient
  temperature: 0.3,                     // Consistent suggestions
  isEnabled: true,
}
```

### 4.2 Prompt Template (`convex/prompts.ts`)

```typescript
"today-plan-block": {
  system: `You are a productivity assistant helping prioritize work for a specific time block.
You must consider:
1. Block duration - only suggest items that fit
2. Time of day - deep work in morning, admin in afternoon
3. Priorities and due dates
4. Ad-hoc life items as constraints (don't schedule deep work right before lunch)
5. Previous completions today (avoid repetition)

Return a JSON array of 1-3 suggestions, ranked by fit.`,

  template: `## Current Block
- Time: {{blockStart}} - {{blockEnd}} ({{blockMinutes}} minutes)
- Context: {{contextLabel}}

## Work Pool
### Todos ({{todoCount}})
{{#each todos}}
- [{{priority}}] {{text}} {{#if estimatedMinutes}}(~{{estimatedMinutes}}m){{/if}} {{#if dueDate}}Due: {{dueDate}}{{/if}}
{{/each}}

### Linear Issues ({{linearCount}})
{{#each linearIssues}}
- [P{{priority}}] {{title}} ({{status}}) {{#if estimatedMinutes}}(~{{estimatedMinutes}}m){{/if}}
{{/each}}

### Ad-hoc Items (constraints)
{{#each adhocItems}}
- {{text}} {{#if preferredTime}}at {{preferredTime}}{{/if}} {{#if estimatedMinutes}}(~{{estimatedMinutes}}m){{/if}}
{{/each}}

### Already completed today
{{#each completedToday}}
- {{title}}
{{/each}}

Return JSON: [{ "type": "todo|linear|email", "itemId": "...", "title": "...", "minutes": N, "reason": "..." }]`
}
```

### 4.3 Frog Prep Prompt

```typescript
"frog-prep-step": {
  system: `You help break down intimidating tasks into tiny first steps.
The user has a "frog" (hard task) but limited time.
Suggest the smallest possible start that creates momentum.`,

  template: `## The Frog
{{frogTitle}}
{{#if frogDescription}}Details: {{frogDescription}}{{/if}}

## Available time: {{availableMinutes}} minutes

Suggest ONE tiny first step (under {{availableMinutes}} minutes) that:
- Reduces the barrier to starting
- Creates visible progress
- Is specific and actionable

Examples: "Open doc and write the first 3 bullet points", "Create the PR with just the file structure"

Return: { "step": "...", "estimatedMinutes": N }`
}
```

---

## Phase 5: Integration & Polish

### 5.1 Cron Jobs (`convex/crons.ts`)

```typescript
// Morning: Sync calendar and generate blocks
crons.daily("generate-today-plan", { hour: 6, minute: 0 }, async (ctx) => {
  await ctx.runAction(api.calendarSync.syncTodayCalendarEvents)
  await ctx.runAction(api.freeBlocks.generateFreeBlocks, { date: getTodaySydney() })
})

// Periodic: Refresh calendar (catch late additions)
crons.interval("refresh-calendar", { minutes: 30 }, async (ctx) => {
  await ctx.runAction(api.calendarSync.syncTodayCalendarEvents)
})
```

### 5.2 Keyboard Shortcuts

Add to `dashboard-layout.tsx`:
- `d` → Navigate to Today Plan
- In Today Plan view:
  - `s` → Start selected block
  - `f` → Frog mode
  - `r` → Shuffle/refresh suggestions
  - `n` → Next block
  - `p` → Previous block

### 5.3 Mobile Responsive

- Use Sheet component for Work Pool (slide-in panel)
- Stack Free Blocks vertically
- Full-screen Active Session view
- Bottom action bar for Start/Shuffle/Frog

---

## Implementation Order

### Sprint 1: Foundation (Core data layer)
1. [ ] Schema updates - add new tables
2. [ ] `adHocItems.ts` - CRUD for life items
3. [ ] `freeBlocks.ts` - block generation (hardcoded working hours first)
4. [ ] `workPool.ts` - unified work pool query
5. [ ] Basic route setup (`today.tsx`)

### Sprint 2: Core UI
6. [ ] `TodayPlanHeader.tsx` - date and stats
7. [ ] `FreeBlockList.tsx` + `FreeBlockCard.tsx`
8. [ ] `WorkPoolPanel.tsx` with all sections
9. [ ] `AdHocInput.tsx` with time parsing
10. [ ] Zustand store for UI state

### Sprint 3: AI Suggestions
11. [ ] AI settings for today-plan
12. [ ] Prompt templates
13. [ ] `todayPlanAI.ts` - suggestion generation
14. [ ] Integrate suggestions into FreeBlockCard
15. [ ] Shuffle functionality

### Sprint 4: Execution Mode
16. [ ] `blockSessions.ts` - session tracking
17. [ ] `ActiveSessionView.tsx` with timer
18. [ ] `SessionControls.tsx` - Done/Pause/Swap
19. [ ] `MicroWrapUp.tsx` - end-of-block prompt

### Sprint 5: Frog Mode
20. [ ] `frogMode.ts` - tagging and queries
21. [ ] `FrogModePanel.tsx` UI
22. [ ] Frog prep step AI generation
23. [ ] Integrate frog button into blocks

### Sprint 6: Calendar Integration
24. [ ] Google Calendar OAuth setup
25. [ ] `calendarSync.ts` - event fetching
26. [ ] `CalendarStrip.tsx` - visual timeline
27. [ ] Cron jobs for auto-sync

### Sprint 7: Polish
28. [ ] Keyboard shortcuts
29. [ ] Mobile responsive layout
30. [ ] Settings page for Today Plan preferences
31. [ ] Analytics (completion rates, estimate accuracy)

---

## Files to Create

```
convex/
  adHocItems.ts          # Ad-hoc life items CRUD
  calendarSync.ts        # Google Calendar integration
  freeBlocks.ts          # Free block generation
  workPool.ts            # Unified work pool query
  todayPlanAI.ts         # AI suggestions engine
  frogMode.ts            # Frog tagging and queries
  blockSessions.ts       # Execution session tracking

src/routes/_authenticated/
  today.tsx              # Main layout

src/stores/
  useTodayPlanStore.ts   # UI state management

src/components/today/
  TodayPlanHeader.tsx
  FreeBlockList.tsx
  FreeBlockCard.tsx
  SuggestionItem.tsx
  BlockActions.tsx
  WorkPoolPanel.tsx
  TodoPoolSection.tsx
  LinearPoolSection.tsx
  AdHocSection.tsx
  AdHocInput.tsx
  ActiveSessionView.tsx
  SessionTimer.tsx
  TaskDetails.tsx
  SessionControls.tsx
  MicroWrapUp.tsx
  FrogModePanel.tsx
  FrogList.tsx
  FrogPrepSuggestion.tsx
  CalendarStrip.tsx
  EventBlock.tsx
  FreeBlockIndicator.tsx
```

## Files to Modify

```
convex/schema.ts         # Add new tables
convex/crons.ts          # Add daily sync jobs
convex/aiSettings.ts     # Add today-plan setting
convex/prompts.ts        # Add prompt templates
convex/todoItems.ts      # Add estimatedMinutes, dueDate fields

src/components/layout/dashboard-layout.tsx  # Add nav item + shortcuts
```

---

## Edge Cases to Handle

1. **No free time today** → Show message "Fully booked" with overflow tasks
2. **Overlapping events** → Merge into single busy block
3. **Block too small** → Filter blocks < 15 minutes, show as "quick break"
4. **No tasks in pool** → Suggest email blocks or "capture tasks" prompt
5. **Ad-hoc conflicts** → If lunch is at 12:30 and block is 12:00-13:00, split or adjust
6. **Session overrun** → Prompt to extend or wrap up
7. **Calendar sync fails** → Show cached events with "sync failed" warning
8. **Timezone changes** → Use Sydney timezone consistently via `getTodaySydney()`
