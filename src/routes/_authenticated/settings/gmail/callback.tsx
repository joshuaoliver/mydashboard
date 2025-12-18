import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/_authenticated/settings/gmail/callback')({
  component: GmailCallbackPage,
})

function GmailCallbackPage() {
  useEffect(() => {
    // Get the authorization code from URL
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

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
    }

    // Close this window after a short delay
    setTimeout(() => {
      window.close()
    }, 1000)
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4" />
        <p className="text-gray-600">Completing authorization...</p>
        <p className="text-sm text-gray-500 mt-2">This window will close automatically.</p>
      </div>
    </div>
  )
}
