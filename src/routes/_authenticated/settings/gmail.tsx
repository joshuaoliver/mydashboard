import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { useState, useCallback, useEffect } from 'react'

// Define search params for OAuth callback handling
type GmailSearchParams = {
  oauth_success?: string
  oauth_error?: string
}

export const Route = createFileRoute('/_authenticated/settings/gmail')({
  component: GmailSettingsPage,
  validateSearch: (search: Record<string, unknown>): GmailSearchParams => {
    return {
      oauth_success: search.oauth_success as string | undefined,
      oauth_error: search.oauth_error as string | undefined,
    }
  },
})

function GmailSettingsPage() {
  const searchParams = useSearch({ from: '/_authenticated/settings/gmail' })
  const queryClient = useQueryClient()
  
  const { data: settings } = useQuery(
    convexQuery(api.settingsStore.getGmailSettings, {})
  )
  const { data: stats } = useQuery({
    ...convexQuery(api.gmailSync.getStats, {}),
    enabled: !!settings?.isConfigured,
  })

  const setSetting = useConvexMutation(api.settingsStore.setSetting)
  const testConnection = useConvexAction(api.gmailActions.testConnection)

  const [clientId, setClientId] = useState(settings?.clientId ?? '')
  const [clientSecret, setClientSecret] = useState(settings?.clientSecret ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [oauthMessage, setOauthMessage] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Handle OAuth callback results from query params
  useEffect(() => {
    if (searchParams.oauth_success === 'true') {
      setOauthMessage({
        type: 'success',
        message: 'Gmail connected successfully!',
      })
      // Invalidate queries to refresh the settings
      queryClient.invalidateQueries()
      // Clean up URL
      window.history.replaceState({}, '', '/settings/gmail')
    } else if (searchParams.oauth_error) {
      setOauthMessage({
        type: 'error',
        message: `OAuth failed: ${searchParams.oauth_error}`,
      })
      // Clean up URL
      window.history.replaceState({}, '', '/settings/gmail')
    }
  }, [searchParams, queryClient])

  const isConfigured = settings?.isConfigured ?? false
  const hasCredentials = !!(settings?.clientId && settings?.clientSecret)

  // Get the Convex HTTP endpoint URL for OAuth redirect
  // This goes directly to Convex server, bypassing client-side routing issues
  const convexSiteUrl = import.meta.env.VITE_CONVEX_URL?.replace('.cloud', '.site') || ''
  const redirectUri = convexSiteUrl ? `${convexSiteUrl}/gmail-callback` : ''

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

    if (!redirectUri) {
      alert('Could not determine Convex site URL. Check VITE_CONVEX_URL.')
      return
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.labels',
    ].join(' ')

    // OAuth redirects directly to Convex HTTP endpoint
    // which handles the code exchange server-side
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', settings.clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    console.log('[Gmail OAuth] Redirecting to Google with redirect_uri:', redirectUri)

    // Redirect in same window (no popup)
    window.location.href = authUrl.toString()
  }, [settings?.clientId, redirectUri])

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
    <div className="p-6">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Mail className="w-8 h-8 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold">Gmail Integration</h1>
            <p className="text-muted-foreground mt-1">
              Connect your Gmail to track inbox statistics
            </p>
          </div>
        </div>

        {/* OAuth Result Message */}
        {oauthMessage && (
          <div
            className={`p-4 rounded-lg border ${
              oauthMessage.type === 'success'
                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {oauthMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              {oauthMessage.message}
            </div>
          </div>
        )}

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Connection Status</span>
              {isConfigured ? (
                <Badge variant="outline" className="text-green-500 border-green-500">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Connected
                </Badge>
              ) : hasCredentials ? (
                <Badge variant="outline" className="text-amber-500 border-amber-500">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Credentials Set - Authorization Needed
                </Badge>
              ) : (
                <Badge variant="secondary">
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
                  <span className="text-muted-foreground">Current Inbox</span>
                  <p className="text-lg font-semibold">{stats.currentInbox ?? '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Unread</span>
                  <p className="text-lg font-semibold">{stats.currentUnread ?? '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Snapshots</span>
                  <p className="text-lg font-semibold">{stats.totalSnapshots}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Sync</span>
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
                  className={`mt-3 p-3 rounded-lg text-sm border ${
                    testResult.success ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Setup Instructions */}
        <Card>
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
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                  1
                </span>
                Create a Google Cloud Project
              </h3>
              <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                <p>
                  Go to the{' '}
                  <a
                    href="https://console.cloud.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-1"
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
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                  2
                </span>
                Enable the Gmail API
              </h3>
              <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                <p>
                  Go to{' '}
                  <a
                    href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-1"
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
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                  3
                </span>
                Configure OAuth Consent Screen
              </h3>
              <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                <p>
                  Go to{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials/consent"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-1"
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
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                  4
                </span>
                Create OAuth Credentials
              </h3>
              <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                <p>
                  Go to{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-1"
                  >
                    Credentials <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Click "Create Credentials" → "OAuth client ID"</li>
                  <li>Select "Web application"</li>
                  <li>Add the following redirect URI:</li>
                </ul>
                <div className="flex items-center gap-2 p-2 bg-muted rounded mt-2">
                  <code className="text-xs flex-1 break-all">{redirectUri}</code>
                  <Button
                    variant="ghost"
                    size="icon"
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
        <Card>
          <CardHeader>
            <CardTitle>OAuth Credentials</CardTitle>
            <CardDescription>
              Enter your Google OAuth credentials from the Cloud Console
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                placeholder="xxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                type="text"
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <Input
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
    </div>
  )
}
