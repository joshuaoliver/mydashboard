/**
 * Convex Query Cache Hooks
 * 
 * These hooks provide cache-enabled versions of Convex queries that persist
 * subscriptions even after components unmount. This significantly improves
 * navigation performance by keeping data fresh and ready.
 * 
 * Features:
 * - Subscriptions stay alive for 5 minutes after unmount (configurable in main.tsx)
 * - Fast reloading during navigation changes
 * - Real-time updates continue even when component is unmounted
 * 
 * Usage:
 * ```tsx
 * import { useCachedQuery } from '@/lib/convex-cache'
 * import { api } from '../../convex/_generated/api'
 * 
 * const { data } = useCachedQuery(api.todos.list, {})
 * ```
 */

// Re-export cache-enabled hooks from convex-helpers
export { 
  useQuery as useCachedQuery,
  useQueries as useCachedQueries,
  usePaginatedQuery as useCachedPaginatedQuery
} from 'convex-helpers/react/cache/hooks'

// Also re-export the provider for convenience
export { ConvexQueryCacheProvider } from 'convex-helpers/react/cache/provider'
