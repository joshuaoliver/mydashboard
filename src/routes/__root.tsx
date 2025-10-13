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
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  notFoundComponent: () => <div>Route not found</div>,
  component: RootComponent,
})

function RootComponent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: user, isLoading } = useQuery(convexQuery(api.auth.currentUser, {}))

  // Public routes that don't require authentication
  const publicRoutes = ['/sign-in', '/sign-up']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  React.useEffect(() => {
    // Don't redirect while loading auth state
    if (isLoading) return

    // If not authenticated and trying to access protected route, redirect to sign-in
    if (!user && !isPublicRoute) {
      navigate({ to: '/sign-in' })
    }
    // If authenticated and on auth pages, redirect to dashboard
    if (user && isPublicRoute) {
      navigate({ to: '/' })
    }
  }, [user, isPublicRoute, navigate, isLoading])

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
