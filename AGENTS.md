# AGENTS.md

## Commands
- `bun run dev` - Start dev server (Vite + Convex)
- `bun run build` - Build for production (typecheck: `bunx tsc --noEmit`)
- `bun run format` - Format with Prettier
- **Package manager: Bun only** - Do not use npm/yarn

## Architecture
- **Frontend**: TanStack Router (file-based routing in `src/routes/`), React 19, Shadcn/ui, Tailwind CSS v4
- **Backend**: Convex real-time database in `convex/` (queries, mutations, actions)
- **Imports**: Use `~/*` or `@/*` path aliases for `src/` (e.g., `~/components/ui/button`)
- **Schema**: `convex/schema.ts` - tables: users, beeperChats, beeperMessages, contacts, prompts, todoDocuments, todoItems, etc.
- **Query Caching**: Use `useCachedQuery` from `@/lib/convex-cache` for better navigation performance (keeps subscriptions alive 5min after unmount)
- **API pattern**: `useCachedQuery(api.module.function, {})` (preferred) or `convexQuery(api.module.function, {})` with `@tanstack/react-query`

## Code Style
- TypeScript strict mode; no `any` types
- Functional components with hooks; named exports
- Convex functions: use `v` from `convex/values` for validation
- Route files: export `Route` via `createFileRoute()`
- Icons: Lucide React; Forms: React Hook Form + Zod
- Keep components small, no unnecessary comments

## Convex TypeScript Best Practices

### 1. Explicit Return Types on Handlers
When a Convex action/mutation calls another action via `ctx.runAction()`, add explicit return types to avoid circular type inference:

```typescript
// ❌ BAD - causes "implicitly has type 'any'" errors
export const triggerSync = action({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await ctx.runAction(internal.module.otherAction, { date: args.date });
  },
});

// ✅ GOOD - explicit return type
export const triggerSync = action({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ success: boolean; count?: number }> => {
    return await ctx.runAction(internal.module.otherAction, { date: args.date });
  },
});
```

### 2. Internal vs Public Actions
- Use `internalAction` for functions only called by other Convex functions
- Use `action` for functions called from the frontend
- Internal functions use `internal.module.function`, public use `api.module.function`

```typescript
// Called only from other Convex functions
export const generateSummary = internalAction({ ... });
// Called from: ctx.runAction(internal.dailySummary.generateSummary, {})

// Called from frontend
export const triggerSync = action({ ... });
// Called from: useAction(api.googleCalendar.triggerSync)
```

### 3. Type Safety with Optional Properties
When mapping arrays where properties might be optional, provide defaults:

```typescript
// ❌ BAD - priority and title can be undefined
const allTasks = workPool.todos.map(t => ({ ...t, type: "todo" as const }));
// Later: priority: task.priority  // Error: undefined not assignable to number

// ✅ GOOD - provide fallback values
const allTasks = workPool.todos.map(t => ({ ...t, type: "todo" as const }));
// Later: priority: task.priority ?? 3, taskTitle: task.title ?? "Untitled"
```

### 4. AI SDK Property Names
The Vercel AI SDK uses `maxOutputTokens`, not `maxTokens`:

```typescript
// ❌ BAD
const result = await generateText({ model, prompt, maxTokens: 2000 });

// ✅ GOOD  
const result = await generateText({ model, prompt, maxOutputTokens: 2000 });
```

### 5. Avoid Unnecessary Database Writes
Convex queries are reactive - any `db.patch()` triggers UI re-renders. Skip writes when nothing changed:

```typescript
// ✅ GOOD - only write if there are actual changes
const hasChanges = newValue !== existingValue;
if (!hasChanges) {
  return { chatDocId, shouldSyncMessages }; // Early return, no patch
}

// Build update with only changed fields
const updates: any = {};
if (unreadChanged) updates.unreadCount = args.unreadCount;
if (titleChanged) updates.title = args.title;

if (Object.keys(updates).length > 0) {
  await ctx.db.patch(existingDoc._id, updates);
}
```
