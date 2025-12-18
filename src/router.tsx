import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { routeTree } from './routeTree.gen'

// Client-side singleton router instance
let clientRouter: ReturnType<typeof createRouterInstance> | undefined
// Client-side singleton Convex client (persists across reloads)
let convexQueryClientInstance: ConvexQueryClient | undefined
let queryClientInstance: QueryClient | undefined

function createRouterInstance() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!
  if (!CONVEX_URL) {
    console.error('missing envar CONVEX_URL')
  }

  // On the client, reuse the same ConvexQueryClient to maintain auth session
  if (typeof document !== 'undefined') {
    if (!convexQueryClientInstance) {
      convexQueryClientInstance = new ConvexQueryClient(CONVEX_URL)
    }
    if (!queryClientInstance) {
      queryClientInstance = new QueryClient({
        defaultOptions: {
          queries: {
            queryKeyHashFn: convexQueryClientInstance.hashFn(),
            queryFn: convexQueryClientInstance.queryFn(),
            gcTime: 5000,
          },
        },
      })
      convexQueryClientInstance.connect(queryClientInstance)
    }
  } else {
    // Server-side: create new instances for each request
    convexQueryClientInstance = new ConvexQueryClient(CONVEX_URL)
    queryClientInstance = new QueryClient({
      defaultOptions: {
        queries: {
          queryKeyHashFn: convexQueryClientInstance.hashFn(),
          queryFn: convexQueryClientInstance.queryFn(),
          gcTime: 5000,
        },
      },
    })
    convexQueryClientInstance.connect(queryClientInstance)
  }

  const convexQueryClient = convexQueryClientInstance
  const queryClient = queryClientInstance

  const routerInstance = routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      defaultPreload: 'intent',
      defaultSsr: false, // Disable SSR globally - client-side only rendering
      context: { queryClient },
      scrollRestoration: true,
      defaultPreloadStaleTime: 0, // Let React Query handle all caching
      defaultErrorComponent: (err) => <p>{err.error.stack}</p>,
      defaultNotFoundComponent: () => <p>not found</p>,
      Wrap: ({ children }) => (
        <ConvexAuthProvider 
          client={convexQueryClient.convexClient}
          storage={typeof window !== 'undefined' ? window.localStorage : undefined}
        >
          {children}
        </ConvexAuthProvider>
      ),
    }),
    queryClient,
  )

  return routerInstance
}

function createRouter() {
  // On the client, reuse the same router instance
  if (typeof document !== 'undefined') {
    if (!clientRouter) {
      clientRouter = createRouterInstance()
    }
    return clientRouter
  }
  
  // On the server, always create a new router for each request
  return createRouterInstance()
}

// Required for TanStack Start
export async function getRouter() {
  return createRouter()
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
