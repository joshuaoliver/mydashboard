import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

/**
 * Gmail OAuth Callback Route (Legacy/Fallback)
 * 
 * The main OAuth flow now goes through the Convex HTTP endpoint at:
 *   https://your-convex-site.convex.site/gmail-callback
 * 
 * This client-side route exists as a fallback. If someone lands here,
 * we redirect them to the Gmail settings page.
 */

export const Route = createFileRoute('/gmail-callback')({
  component: GmailCallbackPage,
})

function GmailCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // This route shouldn't be hit anymore since OAuth goes to Convex HTTP endpoint.
    // If we get here, just redirect to settings.
    console.log('[Gmail Callback] Unexpected hit on client-side route, redirecting to settings')
    navigate({ to: '/settings/gmail' })
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="text-center max-w-md p-6">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4" />
        <p className="text-slate-300">Redirecting...</p>
      </div>
    </div>
  )
}
