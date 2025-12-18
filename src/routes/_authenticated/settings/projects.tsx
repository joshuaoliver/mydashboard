import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexMutation, useConvexAction } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, FolderKanban, Clock, LayoutList, Pencil, RefreshCw, ChevronRight, Calendar, Play, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/settings/projects')({
  component: ProjectsPage,
})

function ProjectsPage() {
  const { data: projects } = useQuery(
    convexQuery(api.projectsStore.listProjects, {})
  )
  const { data: hubstaffSettings } = useQuery(
    convexQuery(api.settingsStore.getHubstaffSettings, {})
  )
  const { data: linearWorkspaces } = useQuery(
    convexQuery(api.linearActions.listWorkspaces, {})
  )
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<NonNullable<typeof projects>[0] | null>(null)
  const [isSyncSectionOpen, setIsSyncSectionOpen] = useState(false)

  return (
    <div className="p-6">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Manage projects that link Hubstaff time tracking with Linear issues
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsSyncSectionOpen(!isSyncSectionOpen)}>
              <Settings className="w-4 h-4 mr-2" />
              Sync Settings
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <ProjectFormDialog
                onClose={() => setIsCreateDialogOpen(false)}
                isOpen={isCreateDialogOpen}
              />
            </Dialog>
          </div>
        </div>

        {/* Sync Settings Section */}
        {isSyncSectionOpen && (
          <SyncSettingsSection />
        )}

        {(projects?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKanban className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No projects yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create a project to link Hubstaff and Linear data
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(projects ?? []).map((project) => (
              <ProjectCard
                key={project._id}
                project={project}
                onEdit={() => setEditingProject(project)}
              />
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog
          open={editingProject !== null}
          onOpenChange={(open) => !open && setEditingProject(null)}
        >
          {editingProject && (
            <ProjectFormDialog
              project={editingProject}
              onClose={() => setEditingProject(null)}
              isOpen={true}
            />
          )}
        </Dialog>
      </div>
    </div>
  )
}

// ============================================
// Sync Settings Section
// ============================================

function SyncSettingsSection() {
  const triggerHubstaffSync = useConvexAction(api.hubstaffActions.triggerManualSync)
  const triggerLinearSync = useConvexAction(api.linearActions.triggerManualSync)
  
  const [isSyncingHubstaff, setIsSyncingHubstaff] = useState(false)
  const [isSyncingLinear, setIsSyncingLinear] = useState(false)
  const [hubstaffDaysBack, setHubstaffDaysBack] = useState(7)
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleHubstaffSync = async () => {
    setIsSyncingHubstaff(true)
    setSyncResult(null)
    try {
      const result = await triggerHubstaffSync({ daysBack: hubstaffDaysBack })
      setSyncResult({
        type: 'success',
        message: `Hubstaff sync complete! Processed ${result.entriesProcessed ?? 0} entries.`
      })
    } catch (e) {
      setSyncResult({
        type: 'error',
        message: `Hubstaff sync failed: ${e instanceof Error ? e.message : 'Unknown error'}`
      })
    } finally {
      setIsSyncingHubstaff(false)
    }
  }

  const handleLinearSync = async () => {
    setIsSyncingLinear(true)
    setSyncResult(null)
    try {
      const result = await triggerLinearSync({})
      setSyncResult({
        type: 'success',
        message: `Linear sync complete! Processed ${result.totalIssuesProcessed ?? 0} issues.`
      })
    } catch (e) {
      setSyncResult({
        type: 'error',
        message: `Linear sync failed: ${e instanceof Error ? e.message : 'Unknown error'}`
      })
    } finally {
      setIsSyncingLinear(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Sync Settings
        </CardTitle>
        <CardDescription>
          Manually trigger syncs and configure historical data fetching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncResult && (
          <div className={`rounded-lg p-3 text-sm border ${
            syncResult.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-600'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}>
            {syncResult.message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Hubstaff Sync */}
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-500" />
              <span className="font-semibold text-green-600">Hubstaff Sync</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Sync time entries from Hubstaff
            </p>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Days back:</Label>
              <Select
                value={hubstaffDaysBack.toString()}
                onValueChange={(v) => setHubstaffDaysBack(parseInt(v))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleHubstaffSync}
              disabled={isSyncingHubstaff}
              className="w-full"
              variant="outline"
            >
              <Play className={`w-4 h-4 mr-2 ${isSyncingHubstaff ? 'animate-spin' : ''}`} />
              {isSyncingHubstaff ? 'Syncing...' : 'Run Sync'}
            </Button>
          </div>

          {/* Linear Sync */}
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <LayoutList className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-purple-600">Linear Sync</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Sync issues from all active Linear workspaces
            </p>
            <Button
              onClick={handleLinearSync}
              disabled={isSyncingLinear}
              className="w-full mt-auto"
              variant="outline"
            >
              <Play className={`w-4 h-4 mr-2 ${isSyncingLinear ? 'animate-spin' : ''}`} />
              {isSyncingLinear ? 'Syncing...' : 'Run Sync'}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> These syncs run automatically every 15 minutes. Use manual sync for immediate updates or to fetch historical data.
        </p>
      </CardContent>
    </Card>
  )
}

function ProjectCard({
  project,
  onEdit,
}: {
  project: {
    _id: Id<'projects'>
    name: string
    hubstaffProjectId?: number
    hubstaffProjectName?: string
    linearWorkspaceId?: string
    linearTeamId?: string
    linearTeamName?: string
    isActive: boolean
    createdAt: number
  }
  onEdit: () => void
}) {
  const deleteProject = useConvexMutation(api.projectsStore.deleteProject)
  const toggleActive = useConvexMutation(api.projectsStore.toggleProjectActive)

  const handleDelete = () => {
    if (confirm(`Delete project "${project.name}"?`)) {
      deleteProject({ id: project._id }).catch((e) =>
        alert(e.message || 'Failed to delete')
      )
    }
  }

  const handleToggleActive = () => {
    toggleActive({ id: project._id }).catch((e) =>
      alert(e.message || 'Failed to toggle')
    )
  }

  return (
    <Card className={!project.isActive ? 'opacity-60' : ''}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-blue-500" />
          <CardTitle className="text-lg font-semibold">{project.name}</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Hubstaff Link */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-green-500" />
          {project.hubstaffProjectName ? (
            <span>{project.hubstaffProjectName}</span>
          ) : (
            <span className="text-muted-foreground italic">No Hubstaff project</span>
          )}
        </div>

        {/* Linear Link */}
        <div className="flex items-center gap-2 text-sm">
          <LayoutList className="w-4 h-4 text-purple-500" />
          {project.linearTeamName ? (
            <span>{project.linearTeamName}</span>
          ) : (
            <span className="text-muted-foreground italic">No Linear team</span>
          )}
        </div>

        {/* Active Toggle */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">Active</span>
          <Switch checked={project.isActive} onCheckedChange={handleToggleActive} />
        </div>

        <CardDescription className="text-xs">
          Created {new Date(project.createdAt).toLocaleDateString()}
        </CardDescription>
      </CardContent>
    </Card>
  )
}

function ProjectFormDialog({
  project,
  onClose,
  isOpen,
}: {
  project?: {
    _id: Id<'projects'>
    name: string
    hubstaffProjectId?: number
    hubstaffProjectName?: string
    linearWorkspaceId?: string
    linearTeamId?: string
    linearTeamName?: string
    isActive: boolean
  }
  onClose: () => void
  isOpen: boolean
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [hubstaffProjectId, setHubstaffProjectId] = useState(
    project?.hubstaffProjectId?.toString() ?? ''
  )
  const [hubstaffProjectName, setHubstaffProjectName] = useState(
    project?.hubstaffProjectName ?? ''
  )
  const [linearTeamId, setLinearTeamId] = useState(project?.linearTeamId ?? '')
  const [linearTeamName, setLinearTeamName] = useState(project?.linearTeamName ?? '')
  const [linearWorkspaceId, setLinearWorkspaceId] = useState(
    project?.linearWorkspaceId ?? ''
  )
  const [isActive, setIsActive] = useState(project?.isActive ?? true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createProject = useConvexMutation(api.projectsStore.createProject)
  const updateProject = useConvexMutation(api.projectsStore.updateProject)

  const isEdit = !!project

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Please enter a project name')
      return
    }

    setIsSubmitting(true)
    try {
      if (isEdit) {
        await updateProject({
          id: project._id,
          name: name.trim(),
          hubstaffProjectId: hubstaffProjectId ? parseInt(hubstaffProjectId) : null,
          hubstaffProjectName: hubstaffProjectName.trim() || null,
          linearWorkspaceId: linearWorkspaceId.trim() || null,
          linearTeamId: linearTeamId.trim() || null,
          linearTeamName: linearTeamName.trim() || null,
          isActive,
        })
      } else {
        await createProject({
          name: name.trim(),
          hubstaffProjectId: hubstaffProjectId ? parseInt(hubstaffProjectId) : undefined,
          hubstaffProjectName: hubstaffProjectName.trim() || undefined,
          linearWorkspaceId: linearWorkspaceId.trim() || undefined,
          linearTeamId: linearTeamId.trim() || undefined,
          linearTeamName: linearTeamName.trim() || undefined,
          isActive,
        })
      }
      onClose()
    } catch (e: any) {
      alert(e.message || 'Failed to save project')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Project' : 'Create Project'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Update project settings and integrations'
            : 'Create a new project to link Hubstaff and Linear'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Project Name */}
        <div className="space-y-2">
          <Label>Project Name *</Label>
          <Input
            placeholder="My Project"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {/* Hubstaff Section */}
        <div className="space-y-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-500" />
            <span className="font-medium text-green-500">Hubstaff</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Project ID</Label>
              <Input
                placeholder="12345"
                value={hubstaffProjectId}
                onChange={(e) => setHubstaffProjectId(e.target.value)}
                type="number"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Project Name</Label>
              <Input
                placeholder="Hubstaff project name"
                value={hubstaffProjectName}
                onChange={(e) => setHubstaffProjectName(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Linear Section */}
        <div className="space-y-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-purple-500" />
            <span className="font-medium text-purple-500">Linear</span>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Workspace ID</Label>
              <Input
                placeholder="workspace-slug"
                value={linearWorkspaceId}
                onChange={(e) => setLinearWorkspaceId(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Team ID</Label>
                <Input
                  placeholder="team-id"
                  value={linearTeamId}
                  onChange={(e) => setLinearTeamId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Team Name</Label>
                <Input
                  placeholder="Engineering"
                  value={linearTeamName}
                  onChange={(e) => setLinearTeamName(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center justify-between">
          <Label>Active</Label>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Project'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
