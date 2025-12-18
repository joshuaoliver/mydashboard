import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'
import { useState, useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Use Convex's reactive auth hook
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  // Debug: Log auth state changes
  useEffect(() => {
    console.log('Auth state:', { isAuthenticated, isAuthLoading })
  }, [isAuthenticated, isAuthLoading])

  // Redirect to dashboard when authenticated
  useEffect(() => {
    if (isAuthenticated && !isAuthLoading) {
      console.log('User authenticated, redirecting to dashboard')
      navigate({ to: '/' })
    }
  }, [isAuthenticated, isAuthLoading, navigate])

  const clearAuthStorage = () => {
    if (typeof window !== 'undefined') {
      console.log('Clearing all auth-related localStorage items...')
      const authKeys = Object.keys(localStorage).filter(k => 
        k.includes('convex') || k.includes('auth') || k.includes('token')
      )
      authKeys.forEach(key => {
        console.log('Removing:', key)
        localStorage.removeItem(key)
      })
      sessionStorage.clear()
      console.log('Auth storage cleared! Please refresh the page.')
      setError('Auth storage cleared! Please refresh the page and try again.')
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)

    try {
      console.log('Attempting sign in...')
      await signIn('password', formData)
      console.log('Sign in successful, waiting for auth state to update...')
      // Don't setIsLoading(false) - keep showing loading until redirect
    } catch (err) {
      console.error('Sign in error:', err)
      setError(err instanceof Error ? err.message : 'Sign in failed')
      setIsLoading(false)
    }
  }

  // Show loading if checking initial auth state
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent" />
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Sign In</h1>
          <p className="text-gray-500">Enter your credentials to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
          </div>

          {/* Hidden field to specify sign-in flow */}
          <input type="hidden" name="flow" value="signIn" />

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="border-t pt-4 text-center text-sm text-gray-500">
          <p>
            Need to create an account?{' '}
            <Link to="/sign-up" className="text-blue-600 hover:underline font-medium">
              Sign up here
            </Link>
          </p>
        </div>

        {/* Debug button to clear old tokens */}
        <div className="border-t pt-4">
          <Button 
            type="button"
            variant="outline" 
            onClick={clearAuthStorage}
            className="w-full text-xs"
          >
            🔧 Clear Auth Storage (Debug)
          </Button>
          <p className="mt-2 text-xs text-gray-500 text-center">
            Click this if you're seeing authentication errors
          </p>
        </div>
      </Card>
    </div>
  )
}
