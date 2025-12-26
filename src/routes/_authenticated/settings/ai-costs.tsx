import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useAction } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  DollarSign,
  Loader2,
  Sparkles,
  MessageSquare,
  FileText,
  Mic,
  Tag,
  RefreshCw,
  TrendingUp,
  Activity,
  Search,
  Database,
} from 'lucide-react'
import { useState, useMemo } from 'react'

export const Route = createFileRoute('/_authenticated/settings/ai-costs')({
  component: AICostsPage,
})

// Feature key to display info mapping
const FEATURE_INFO: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  'reply-suggestions': {
    label: 'Reply Suggestions',
    icon: MessageSquare,
    color: 'bg-blue-500',
  },
  'chat-agent': {
    label: 'Chat Agent',
    icon: Sparkles,
    color: 'bg-purple-500',
  },
  'daily-summary': {
    label: 'Daily Summary',
    icon: FileText,
    color: 'bg-green-500',
  },
  'voice-notes': {
    label: 'Voice Notes',
    icon: Mic,
    color: 'bg-orange-500',
  },
  'voice-transcription': {
    label: 'Voice Transcription',
    icon: Mic,
    color: 'bg-amber-500',
  },
  'thread-title': {
    label: 'Thread Titles',
    icon: Tag,
    color: 'bg-pink-500',
  },
}

