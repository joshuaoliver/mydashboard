import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Mail,
  Clock,
  LayoutList,
  ArrowRight,
  Inbox,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/stats/')({
  component: StatsOverviewPage,
})

function StatsOverviewPage() {
  // Gmail stats
  const { data: gmailSettings } = useQuery(convexQuery(api.settingsStore.getGmailSettings, {}))
  const { data: gmailSnapshot } = useQuery({
    ...convexQuery(api.gmailSync.getLatestSnapshot, {}),
    enabled: !!gmailSettings?.isConfigured,
  })

  // Hubstaff stats
  const { data: hubstaffSettings } = useQuery(convexQuery(api.settingsStore.getHubstaffSettings, {}))
  const { data: hubstaffToday } = useQuery({
    ...convexQuery(api.hubstaffSync.getTodayStats, {}),
    enabled: !!hubstaffSettings?.isConfigured,
  })
  const { data: hubstaffWeek } = useQuery({
    ...convexQuery(api.hubstaffSync.getWeekStats, {}),
    enabled: !!hubstaffSettings?.isConfigured,
  })

  // Linear stats
  const { data: linearStats } = useQuery(convexQuery(api.linearSync.getStats, {}))

  const gmailConfigured = gmailSettings?.isConfigured ?? false
  const hubstaffConfigured = hubstaffSettings?.isConfigured ?? false
  const linearConfigured = (linearStats?.totalWorkspaces ?? 0) > 0

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Stats Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Overview of your Gmail, Hubstaff, and Linear integrations
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Gmail Card */}
        <Link to="/stats/gmail" className="block">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Mail className="w-5 h-5 text-red-500" />
                Gmail
              </CardTitle>
              {gmailConfigured ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Not Set Up
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {gmailConfigured && gmailSnapshot ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">{gmailSnapshot.totalInbox}</p>
                      <p className="text-sm text-gray-500">Total Emails</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-red-600">
                        {gmailSnapshot.unread}
                      </p>
                      <p className="text-sm text-gray-500">Unread</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      Last updated:{' '}
                      {new Date(gmailSnapshot.timestamp).toLocaleTimeString()}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-gray-500">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {gmailConfigured
                      ? 'No data yet - waiting for first sync'
                      : 'Connect Gmail in settings'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Hubstaff Card */}
        <Link to="/stats/hubstaff" className="block">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-500" />
                Hubstaff
              </CardTitle>
              {hubstaffConfigured ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Not Set Up
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {hubstaffConfigured ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">
                        {hubstaffToday?.totalHours?.toFixed(1) ?? '0'}h
                      </p>
                      <p className="text-sm text-gray-500">Today</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-green-600">
                        {hubstaffWeek?.totalHours?.toFixed(1) ?? '0'}h
                      </p>
                      <p className="text-sm text-gray-500">This Week</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      {hubstaffSettings?.selectedUserName || 'Tracking time'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Connect Hubstaff in settings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Linear Card */}
        <Link to="/stats/linear" className="block">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <LayoutList className="w-5 h-5 text-purple-500" />
                Linear
              </CardTitle>
              {linearConfigured ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Not Set Up
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {linearConfigured && linearStats ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">{linearStats.totalIssues}</p>
                      <p className="text-sm text-gray-500">Open Issues</p>
                    </div>
                    <div className="text-right space-y-1">
                      {linearStats.byPriority.urgent > 0 && (
                        <Badge className="bg-red-100 text-red-800">
                          {linearStats.byPriority.urgent} Urgent
                        </Badge>
                      )}
                      {linearStats.byPriority.high > 0 && (
                        <Badge className="bg-orange-100 text-orange-800">
                          {linearStats.byPriority.high} High
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      {linearStats.byStatusType.started} in progress
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-gray-500">
                  <LayoutList className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Connect Linear in settings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Quick Setup</h2>
        <div className="flex flex-wrap gap-3">
          {!gmailConfigured && (
            <Link
              to="/settings/gmail"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Set up Gmail
            </Link>
          )}
          {!hubstaffConfigured && (
            <Link
              to="/settings/hubstaff"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Clock className="w-4 h-4" />
              Set up Hubstaff
            </Link>
          )}
          {!linearConfigured && (
            <Link
              to="/settings/linear"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <LayoutList className="w-4 h-4" />
              Set up Linear
            </Link>
          )}
          <Link
            to="/settings/projects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            Manage Projects
          </Link>
        </div>
      </div>
    </div>
  )
}
