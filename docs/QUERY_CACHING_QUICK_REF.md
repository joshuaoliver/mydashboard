# Query Caching Quick Reference

## 🚀 Quick Start

### Import
```tsx
import { useCachedQuery, useCachedPaginatedQuery } from '@/lib/convex-cache'
import { api } from '../../../convex/_generated/api'
```

### Basic Usage
```tsx
// Simple query
const todos = useCachedQuery(api.todos.list, {})

// Paginated query
const { results, status, loadMore } = useCachedPaginatedQuery(
  api.chats.list,
  { filter: 'active' },
  { initialNumItems: 50 }
)

// With options
const data = useCachedQuery(
  api.settings.get,
  {},
  { enabled: someCondition }
)
```

## 🔄 Migration Cheat Sheet

### From React Query + convexQuery
```tsx
// Before
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
const { data } = useQuery(convexQuery(api.todos.list, {}))

// After
import { useCachedQuery } from '@/lib/convex-cache'
const data = useCachedQuery(api.todos.list, {})
```

### From Native Convex Hooks
```tsx
// Before
import { useQuery } from 'convex/react'
const data = useQuery(api.todos.list, {})

// After
import { useCachedQuery } from '@/lib/convex-cache'
const data = useCachedQuery(api.todos.list, {})
```

## ⚙️ Configuration

Located in `src/main.tsx`:
```tsx
<ConvexQueryCacheProvider
  expiration={5 * 60 * 1000}  // 5 min cache
  maxIdleEntries={250}         // max subscriptions
  debug={false}                // enable for logs
>
```

## 🐛 Debug Mode

Enable in `src/main.tsx`:
```tsx
<ConvexQueryCacheProvider debug={true}>
```

Console output:
```
[ConvexQueryCache] Active: 12, Idle: 5, Total: 17
```

## ✅ Benefits
- ⚡ Instant navigation (no loading states)
- 🔄 Real-time updates continue
- 💾 5-minute cache window
- 🧹 Automatic cleanup

## ⚠️ When NOT to Use
- Very large datasets (>1MB)
- Sensitive data
- One-time actions
- Rarely accessed pages

## 📚 Full Docs
- `docs/QUERY_CACHING.md` - Complete guide
- `docs/QUERY_CACHING_IMPLEMENTATION.md` - Implementation details
