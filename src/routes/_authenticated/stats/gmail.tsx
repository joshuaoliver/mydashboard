import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { convexQuery, useConvexAction, useConvexMutation } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Mail,
  ArrowLeft,
  Inbox,
  Settings,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/stats/gmail')({
  component: GmailStatsPage,
})

function GmailStatsPage() {
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deletingId, setDeletingId] = useState<Id<"gmailSnapshots"> | null>(null)

  const triggerSync = useConvexAction(api.gmailSync.triggerManualSync)
  const { mutateAsync: deleteSnapshot } = useConvexMutation(api.gmailSync.deleteSnapshot)

  const { data: settings } = useQuery(
    convexQuery(api.settingsStore.getGmailSettings, {})
  )
  const { data: latestSnapshot } = useQuery({
    ...convexQuery(api.gmailSync.getLatestSnapshot, {}),
    enabled: !!settings?.isConfigured,
  })
  const { data: dailySummary } = useQuery({
    ...convexQuery(api.gmailSync.getDailySummary, { days: 30 }),
    enabled: !!settings?.isConfigured,
  })
  const { data: recentSnapshots } = useQuery({
    ...convexQuery(api.gmailSync.getSnapshots, { limit: 20 }),
    enabled: !!settings?.isConfigured,
  })
  const { data: stats } = useQuery({
    ...convexQuery(api.gmailSync.getStats, {}),
    enabled: !!settings?.isConfigured,
  })

  const isConfigured = settings?.isConfigured ?? false

  // Calculate trend (comparing latest to 24h ago)
  const trend =
    recentSnapshots && recentSnapshots.length > 1
      ? latestSnapshot!.totalInbox - recentSnapshots[recentSnapshots.length - 1].totalInbox
      : 0

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setRefreshResult(null)
    try {
      const result = await triggerSync({})
      if (result.success) {
        setRefreshResult({ type: 'success', message: result.message || 'Synced successfully!' })
      } else {
        setRefreshResult({ type: 'error', message: result.error || 'Sync failed' })
      }
    } catch (e: unknown) {
      setRefreshResult({ type: 'error', message: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDeleteSnapshot = async (id: Id<"gmailSnapshots">) => {
    if (!confirm('Delete this snapshot? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteSnapshot({ id })
      queryClient.invalidateQueries()
    } catch (e) {
      console.error('Failed to delete snapshot:', e)
    } finally {
      setDeletingId(null)
    }
  }

  if (!isConfigured) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/stats" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Stats
          </Link>
          <div className="flex items-center gap-3">
            <Mail className="w-8 h-8 text-red-500" />
            <h1 className="text-3xl font-bold text-gray-900">Gmail Stats</h1>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">Gmail is not connected</p>
            <p className="text-sm text-gray-500 mb-4">
              Set up Gmail integration to start tracking your inbox
            </p>
            <Link to="/settings/gmail">
              <Button>
                <Settings className="w-4 h-4 mr-2" />
                Configure Gmail
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link to="/stats" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Stats
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-8 h-8 text-red-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gmail Stats</h1>
              <p className="text-sm text-gray-600 mt-1">
                Historical inbox tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Syncing...' : 'Refresh'}
            </Button>
            <Link to="/settings/gmail">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
          </div>
        </div>
        {refreshResult && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm border ${
              refreshResult.type === 'success'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {refreshResult.message}
          </div>
        )}
      </div>

      {/* Current Stats */}
      {latestSnapshot && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Inbox</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                {latestSnapshot.totalInbox}
                {trend !== 0 && (
                  <span
                    className={`text-sm font-normal flex items-center ${
                      trend > 0 ? 'text-red-500' : 'text-green-500'
                    }`}
                  >
                    {trend > 0 ? (
                      <TrendingUp className="w-4 h-4 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 mr-1" />
                    )}
                    {trend > 0 ? '+' : ''}
                    {trend}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unread</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                {latestSnapshot.unread}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Primary</CardDescription>
              <CardTitle className="text-3xl">
                {latestSnapshot.primary ?? '-'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Promotions</CardDescription>
              <CardTitle className="text-3xl text-gray-500">
                {latestSnapshot.promotions ?? '-'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Category Breakdown */}
      {latestSnapshot && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Email distribution by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600">Primary</p>
                <p className="text-2xl font-bold text-blue-800">
                  {latestSnapshot.primary ?? 0}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-600">Social</p>
                <p className="text-2xl font-bold text-purple-800">
                  {latestSnapshot.social ?? 0}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600">Promotions</p>
                <p className="text-2xl font-bold text-green-800">
                  {latestSnapshot.promotions ?? 0}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-600">Updates</p>
                <p className="text-2xl font-bold text-yellow-800">
                  {latestSnapshot.updates ?? 0}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Forums</p>
                <p className="text-2xl font-bold text-gray-800">
                  {latestSnapshot.forums ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily History Chart (simplified as table for now) */}
      {dailySummary && dailySummary.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Daily History (Last 30 Days)</CardTitle>
            <CardDescription>End-of-day inbox counts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-1">
              {dailySummary.map((day, idx) => {
                const maxInbox = Math.max(...dailySummary.map((d) => d.totalInbox))
                const height = maxInbox > 0 ? (day.totalInbox / maxInbox) * 100 : 0
                return (
                  <div
                    key={day.date}
                    className="flex-1 bg-red-200 hover:bg-red-300 transition-colors rounded-t cursor-pointer group relative"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                    title={`${day.date}: ${day.totalInbox} emails`}
                  >
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {day.date}: {day.totalInbox}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>{dailySummary[0]?.date}</span>
              <span>{dailySummary[dailySummary.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Snapshots Table */}
      {recentSnapshots && recentSnapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Snapshots</CardTitle>
            <CardDescription>Last {recentSnapshots.length} data points</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Unread</TableHead>
                  <TableHead className="text-right">Primary</TableHead>
                  <TableHead className="text-right">Social</TableHead>
                  <TableHead className="text-right">Promotions</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSnapshots.map((snapshot) => (
                  <TableRow key={snapshot._id}>
                    <TableCell>
                      {new Date(snapshot.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {snapshot.totalInbox}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {snapshot.unread}
                    </TableCell>
                    <TableCell className="text-right">
                      {snapshot.primary ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {snapshot.social ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {snapshot.promotions ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteSnapshot(snapshot._id)}
                        disabled={deletingId === snapshot._id}
                      >
                        <Trash2 className={`h-4 w-4 ${deletingId === snapshot._id ? 'animate-pulse' : ''}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Stats Summary */}
      {stats && (
        <div className="mt-6 text-sm text-gray-500">
          <p>
            Tracking since{' '}
            {stats.oldestSnapshot
              ? new Date(stats.oldestSnapshot).toLocaleDateString()
              : 'N/A'}{' '}
            • {stats.totalSnapshots} snapshots recorded
          </p>
        </div>
      )}
    </div>
  )
}
