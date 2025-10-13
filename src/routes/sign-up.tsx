import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [signedUp, setSignedUp] = useState(false)
  
  // Check auth state
  const { data: user } = useQuery(convexQuery(api.auth.currentUser, {}))

  // Redirect to dashboard when authenticated
  useEffect(() => {
    if (user && signedUp) {
      console.log('User authenticated, redirecting to dashboard')
      navigate({ to: '/' })
    }
  }, [user, signedUp, navigate])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string

    // Hardcoded restriction: Only allow josh@bywave.com.au to sign up
    if (email !== 'josh@bywave.com.au') {
      setError('This account is for personal use only. Sign-ups are restricted.')
      setIsLoading(false)
      return
    }

    try {
      await signIn('password', formData)
      console.log('Sign up successful, waiting for auth state to update...')
      setSignedUp(true)
      // Keep loading state - will redirect when user data loads
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Create Account</h1>
          <p className="text-gray-500">Set up your personal dashboard account</p>
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
              minLength={8}
            />
          </div>

          {/* Hidden field to specify sign-up flow */}
          <input type="hidden" name="flow" value="signUp" />

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <div className="border-t pt-4 text-center text-sm text-gray-500">
          <p>
            Already have an account?{' '}
            <a href="/sign-in" className="text-blue-600 hover:underline font-medium">
              Sign in here
            </a>
          </p>
        </div>

        <div className="rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
          <strong>Restricted Access:</strong> This account is for personal use only. 
          Only <span className="font-mono font-semibold">josh@bywave.com.au</span> can create an account.
        </div>
      </Card>
    </div>
  )
}

