import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
  MessageSquare,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Code2,
  Save
} from 'lucide-react'
import { useState } from 'react'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/settings/prompts')({
  component: PromptsPage,
})

interface PromptFormData { 
  name: string
  title: string
  description: string 
}

// Template variables that can be used in prompts
const TEMPLATE_VARIABLES = [
  { name: '{{chatName}}', description: 'Name of the person you\'re chatting with' },
  { name: '{{conversationHistory}}', description: 'Recent message history' },
  { name: '{{lastMessageText}}', description: 'The last message received' },
  { name: '{{contactContext}}', description: 'Contact information from your database' },
  { name: '{{customContext}}', description: 'Any custom context you provide' },
  { name: '{{platform}}', description: 'Instagram, WhatsApp, etc.' },
  { name: '{{messageCount}}', description: 'Number of messages in conversation' },
]

function PromptsPage() {
  const { data: prompts } = useQuery(convexQuery(api.prompts.listPrompts, {}))
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingPromptId, setEditingPromptId] = useState<Id<'prompts'> | null>(null)
  const [expandedPromptId, setExpandedPromptId] = useState<Id<'prompts'> | null>(null)
  const [editData, setEditData] = useState<Record<Id<'prompts'>, PromptFormData>>({})
  const [formData, setFormData] = useState<PromptFormData>({ name: '', title: '', description: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [savedPromptId, setSavedPromptId] = useState<Id<'prompts'> | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  const createPrompt = useMutation(api.prompts.createPrompt)
  const updatePrompt = useMutation(api.prompts.updatePrompt)
  const deletePrompt = useMutation(api.prompts.deletePrompt)
  const initializeDefaults = useMutation(api.prompts.initializeDefaultPrompts)

  const handleCreate = async () => {
    if (!formData.name || !formData.title || !formData.description) {
      alert('Please fill in all fields')
      return
    }
    try {
      await createPrompt(formData)
      setFormData({ name: '', title: '', description: '' })
      setIsCreateDialogOpen(false)
    } catch (e: any) {
      alert(e.message || 'Failed to create prompt')
    }
  }

  const startEditing = (p: { _id: Id<'prompts'>; name: string; title: string; description: string }) => {
    setEditingPromptId(p._id)
    setExpandedPromptId(p._id)
    setEditData((prev) => ({ 
      ...prev, 
      [p._id]: { name: p.name, title: p.title, description: p.description } 
    }))
  }

  const savePrompt = async (id: Id<'prompts'>) => {
    const d = editData[id]
    if (!d?.name || !d?.title || !d?.description) {
      alert('Please fill in all fields')
      return
    }
    setIsSaving(true)
    try {
      await updatePrompt({ id, ...d })
      setEditingPromptId(null)
      setSavedPromptId(id)
      setTimeout(() => setSavedPromptId(null), 2000)
    } catch (e: any) {
      alert(e.message || 'Failed to update prompt')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: Id<'prompts'>) => {
    if (confirm('Are you sure you want to delete this prompt? This action cannot be undone.')) {
      try {
        await deletePrompt({ id })
      } catch (e: any) {
        alert(e.message || 'Failed to delete prompt')
      }
    }
  }

  const handleInitialize = async () => {
    setIsInitializing(true)
    try {
      const result = await initializeDefaults()
      if (result.created.length > 0) {
        alert(`Created ${result.created.length} default prompt(s): ${result.created.join(', ')}`)
      } else {
        alert('All default prompts already exist')
      }
    } catch (e: any) {
      alert(e.message || 'Failed to initialize defaults')
    } finally {
      setIsInitializing(false)
    }
  }

  const updateField = (id: Id<'prompts'>, field: keyof PromptFormData, value: string) => {
    setEditData((prev) => ({ 
      ...prev, 
      [id]: { 
        ...(prev[id] || { name: '', title: '', description: '' }), 
        [field]: value 
      } 
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const insertVariable = (id: Id<'prompts'>, variable: string) => {
    const current = editData[id]?.description || ''
    updateField(id, 'description', current + variable)
  }

  return (
    <div className="p-6">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Prompts</h1>
            <p className="text-muted-foreground mt-1">
              Manage and customize AI prompt templates used throughout the app
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleInitialize}
              disabled={isInitializing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isInitializing ? 'animate-spin' : ''}`} />
              Initialize Defaults
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Prompt
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Prompt</DialogTitle>
                  <DialogDescription>
                    Create a new AI prompt template. Use template variables like {'{{chatName}}'} for dynamic content.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name (unique key)</Label>
                      <Input 
                        placeholder="reply-suggestions" 
                        value={formData.name} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Display Title</Label>
                      <Input 
                        placeholder="AI Reply Suggestions" 
                        value={formData.title} 
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Prompt Template</Label>
                    <Textarea 
                      placeholder="Enter your prompt template here..."
                      value={formData.description} 
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate}>Create Prompt</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Template Variables Reference */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm">Template Variables</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARIABLES.map((v) => (
                <Badge
                  key={v.name}
                  variant="secondary"
                  className="cursor-pointer font-mono text-xs hover:bg-accent"
                  onClick={() => copyToClipboard(v.name)}
                  title={v.description}
                >
                  {v.name}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Click to copy. Hover for description.</p>
          </CardContent>
        </Card>

        {/* Prompts List */}
        {(prompts?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No prompts yet</p>
              <Button onClick={handleInitialize} disabled={isInitializing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isInitializing ? 'animate-spin' : ''}`} />
                Initialize Default Prompts
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(prompts ?? []).map((prompt) => {
              const isEditing = editingPromptId === prompt._id
              const isExpanded = expandedPromptId === prompt._id
              const isSaved = savedPromptId === prompt._id
              const ed = editData[prompt._id] || { 
                name: prompt.name, 
                title: prompt.title, 
                description: prompt.description 
              }

              return (
                <Card 
                  key={prompt._id} 
                  className={isEditing ? 'ring-2 ring-primary/50' : ''}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {isEditing ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Name</Label>
                              <Input 
                                value={ed.name} 
                                onChange={(e) => updateField(prompt._id, 'name', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Title</Label>
                              <Input 
                                value={ed.title} 
                                onChange={(e) => updateField(prompt._id, 'title', e.target.value)}
                              />
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="cursor-pointer"
                            onClick={() => setExpandedPromptId(isExpanded ? null : prompt._id)}
                          >
                            <div className="flex items-center gap-3">
                              <CardTitle>{prompt.title}</CardTitle>
                              {isSaved && (
                                <Badge variant="outline" className="text-green-500 border-green-500">
                                  <Check className="h-3 w-3 mr-1" />
                                  Saved
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="mt-1 flex items-center gap-3">
                              <code className="text-xs bg-muted px-2 py-0.5 rounded">
                                {prompt.name}
                              </code>
                              <span className="text-xs">
                                Updated {new Date(prompt.updatedAt).toLocaleDateString()}
                              </span>
                            </CardDescription>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => savePrompt(prompt._id)}
                              disabled={isSaving}
                            >
                              <Save className={`h-4 w-4 text-green-500 ${isSaving ? 'animate-pulse' : ''}`} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setEditingPromptId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setExpandedPromptId(isExpanded ? null : prompt._id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => startEditing(prompt)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(prompt._id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  {(isExpanded || isEditing) && (
                    <CardContent className="pt-0">
                      {isEditing ? (
                        <div className="space-y-3">
                          {/* Variable insertion buttons when editing */}
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-xs text-muted-foreground mr-2">Insert:</span>
                            {TEMPLATE_VARIABLES.map((v) => (
                              <Badge
                                key={v.name}
                                variant="outline"
                                className="cursor-pointer font-mono text-xs hover:bg-accent"
                                onClick={() => insertVariable(prompt._id, v.name)}
                                title={v.description}
                              >
                                {v.name.replace(/\{\{|\}\}/g, '')}
                              </Badge>
                            ))}
                          </div>
                          <Textarea 
                            value={ed.description} 
                            onChange={(e) => updateField(prompt._id, 'description', e.target.value)}
                            className="min-h-[500px] font-mono text-sm leading-relaxed"
                          />
                        </div>
                      ) : (
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(prompt.description)}
                            className="absolute top-2 right-2"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-lg max-h-[400px] overflow-auto">
                            {prompt.description}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
