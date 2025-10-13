import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check, Sparkles, Database, Zap } from 'lucide-react'
import { useState } from 'react'
import { Loader } from '@/components/ai-elements/loader'
import { Response } from '@/components/ai-elements/response'

interface ReplySuggestion {
  reply: string
  style: string
  reasoning: string
}

interface ReplySuggestionsProps {
  suggestions: ReplySuggestion[]
  isLoading: boolean
  error?: string
  conversationContext?: {
    lastMessage: string
    messageCount: number
  }
  isCached?: boolean       // New: indicates if suggestions are from cache
  generatedAt?: number     // New: when suggestions were generated
  onGenerateClick?: () => void
  selectedIndex?: number   // Currently selected suggestion index
  onSuggestionSelect?: (index: number) => void  // Callback when suggestion is clicked
}

export function ReplySuggestions({
  suggestions,
  isLoading,
  error,
  conversationContext,
  isCached = false,
  generatedAt,
  onGenerateClick,
  selectedIndex = 0,
  onSuggestionSelect,
}: ReplySuggestionsProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <CardTitle>AI Reply Suggestions</CardTitle>
          </div>
          <CardDescription>Generating thoughtful responses...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <CardTitle>AI Reply Suggestions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-2">Failed to generate suggestions</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No suggestions yet - show button to generate
  if (!suggestions || suggestions.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <CardTitle>AI Reply Suggestions</CardTitle>
          </div>
          <CardDescription>
            Click the button below to generate AI-powered reply suggestions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <p className="text-gray-600 mb-6">Ready to generate smart replies?</p>
            {onGenerateClick && (
              <Button onClick={onGenerateClick} size="lg" className="gap-2">
                <Sparkles className="w-5 h-5" />
                Generate AI Suggestions
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <CardTitle>AI Reply Suggestions</CardTitle>
          </div>
          {isCached ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
              <Database className="w-3.5 h-3.5" />
              Cached
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
              <Zap className="w-3.5 h-3.5" />
              Fresh
            </div>
          )}
        </div>
        {conversationContext && (
          <CardDescription>
            Based on {conversationContext.messageCount} messages
            {isCached && generatedAt && (
              <span className="text-xs text-gray-500">
                {' • '}Generated {new Date(generatedAt).toLocaleTimeString()}
              </span>
            )}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {conversationContext && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-600 mb-1">Last message:</p>
            <p className="text-sm text-gray-800 italic">
              "{conversationContext.lastMessage}"
            </p>
          </div>
        )}

        {/* Quick action chips */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-600 mb-2">Quick Actions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleCopy(suggestion.reply, index)}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border border-blue-200 hover:border-blue-300 rounded-full text-xs font-medium text-blue-700 transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3" />
                {suggestion.style}
                {copiedIndex === index && <Check className="w-3 h-3 text-green-600" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {suggestions.map((suggestion, index) => {
            const isSelected = index === selectedIndex
            return (
              <div
                key={index}
                onClick={() => onSuggestionSelect?.(index)}
                className={`p-4 rounded-lg transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-blue-50 border-2 border-blue-400 shadow-md'
                    : 'bg-white border-2 border-gray-200 hover:border-blue-300'
                }`}
              >
                {/* Style badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    )}
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      isSelected 
                        ? 'text-blue-700 bg-blue-100' 
                        : 'text-blue-600 bg-blue-50'
                    }`}>
                      {suggestion.style}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopy(suggestion.reply, index)
                    }}
                    className="h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="w-4 h-4 mr-1 text-green-600" />
                        <span className="text-green-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                {/* Reply text with markdown support */}
                <div className="text-sm text-gray-900 mb-3 leading-relaxed">
                  <Response>{suggestion.reply}</Response>
                </div>

                {/* Reasoning */}
                {suggestion.reasoning && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Why this works:</span>{' '}
                      {suggestion.reasoning}
                    </p>
                  </div>
                )}
                
                {/* Selected indicator */}
                {isSelected && (
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <p className="text-xs text-blue-700 font-medium">
                      ✓ Pre-filled in input below
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            💡 <span className="font-medium">Tip:</span> These are AI-generated suggestions. 
            Feel free to personalize them before sending!
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

