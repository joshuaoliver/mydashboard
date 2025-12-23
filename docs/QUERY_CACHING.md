# Query Caching with Convex Helpers

This project uses `convex-helpers` to implement subscription caching, which significantly improves navigation performance by keeping query subscriptions alive even after components unmount.

## Table of Contents
- [Overview](#overview)
- [What is Subscription Caching?](#what-is-subscription-caching)
- [Trade-offs](#trade-offs)
- [Implementation](#implementation)
- [Usage](#usage)
- [Migration Guide](#migration-guide)
- [Debugging](#debugging)
- [When NOT to Use Caching](#when-not-to-use-caching)
- [Performance Monitoring](#performance-monitoring)
- [Examples](#examples)
- [References](#references)

## Overview

### What is Subscription Caching?

Traditional query hooks (`useQuery`, `usePaginatedQuery`) from Convex automatically unsubscribe when a component unmounts. This means:
- When you navigate away from a page, all subscriptions close
- When you navigate back, data must be re-fetched from the server
- This causes loading states and delays during navigation

**Subscription caching** keeps subscriptions alive for a configurable period (default: 5 minutes) after unmount:
- Navigate away → subscription stays open in the background
- Navigate back → data is instantly available (no loading state)
- Real-time updates continue even when component is unmounted
- After expiration period, subscription closes to free resources

### Trade-offs

**Benefits:**
- ✅ Instant navigation between pages (no loading states)
- ✅ Data stays fresh with real-time updates
- ✅ Better user experience
- ✅ Reduced perceived latency

**Costs:**
- ⚠️ Slightly more bandwidth usage (subscriptions stay open longer)
- ⚠️ More memory usage (cached data retained longer)
- ⚠️ Not suitable for very large datasets that change frequently

**Note:** This is optimized for user experience, not bandwidth. The extra bandwidth is typically negligible for most applications.

## Implementation

### 1. Provider Setup

The cache provider is configured in `src/main.tsx`:

```tsx
import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache'

<ConvexAuthProvider client={convex}>
  <ConvexQueryCacheProvider
    expiration={5 * 60 * 1000}  // 5 minutes
    maxIdleEntries={250}         // max cached subscriptions
    debug={false}                // enable debug logs
  >
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </ConvexQueryCacheProvider>
</ConvexAuthProvider>
```

### 2. Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `expiration` | number | 300000 (5 min) | Milliseconds to keep unmounted subscriptions alive |
| `maxIdleEntries` | number | 250 | Maximum number of unused subscriptions in cache |
| `debug` | boolean | false | Log cache state every 3 seconds for debugging |

### 3. Custom Hooks

We've created convenience hooks in `src/lib/convex-cache.ts`:

```tsx
import { 
  useCachedQuery,           // Drop-in replacement for useQuery
  useCachedPaginatedQuery,  // Drop-in replacement for usePaginatedQuery
  useCachedQueries          // Drop-in replacement for useQueries
} from '@/lib/convex-cache'
```

## Usage

### Pattern 1: Native Convex Hooks (from `convex/react`)

**Before:**
```tsx
import { useQuery, usePaginatedQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

const data = useQuery(api.todos.list, {})
const { results, status, loadMore } = usePaginatedQuery(
  api.chats.list,
  { filter: 'active' },
  { initialNumItems: 50 }
)
```

**After:**
```tsx
import { useCachedQuery, useCachedPaginatedQuery } from '@/lib/convex-cache'
import { api } from '../../../convex/_generated/api'

const data = useCachedQuery(api.todos.list, {})
const { results, status, loadMore } = useCachedPaginatedQuery(
  api.chats.list,
  { filter: 'active' },
  { initialNumItems: 50 }
)
```

### Pattern 2: React Query with Convex (from `@convex-dev/react-query`)

For routes using `@tanstack/react-query` with `convexQuery`:

**Before:**
```tsx
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'

const { data } = useQuery(convexQuery(api.todos.list, {}))
```

**After:**
```tsx
import { useCachedQuery } from '@/lib/convex-cache'
import { api } from '../../../convex/_generated/api'

const { data } = useCachedQuery(api.todos.list, {})
```

**Note:** The cached version uses the native Convex API (no `convexQuery` wrapper needed).

## Migration Guide

### Step 1: Identify Query Usage

Search for these patterns in your codebase:
```bash
# Native Convex hooks
grep -r "useQuery.*api\." src/
grep -r "usePaginatedQuery.*api\." src/

# React Query with Convex
grep -r "convexQuery" src/
```

### Step 2: Update Imports

Replace:
```tsx
import { useQuery, usePaginatedQuery } from 'convex/react'
```

With:
```tsx
import { useAction, useMutation, useConvex } from 'convex/react'
import { useCachedQuery, useCachedPaginatedQuery } from '@/lib/convex-cache'
```

### Step 3: Update Hook Calls

The API is identical, just use the cached versions:
```tsx
// Before
const data = useQuery(api.todos.list, {})

// After
const data = useCachedQuery(api.todos.list, {})
```

### Step 4: Test Navigation

1. Navigate to a page with queries
2. Navigate away
3. Navigate back
4. Data should appear instantly (no loading state)

## Debugging

### Enable Debug Mode

Set `debug: true` in the provider configuration:

```tsx
<ConvexQueryCacheProvider
  expiration={5 * 60 * 1000}
  maxIdleEntries={250}
  debug={true}  // Enable debug logs
>
```

This will log cache state every 3 seconds to the console:
```
[ConvexQueryCache] Active: 12, Idle: 5, Total: 17
```

### Common Issues

**Problem:** Data not appearing instantly after navigation

**Solutions:**
1. Check that you're using `useCachedQuery` instead of `useQuery`
2. Verify the provider is wrapping your app correctly
3. Check if expiration time is too short
4. Enable debug mode to see cache state

**Problem:** Too much memory usage

**Solutions:**
1. Reduce `expiration` time (e.g., 2 minutes instead of 5)
2. Reduce `maxIdleEntries` (e.g., 100 instead of 250)
3. Identify queries that don't need caching and use regular hooks

## When NOT to Use Caching

Consider using regular hooks (without caching) for:

1. **Very large datasets** - If a query returns megabytes of data
2. **Infrequently accessed pages** - If users rarely navigate back to a page
3. **Sensitive data** - If data should not persist after unmount for security reasons
4. **One-time actions** - If data is only needed once and won't be revisited

For these cases, use the original hooks:
```tsx
import { useQuery } from 'convex/react'
// or
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
```

## Performance Monitoring

### Metrics to Track

1. **Cache Hit Rate** - Enable debug mode and monitor idle subscriptions
2. **Navigation Speed** - Time between route change and data display
3. **Memory Usage** - Monitor browser memory with DevTools
4. **Bandwidth** - Compare network traffic with/without caching

### Optimization Tips

1. **Tune expiration time** - Balance between performance and resource usage
2. **Selective caching** - Only cache frequently accessed queries
3. **Monitor cache size** - Adjust `maxIdleEntries` based on usage patterns
4. **Profile in production** - Test with real user navigation patterns

## Examples

### Example 1: Todo List (Already Migrated)

```tsx
// src/routes/_authenticated/todos.tsx
import { useCachedQuery } from '@/lib/convex-cache'
import { api } from '../../../convex/_generated/api'

function TodosLayout() {
  const { data: documents, isLoading } = useCachedQuery(
    api.todoDocuments.listDocuments, 
    {}
  )
  
  return <DocumentList documents={documents ?? []} />
}
```

### Example 2: Chat List (Already Migrated)

```tsx
// src/components/messages/ChatListPanel.tsx
import { useCachedQuery, useCachedPaginatedQuery } from '@/lib/convex-cache'
import { api } from '../../../convex/_generated/api'

export function ChatListPanel() {
  const { results: allLoadedChats, status, loadMore } = useCachedPaginatedQuery(
    api.beeperQueries.listCachedChats,
    { filter: tabFilter },
    { initialNumItems: 100 }
  )
  
  const syncInfo = useCachedQuery(api.beeperQueries.getChatInfo)
  
  return <ChatList chats={allLoadedChats} />
}
```

### Example 3: Settings Page (To Be Migrated)

```tsx
// src/routes/_authenticated/settings/prompts.tsx
// TODO: Migrate to useCachedQuery
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'

export function PromptsSettings() {
  // Current implementation
  const { data: prompts } = useQuery(convexQuery(api.prompts.listPrompts, {}))
  
  // Should be:
  // const prompts = useCachedQuery(api.prompts.listPrompts, {})
  
  return <PromptsList prompts={prompts} />
}
```

## References

- [convex-helpers Documentation](https://github.com/get-convex/convex-helpers)
- [Convex Query Caching](https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#query-caching)
- [Convex Real-time Subscriptions](https://docs.convex.dev/client/react/queries)

## Migration Status

### ✅ Migrated
- `src/routes/_authenticated/todos.tsx`
- `src/components/messages/ChatListPanel.tsx`

### 🔄 To Be Migrated
- `src/routes/_authenticated/settings/prompts.tsx`
- `src/routes/_authenticated/settings/index.tsx`
- `src/routes/_authenticated/stats/index.tsx`
- `src/routes/_authenticated/stats/linear.tsx`
- `src/routes/_authenticated/sales.tsx`
- `src/routes/_authenticated/contacts/$contactId.tsx`
- And other routes using `useQuery` with `convexQuery`

### Migration Priority
1. **High Priority** - Frequently navigated pages (dashboard, messages, todos)
2. **Medium Priority** - Settings pages, stats pages
3. **Low Priority** - Rarely accessed pages, one-time setup pages
