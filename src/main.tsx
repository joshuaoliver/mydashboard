import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { createRouter, queryClient, convexQueryClient } from './router'
import './styles/app.css'

// Create router
const router = createRouter()

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

// Mount the app
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConvexAuthProvider client={convexQueryClient.convexClient}>
        <RouterProvider router={router} />
      </ConvexAuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
