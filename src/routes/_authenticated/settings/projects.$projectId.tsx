import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery as useConvexQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, FolderKanban, Clock, LayoutList, ExternalLink, Calendar, TrendingUp } from 'lucide-react'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/settings/projects/$projectId')({
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  
  // Use Convex native useQuery with "skip" for conditional queries
  const project = useConvexQuery(
    api.projectsStore.getProject, 
    { id: projectId as Id<'projects'> }
  )
  const isLoading = project === undefined

  // Fetch time entries for this project
  const timeEntries = useConvexQuery(
    api.projectsStore.getProjectTimeEntries,
    project?.hubstaffProjectId 
      ? { projectId: projectId as Id<'projects'>, limit: 50 }
      : "skip"
  )

  // Fetch Linear issues for this project
  const linearIssues = useConvexQuery(
    api.projectsStore.getProjectLinearIssues,
    project?.linearTeamId 
      ? { projectId: projectId as Id<'projects'> }
      : "skip"
  )

  // Format seconds to hours:minutes
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="max-w-4xl">
          <Link to="/settings/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Projects
          </Link>
          <p className="text-muted-foreground">Project not found</p>
        </div>
      </div>
    )
  }

  // Calculate stats
  const totalTrackedSeconds = timeEntries?.reduce((sum, e) => sum + e.trackedSeconds, 0) ?? 0
  const totalHours = Math.round((totalTrackedSeconds / 3600) * 100) / 100

  const openIssues = linearIssues?.filter(
    (i) => i.statusType !== 'completed' && i.statusType !== 'canceled'
  ).length ?? 0

  return (
    <div className="p-6">
      <div className="max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <Link to="/settings/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Projects
          </Link>
          <div className="flex items-center gap-3">
            <FolderKanban className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-3xl font-bold">{project.name}</h1>
              <p className="text-muted-foreground">
                {project.isActive ? (
                  <Badge variant="outline" className="text-green-500 border-green-500">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-green-500" />
                Total Time Tracked
              </CardDescription>
              <CardTitle className="text-2xl text-green-600">{totalHours}h</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Time Entries
              </CardDescription>
              <CardTitle className="text-2xl">{timeEntries?.length ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <LayoutList className="w-4 h-4 text-purple-500" />
                Open Issues
              </CardDescription>
              <CardTitle className="text-2xl text-purple-600">{openIssues}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Total Issues
              </CardDescription>
              <CardTitle className="text-2xl">{linearIssues?.length ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Integration Info */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Hubstaff Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-500" />
                Hubstaff Project
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.hubstaffProjectId ? (
                <div className="space-y-2">
                  <p className="font-medium">{project.hubstaffProjectName}</p>
                  <p className="text-sm text-muted-foreground">ID: {project.hubstaffProjectId}</p>
                </div>
              ) : (
                <p className="text-muted-foreground italic">No Hubstaff project linked</p>
              )}
            </CardContent>
          </Card>

          {/* Linear Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutList className="w-5 h-5 text-purple-500" />
                Linear Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.linearTeamId ? (
                <div className="space-y-2">
                  <p className="font-medium">{project.linearTeamName}</p>
                  <p className="text-sm text-muted-foreground">Team ID: {project.linearTeamId}</p>
                  {project.linearWorkspaceId && (
                    <p className="text-sm text-muted-foreground">Workspace: {project.linearWorkspaceId}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No Linear team linked</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Time Entries */}
        {project.hubstaffProjectId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-500" />
                Recent Time Entries
              </CardTitle>
              <CardDescription>Last 50 time entries for this project</CardDescription>
            </CardHeader>
            <CardContent>
              {timeEntries && timeEntries.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead className="text-right">Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.map((entry) => (
                      <TableRow key={entry._id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell className="text-muted-foreground">
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
              ) : (
                <p className="text-muted-foreground text-center py-8">No time entries found</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Linear Issues */}
        {project.linearTeamId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutList className="w-5 h-5 text-purple-500" />
                Linear Issues
              </CardTitle>
              <CardDescription>Issues from this team</CardDescription>
            </CardHeader>
            <CardContent>
              {linearIssues && linearIssues.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linearIssues.map((issue) => (
                      <TableRow key={issue._id}>
                        <TableCell className="font-mono text-sm">
                          {issue.identifier}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {issue.title}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              issue.statusType === 'started' ? 'default' :
                              issue.statusType === 'completed' ? 'secondary' :
                              'outline'
                            }
                          >
                            {issue.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              issue.priority === 1 ? 'destructive' :
                              issue.priority === 2 ? 'default' :
                              'outline'
                            }
                          >
                            {issue.priorityLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <a
                            href={issue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">No issues found</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created</span>
                <p className="font-medium">{new Date(project.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Updated</span>
                <p className="font-medium">{new Date(project.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
