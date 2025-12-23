import { createFileRoute } from '@tanstack/react-router'
import { useQuery as useConvexQuery, useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  Calendar,
  FileText,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Clock,
  TrendingUp,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/summaries')({
  component: SummariesPage,
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getYesterdayDate(): string {
  const now = new Date()
  now.setDate(now.getDate() - 1)
  return now.toISOString().split('T')[0]
}

function SummariesPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Get recent summaries - using Convex's native useQuery
  const summaries = useConvexQuery(api.dailySummary.getRecentSummaries, { limit: 14 })
  const summariesLoading = summaries === undefined

  // Get selected summary detail - use "skip" for conditional queries
  const selectedSummary = useConvexQuery(
    api.dailySummary.getSummary,
    selectedDate ? { date: selectedDate } : "skip"
  )
  const summaryLoading = selectedDate ? selectedSummary === undefined : false

  const triggerGeneration = useAction(api.dailySummary.triggerSummaryGeneration)
  
  // Refetch is not needed with Convex - data is reactive and auto-updates
  const refetchSummaries = () => {
    // Convex queries are reactive, so this is a no-op
    // The data will automatically update when the backend changes
  }

  const handleGenerate = async (date?: string) => {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      await triggerGeneration({ date })
      refetchSummaries()
      if (date) setSelectedDate(date)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  // Check if yesterday's summary exists
  const yesterday = getYesterdayDate()
  const hasYesterdaySummary = summaries?.some(s => s.date === yesterday)

  return (
    <div className="h-full flex">
      {/* Sidebar - Summary List */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Daily Summaries
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            AI-generated reflections on your work
          </p>
        </div>

        {/* Generate Button */}
        <div className="p-3 border-b">
          {!hasYesterdaySummary && (
            <Button
              onClick={() => handleGenerate()}
              disabled={isGenerating}
              className="w-full"
              variant="outline"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Generate Yesterday's Summary
            </Button>
          )}
          {generateError && (
            <p className="text-xs text-destructive mt-2">{generateError}</p>
          )}
        </div>

        {/* Summary List */}
        <ScrollArea className="flex-1">
          {summariesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !summaries?.length ? (
            <div className="p-6 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No summaries yet</p>
              <p className="text-xs mt-1">
                Complete some work blocks to get your first summary
              </p>
            </div>
          ) : (
            <div className="p-2">
              {summaries.map((summary) => (
                <button
                  key={summary.date}
                  onClick={() => setSelectedDate(summary.date)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-colors mb-1",
                    selectedDate === summary.date
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {formatDate(summary.date)}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  {summary.oneLiner && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                      "{summary.oneLiner}"
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Content - Selected Summary */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedDate ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Select a summary to view</p>
            </div>
          </div>
        ) : summaryLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : selectedSummary ? (
          <>
            {/* Summary Header */}
            <div className="px-6 py-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {formatDate(selectedSummary.date)}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Generated {new Date(selectedSummary.generatedAt).toLocaleTimeString()}
                    </Badge>
                    {selectedSummary.modelUsed !== 'none' && (
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        {selectedSummary.modelUsed.split('/').pop()}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerate(selectedDate)}
                    disabled={isGenerating}
                  >
                    <RefreshCw className={cn("w-4 h-4 mr-1", isGenerating && "animate-spin")} />
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Open HTML in new tab
                      const blob = new Blob([selectedSummary.htmlContent], { type: 'text/html' })
                      const url = URL.createObjectURL(blob)
                      window.open(url, '_blank')
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Open Full
                  </Button>
                </div>
              </div>
            </div>

            {/* Summary Content */}
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6 max-w-3xl">
                {/* One-liner Quote */}
                {selectedSummary.oneLiner && (
                  <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-l-4 border-l-primary">
                    <CardContent className="py-4">
                      <p className="italic text-lg text-center">
                        "{selectedSummary.oneLiner}"
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Sections */}
                <div className="grid gap-4">
                  {selectedSummary.sections.overview && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {selectedSummary.sections.overview}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedSummary.sections.workedOn && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">What You Worked On</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert">
                          {selectedSummary.sections.workedOn.split('\n').map((line, i) => {
                            const cleaned = line.replace(/^[-*]\s*/, '').trim()
                            if (!cleaned) return null
                            return (
                              <div key={i} className="flex gap-2 mb-1">
                                <span className="text-primary">•</span>
                                <span>{cleaned}</span>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {selectedSummary.sections.momentum && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Momentum</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {selectedSummary.sections.momentum}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedSummary.sections.patterns && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Patterns Observed</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {selectedSummary.sections.patterns}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Raw HTML Preview (collapsed) */}
                <details className="mt-6">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    View rendered HTML
                  </summary>
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={selectedSummary.htmlContent}
                      className="w-full h-[600px] bg-background"
                      title="Summary HTML"
                    />
                  </div>
                </details>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Summary not found for {selectedDate}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => handleGenerate(selectedDate)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Generate Summary
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
