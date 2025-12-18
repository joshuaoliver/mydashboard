import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Clock,
  ArrowLeft,
  Settings,
  Calendar,
  Briefcase,
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/stats/hubstaff')({
  component: HubstaffStatsPage,
})

function HubstaffStatsPage() {
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.settingsStore.getHubstaffSettings, {})
  )
  const { data: todayStats } = useQuery({
    ...convexQuery(api.hubstaffSync.getTodayStats, {}),
    enabled: !!settings?.isConfigured,
  })
  const { data: weekStats } = useQuery({
    ...convexQuery(api.hubstaffSync.getWeekStats, {}),
    enabled: !!settings?.isConfigured,
  })
  const { data: dailySummaries } = useQuery({
    ...convexQuery(api.hubstaffSync.getDailySummaries, { days: 30 }),
    enabled: !!settings?.isConfigured,
  })
  const { data: recentEntries } = useQuery({
    ...convexQuery(api.hubstaffSync.getTimeEntries, { limit: 20 }),
    enabled: !!settings?.isConfigured,
  })
  const { data: stats } = useQuery({
    ...convexQuery(api.hubstaffSync.getStats, {}),
    enabled: !!settings?.isConfigured,
  })

  const isConfigured = settings?.isConfigured ?? false

  if (!isConfigured) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/stats" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Stats
          </Link>
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-green-500" />
            <h1 className="text-3xl font-bold text-gray-900">Hubstaff Stats</h1>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">Hubstaff is not connected</p>
            <p className="text-sm text-gray-500 mb-4">
              Set up Hubstaff integration to start tracking your time
            </p>
            <Link to="/settings/hubstaff">
              <Button>
                <Settings className="w-4 h-4 mr-2" />
                Configure Hubstaff
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Format seconds to hours:minutes
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
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
            <Clock className="w-8 h-8 text-green-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Hubstaff Stats</h1>
              <p className="text-sm text-gray-600 mt-1">
                {settings?.selectedUserName || 'Time tracking data'}
              </p>
            </div>
          </div>
          <Link to="/settings/hubstaff">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {todayStats?.totalHours?.toFixed(1) ?? '0'}h
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This Week</CardDescription>
            <CardTitle className="text-3xl">
              {weekStats?.totalHours?.toFixed(1) ?? '0'}h
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Days Tracked</CardDescription>
            <CardTitle className="text-3xl">
              {weekStats?.daysTracked ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>All Time</CardDescription>
            <CardTitle className="text-3xl text-gray-600">
              {stats?.totalHoursAllTime?.toFixed(0) ?? '0'}h
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Today's Project Breakdown */}
      {todayStats?.projectBreakdown && todayStats.projectBreakdown.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Today's Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayStats.projectBreakdown.map((project) => {
                const percentage =
                  todayStats.totalSeconds > 0
                    ? (project.seconds / todayStats.totalSeconds) * 100
                    : 0
                return (
                  <div key={project.projectId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{project.projectName}</span>
                      <span className="text-sm text-gray-500">
                        {formatTime(project.seconds)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Chart */}
      {dailySummaries && dailySummaries.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Daily Hours (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end justify-between gap-1">
              {dailySummaries
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((day) => {
                  const maxHours = Math.max(...dailySummaries.map((d) => d.totalHours))
                  const height = maxHours > 0 ? (day.totalHours / maxHours) * 100 : 0
                  return (
                    <div
                      key={day.date}
                      className="flex-1 bg-green-200 hover:bg-green-300 transition-colors rounded-t cursor-pointer group relative"
                      style={{ height: `${height}%`, minHeight: day.totalHours > 0 ? '4px' : '0' }}
                      title={`${day.date}: ${day.totalHours.toFixed(1)}h`}
                    >
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {day.date}: {day.totalHours.toFixed(1)}h
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>{dailySummaries[0]?.date}</span>
              <span>{dailySummaries[dailySummaries.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Time Entries */}
      {recentEntries && recentEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Recent Time Entries
            </CardTitle>
            <CardDescription>Last {recentEntries.length} entries</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEntries.map((entry) => (
                  <TableRow key={entry._id}>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.hubstaffProjectName}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {entry.taskName || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatTime(entry.trackedSeconds)}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.activityPercent ? `${entry.activityPercent}%` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Stats Footer */}
      {stats && (
        <div className="mt-6 text-sm text-gray-500">
          <p>
            Tracking since {stats.oldestEntry || 'N/A'} • {stats.totalEntries} entries •{' '}
            {stats.totalDays} days
          </p>
        </div>
      )}
    </div>
  )
}
