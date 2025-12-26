import { createFileRoute, Link } from '@tanstack/react-router'
import { useCachedQuery } from '@/lib/convex-cache'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Mail,
  Clock,
  LayoutList,
  Inbox,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  Reply,
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/reflect/stats')({
  component: ReflectStatsPage,
})

function ReflectStatsPage() {
  // Gmail stats (with caching)
  const gmailSettings = useCachedQuery(api.settingsStore.getGmailSettings, {})
  const gmailSnapshot = useCachedQuery(
    api.gmailSync.getLatestSnapshot,
    gmailSettings?.isConfigured ? {} : "skip"
  )

  // Hubstaff stats (with caching)
  const hubstaffSettings = useCachedQuery(api.settingsStore.getHubstaffSettings, {})
  const hubstaffToday = useCachedQuery(
    api.hubstaffSync.getTodayStats,
    hubstaffSettings?.isConfigured ? {} : "skip"
  )
  const hubstaffWeek = useCachedQuery(
    api.hubstaffSync.getWeekStats,
    hubstaffSettings?.isConfigured ? {} : "skip"
  )

  // Linear stats (with caching)
  const linearStats = useCachedQuery(api.linearSync.getStats, {})

  // Message stats (with caching)
  const messageSnapshot = useCachedQuery(api.messageStats.getLatestSnapshot, {})

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Messages Card */}
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              Messages
            </CardTitle>
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </CardHeader>
          <CardContent>
            {messageSnapshot ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{messageSnapshot.activeChats}</p>
                    <p className="text-sm text-gray-500">Active Chats</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-orange-600">
                      {messageSnapshot.needsReplyChats}
                    </p>
                    <p className="text-sm text-gray-500 flex items-center justify-end gap-1">
                      <Reply className="w-3 h-3" />
                      Awaiting Reply
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {messageSnapshot.archivedChats} archived
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gmail Card */}
        <Card className="h-full">
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
                <div className="text-sm text-gray-500">
                  Last updated: {new Date(gmailSnapshot.timestamp).toLocaleTimeString()}
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

        {/* Hubstaff Card */}
        <Card className="h-full">
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
                <div className="text-sm text-gray-500">
                  {hubstaffSettings?.selectedUserName || 'Tracking time'}
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

        {/* Linear Card */}
        <Card className="h-full">
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
                <div className="text-sm text-gray-500">
                  {linearStats.byStatusType.started} in progress
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
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Quick Setup</h2>
        <div className="flex flex-wrap gap-3">
          {!gmailConfigured && (
            <Link
              to="/settings/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Set up Gmail
            </Link>
          )}
          {!hubstaffConfigured && (
            <Link
              to="/settings/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Clock className="w-4 h-4" />
              Set up Hubstaff
            </Link>
          )}
          {!linearConfigured && (
            <Link
              to="/settings/integrations"
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

