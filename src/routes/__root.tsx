import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useLocation,
} from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { useConvexAuth } from 'convex/react'
import * as React from 'react'
import { PinEntry } from '@/components/auth/PinEntry'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1>
        <p className="mt-2 text-gray-600">The page you're looking for doesn't exist.</p>
      </div>
    </div>
  ),
})

function RootComponent() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // OAuth callback routes - need auth bypass because user might be mid-auth-flow
  // These handle their own redirect after processing
  // Check both router location AND window.location for reliability during initial load
  const callbackRoutes = ['/gmail-callback']
  const isCallbackRoute = callbackRoutes.some(route => 
    location.pathname === route || 
    location.pathname.startsWith(route) ||
    window.location.pathname === route ||
    window.location.pathname.startsWith(route)
  )
  
  // Skip all auth/PIN logic for callbacks - render immediately
  const shouldBypassAuth = isCallbackRoute
  
  // Debug: Log on every render to track what's happening
  console.log('[Root] Render:', { 
    routerPath: location.pathname, 
    windowPath: window.location.pathname,
    windowSearch: window.location.search,
    isCallbackRoute, 
    shouldBypassAuth 
  })

  // Check PIN unlock state from sessionStorage
  const [isAppUnlocked, setIsAppUnlocked] = React.useState(() => {
    // Bypass PIN for callback routes/popups
    if (shouldBypassAuth) return true
    return sessionStorage.getItem('app-unlocked') === 'true'
  })

  // Use Convex's built-in auth hook - this updates reactively
  const { isAuthenticated, isLoading } = useConvexAuth()

  // Public routes that don't require authentication
  // Include gmail-callback as public since it handles OAuth flow
  const publicRoutes = ['/sign-in', '/sign-up', '/gmail-callback']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  // Handle redirects based on auth state
  React.useEffect(() => {
    // Never redirect callback routes - they handle their own flow
    if (shouldBypassAuth) {
      console.log('Callback route, skipping all redirects:', { pathname: location.pathname })
      return
    }
    
    if (!isAppUnlocked || isLoading) return

    console.log('Auth state:', { isAuthenticated, isPublicRoute, pathname: location.pathname })

    if (!isAuthenticated && !isPublicRoute) {
      console.log('Not authenticated, redirecting to sign-in')
      navigate({ to: '/sign-in' })
    }

    // Only redirect to dashboard from sign-in/sign-up pages, not from callback routes
    if (isAuthenticated && (location.pathname === '/sign-in' || location.pathname === '/sign-up')) {
      console.log('Authenticated on auth page, redirecting to dashboard')
      navigate({ to: '/' })
    }
  }, [isAuthenticated, isPublicRoute, shouldBypassAuth, navigate, isLoading, isAppUnlocked, location.pathname])

  // Handle PIN unlock
  const handlePinUnlock = () => {
    setIsAppUnlocked(true)
  }

  // For callback routes/popups, skip PIN and render immediately
  if (shouldBypassAuth) {
    return <Outlet />
  }

  // Show PIN entry if not unlocked
  if (!isAppUnlocked) {
    return <PinEntry onUnlock={handlePinUnlock} />
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent" />
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
