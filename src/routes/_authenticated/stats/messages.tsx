import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery as useConvexQuery, useAction, useMutation } from 'convex/react'
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
  MessageSquare,
  ArrowLeft,
  Archive,
  Reply,
  RefreshCw,
  Trash2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { useState } from 'react'
import type { Id } from '../../../../convex/_generated/dataModel'
import { formatSydneyDateTime } from '@/lib/timezone'

export const Route = createFileRoute('/_authenticated/stats/messages')({
  component: MessageStatsPage,
})

function MessageStatsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deletingId, setDeletingId] = useState<Id<"messageSnapshots"> | null>(null)

  const triggerCapture = useAction(api.messageStats.triggerManualCapture)
  const deleteSnapshot = useMutation(api.messageStats.deleteSnapshot)

  // Use Convex native useQuery - data is reactive and auto-updates
  const latestSnapshot = useConvexQuery(api.messageStats.getLatestSnapshot, {})
  const dailySummary = useConvexQuery(api.messageStats.getDailySummary, { days: 30 })
  const recentSnapshots = useConvexQuery(api.messageStats.getSnapshots, { limit: 20 })
  const stats = useConvexQuery(api.messageStats.getStats, {})

  // Calculate trend (comparing latest to earliest in recent snapshots)
  const trend =
    recentSnapshots && recentSnapshots.length > 1
      ? latestSnapshot!.needsReplyChats - recentSnapshots[recentSnapshots.length - 1].needsReplyChats
      : 0

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setRefreshResult(null)
    try {
      const result = await triggerCapture({})
      if (result.success) {
        setRefreshResult({ type: 'success', message: result.message || 'Captured successfully!' })
      } else {
        setRefreshResult({ type: 'error', message: result.error || 'Capture failed' })
      }
    } catch (e: unknown) {
      setRefreshResult({ type: 'error', message: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDeleteSnapshot = async (id: Id<"messageSnapshots">) => {
    if (!confirm('Delete this snapshot? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteSnapshot({ id })
      // Convex queries are reactive - they auto-update when backend data changes
    } catch (e) {
      console.error('Failed to delete snapshot:', e)
    } finally {
      setDeletingId(null)
    }
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
            <MessageSquare className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Message Stats</h1>
              <p className="text-sm text-gray-600 mt-1">
                Chat tracking across all networks
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Capturing...' : 'Capture Now'}
          </Button>
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
              <CardDescription>Total Chats</CardDescription>
              <CardTitle className="text-4xl">
                {latestSnapshot.totalChats}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Chats</CardDescription>
              <CardTitle className="text-4xl text-green-600">
                {latestSnapshot.activeChats}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Archive className="w-3 h-3" />
                Archived
              </CardDescription>
              <CardTitle className="text-4xl text-gray-500">
                {latestSnapshot.archivedChats}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Reply className="w-3 h-3" />
                Awaiting Reply
              </CardDescription>
              <CardTitle className="text-4xl flex items-center gap-2 text-orange-600">
                {latestSnapshot.needsReplyChats}
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
        </div>
      )}

      {/* Network Breakdown */}
      {latestSnapshot && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>By Network</CardTitle>
            <CardDescription>Current chat counts per platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <NetworkCard
                name="iMessage"
                total={latestSnapshot.imessageChats || 0}
                needsReply={latestSnapshot.needsReplyImessage || 0}
                color="text-blue-600"
              />
              <NetworkCard
                name="WhatsApp"
                total={latestSnapshot.whatsappChats || 0}
                needsReply={latestSnapshot.needsReplyWhatsapp || 0}
                color="text-green-600"
              />
              <NetworkCard
                name="Instagram"
                total={latestSnapshot.instagramChats || 0}
                needsReply={latestSnapshot.needsReplyInstagram || 0}
                color="text-pink-600"
              />
              <NetworkCard
                name="Facebook"
                total={latestSnapshot.facebookChats || 0}
                needsReply={latestSnapshot.needsReplyFacebook || 0}
                color="text-blue-800"
              />
              <NetworkCard
                name="Telegram"
                total={latestSnapshot.telegramChats || 0}
                needsReply={latestSnapshot.needsReplyTelegram || 0}
                color="text-sky-500"
              />
              <NetworkCard
                name="Other"
                total={latestSnapshot.otherNetworkChats || 0}
                needsReply={latestSnapshot.needsReplyOther || 0}
                color="text-gray-600"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily History Chart */}
      {dailySummary && dailySummary.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Awaiting Reply Trend (Last 30 Days)</CardTitle>
            <CardDescription>Track your response rate over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-1">
              {dailySummary.map((day) => {
                const maxNeedsReply = Math.max(...dailySummary.map((d) => d.needsReplyChats))
                const height = maxNeedsReply > 0 ? (day.needsReplyChats / maxNeedsReply) * 100 : 0
                return (
                  <div
                    key={day.date}
                    className="flex-1 bg-orange-200 hover:bg-orange-300 transition-colors rounded-t cursor-pointer group relative"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                    title={`${day.date}: ${day.needsReplyChats} awaiting reply`}
                  >
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {day.date}: {day.needsReplyChats} awaiting reply
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
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Archived</TableHead>
                  <TableHead className="text-right">Awaiting Reply</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSnapshots.map((snapshot) => (
                  <TableRow key={snapshot._id}>
                    <TableCell>
                      {formatSydneyDateTime(snapshot.timestamp)}
                    </TableCell>
                    <TableCell className="text-right">
                      {snapshot.totalChats}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {snapshot.activeChats}
                    </TableCell>
                    <TableCell className="text-right text-gray-500">
                      {snapshot.archivedChats}
                    </TableCell>
                    <TableCell className="text-right font-medium text-orange-600">
                      {snapshot.needsReplyChats}
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
              ? formatSydneyDateTime(stats.oldestSnapshot)
              : 'N/A'}{' '}
            • {stats.totalSnapshots} snapshots recorded
          </p>
        </div>
      )}
    </div>
  )
}

function NetworkCard({
  name,
  total,
  needsReply,
  color,
}: {
  name: string
  total: number
  needsReply: number
  color: string
}) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className={`font-semibold ${color}`}>{name}</div>
      <div className="text-2xl font-bold">{total}</div>
      {needsReply > 0 && (
        <div className="text-xs text-orange-600 mt-1">
          {needsReply} awaiting reply
        </div>
      )}
    </div>
  )
}
