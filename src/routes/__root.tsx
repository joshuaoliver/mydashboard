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
  
  // Check PIN unlock state from sessionStorage
  const [isAppUnlocked, setIsAppUnlocked] = React.useState(() => {
    return sessionStorage.getItem('app-unlocked') === 'true'
  })

  // Use Convex's built-in auth hook - this updates reactively
  const { isAuthenticated, isLoading } = useConvexAuth()

  // Public routes that don't require authentication
  // Note: OAuth callback routes need to be here to prevent redirect race conditions
  const publicRoutes = ['/sign-in', '/sign-up', '/gmail-callback']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  // Handle redirects based on auth state
  React.useEffect(() => {
    if (!isAppUnlocked || isLoading) return

    console.log('Auth state:', { isAuthenticated, isPublicRoute, pathname: location.pathname })

    if (!isAuthenticated && !isPublicRoute) {
      console.log('Not authenticated, redirecting to sign-in')
      navigate({ to: '/sign-in' })
    }

    if (isAuthenticated && isPublicRoute) {
      console.log('Authenticated on public route, redirecting to dashboard')
      navigate({ to: '/' })
    }
  }, [isAuthenticated, isPublicRoute, navigate, isLoading, isAppUnlocked, location.pathname])

  // Handle PIN unlock
  const handlePinUnlock = () => {
    setIsAppUnlocked(true)
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
