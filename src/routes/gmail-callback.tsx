import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'

/**
 * Gmail OAuth Callback Route
 * 
 * This is a standalone public route that handles the OAuth redirect from Google.
 * It exchanges the authorization code for tokens and redirects back to settings.
 * 
 * Flow:
 * 1. Google redirects here with ?code=xxx
 * 2. We exchange the code for tokens via Convex action
 * 3. On success, redirect to /settings/gmail
 * 
 * Note: We parse URL params directly with URLSearchParams because TanStack Router's
 * search parsing can have issues with special characters in OAuth codes.
 */
export const Route = createFileRoute('/gmail-callback')({
  component: GmailCallbackPage,
})

function GmailCallbackPage() {
  const navigate = useNavigate()
  const exchangeCode = useAction(api.gmailActions.exchangeCodeForTokens)
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasProcessed = useRef(false)

  useEffect(() => {
    // Prevent double-processing in React strict mode
    if (hasProcessed.current) return
    hasProcessed.current = true

    const handleCallback = async () => {
      // Parse URL params directly - more reliable for OAuth codes with special chars
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const error = params.get('error')
      
      console.log('[Gmail Callback] Processing', { 
        hasCode: !!code, 
        codeLength: code?.length,
        error,
        fullSearch: window.location.search 
      })

      if (error) {
        setStatus('error')
        setErrorMessage(error)
        return
      }

      if (!code) {
        setStatus('error')
        setErrorMessage('No authorization code received')
        return
      }

      // Get the redirect URI from sessionStorage (stored before OAuth redirect)
      const redirectUri = sessionStorage.getItem('gmail_oauth_redirect_uri') 
        || `${window.location.origin}/gmail-callback`
      
      try {
        await exchangeCode({ code, redirectUri })
        setStatus('success')
        
        // Clean up
        sessionStorage.removeItem('gmail_oauth_redirect_uri')
        
        // Redirect back to Gmail settings
        setTimeout(() => {
          navigate({ to: '/settings/gmail' })
        }, 1000)
      } catch (e: any) {
        console.error('[Gmail Callback] Token exchange failed:', e)
        setStatus('error')
        setErrorMessage(e.message || 'Failed to exchange authorization code')
      }
    }

    handleCallback()
  }, [exchangeCode, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="text-center max-w-md p-6">
        {status === 'processing' && (
          <>
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4" />
            <p className="text-slate-300">Completing Gmail authorization...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="text-green-500 text-4xl mb-4">✓</div>
            <p className="text-slate-300">Gmail connected successfully!</p>
            <p className="text-sm text-slate-500 mt-2">Redirecting to settings...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="text-red-500 text-4xl mb-4">✗</div>
            <p className="text-slate-300">Authorization failed</p>
            <p className="text-sm text-red-400 mt-2">{errorMessage}</p>
            <button
              onClick={() => navigate({ to: '/settings/gmail' })}
              className="mt-4 px-4 py-2 bg-slate-700 text-slate-200 rounded hover:bg-slate-600"
            >
              Return to Settings
            </button>
          </>
        )}
      </div>
    </div>
  )
}
