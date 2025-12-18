import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { routeTree } from './routeTree.gen'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL!
if (!CONVEX_URL) {
  console.error('Missing VITE_CONVEX_URL environment variable')
}

// Create singleton instances for the SPA
export const convexQueryClient = new ConvexQueryClient(CONVEX_URL)

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
      gcTime: 5 * 60 * 1000, // 5 minutes
      staleTime: 0, // Let Convex handle real-time updates
    },
  },
})

convexQueryClient.connect(queryClient)

// Singleton router instance
let router: ReturnType<typeof createTanStackRouter> | undefined

export function createRouter() {
  if (!router) {
    router = routerWithQueryClient(
      createTanStackRouter({
        routeTree,
        defaultPreload: 'intent',
        context: { queryClient },
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
        defaultErrorComponent: ({ error }) => (
          <div className="p-4 text-red-600">
            <h2 className="text-lg font-bold">Error</h2>
            <pre className="mt-2 text-sm">{error.message}</pre>
          </div>
        ),
        defaultNotFoundComponent: () => (
          <div className="p-4 text-gray-600">Page not found</div>
        ),
      }),
      queryClient
    )
  }
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
