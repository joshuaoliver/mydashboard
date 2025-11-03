import { Button } from '@/components/ui/button'
import { Copy, Check, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Loader } from '@/components/ai-elements/loader'
import { Response } from '@/components/ai-elements/response'

interface ReplySuggestion {
  reply: string
  style: string  // Conversation pathway label (e.g., "Ask deeper question", "Shift to plans")
}

interface ReplySuggestionsProps {
  suggestions: ReplySuggestion[]
  isLoading: boolean
  error?: string
  _conversationContext?: {
    lastMessage: string
    messageCount: number
  }
  _isCached?: boolean       // New: indicates if suggestions are from cache
  _generatedAt?: number     // New: when suggestions were generated
  onGenerateClick?: (customContext?: string) => void  // Now accepts custom context
  selectedIndex?: number   // Currently selected suggestion index
  onSuggestionSelect?: (index: number) => void  // Callback when suggestion is clicked
}

export function ReplySuggestions({
  suggestions,
  isLoading,
  error,
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
      <div className="p-4">
        <div className="flex items-center justify-center py-8">
          <Loader />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-4">
        <div className="text-center py-6">
          <p className="text-red-600 text-sm mb-1">Failed to generate suggestions</p>
          <p className="text-xs text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  // No suggestions yet - show button to generate
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-purple-400" />
          <p className="text-gray-600 text-sm mb-4">Ready to generate smart replies?</p>
          {onGenerateClick && (
            <Button onClick={() => onGenerateClick()} size="sm" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Suggestions
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.map((suggestion, index) => {
          const isSelected = index === selectedIndex
          return (
            <div
              key={index}
              onClick={() => onSuggestionSelect?.(index)}
              className={`p-3 rounded-lg transition-all cursor-pointer group ${
                isSelected
                  ? 'bg-blue-50 border-2 border-blue-500 shadow-sm'
                  : 'bg-white border-2 border-gray-300 hover:border-blue-400 hover:shadow-sm'
              }`}
            >
              {/* Reply text with markdown support */}
              <div className={`text-sm text-gray-900 leading-relaxed ${isSelected ? 'mb-3' : ''}`}>
                <Response>{suggestion.reply}</Response>
              </div>

              {/* Style badge and copy button - only show for selected */}
              {isSelected && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                    <span className="text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 text-blue-700 bg-blue-100">
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
                    className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="w-3 h-3 mr-1 text-green-600" />
                        <span className="text-green-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

