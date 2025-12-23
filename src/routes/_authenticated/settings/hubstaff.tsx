import { createFileRoute } from '@tanstack/react-router'
import { useQuery as useConvexQuery, useAction } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Building2,
  Calendar,
} from 'lucide-react'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/_authenticated/settings/hubstaff')({
  component: HubstaffSettingsPage,
})

function HubstaffSettingsPage() {
  // Use Convex native useQuery with "skip" for conditional queries
  const settings = useConvexQuery(api.settingsStore.getHubstaffSettings, {})
  const stats = useConvexQuery(
    api.hubstaffSync.getStats,
    settings?.isConfigured ? {} : "skip"
  )

  const saveConfiguration = useAction(api.hubstaffActions.saveConfiguration)
  const testConnection = useAction(api.hubstaffActions.testConnection)
  const fetchOrganizations = useAction(api.hubstaffActions.fetchOrganizations)
  const fetchUsers = useAction(api.hubstaffActions.fetchOrganizationUsers)
  const backfillData = useAction(api.hubstaffSync.backfillHistoricalData)

  const [refreshToken, setRefreshToken] = useState('')
  const [organizationId, setOrganizationId] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [organizations, setOrganizations] = useState<
    { id: number; name: string }[]
  >([])
  const [users, setUsers] = useState<{ id: number; name: string }[]>([])
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const isConfigured = settings?.isConfigured ?? false

  // Sync state from settings when they load
  // IMPORTANT: Always sync the refresh token from settings because Hubstaff uses
  // rotating refresh tokens - after each use, a new one is issued and the old one is invalid
  useEffect(() => {
    if (settings) {
      // Always use the latest refresh token from the database
      if (settings.refreshToken) {
        setRefreshToken(settings.refreshToken)
      }
      if (settings.organizationId && !organizationId) {
        setOrganizationId(settings.organizationId)
      }
      if (settings.selectedUserId && !selectedUserId) {
        setSelectedUserId(settings.selectedUserId)
      }
    }
  }, [settings])

  // Load organizations when refresh token changes
  const handleLoadOrganizations = async () => {
    if (!refreshToken.trim()) {
      alert('Please enter a refresh token first')
      return
    }

    setIsLoadingOrgs(true)
    try {
      // Save the token first so the backend can use it for fetching orgs
      // This also validates the token and stores the new access token
      const result = await saveConfiguration({
        refreshToken: refreshToken.trim(),
        organizationId: 0, // Temporary - will be updated when user selects one
      })

      if (!result.success) {
        throw new Error('Failed to save token')
      }

      // Now fetch organizations using the stored token
      const orgs = await fetchOrganizations({})
      setOrganizations(orgs.map((o) => ({ id: o.id, name: o.name })))

      if (orgs.length === 1) {
        setOrganizationId(orgs[0].id)
      }
    } catch (e: any) {
      alert('Failed to load organizations: ' + (e.message || 'Unknown error'))
    } finally {
      setIsLoadingOrgs(false)
    }
  }

  // Load users when organization is selected
  useEffect(() => {
    if (organizationId && refreshToken) {
      loadUsers(organizationId)
    }
  }, [organizationId])

  const loadUsers = async (orgId: number) => {
    setIsLoadingUsers(true)
    try {
      const fetchedUsers = await fetchUsers({ organizationId: orgId })
      setUsers(fetchedUsers.map((u) => ({ id: u.id, name: u.name })))
    } catch (e: any) {
      console.error('Failed to load users:', e)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const handleSave = async () => {
    if (!refreshToken.trim()) {
      alert('Please enter a refresh token')
      return
    }
    if (!organizationId) {
      alert('Please select an organization')
      return
    }
    if (!selectedUserId) {
      alert('Please select a user to track')
      return
    }

    setIsSaving(true)
    try {
      const selectedOrg = organizations.find((o) => o.id === organizationId)
      const selectedUser = users.find((u) => u.id === selectedUserId)

      await saveConfiguration({
        refreshToken: refreshToken.trim(),
        organizationId,
        organizationName: selectedOrg?.name,
        selectedUserId,
        selectedUserName: selectedUser?.name,
      })

      alert('Configuration saved successfully!')
    } catch (e: any) {
      alert('Failed to save: ' + (e.message || 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection({})
      if (result.success) {
        setTestResult({
          success: true,
          message: result.message || 'Connected successfully!',
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

  return (
    <div className="p-6">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Clock className="w-8 h-8 text-green-500" />
          <div>
            <h1 className="text-2xl font-bold">Hubstaff Integration</h1>
            <p className="text-muted-foreground mt-1">
              Connect Hubstaff to track your time entries
            </p>
          </div>
        </div>

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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Organization</span>
                  <p className="text-lg font-semibold">{settings?.organizationName || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tracking User</span>
                  <p className="text-lg font-semibold">{settings?.selectedUserName || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Entries</span>
                  <p className="text-lg font-semibold">{stats?.totalEntries ?? 0}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Hours</span>
                  <p className="text-lg font-semibold">{stats?.totalHoursAllTime ?? 0}h</p>
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
              You'll need a Hubstaff refresh token to connect
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-500">
              <p className="font-medium mb-2">Getting your Refresh Token:</p>
              <p>
                The refresh token is reused from your existing Hubstaff integration in 
                transdirect-pm. You can find it in the config.json file of that project,
                or generate a new one through Hubstaff's OAuth flow.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Form */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Enter your Hubstaff credentials and select which user to track
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Refresh Token */}
            <div className="space-y-2">
              <Label>Refresh Token</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIs..."
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  type="password"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleLoadOrganizations}
                  disabled={isLoadingOrgs || !refreshToken.trim()}
                >
                  {isLoadingOrgs ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )}
                  <span className="ml-2">Load Orgs</span>
                </Button>
              </div>
            </div>

            {/* Organization Selection */}
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select
                value={organizationId?.toString() ?? ''}
                onValueChange={(v) => setOrganizationId(parseInt(v))}
                disabled={organizations.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an organization..." />
                </SelectTrigger>
                <SelectContent>
                  {organizations
                    .filter((org) => org.id != null)
                    .map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {organizations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Enter your refresh token and click "Load Orgs" to see organizations
                </p>
              )}
            </div>

            {/* User Selection */}
            <div className="space-y-2">
              <Label>User to Track</Label>
              <Select
                value={selectedUserId?.toString() ?? ''}
                onValueChange={(v) => setSelectedUserId(parseInt(v))}
                disabled={users.length === 0 || isLoadingUsers}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={isLoadingUsers ? 'Loading users...' : 'Select a user...'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((user) => user.id != null)
                    .map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {users.length === 0 && organizationId && !isLoadingUsers && (
                <p className="text-xs text-muted-foreground">No users found in this organization</p>
              )}
            </div>

            {/* Save Button */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={isSaving || !selectedUserId}>
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Backfill Historical Data */}
        {isConfigured && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Load Historical Data
              </CardTitle>
              <CardDescription>
                Import your past time entries from Hubstaff
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will fetch and store your time entries from the last 30 days. 
                Use this when first setting up or if you're missing data.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    setIsBackfilling(true)
                    setBackfillResult(null)
                    try {
                      const result = await backfillData({ days: 30 })
                      if (result.success) {
                        setBackfillResult({
                          success: true,
                          message: result.message || 'Backfill completed successfully!',
                        })
                      } else {
                        setBackfillResult({
                          success: false,
                          message: result.error || 'Backfill failed',
                        })
                      }
                    } catch (e: any) {
                      setBackfillResult({
                        success: false,
                        message: e.message || 'Backfill failed',
                      })
                    } finally {
                      setIsBackfilling(false)
                    }
                  }}
                  disabled={isBackfilling}
                >
                  <Calendar className={`w-4 h-4 mr-2 ${isBackfilling ? 'animate-pulse' : ''}`} />
                  {isBackfilling ? 'Loading...' : 'Load Last 30 Days'}
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setIsBackfilling(true)
                    setBackfillResult(null)
                    try {
                      const result = await backfillData({ days: 90 })
                      if (result.success) {
                        setBackfillResult({
                          success: true,
                          message: result.message || 'Backfill completed successfully!',
                        })
                      } else {
                        setBackfillResult({
                          success: false,
                          message: result.error || 'Backfill failed',
                        })
                      }
                    } catch (e: any) {
                      setBackfillResult({
                        success: false,
                        message: e.message || 'Backfill failed',
                      })
                    } finally {
                      setIsBackfilling(false)
                    }
                  }}
                  disabled={isBackfilling}
                >
                  {isBackfilling ? 'Loading...' : 'Load Last 90 Days'}
                </Button>
              </div>
              {backfillResult && (
                <div
                  className={`p-3 rounded-lg text-sm border ${
                    backfillResult.success
                      ? 'bg-green-500/10 text-green-500 border-green-500/20'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  {backfillResult.message}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
