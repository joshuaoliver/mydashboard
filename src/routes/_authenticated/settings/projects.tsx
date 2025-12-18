import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
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
import { Plus, Trash2, FolderKanban, Clock, LayoutList, Pencil } from 'lucide-react'
import { useState } from 'react'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/settings/projects')({
  component: ProjectsPage,
})

function ProjectsPage() {
  const { data: projects } = useQuery(
    convexQuery(api.projectsStore.listProjects, {})
  )
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<NonNullable<typeof projects>[0] | null>(null)

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage projects that link Hubstaff time tracking with Linear issues
          </p>
        </div>
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

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">No projects yet</p>
            <p className="text-sm text-gray-500 mb-4">
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
          <FolderKanban className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-lg font-semibold">{project.name}</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Hubstaff Link */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-green-600" />
          {project.hubstaffProjectName ? (
            <span className="text-gray-700">{project.hubstaffProjectName}</span>
          ) : (
            <span className="text-gray-400 italic">No Hubstaff project</span>
          )}
        </div>

        {/* Linear Link */}
        <div className="flex items-center gap-2 text-sm">
          <LayoutList className="w-4 h-4 text-purple-600" />
          {project.linearTeamName ? (
            <span className="text-gray-700">{project.linearTeamName}</span>
          ) : (
            <span className="text-gray-400 italic">No Linear team</span>
          )}
        </div>

        {/* Active Toggle */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-gray-600">Active</span>
          <Switch checked={project.isActive} onCheckedChange={handleToggleActive} />
        </div>

        <CardDescription className="text-xs text-gray-500">
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
          <Label htmlFor="name">Project Name *</Label>
          <Input
            id="name"
            placeholder="My Project"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {/* Hubstaff Section */}
        <div className="space-y-3 p-3 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-800">Hubstaff</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="hubstaffId" className="text-xs">
                Project ID
              </Label>
              <Input
                id="hubstaffId"
                placeholder="12345"
                value={hubstaffProjectId}
                onChange={(e) => setHubstaffProjectId(e.target.value)}
                type="number"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hubstaffName" className="text-xs">
                Project Name
              </Label>
              <Input
                id="hubstaffName"
                placeholder="Hubstaff project name"
                value={hubstaffProjectName}
                onChange={(e) => setHubstaffProjectName(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Linear Section */}
        <div className="space-y-3 p-3 bg-purple-50 rounded-lg">
          <div className="flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-purple-600" />
            <span className="font-medium text-purple-800">Linear</span>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="linearWorkspace" className="text-xs">
                Workspace ID
              </Label>
              <Input
                id="linearWorkspace"
                placeholder="workspace-slug"
                value={linearWorkspaceId}
                onChange={(e) => setLinearWorkspaceId(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="linearTeamId" className="text-xs">
                  Team ID
                </Label>
                <Input
                  id="linearTeamId"
                  placeholder="team-id"
                  value={linearTeamId}
                  onChange={(e) => setLinearTeamId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="linearTeamName" className="text-xs">
                  Team Name
                </Label>
                <Input
                  id="linearTeamName"
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
          <Label htmlFor="active">Active</Label>
          <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
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
