import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache'
import { ThemeProvider } from '@/components/theme-provider'
import { createRouter } from './router'
import './styles/app.css'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string
if (!CONVEX_URL) {
  throw new Error('Missing VITE_CONVEX_URL environment variable')
}

// Create the Convex client (single instance)
const convex = new ConvexReactClient(CONVEX_URL)

// Create ConvexQueryClient for React Query integration
const convexQueryClient = new ConvexQueryClient(convex)

// Create QueryClient with Convex integration
// Convex provides real-time updates via WebSocket, so we can cache aggressively
// staleTime: how long data is considered fresh (won't refetch during this window)
// gcTime: how long to keep unused data in cache before garbage collecting
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
      gcTime: 10 * 60 * 1000, // Keep unused data for 10 minutes
      staleTime: 60 * 1000, // Consider data fresh for 60 seconds
    },
  },
})

convexQueryClient.connect(queryClient)

// Create router with queryClient context
const router = createRouter(queryClient)

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('✅ Service Worker registered:', registration.scope)
    })
    .catch((error) => {
      console.error('❌ Service Worker registration failed:', error)
    })
}

// Mount the app - ConvexAuthProvider replaces ConvexProvider
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ConvexAuthProvider client={convex}>
        <ConvexQueryCacheProvider
          expiration={5 * 60 * 1000} // 5 minutes (default)
          maxIdleEntries={250} // max cached subscriptions (default)
          debug={false} // set to true to see cache debug logs
        >
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ConvexQueryCacheProvider>
      </ConvexAuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)
