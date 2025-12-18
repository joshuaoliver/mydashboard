import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { routeTree } from './routeTree.gen'

// Singleton router instance
let router: ReturnType<typeof createTanStackRouter> | undefined

export function createRouter(queryClient: QueryClient) {
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
