import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check, Sparkles, Loader2 } from 'lucide-react'
import { useState } from 'react'

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
  onGenerateClick?: () => void
}

export function ReplySuggestions({
  suggestions,
  isLoading,
  error,
  conversationContext,
  onGenerateClick,
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
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
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
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <CardTitle>AI Reply Suggestions</CardTitle>
        </div>
        {conversationContext && (
          <CardDescription>
            Based on {conversationContext.messageCount} messages in the conversation
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

        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
            >
              {/* Style badge */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {suggestion.style}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(suggestion.reply, index)}
                  className="h-8"
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

              {/* Reply text */}
              <p className="text-sm text-gray-900 mb-3 leading-relaxed">
                {suggestion.reply}
              </p>

              {/* Reasoning */}
              {suggestion.reasoning && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Why this works:</span>{' '}
                    {suggestion.reasoning}
                  </p>
                </div>
              )}
            </div>
          ))}
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

