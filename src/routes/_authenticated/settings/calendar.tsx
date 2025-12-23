import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useQuery as useConvexQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Calendar,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  AlertCircle,
  ListChecks,
} from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'

type CalendarSearchParams = {
  oauth_success?: string
  oauth_error?: string
}

export const Route = createFileRoute('/_authenticated/settings/calendar')({
  component: CalendarSettingsPage,
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => {
    return {
      oauth_success: search.oauth_success as string | undefined,
      oauth_error: search.oauth_error as string | undefined,
    }
  },
})

function CalendarSettingsPage() {
  const searchParams = useSearch({ from: '/_authenticated/settings/calendar' })

  // Use Convex native useQuery with "skip" for conditional queries
  const calendarSettings = useConvexQuery(api.googleCalendar.getSettings, {})
  const appSettings = useConvexQuery(api.settingsStore.getCalendarSettings, {})
  const todayEvents = useConvexQuery(
    api.googleCalendar.getTodayEvents,
    calendarSettings?.isConfigured ? {} : "skip"
  )
  const calendars = useConvexQuery(
    api.googleCalendar.getCalendars,
    calendarSettings?.isConfigured ? {} : "skip"
  )

  const setSetting = useMutation(api.settingsStore.setSetting)
  const triggerSync = useAction(api.googleCalendar.triggerSync)
  const disconnect = useMutation(api.googleCalendar.disconnect)
  const toggleCalendar = useMutation(api.googleCalendar.toggleCalendar)
  const refreshCalendarList = useAction(api.googleCalendar.refreshCalendarList)

  const [clientId, setClientId] = useState(appSettings?.clientId ?? '')
  const [clientSecret, setClientSecret] = useState(appSettings?.clientSecret ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRefreshingCalendars, setIsRefreshingCalendars] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [oauthMessage, setOauthMessage] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Handle OAuth callback results from query params
  // Note: Convex queries are reactive - they auto-update when backend data changes
  useEffect(() => {
    if (searchParams.oauth_success === 'true') {
      setOauthMessage({
        type: 'success',
        message: 'Google Calendar connected successfully! Loading your calendars...',
      })
      window.history.replaceState({}, '', '/settings/calendar')
      // Auto-fetch calendar list after successful OAuth
      refreshCalendarList({}).then((result) => {
        if (result.success) {
          setOauthMessage({
            type: 'success',
            message: `Connected! Found ${result.count ?? 0} calendars. Select which ones to sync.`,
          })
        }
      }).catch(() => {
        // Silently fail - user can manually refresh
      })
    } else if (searchParams.oauth_error) {
      setOauthMessage({
        type: 'error',
        message: `OAuth failed: ${searchParams.oauth_error}`,
      })
      window.history.replaceState({}, '', '/settings/calendar')
    }
  }, [searchParams, refreshCalendarList])

  // Update local state when settings load
  useEffect(() => {
    if (appSettings) {
      setClientId(appSettings.clientId ?? '')
      setClientSecret(appSettings.clientSecret ?? '')
    }
  }, [appSettings])

  const isConfigured = calendarSettings?.isConfigured ?? false
  const hasCredentials = !!(appSettings?.clientId && appSettings?.clientSecret)

  // Get the Convex HTTP endpoint URL for OAuth redirect
  const convexSiteUrl = import.meta.env.VITE_CONVEX_URL?.replace('.cloud', '.site') || ''
  const redirectUri = convexSiteUrl ? `${convexSiteUrl}/calendar-callback` : ''

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      alert('Please enter both Client ID and Client Secret')
      return
    }

    setIsSaving(true)
    try {
      await setSetting({
        key: 'calendar',
        type: 'oauth',
        value: {
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          isConfigured: false,
        },
      })
      alert('Credentials saved! Now click "Connect Calendar" to authorize.')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save credentials'
      alert(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleConnectCalendar = useCallback(() => {
    if (!appSettings?.clientId) {
      alert('Please save your Client ID first')
      return
    }

    if (!redirectUri) {
      alert('Could not determine Convex site URL. Check VITE_CONVEX_URL.')
      return
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
    ].join(' ')

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', appSettings.clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    console.log('[Calendar OAuth] Redirecting to Google with redirect_uri:', redirectUri)

    window.location.href = authUrl.toString()
  }, [appSettings?.clientId, redirectUri])

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)
    try {
      const result = await triggerSync({})
      if (result.success) {
        setSyncResult({
          success: true,
          message: `Synced ${result.count ?? 0} events for today`,
        })
        // Convex queries are reactive - they auto-update when backend data changes
      } else {
        setSyncResult({
          success: false,
          message: result.error || 'Sync failed',
        })
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sync failed'
      setSyncResult({
        success: false,
        message,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) return
    try {
      await disconnect({})
      // Convex queries are reactive - they auto-update when backend data changes
      setOauthMessage({
        type: 'success',
        message: 'Google Calendar disconnected',
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to disconnect'
      alert(message)
    }
  }

  const handleRefreshCalendars = async () => {
    setIsRefreshingCalendars(true)
    try {
      const result = await refreshCalendarList({})
      if (result.success) {
        setOauthMessage({
          type: 'success',
          message: `Found ${result.count ?? 0} calendars`,
        })
      } else {
        setOauthMessage({
          type: 'error',
          message: result.error || 'Failed to fetch calendars',
        })
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to refresh calendars'
      setOauthMessage({ type: 'error', message })
    } finally {
      setIsRefreshingCalendars(false)
    }
  }

  const handleToggleCalendar = async (calendarId: string, isEnabled: boolean) => {
    try {
      await toggleCalendar({ calendarId, isEnabled })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to toggle calendar'
      alert(message)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold">Google Calendar Integration</h1>
            <p className="text-muted-foreground mt-1">
              Connect your Google Calendar to see your schedule and find free time blocks
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
          {isConfigured && (
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Calendar ID</span>
                    <p className="text-lg font-semibold">{calendarSettings?.calendarId ?? 'primary'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Today's Events</span>
                    <p className="text-lg font-semibold">{todayEvents?.length ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Sync</span>
                    <p className="text-lg font-semibold">
                      {calendarSettings?.lastSyncedAt
                        ? new Date(calendarSettings.lastSyncedAt).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                </div>

                {/* Today's Events Preview */}
                {todayEvents && todayEvents.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Today's Schedule</h4>
                    <div className="space-y-2">
                      {todayEvents.slice(0, 5).map((event) => (
                        <div
                          key={event._id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                        >
                          <span className="font-medium">{event.summary}</span>
                          <span className="text-muted-foreground">
                            {formatTime(event.startTime)} - {formatTime(event.endTime)}
                          </span>
                        </div>
                      ))}
                      {todayEvents.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          +{todayEvents.length - 5} more events
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sync Now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    className="text-destructive hover:text-destructive"
                  >
                    Disconnect
                  </Button>
                </div>
                {syncResult && (
                  <div
                    className={`mt-3 p-3 rounded-lg text-sm border ${
                      syncResult.success
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-destructive/10 text-destructive border-destructive/20'
                    }`}
                  >
                    {syncResult.message}
                  </div>
                )}
              </div>
              </CardContent>
          )}
        </Card>

        {/* Calendar Selection */}
        {isConfigured && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5" />
                  <span>Calendars</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshCalendars}
                  disabled={isRefreshingCalendars}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingCalendars ? 'animate-spin' : ''}`} />
                  Refresh List
                </Button>
              </CardTitle>
              <CardDescription>
                Select which calendars to sync events from. Only enabled calendars will be used in the app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calendars && calendars.length > 0 ? (
                <div className="space-y-3">
                  {calendars.map((calendar) => (
                    <div
                      key={calendar._id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: calendar.backgroundColor ?? '#4285f4' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{calendar.summary}</span>
                            {calendar.primary && (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          {calendar.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {calendar.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground opacity-60">
                            {calendar.accessRole}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={calendar.isEnabled}
                        onCheckedChange={(checked) => handleToggleCalendar(calendar.calendarId, checked)}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-4">
                    ℹ️ Events from disabled calendars will be removed from the app. 
                    Click "Sync Now" after changing calendars to update events.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="mb-3">No calendars loaded yet.</p>
                  <Button
                    variant="outline"
                    onClick={handleRefreshCalendars}
                    disabled={isRefreshingCalendars}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingCalendars ? 'animate-spin' : ''}`} />
                    Load Calendars
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
            <CardDescription>
              Follow these steps to connect your Google Calendar
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
                Enable the Google Calendar API
              </h3>
              <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                <p>
                  Go to{' '}
                  <a
                    href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-1"
                  >
                    Google Calendar API <ExternalLink className="w-3 h-3" />
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
                  <li>Add scopes: calendar.readonly, calendar.events.readonly</li>
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
                <Button variant="outline" onClick={handleConnectCalendar}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Connect Calendar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
