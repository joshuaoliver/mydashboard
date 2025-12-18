import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bot, Sparkles, RefreshCw, Check } from 'lucide-react'
import { useState } from 'react'

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

              {/* Temperature and prompt info if available */}
              <div className="flex gap-4 text-sm text-muted-foreground">
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
