import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexAction } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Mail,
  Clock,
  LayoutList,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings,
  Calendar,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { formatSydneyDateTime } from '@/lib/timezone'

export const Route = createFileRoute('/_authenticated/settings/integrations')({
  component: IntegrationsPage,
})

function IntegrationsPage() {
  // Gmail
  const { data: gmailSettings } = useQuery(
    convexQuery(api.settingsStore.getGmailSettings, {})
  )
  const { data: gmailStats } = useQuery({
    ...convexQuery(api.gmailSync.getStats, {}),
    enabled: !!gmailSettings?.isConfigured,
  })
  const gmailSync = useConvexAction(api.gmailSync.triggerManualSync)

  // Hubstaff
  const { data: hubstaffSettings } = useQuery(
    convexQuery(api.settingsStore.getHubstaffSettings, {})
  )
  const { data: hubstaffStats } = useQuery({
    ...convexQuery(api.hubstaffSync.getStats, {}),
    enabled: !!hubstaffSettings?.isConfigured,
  })
  const hubstaffSync = useConvexAction(api.hubstaffSync.triggerManualSync)
  const hubstaffBackfill = useConvexAction(api.hubstaffSync.backfillHistoricalData)

  // Linear
  const { data: linearStats } = useQuery(
    convexQuery(api.linearSync.getStats, {})
  )
  const linearSync = useConvexAction(api.linearSync.triggerManualSync)

  // State for sync/backfill operations
  const [syncing, setSyncing] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [hubstaffDays, setHubstaffDays] = useState(30)

  const gmailConfigured = gmailSettings?.isConfigured ?? false
  const hubstaffConfigured = hubstaffSettings?.isConfigured ?? false
  const linearConfigured = (linearStats?.totalWorkspaces ?? 0) > 0

  const handleSync = async (integration: string, syncFn: () => Promise<any>) => {
    setSyncing(integration)
    setResults((prev) => ({ ...prev, [integration]: undefined as any }))
    try {
      const result = await syncFn()
      setResults((prev) => ({
        ...prev,
        [integration]: {
          success: result.success,
          message: result.success ? (result.message || 'Synced successfully!') : (result.error || 'Sync failed'),
        },
      }))
    } catch (e: any) {
      setResults((prev) => ({
        ...prev,
        [integration]: {
          success: false,
          message: e.message || 'Sync failed',
        },
      }))
    } finally {
      setSyncing(null)
    }
  }

  const handleHubstaffBackfill = async (days: number) => {
    setSyncing('hubstaff-backfill')
    setResults((prev) => ({ ...prev, 'hubstaff-backfill': undefined as any }))
    try {
      const result = await hubstaffBackfill({ days })
      setResults((prev) => ({
        ...prev,
        'hubstaff-backfill': {
          success: result.success,
          message: result.success
            ? (result.message || `Loaded ${result.entriesProcessed} entries`)
            : (result.error || 'Backfill failed'),
        },
      }))
    } catch (e: any) {
      setResults((prev) => ({
        ...prev,
        'hubstaff-backfill': {
          success: false,
          message: e.message || 'Backfill failed',
        },
      }))
    } finally {
      setSyncing(null)
    }
  }

  const integrations = [
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Inbox statistics and email tracking',
      icon: Mail,
      iconColor: 'text-red-500',
      configured: gmailConfigured,
      settingsPath: '/settings/gmail',
      statsPath: '/stats/gmail',
      stats: gmailConfigured
        ? {
            'Total Snapshots': gmailStats?.totalSnapshots ?? 0,
            'Last Sync': gmailStats?.newestSnapshot
              ? formatSydneyDateTime(gmailStats.newestSnapshot)
              : 'Never',
          }
        : null,
      onSync: () => handleSync('gmail', () => gmailSync({})),
      canBackfill: false,
    },
    {
      id: 'hubstaff',
      name: 'Hubstaff',
      description: 'Time tracking and productivity data',
      icon: Clock,
      iconColor: 'text-green-500',
      configured: hubstaffConfigured,
      settingsPath: '/settings/hubstaff',
      statsPath: '/stats/hubstaff',
      stats: hubstaffConfigured
        ? {
            'Total Entries': hubstaffStats?.totalEntries ?? 0,
            'Total Hours': `${hubstaffStats?.totalHoursAllTime ?? 0}h`,
            'First Entry': hubstaffStats?.oldestEntry ?? 'N/A',
          }
        : null,
      onSync: () => handleSync('hubstaff', () => hubstaffSync({})),
      canBackfill: true,
      onBackfill: handleHubstaffBackfill,
    },
    {
      id: 'linear',
      name: 'Linear',
      description: 'Issue tracking and task management',
      icon: LayoutList,
      iconColor: 'text-purple-500',
      configured: linearConfigured,
      settingsPath: '/settings/linear',
      statsPath: '/stats/linear',
      stats: linearConfigured
        ? {
            'Open Issues': linearStats?.totalIssues ?? 0,
            'Workspaces': linearStats?.totalWorkspaces ?? 0,
            'Last Sync': linearStats?.lastSyncedAt
              ? formatSydneyDateTime(linearStats.lastSyncedAt)
              : 'Never',
          }
        : null,
      onSync: () => handleSync('linear', () => linearSync({})),
      canBackfill: false,
    },
  ]

  return (
    <div className="p-6">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Zap className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-muted-foreground mt-1">
              Manage all your connected services and sync data
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Quick Sync
            </CardTitle>
            <CardDescription>
              Sync all configured integrations at once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={async () => {
                if (gmailConfigured) await handleSync('gmail', () => gmailSync({}))
                if (hubstaffConfigured) await handleSync('hubstaff', () => hubstaffSync({}))
                if (linearConfigured) await handleSync('linear', () => linearSync({}))
              }}
              disabled={syncing !== null}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync All
            </Button>
          </CardContent>
        </Card>

        {/* Integration Cards */}
        {integrations.map((integration) => {
          const Icon = integration.icon
          const isSyncing = syncing === integration.id
          const isBackfilling = syncing === `${integration.id}-backfill`
          const syncResult = results[integration.id]
          const backfillResult = results[`${integration.id}-backfill`]

          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${integration.iconColor}`} />
                    {integration.name}
                  </CardTitle>
                  {integration.configured ? (
                    <Badge variant="outline" className="text-green-500 border-green-500">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="w-3 h-3 mr-1" />
                      Not Configured
                    </Badge>
                  )}
                </div>
                <CardDescription>{integration.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                {integration.stats && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                    {Object.entries(integration.stats).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {integration.configured ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={integration.onSync}
                        disabled={syncing !== null}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                      </Button>
                      <Link to={integration.statsPath}>
                        <Button variant="outline" size="sm">
                          View Stats
                        </Button>
                      </Link>
                      <Link to={integration.settingsPath}>
                        <Button variant="ghost" size="sm">
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <Link to={integration.settingsPath}>
                      <Button size="sm">
                        <Settings className="w-4 h-4 mr-2" />
                        Configure
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Sync Result */}
                {syncResult && (
                  <div
                    className={`p-3 rounded-lg text-sm border ${
                      syncResult.success
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-destructive/10 text-destructive border-destructive/20'
                    }`}
                  >
                    {syncResult.message}
                  </div>
                )}

                {/* Backfill Section */}
                {integration.canBackfill && integration.configured && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Load Historical Data</span>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Days to load</Label>
                        <Input
                          type="number"
                          value={hubstaffDays}
                          onChange={(e) => setHubstaffDays(parseInt(e.target.value) || 30)}
                          className="w-24 h-9"
                          min={1}
                          max={365}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => integration.onBackfill?.(hubstaffDays)}
                        disabled={syncing !== null}
                      >
                        <Calendar className={`w-4 h-4 mr-2 ${isBackfilling ? 'animate-pulse' : ''}`} />
                        {isBackfilling ? 'Loading...' : `Load ${hubstaffDays} Days`}
                      </Button>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setHubstaffDays(30); integration.onBackfill?.(30) }}
                          disabled={syncing !== null}
                        >
                          30d
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setHubstaffDays(90); integration.onBackfill?.(90) }}
                          disabled={syncing !== null}
                        >
                          90d
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setHubstaffDays(180); integration.onBackfill?.(180) }}
                          disabled={syncing !== null}
                        >
                          6mo
                        </Button>
                      </div>
                    </div>
                    {backfillResult && (
                      <div
                        className={`mt-3 p-3 rounded-lg text-sm border ${
                          backfillResult.success
                            ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }`}
                      >
                        {backfillResult.message}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