function AICostsPage() {
  // For a single-user dashboard, we use a fixed user ID
  const userId = 'dashboard-user'

  // Usage data
  const { data: aiCosts, isLoading: isAICostsLoading } = useQuery(
    convexQuery(api.costs.getAICostsByUser, { userId })
  )
  const { data: totalCosts } = useQuery(
    convexQuery(api.costs.getTotalAICostsByUser, { userId })
  )

  // Pricing data
  const { data: allPricing, isLoading: isPricingLoading } = useQuery(
    convexQuery(api.costs.getAllPricing, {})
  )

  const syncPricing = useAction(api.costs.updatePricingData)
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<string>('all')

  // Calculate stats from the costs data
  const stats = useMemo(() => {
    if (!aiCosts || aiCosts.length === 0) {
      return {
        totalCost: 0,
        totalTokens: 0,
        byFeature: {} as Record<string, { cost: number; count: number; tokens: number }>,
        byModel: {} as Record<string, { cost: number; count: number; tokens: number }>,
        recentTransactions: [] as any[],
      }
    }

    const byFeature: Record<string, { cost: number; count: number; tokens: number }> = {}
    const byModel: Record<string, { cost: number; count: number; tokens: number }> = {}
    let totalCost = 0
    let totalTokens = 0

    for (const cost of aiCosts) {
      const costAny = cost as any
      const featureKey = costAny.threadId?.startsWith('feature:')
        ? costAny.threadId.replace('feature:', '')
        : 'other'
      const modelKey = `${costAny.providerId ?? 'unknown'}/${costAny.modelId ?? 'unknown'}`
      const costAmount = costAny.cost?.totalCost ?? 0
      const tokens = costAny.usage?.totalTokens ?? 0

      totalCost += costAmount
      totalTokens += tokens

      if (!byFeature[featureKey]) {
        byFeature[featureKey] = { cost: 0, count: 0, tokens: 0 }
      }
      byFeature[featureKey].cost += costAmount
      byFeature[featureKey].count += 1
      byFeature[featureKey].tokens += tokens

      if (!byModel[modelKey]) {
        byModel[modelKey] = { cost: 0, count: 0, tokens: 0 }
      }
      byModel[modelKey].cost += costAmount
      byModel[modelKey].count += 1
      byModel[modelKey].tokens += tokens
    }

    const recentTransactions = [...aiCosts]
      .sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))
      .slice(0, 20)

    return { totalCost, totalTokens, byFeature, byModel, recentTransactions }
  }, [aiCosts])

  // Get unique providers from pricing data
  const providers = allPricing
    ? [...new Set(allPricing.map((p: any) => p.providerId))].sort()
    : []

  // Filter pricing data
  const filteredPricing = (allPricing ?? []).filter((pricing: any) => {
    const matchesSearch =
      searchTerm === '' ||
      pricing.modelId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pricing.providerId?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesProvider =
      selectedProvider === 'all' || pricing.providerId === selectedProvider
    return matchesSearch && matchesProvider
  })

  const handleSyncPricing = async () => {
    setIsSyncing(true)
    try {
      await syncPricing({})
    } catch (error) {
      console.error('Failed to sync pricing:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(6)}`
    if (cost < 1) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(2)}`
  }

  const formatPricingCost = (cost: number | undefined) => {
    if (cost === undefined || cost === null) return '-'
    return `$${cost.toFixed(4)}`
  }

  const formatTokens = (tokens: number) => tokens.toLocaleString()

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-AU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFeatureInfo = (featureKey: string) => {
    return FEATURE_INFO[featureKey] ?? {
      label: featureKey,
      icon: Activity,
      color: 'bg-slate-500',
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Costs</h1>
          <p className="text-muted-foreground mt-1">
            Track AI usage costs and manage model pricing
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleSyncPricing}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Pricing
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="usage" className="space-y-6">
        <TabsList>
          <TabsTrigger value="usage" className="gap-2">
            <Activity className="h-4 w-4" />
            Usage & Costs
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <Database className="h-4 w-4" />
            Model Pricing
          </TabsTrigger>
        </TabsList>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCost(totalCosts?.totalCost ?? stats.totalCost)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {aiCosts?.length ?? 0} API calls
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatTokens(stats.totalTokens)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Prompt + Completion tokens
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Features Used</CardTitle>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.keys(stats.byFeature).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Object.keys(stats.byModel).length} models
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cost by Feature */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Cost by Feature
              </CardTitle>
              <CardDescription>
                Breakdown of AI costs by feature type
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.byFeature).length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No AI costs recorded yet. Use AI features to start tracking costs.
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(stats.byFeature)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([featureKey, data]) => {
                      const info = getFeatureInfo(featureKey)
                      const Icon = info.icon
                      const percentage =
                        stats.totalCost > 0
                          ? (data.cost / stats.totalCost) * 100
                          : 0

                      return (
                        <div key={featureKey} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded ${info.color} text-white`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <span className="font-medium">{info.label}</span>
                              <Badge variant="secondary" className="text-xs">
                                {data.count} calls
                              </Badge>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-medium">
                                {formatCost(data.cost)}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${info.color} transition-all`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost by Model */}
          <Card>
            <CardHeader>
              <CardTitle>Cost by Model</CardTitle>
              <CardDescription>
                Which AI models are being used and their costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.byModel).length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  No model usage recorded yet.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(stats.byModel)
                        .sort(([, a], [, b]) => b.cost - a.cost)
                        .map(([modelKey, data]) => (
                          <TableRow key={modelKey}>
                            <TableCell className="font-mono text-sm">
                              {modelKey}
                            </TableCell>
                            <TableCell className="text-right">{data.count}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatTokens(data.tokens)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {formatCost(data.cost)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Last 20 AI API calls</CardDescription>
            </CardHeader>
            <CardContent>
              {isAICostsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : stats.recentTransactions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No AI activity recorded yet.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Feature</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentTransactions.map((tx: any) => {
                        const featureKey = tx.threadId?.startsWith('feature:')
                          ? tx.threadId.replace('feature:', '')
                          : 'other'
                        const info = getFeatureInfo(featureKey)
                        const Icon = info.icon

                        return (
                          <TableRow key={tx._id}>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatTime(tx._creationTime)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{info.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {tx.providerId}/{tx.modelId}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatTokens(tx.usage?.totalTokens ?? 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-medium">
                              {formatCost(tx.cost?.totalCost ?? 0)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Model Pricing Database
              </CardTitle>
              <CardDescription>
                {allPricing?.length ?? 0} models synced from models.dev. Prices are per 1M tokens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 max-w-sm">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search models..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {providers.map((provider) => (
                      <SelectItem key={provider as string} value={provider as string}>
                        {(provider as string).charAt(0).toUpperCase() +
                          (provider as string).slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pricing Table */}
              {isPricingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPricing.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {allPricing?.length === 0 ? (
                    <div>
                      <p>No pricing data found.</p>
                      <p className="text-sm mt-2">
                        Click "Sync Pricing" to fetch model pricing from models.dev
                      </p>
                    </div>
                  ) : (
                    <p>No models match your search criteria.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Input Cost</TableHead>
                        <TableHead className="text-right">Output Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPricing.map((pricing: any, index: number) => (
                        <TableRow key={`${pricing.providerId}-${pricing.modelId}-${index}`}>
                          <TableCell>
                            <Badge variant="outline">
                              {pricing.providerId?.charAt(0).toUpperCase() +
                                pricing.providerId?.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {pricing.modelId}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatPricingCost(pricing.inputCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatPricingCost(pricing.outputCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Stats footer */}
              {allPricing && allPricing.length > 0 && (
                <div className="mt-4 text-sm text-muted-foreground">
                  Showing {filteredPricing.length} of {allPricing.length} models
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
