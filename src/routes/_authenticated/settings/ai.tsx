import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bot, Sparkles, RefreshCw, Check, FileText } from 'lucide-react'
import { useState, useCallback } from 'react'

export const Route = createFileRoute('/_authenticated/settings/ai')({
  component: AISettingsPage,
})

function AISettingsPage() {
  const { data: settings } = useQuery(
    convexQuery(api.aiSettings.listSettings, {})
  )
  const { data: availableModels } = useQuery(
    convexQuery(api.aiSettings.getAvailableModels, {})
  )
  
  const updateSetting = useMutation(api.aiSettings.updateSetting)
  const initializeDefaults = useMutation(api.aiSettings.initializeDefaults)
  const initializePrompts = useMutation(api.prompts.initializeDefaultPrompts)
  const resetPrompts = useMutation(api.prompts.resetPromptsToDefaults)
  
  const [isInitializing, setIsInitializing] = useState(false)
  const [isInitializingPrompts, setIsInitializingPrompts] = useState(false)
  const [isResettingPrompts, setIsResettingPrompts] = useState(false)
  const [promptsResult, setPromptsResult] = useState<{ created: string[], skipped: string[] } | null>(null)
  const [resetResult, setResetResult] = useState<{ deleted: string[], created: string[] } | null>(null)
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [localTemperatures, setLocalTemperatures] = useState<Record<string, number>>({})

  // Group models by provider
  const modelsByProvider = (availableModels ?? []).reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = []
    }
    acc[model.provider].push(model)
    return acc
  }, {} as Record<string, NonNullable<typeof availableModels>>)

  const handleInitialize = async () => {
    setIsInitializing(true)
    try {
      await initializeDefaults()
    } finally {
      setIsInitializing(false)
    }
  }

  const handleInitializePrompts = async () => {
    setIsInitializingPrompts(true)
    try {
      const result = await initializePrompts()
      setPromptsResult(result)
      setTimeout(() => setPromptsResult(null), 5000)
    } finally {
      setIsInitializingPrompts(false)
    }
  }

  const handleResetPrompts = async () => {
    setIsResettingPrompts(true)
    try {
      const result = await resetPrompts({})
      setResetResult(result)
      setTimeout(() => setResetResult(null), 5000)
    } finally {
      setIsResettingPrompts(false)
    }
  }

  const handleModelChange = async (settingKey: string, modelId: string) => {
    await updateSetting({
      key: settingKey,
      modelId,
    })
    markSaved(settingKey)
  }

  const handleTemperatureDrag = useCallback((settingKey: string, temperature: number) => {
    setLocalTemperatures(prev => ({ ...prev, [settingKey]: temperature }))
  }, [])

  const handleTemperatureCommit = async (settingKey: string, temperature: number) => {
    await updateSetting({
      key: settingKey,
      temperature,
    })
    // Clear local state after commit
    setLocalTemperatures(prev => {
      const next = { ...prev }
      delete next[settingKey]
      return next
    })
    markSaved(settingKey)
  }

  const markSaved = (settingKey: string) => {
    setSavedKeys(prev => new Set([...prev, settingKey]))
    setTimeout(() => {
      setSavedKeys(prev => {
        const next = new Set(prev)
        next.delete(settingKey)
        return next
      })
    }, 2000)
  }

  // Check if we need to show the initialize button
  const hasSettings = (settings?.length ?? 0) > 0

  return (
    <div className="p-6">
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">AI Model Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure which AI models to use for different features. Uses Vercel AI Gateway.
          </p>
        </div>

        {/* Initialize defaults if no settings exist */}
        {!hasSettings && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <CardTitle>Initialize AI Settings</CardTitle>
              </div>
              <CardDescription>
                No AI settings found. Click below to create default settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleInitialize}
                disabled={isInitializing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isInitializing ? 'animate-spin' : ''}`} />
                {isInitializing ? 'Initializing...' : 'Initialize Defaults'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Initialize prompts card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              <CardTitle>Prompt Templates</CardTitle>
            </div>
            <CardDescription>
              Install or reset the default prompt templates used by AI features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleInitializePrompts}
                disabled={isInitializingPrompts || isResettingPrompts}
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isInitializingPrompts ? 'animate-spin' : ''}`} />
                {isInitializingPrompts ? 'Installing...' : 'Install Missing Prompts'}
              </Button>
              <Button
                onClick={handleResetPrompts}
                disabled={isInitializingPrompts || isResettingPrompts}
                variant="destructive"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isResettingPrompts ? 'animate-spin' : ''}`} />
                {isResettingPrompts ? 'Resetting...' : 'Reset to Defaults'}
              </Button>
            </div>
            {promptsResult && (
              <div className="text-sm">
                {promptsResult.created.length > 0 && (
                  <p className="text-green-600">
                    Created: {promptsResult.created.join(', ')}
                  </p>
                )}
                {promptsResult.skipped.length > 0 && (
                  <p className="text-muted-foreground">
                    Already exists: {promptsResult.skipped.join(', ')}
                  </p>
                )}
              </div>
            )}
            {resetResult && (
              <div className="text-sm">
                {resetResult.deleted.length > 0 && (
                  <p className="text-orange-600">
                    Deleted: {resetResult.deleted.join(', ')}
                  </p>
                )}
                {resetResult.created.length > 0 && (
                  <p className="text-green-600">
                    Recreated: {resetResult.created.join(', ')}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings cards */}
        {(settings ?? []).map((setting) => (
          <Card key={setting._id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-500" />
                  <CardTitle>{setting.displayName}</CardTitle>
                </div>
                {savedKeys.has(setting.key) && (
                  <Badge variant="outline" className="text-green-500 border-green-500">
                    <Check className="w-3 h-3 mr-1" />
                    Saved
                  </Badge>
                )}
              </div>
              {setting.description && (
                <CardDescription>
                  {setting.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select
                  value={setting.modelId}
                  onValueChange={(value) => handleModelChange(setting.key, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(modelsByProvider).map(([provider, models]) => (
                      <div key={provider}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {provider}
                        </div>
                        {models.map((model) => (
                          <SelectItem
                            key={model.id}
                            value={model.id}
                          >
                            <div className="flex flex-col">
                              <span>{model.name}</span>
                              <span className="text-xs text-muted-foreground">{model.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show current model info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Current:</span>
                <code className="bg-muted px-2 py-0.5 rounded">
                  {setting.modelId}
                </code>
              </div>

              {/* Temperature slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Temperature</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {(localTemperatures[setting.key] ?? setting.temperature ?? 1).toFixed(1)}
                  </span>
                </div>
                <Slider
                  value={[localTemperatures[setting.key] ?? setting.temperature ?? 1]}
                  min={0}
                  max={2}
                  step={0.1}
                  onValueChange={(value) => handleTemperatureDrag(setting.key, value[0])}
                  onValueCommit={(value) => handleTemperatureCommit(setting.key, value[0])}
                  className="w-full cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Higher = more creative, Lower = more focused
                </p>
              </div>

              {/* Prompt info if available */}
              {setting.promptName && (
                <div className="text-sm text-muted-foreground">
                  Prompt template: <code className="bg-muted px-1.5 py-0.5 rounded">{setting.promptName}</code>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Info card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">About Vercel AI Gateway</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              This dashboard uses the <strong>Vercel AI Gateway</strong> to access AI models from multiple providers through a single API.
            </p>
            <p>
              Available providers: Google (Gemini), Anthropic (Claude), OpenAI (GPT), DeepSeek, xAI (Grok), Meta (Llama), Mistral, and more.
            </p>
            <p>
              Model changes take effect immediately for new requests.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
