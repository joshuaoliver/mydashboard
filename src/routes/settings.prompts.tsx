import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/settings/prompts')({
  component: PromptsPage,
})

interface PromptFormData {
  name: string
  title: string
  description: string
}

function PromptsPage() {
  const { data: prompts } = useSuspenseQuery(
    convexQuery(api.prompts.listPrompts, {})
  )

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<{
    id: Id<'prompts'>
    name: string
    title: string
    description: string
  } | null>(null)

  const { mutate: createPrompt } = useConvexMutation(api.prompts.createPrompt)
  const { mutate: updatePrompt } = useConvexMutation(api.prompts.updatePrompt)
  const { mutate: deletePrompt } = useConvexMutation(api.prompts.deletePrompt)

  const [formData, setFormData] = useState<PromptFormData>({
    name: '',
    title: '',
    description: '',
  })

  const handleCreatePrompt = () => {
    if (!formData.name || !formData.title || !formData.description) {
      alert('Please fill in all fields')
      return
    }

    createPrompt(
      {
        name: formData.name,
        title: formData.title,
        description: formData.description,
      },
      {
        onSuccess: () => {
          setFormData({ name: '', title: '', description: '' })
          setIsCreateDialogOpen(false)
        },
        onError: (error) => {
          alert(error.message)
        },
      }
    )
  }

  const handleEditPrompt = () => {
    if (!editingPrompt) return
    
    if (!formData.name || !formData.title || !formData.description) {
      alert('Please fill in all fields')
      return
    }

    updatePrompt(
      {
        id: editingPrompt.id,
        name: formData.name,
        title: formData.title,
        description: formData.description,
      },
      {
        onSuccess: () => {
          setFormData({ name: '', title: '', description: '' })
          setEditingPrompt(null)
          setIsEditDialogOpen(false)
        },
        onError: (error) => {
          alert(error.message)
        },
      }
    )
  }

  const handleDeletePrompt = (id: Id<'prompts'>) => {
    if (confirm('Are you sure you want to delete this prompt?')) {
      deletePrompt(
        { id },
        {
          onError: (error) => {
            alert(error.message)
          },
        }
      )
    }
  }

  const openEditDialog = (prompt: {
    _id: Id<'prompts'>
    name: string
    title: string
    description: string
  }) => {
    setEditingPrompt({
      id: prompt._id,
      name: prompt.name,
      title: prompt.title,
      description: prompt.description,
    })
    setFormData({
      name: prompt.name,
      title: prompt.title,
      description: prompt.description,
    })
    setIsEditDialogOpen(true)
  }

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false)
    setFormData({ name: '', title: '', description: '' })
  }

  const closeEditDialog = () => {
    setIsEditDialogOpen(false)
    setEditingPrompt(null)
    setFormData({ name: '', title: '', description: '' })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Prompts</h1>
            <p className="text-gray-500 mt-1">
              Manage your AI prompts and templates
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Prompt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Prompt</DialogTitle>
                <DialogDescription>
                  Add a new prompt to your collection
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="create-name">Name</Label>
                  <Input
                    id="create-name"
                    placeholder="e.g., code-review"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    A unique identifier (use lowercase and hyphens)
                  </p>
                </div>
                <div>
                  <Label htmlFor="create-title">Title</Label>
                  <Input
                    id="create-title"
                    placeholder="e.g., Code Review Assistant"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Display name for the prompt
                  </p>
                </div>
                <div>
                  <Label htmlFor="create-description">Description</Label>
                  <Textarea
                    id="create-description"
                    placeholder="Enter the prompt text or description..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreateDialog}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePrompt}>Create Prompt</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {prompts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">No prompts yet</p>
              <p className="text-sm text-gray-400">
                Create your first prompt to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {prompts.map((prompt) => (
              <Card key={prompt._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>{prompt.title}</CardTitle>
                      <CardDescription className="mt-1">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {prompt.name}
                        </code>
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(prompt)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePrompt(prompt._id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {prompt.description}
                  </p>
                  <div className="mt-4 text-xs text-gray-400">
                    Last updated:{' '}
                    {new Date(prompt.updatedAt).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Prompt</DialogTitle>
              <DialogDescription>
                Update your prompt details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  placeholder="e.g., code-review"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  A unique identifier (use lowercase and hyphens)
                </p>
              </div>
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  placeholder="e.g., Code Review Assistant"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  Display name for the prompt
                </p>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  placeholder="Enter the prompt text or description..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeEditDialog}>
                Cancel
              </Button>
              <Button onClick={handleEditPrompt}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

