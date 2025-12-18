import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LayoutList,
  ArrowLeft,
  Settings,
  ExternalLink,
  AlertCircle,
  Circle,
  ArrowUpCircle,
  MinusCircle,
  ArrowDownCircle,
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/stats/linear')({
  component: LinearStatsPage,
})

function LinearStatsPage() {
  const { data: issuesByWorkspace } = useQuery(
    convexQuery(api.linearSync.getIssuesByWorkspace, {})
  )
  const { data: stats } = useQuery(convexQuery(api.linearSync.getStats, {}))

  const hasWorkspaces = (stats?.totalWorkspaces ?? 0) > 0

  // Priority icons and colors
  const priorityConfig: Record<
    number,
    { icon: typeof AlertCircle; color: string; label: string }
  > = {
    0: { icon: MinusCircle, color: 'text-gray-400', label: 'No Priority' },
    1: { icon: AlertCircle, color: 'text-red-500', label: 'Urgent' },
    2: { icon: ArrowUpCircle, color: 'text-orange-500', label: 'High' },
    3: { icon: Circle, color: 'text-yellow-500', label: 'Medium' },
    4: { icon: ArrowDownCircle, color: 'text-blue-500', label: 'Low' },
  }

  // Status type colors
  const statusTypeColors: Record<string, string> = {
    backlog: 'bg-gray-100 text-gray-700',
    unstarted: 'bg-gray-100 text-gray-700',
    started: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    canceled: 'bg-red-100 text-red-700',
  }

  if (!hasWorkspaces) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/stats" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Stats
          </Link>
          <div className="flex items-center gap-3">
            <LayoutList className="w-8 h-8 text-purple-500" />
            <h1 className="text-3xl font-bold text-gray-900">Linear Tasks</h1>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LayoutList className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">No Linear workspaces connected</p>
            <p className="text-sm text-gray-500 mb-4">
              Add a Linear workspace to start tracking your issues
            </p>
            <Link to="/settings/linear">
              <Button>
                <Settings className="w-4 h-4 mr-2" />
                Configure Linear
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
            <LayoutList className="w-8 h-8 text-purple-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Linear Tasks</h1>
              <p className="text-sm text-gray-600 mt-1">
                {stats?.totalIssues} open issues across {stats?.totalWorkspaces} workspace(s)
              </p>
            </div>
          </div>
          <Link to="/settings/linear">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Priority Summary */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <Card className={stats.byPriority.urgent > 0 ? 'border-red-200 bg-red-50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Urgent
              </CardDescription>
              <CardTitle className="text-2xl text-red-600">
                {stats.byPriority.urgent}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={stats.byPriority.high > 0 ? 'border-orange-200 bg-orange-50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <ArrowUpCircle className="w-4 h-4 text-orange-500" />
                High
              </CardDescription>
              <CardTitle className="text-2xl text-orange-600">
                {stats.byPriority.high}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Circle className="w-4 h-4 text-yellow-500" />
                Medium
              </CardDescription>
              <CardTitle className="text-2xl">{stats.byPriority.medium}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <ArrowDownCircle className="w-4 h-4 text-blue-500" />
                Low
              </CardDescription>
              <CardTitle className="text-2xl">{stats.byPriority.low}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <MinusCircle className="w-4 h-4 text-gray-400" />
                No Priority
              </CardDescription>
              <CardTitle className="text-2xl text-gray-500">
                {stats.byPriority.none}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Status Summary */}
      {stats && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>By Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm">
                  Backlog: {stats.byStatusType.backlog}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-sm">
                  Todo: {stats.byStatusType.unstarted}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm">
                  In Progress: {stats.byStatusType.started}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issues by Workspace */}
      {(issuesByWorkspace ?? []).map((workspace) => (
        <Card key={workspace.workspaceId} className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{workspace.workspaceName}</span>
              <Badge variant="outline">{workspace.issues.length} issues</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workspace.issues.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No open issues assigned to you
                </p>
              ) : (
                workspace.issues.map((issue) => {
                  const PriorityIcon = priorityConfig[issue.priority]?.icon || Circle
                  const priorityColor =
                    priorityConfig[issue.priority]?.color || 'text-gray-400'

                  return (
                    <a
                      key={issue._id}
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <PriorityIcon className={`w-5 h-5 mt-0.5 ${priorityColor}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-500 font-mono">
                                {issue.identifier}
                              </span>
                              <Badge
                                className={
                                  statusTypeColors[issue.statusType] ||
                                  'bg-gray-100 text-gray-700'
                                }
                              >
                                {issue.status}
                              </Badge>
                            </div>
                            <h3 className="font-medium text-gray-900 truncate">
                              {issue.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span>{issue.teamName}</span>
                              {issue.dueDate && (
                                <>
                                  <span>•</span>
                                  <span>Due: {issue.dueDate}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </a>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Last Synced */}
      {stats?.lastSyncedAt && (
        <div className="mt-6 text-sm text-gray-500">
          <p>Last synced: {new Date(stats.lastSyncedAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  )
}
