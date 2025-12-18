import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

/**
 * Gmail OAuth Callback Route
 * 
 * This is a standalone public route (not under /_authenticated) to handle
 * the OAuth redirect from Google. It needs to be public because:
 * 1. Google redirects here with the auth code
 * 2. The auth state might not be confirmed yet when this loads
 * 3. We just need to grab the code and send it to the parent window
 * 
 * The actual token exchange happens in the parent window (settings/gmail page).
 */
export const Route = createFileRoute('/gmail-callback')({
  component: GmailCallbackPage,
})

function GmailCallbackPage() {
  useEffect(() => {
    // Get the authorization code from URL
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    console.log('[Gmail Callback] Received callback', { 
      hasCode: !!code, 
      error,
      origin: window.location.origin 
    })

    // Send message to opener window
    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'gmail_oauth_callback',
          code,
          error,
        },
        window.location.origin
      )
      console.log('[Gmail Callback] Sent message to opener')
    } else {
      console.warn('[Gmail Callback] No opener window found')
    }

    // Close this window after a short delay
    setTimeout(() => {
      window.close()
    }, 1000)
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4" />
        <p className="text-slate-300">Completing authorization...</p>
        <p className="text-sm text-slate-500 mt-2">This window will close automatically.</p>
      </div>
    </div>
  )
}
