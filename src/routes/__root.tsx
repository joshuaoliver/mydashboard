import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useLocation,
} from '@tanstack/react-router'
import { QueryClient, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import * as React from 'react'
import { api } from '../../convex/_generated/api'
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

  // Public routes that don't require authentication
  const publicRoutes = ['/sign-in', '/sign-up']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  // Check auth state (only after PIN unlock)
  const { data: user, isLoading } = useQuery({
    ...convexQuery(api.auth.currentUser, {}),
    enabled: isAppUnlocked,
  })

  // Handle redirects based on auth state
  React.useEffect(() => {
    if (!isAppUnlocked || isLoading) return

    if (!user && !isPublicRoute) {
      navigate({ to: '/sign-in' })
    }

    if (user && isPublicRoute) {
      navigate({ to: '/' })
    }
  }, [user, isPublicRoute, navigate, isLoading, isAppUnlocked])

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
