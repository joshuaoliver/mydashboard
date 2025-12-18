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
import { useState, useEffect } from 'react'
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
            <h1 className="text-2xl font-bold text-slate-100">AI Prompts</h1>
            <p className="text-slate-400 mt-1">
              Manage and customize AI prompt templates used throughout the app
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleInitialize}
              disabled={isInitializing}
              className="gap-2 bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
            >
              <RefreshCw className={`h-4 w-4 ${isInitializing ? 'animate-spin' : ''}`} />
              Initialize Defaults
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Prompt
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 text-slate-100 max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Prompt</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Create a new AI prompt template. Use template variables like {'{{chatName}}'} for dynamic content.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Name (unique key)</Label>
                      <Input 
                        placeholder="reply-suggestions" 
                        value={formData.name} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-slate-900 border-slate-600 text-slate-100 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Display Title</Label>
                      <Input 
                        placeholder="AI Reply Suggestions" 
                        value={formData.title} 
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="bg-slate-900 border-slate-600 text-slate-100 mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300">Prompt Template</Label>
                    <Textarea 
                      placeholder="Enter your prompt template here..."
                      value={formData.description} 
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="bg-slate-900 border-slate-600 text-slate-100 mt-1 min-h-[300px] font-mono text-sm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate}>Create Prompt</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Template Variables Reference */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm text-slate-300">Template Variables</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.name}
                  onClick={() => copyToClipboard(v.name)}
                  className="group relative px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs font-mono text-blue-400 hover:bg-slate-800 hover:border-blue-500 transition-colors"
                  title={v.description}
                >
                  {v.name}
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-700 text-slate-200 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {v.description}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Click to copy. Hover for description.</p>
          </CardContent>
        </Card>

        {/* Prompts List */}
        {(prompts?.length ?? 0) === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">No prompts yet</p>
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
                  className={`bg-slate-800/50 border-slate-700 transition-all ${
                    isEditing ? 'ring-2 ring-blue-500/50' : ''
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {isEditing ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-slate-400 text-xs">Name</Label>
                              <Input 
                                value={ed.name} 
                                onChange={(e) => updateField(prompt._id, 'name', e.target.value)}
                                className="bg-slate-900 border-slate-600 text-slate-100 mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-slate-400 text-xs">Title</Label>
                              <Input 
                                value={ed.title} 
                                onChange={(e) => updateField(prompt._id, 'title', e.target.value)}
                                className="bg-slate-900 border-slate-600 text-slate-100 mt-1"
                              />
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="cursor-pointer"
                            onClick={() => setExpandedPromptId(isExpanded ? null : prompt._id)}
                          >
                            <div className="flex items-center gap-3">
                              <CardTitle className="text-slate-100">{prompt.title}</CardTitle>
                              {isSaved && (
                                <span className="flex items-center gap-1 text-green-400 text-xs">
                                  <Check className="h-3 w-3" />
                                  Saved
                                </span>
                              )}
                            </div>
                            <CardDescription className="mt-1">
                              <code className="text-xs bg-slate-900 text-slate-400 px-2 py-0.5 rounded">
                                {prompt.name}
                              </code>
                              <span className="text-slate-500 ml-3 text-xs">
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
                              size="sm" 
                              onClick={() => savePrompt(prompt._id)}
                              disabled={isSaving}
                              className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                            >
                              <Save className={`h-4 w-4 ${isSaving ? 'animate-pulse' : ''}`} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setEditingPromptId(null)}
                              className="text-slate-400 hover:text-slate-300"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setExpandedPromptId(isExpanded ? null : prompt._id)}
                              className="text-slate-400 hover:text-slate-300"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => startEditing(prompt)}
                              className="text-slate-400 hover:text-slate-300"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDelete(prompt._id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
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
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-slate-500 mr-2">Insert:</span>
                            {TEMPLATE_VARIABLES.map((v) => (
                              <button
                                key={v.name}
                                onClick={() => insertVariable(prompt._id, v.name)}
                                className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-blue-400 hover:bg-slate-800 hover:border-blue-500 transition-colors"
                                title={v.description}
                              >
                                {v.name.replace(/\{\{|\}\}/g, '')}
                              </button>
                            ))}
                          </div>
                          <Textarea 
                            value={ed.description} 
                            onChange={(e) => updateField(prompt._id, 'description', e.target.value)}
                            className="bg-slate-900 border-slate-600 text-slate-100 min-h-[500px] font-mono text-sm leading-relaxed"
                          />
                        </div>
                      ) : (
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(prompt.description)}
                            className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-900/50 p-4 rounded-lg border border-slate-700 max-h-[400px] overflow-auto">
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
