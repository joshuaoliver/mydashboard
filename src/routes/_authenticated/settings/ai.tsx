import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bot, Sparkles, RefreshCw, Check } from 'lucide-react'
import { useState, useEffect } from 'react'

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
  
  const [isInitializing, setIsInitializing] = useState(false)
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())

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

  const handleModelChange = async (settingKey: string, modelId: string) => {
    await updateSetting({
      key: settingKey,
      modelId,
    })
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">AI Model Settings</h1>
        <p className="text-slate-400 mt-1">
          Configure which AI models to use for different features. Uses Vercel AI Gateway.
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Initialize defaults if no settings exist */}
        {!hasSettings && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <CardTitle className="text-slate-100">Initialize AI Settings</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                No AI settings found. Click below to create default settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleInitialize}
                disabled={isInitializing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isInitializing ? 'animate-spin' : ''}`} />
                {isInitializing ? 'Initializing...' : 'Initialize Defaults'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Settings cards */}
        {(settings ?? []).map((setting) => (
          <Card key={setting._id} className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-400" />
                  <CardTitle className="text-slate-100">{setting.displayName}</CardTitle>
                </div>
                {savedKeys.has(setting.key) && (
                  <div className="flex items-center gap-1 text-green-400 text-sm">
                    <Check className="w-4 h-4" />
                    Saved
                  </div>
                )}
              </div>
              {setting.description && (
                <CardDescription className="text-slate-400">
                  {setting.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Model</label>
                <Select
                  value={setting.modelId}
                  onValueChange={(value) => handleModelChange(setting.key, value)}
                >
                  <SelectTrigger className="w-full bg-slate-900 border-slate-600 text-slate-100">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {Object.entries(modelsByProvider).map(([provider, models]) => (
                      <div key={provider}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                          {provider}
                        </div>
                        {models.map((model) => (
                          <SelectItem
                            key={model.id}
                            value={model.id}
                            className="text-slate-100 focus:bg-slate-700 focus:text-slate-100"
                          >
                            <div className="flex flex-col">
                              <span>{model.name}</span>
                              <span className="text-xs text-slate-400">{model.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show current model info */}
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>Current:</span>
                <code className="bg-slate-900 px-2 py-0.5 rounded text-slate-300">
                  {setting.modelId}
                </code>
              </div>

              {/* Temperature and prompt info if available */}
              <div className="flex gap-4 text-sm text-slate-500">
                {setting.temperature !== undefined && (
                  <span>Temperature: {setting.temperature}</span>
                )}
                {setting.promptName && (
                  <span>Prompt: {setting.promptName}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Info card */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-300 text-sm">About Vercel AI Gateway</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400 space-y-2">
            <p>
              This dashboard uses the <strong>Vercel AI Gateway</strong> to access AI models from multiple providers through a single API.
            </p>
            <p>
              Available providers: Google (Gemini), Anthropic (Claude), OpenAI (GPT), DeepSeek, xAI (Grok), Meta (Llama), Mistral, and more.
            </p>
            <p className="text-slate-500">
              Model changes take effect immediately for new requests.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
