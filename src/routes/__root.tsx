import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Outlet,
  useNavigate,
  useLocation,
} from '@tanstack/react-router'
import { QueryClient, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import * as React from 'react'
import appCss from '~/styles/app.css?url'
import { api } from '../../convex/_generated/api'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Dashboard',
      },
      {
        name: 'theme-color',
        content: '#6366f1',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  notFoundComponent: () => <div>Route not found</div>,
  component: RootComponent,
})

function RootComponent() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMounted, setIsMounted] = React.useState(false)
  
  // Only check auth on client-side (not during SSR)
  const { data: user, isLoading } = useQuery({
    ...convexQuery(api.auth.currentUser, {}),
    enabled: isMounted, // Only run on client
  })

  // Public routes that don't require authentication
  const publicRoutes = ['/sign-in', '/sign-up']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  // Set mounted flag after hydration
  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // Handle redirects based on auth state
  React.useEffect(() => {
    if (!isMounted || isLoading) return

    // If not authenticated and trying to access protected route, redirect to sign-in
    if (!user && !isPublicRoute) {
      console.log('Not authenticated, redirecting to sign-in')
      navigate({ to: '/sign-in' })
    }
    
    // If authenticated and on auth pages, redirect to dashboard
    if (user && isPublicRoute) {
      console.log('Authenticated on auth page, redirecting to dashboard')
      navigate({ to: '/' })
    }
  }, [user, isPublicRoute, navigate, isMounted, isLoading])

  // Show loading spinner during SSR and initial client load
  if (!isMounted || isLoading) {
    return (
      <RootDocument>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </RootDocument>
    )
  }

  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
