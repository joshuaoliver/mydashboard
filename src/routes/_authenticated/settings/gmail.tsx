import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexMutation, useConvexAction } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Mail,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { useState, useCallback } from 'react'

export const Route = createFileRoute('/_authenticated/settings/gmail')({
  component: GmailSettingsPage,
})

function GmailSettingsPage() {
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.settingsStore.getGmailSettings, {})
  )
  const { data: stats } = useQuery({
    ...convexQuery(api.gmailSync.getStats, {}),
    enabled: !!settings?.isConfigured,
  })

  const setSetting = useConvexMutation(api.settingsStore.setSetting)
  const testConnection = useConvexAction(api.gmailActions.testConnection)
  const exchangeCode = useConvexAction(api.gmailActions.exchangeCodeForTokens)

  const [clientId, setClientId] = useState(settings?.clientId ?? '')
  const [clientSecret, setClientSecret] = useState(settings?.clientSecret ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const isConfigured = settings?.isConfigured ?? false
  const hasCredentials = !!(settings?.clientId && settings?.clientSecret)

  // Get the redirect URI for OAuth
  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/settings/gmail/callback`
      : ''

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      alert('Please enter both Client ID and Client Secret')
      return
    }

    setIsSaving(true)
    try {
      await setSetting({
        key: 'gmail',
        type: 'oauth',
        value: {
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          isConfigured: false,
        },
      })
      alert('Credentials saved! Now click "Connect Gmail" to authorize.')
    } catch (e: any) {
      alert(e.message || 'Failed to save credentials')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConnectGmail = useCallback(() => {
    if (!settings?.clientId) {
      alert('Please save your Client ID first')
      return
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.labels',
    ].join(' ')

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', settings.clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    // Open in popup
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      authUrl.toString(),
      'gmail_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    // Listen for the callback
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'gmail_oauth_callback') return

      window.removeEventListener('message', handleMessage)
      popup?.close()

      if (event.data.code) {
        try {
          await exchangeCode({
            code: event.data.code,
            redirectUri,
          })
          window.location.reload()
        } catch (e: any) {
          alert('Failed to complete authorization: ' + (e.message || 'Unknown error'))
        }
      } else if (event.data.error) {
        alert('Authorization failed: ' + event.data.error)
      }
    }

    window.addEventListener('message', handleMessage)
  }, [settings?.clientId, redirectUri, exchangeCode])

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection({})
      if (result.success) {
        setTestResult({
          success: true,
          message: `Connected! Inbox: ${result.stats?.totalInbox} emails, ${result.stats?.unread} unread`,
        })
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Connection failed',
        })
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Connection test failed',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Mail className="w-8 h-8 text-red-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gmail Integration</h1>
            <p className="text-sm text-gray-600 mt-1">
              Connect your Gmail to track inbox statistics
            </p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Connection Status</span>
            {isConfigured ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Connected
              </Badge>
            ) : hasCredentials ? (
              <Badge className="bg-yellow-100 text-yellow-800">
                <AlertCircle className="w-4 h-4 mr-1" />
                Credentials Set - Authorization Needed
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-800">
                <XCircle className="w-4 h-4 mr-1" />
                Not Configured
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        {isConfigured && stats && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Current Inbox</span>
                <p className="text-lg font-semibold">{stats.currentInbox ?? '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Unread</span>
                <p className="text-lg font-semibold">{stats.currentUnread ?? '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Total Snapshots</span>
                <p className="text-lg font-semibold">{stats.totalSnapshots}</p>
              </div>
              <div>
                <span className="text-gray-500">Last Sync</span>
                <p className="text-lg font-semibold">
                  {stats.newestSnapshot
                    ? new Date(stats.newestSnapshot).toLocaleString()
                    : '-'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
                Test Connection
              </Button>
            </div>
            {testResult && (
              <div
                className={`mt-3 p-3 rounded-lg ${
                  testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Setup Instructions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>
            Follow these steps to connect your Gmail account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm">
                1
              </span>
              Create a Google Cloud Project
            </h3>
            <div className="ml-8 space-y-2 text-sm text-gray-600">
              <p>
                Go to the{' '}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Google Cloud Console <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <p>Create a new project or select an existing one.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm">
                2
              </span>
              Enable the Gmail API
            </h3>
            <div className="ml-8 space-y-2 text-sm text-gray-600">
              <p>
                Go to{' '}
                <a
                  href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Gmail API <ExternalLink className="w-3 h-3" />
                </a>{' '}
                and click "Enable".
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm">
                3
              </span>
              Configure OAuth Consent Screen
            </h3>
            <div className="ml-8 space-y-2 text-sm text-gray-600">
              <p>
                Go to{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials/consent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  OAuth consent screen <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Select "External" user type (or Internal if using Google Workspace)</li>
                <li>Fill in app name and your email</li>
                <li>Add scopes: gmail.readonly, gmail.labels</li>
                <li>Add your email as a test user</li>
              </ul>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm">
                4
              </span>
              Create OAuth Credentials
            </h3>
            <div className="ml-8 space-y-2 text-sm text-gray-600">
              <p>
                Go to{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Credentials <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Click "Create Credentials" → "OAuth client ID"</li>
                <li>Select "Web application"</li>
                <li>Add the following redirect URI:</li>
              </ul>
              <div className="flex items-center gap-2 p-2 bg-gray-100 rounded mt-2">
                <code className="text-xs flex-1 break-all">{redirectUri}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(redirectUri)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="mt-2">Copy the Client ID and Client Secret below.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credentials Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>OAuth Credentials</CardTitle>
          <CardDescription>
            Enter your Google OAuth credentials from the Cloud Console
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              placeholder="xxxx.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              type="text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              placeholder="GOCSPX-xxxx"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              type="password"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveCredentials} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Credentials'}
            </Button>
            {hasCredentials && !isConfigured && (
              <Button variant="outline" onClick={handleConnectGmail}>
                <Mail className="w-4 h-4 mr-2" />
                Connect Gmail
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
