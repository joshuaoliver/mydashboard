import { createFileRoute, Link } from '@tanstack/react-router'
import { useCachedQuery } from '@/lib/convex-cache'
import { api } from '~/../convex/_generated/api'
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
  ArrowRight,
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/reflect/stats/')({
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
    <div className="p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Stats Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your Gmail, Hubstaff, and Linear integrations
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Messages Card */}
        <Link to="/reflect/stats/messages" className="block">
          <Card className="h-full hover:border-blue-300 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Messages
              </CardTitle>
              <Badge variant="outline" className="text-green-600 border-green-300">
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
                      <p className="text-sm text-muted-foreground">Active Chats</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-orange-500">
                        {messageSnapshot.needsReplyChats}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center justify-end gap-1">
                        <Reply className="w-3 h-3" />
                        Awaiting Reply
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{messageSnapshot.archivedChats} archived</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No data yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Gmail Card */}
        <Link to="/reflect/stats/gmail" className="block">
          <Card className="h-full hover:border-red-300 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Mail className="w-5 h-5 text-red-500" />
                Gmail
              </CardTitle>
              {gmailConfigured ? (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">Total Emails</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-red-500">
                        {gmailSnapshot.unread}
                      </p>
                      <p className="text-sm text-muted-foreground">Unread</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Updated: {new Date(gmailSnapshot.timestamp).toLocaleTimeString()}</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-muted-foreground">
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
        <Link to="/reflect/stats/hubstaff" className="block">
          <Card className="h-full hover:border-green-300 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-500" />
                Hubstaff
              </CardTitle>
              {hubstaffConfigured ? (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">Today</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-green-500">
                        {hubstaffWeek?.totalHours?.toFixed(1) ?? '0'}h
                      </p>
                      <p className="text-sm text-muted-foreground">This Week</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{hubstaffSettings?.selectedUserName || 'Tracking time'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Connect Hubstaff in settings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Linear Card */}
        <Link to="/reflect/stats/linear" className="block">
          <Card className="h-full hover:border-purple-300 transition-colors cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <LayoutList className="w-5 h-5 text-purple-500" />
              Linear
            </CardTitle>
            {linearConfigured ? (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground">Open Issues</p>
                  </div>
                  <div className="text-right space-y-1">
                    {linearStats.byPriority.urgent > 0 && (
                      <Badge variant="destructive">
                        {linearStats.byPriority.urgent} Urgent
                      </Badge>
                    )}
                    {linearStats.byPriority.high > 0 && (
                      <Badge variant="outline" className="text-orange-500 border-orange-300">
                        {linearStats.byPriority.high} High
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{linearStats.byStatusType.started} in progress</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-muted-foreground">
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
              to="/settings/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/20"
            >
              <Mail className="w-4 h-4" />
              Set up Gmail
            </Link>
          )}
          {!hubstaffConfigured && (
            <Link
              to="/settings/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors border border-green-500/20"
            >
              <Clock className="w-4 h-4" />
              Set up Hubstaff
            </Link>
          )}
          {!linearConfigured && (
            <Link
              to="/settings/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-500 rounded-lg hover:bg-purple-500/20 transition-colors border border-purple-500/20"
            >
              <LayoutList className="w-4 h-4" />
              Set up Linear
            </Link>
          )}
          <Link
            to="/settings/projects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors border border-blue-500/20"
          >
            <TrendingUp className="w-4 h-4" />
            Manage Projects
          </Link>
        </div>
      </div>
    </div>
  )
}

