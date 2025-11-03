import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
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
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
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
  const [editingPromptId, setEditingPromptId] = useState<Id<'prompts'> | null>(null)
  const [editData, setEditData] = useState<Record<Id<'prompts'>, PromptFormData>>({})

  const createPrompt = useConvexMutation(api.prompts.createPrompt)
  const updatePrompt = useConvexMutation(api.prompts.updatePrompt)
  const deletePrompt = useConvexMutation(api.prompts.deletePrompt)

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

    createPrompt({
      name: formData.name,
      title: formData.title,
      description: formData.description,
    }).then(() => {
      setFormData({ name: '', title: '', description: '' })
      setIsCreateDialogOpen(false)
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create prompt'
      alert(message)
    })
  }

  const startEditing = (prompt: {
    _id: Id<'prompts'>
    name: string
    title: string
    description: string
  }) => {
    setEditingPromptId(prompt._id)
    setEditData((prev) => ({
      ...prev,
      [prompt._id]: {
        name: prompt.name,
        title: prompt.title,
        description: prompt.description,
      },
    }))
  }

  const cancelEditing = () => {
    setEditingPromptId(null)
  }

  const savePrompt = (id: Id<'prompts'>) => {
    const data = editData[id]
    if (!data || !data.name || !data.title || !data.description) {
      alert('Please fill in all fields')
      return
    }

    updatePrompt({
      id,
      name: data.name,
      title: data.title,
      description: data.description,
    }).then(() => {
      setEditingPromptId(null)
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update prompt'
      alert(message)
    })
  }

  const handleDeletePrompt = (id: Id<'prompts'>) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return

    deletePrompt({ id }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete prompt'
      alert(message)
    })
  }

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false)
    setFormData({ name: '', title: '', description: '' })
  }

  const updateEditField = (id: Id<'prompts'>, field: keyof PromptFormData, value: string) => {
    setEditData((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {
          name: '',
          title: '',
          description: '',
        }),
        [field]: value,
      },
    }))
  }

  return (
    <DashboardLayout>
      <div className="p-6">
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
          <div className="space-y-6">
            {prompts.map((prompt) => {
              const isEditing = editingPromptId === prompt._id
              const currentEditData = editData[prompt._id] || {
                name: prompt.name,
                title: prompt.title,
                description: prompt.description,
              }

              return (
                <Card key={prompt._id} className="w-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      {isEditing ? (
                        <div className="flex-1 space-y-4">
                          <div>
                            <Label htmlFor={`name-${prompt._id}`}>Name</Label>
                            <Input
                              id={`name-${prompt._id}`}
                              placeholder="e.g., code-review"
                              value={currentEditData.name}
                              onChange={(e) =>
                                updateEditField(prompt._id, 'name', e.target.value)
                              }
                            />
                            <p className="text-sm text-gray-500 mt-1">
                              A unique identifier (use lowercase and hyphens)
                            </p>
                          </div>
                          <div>
                            <Label htmlFor={`title-${prompt._id}`}>Title</Label>
                            <Input
                              id={`title-${prompt._id}`}
                              placeholder="e.g., Code Review Assistant"
                              value={currentEditData.title}
                              onChange={(e) =>
                                updateEditField(prompt._id, 'title', e.target.value)
                              }
                            />
                            <p className="text-sm text-gray-500 mt-1">
                              Display name for the prompt
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <CardTitle>{prompt.title}</CardTitle>
                          <CardDescription className="mt-1">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {prompt.name}
                            </code>
                          </CardDescription>
                        </div>
                      )}
                      <div className="flex space-x-2">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => savePrompt(prompt._id)}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(prompt)}
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
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`description-${prompt._id}`}>Description</Label>
                          <Textarea
                            id={`description-${prompt._id}`}
                            placeholder="Enter the prompt text or description..."
                            value={currentEditData.description}
                            onChange={(e) =>
                              updateEditField(prompt._id, 'description', e.target.value)
                            }
                            className="w-full min-h-[400px] font-mono text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-full">
                          <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg border overflow-x-auto">
                            {prompt.description}
                          </pre>
                        </div>
                        <div className="mt-4 text-xs text-gray-400">
                          Last updated:{' '}
                          {new Date(prompt.updatedAt).toLocaleString()}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  )
}

