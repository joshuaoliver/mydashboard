import { Button } from '@/components/ui/button'
import { Copy, Check, Sparkles, Send } from 'lucide-react'
import { useState } from 'react'
import { Loader } from '@/components/ai-elements/loader'

interface ReplySuggestion {
  reply: string
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
  onSendSuggestion?: (text: string) => void  // Callback to send a suggestion directly
}

export function ReplySuggestions({
  suggestions,
  isLoading,
  error,
  onGenerateClick,
  selectedIndex = 0,
  onSuggestionSelect,
  onSendSuggestion,
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

  const handleSend = (text: string, index: number) => {
    // First select it
    onSuggestionSelect?.(index)
    // Then send it
    onSendSuggestion?.(text)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-2">
        <div className="flex items-center justify-center py-4">
          <Loader />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-2">
        <div className="text-center py-3">
          <p className="text-red-600 text-xs mb-0.5">Failed to generate suggestions</p>
          <p className="text-[10px] text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  // No suggestions yet - show button to generate
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="p-2">
        <div className="text-center py-4">
          <Sparkles className="w-6 h-6 mx-auto mb-2 text-purple-400" />
          <p className="text-gray-600 text-xs mb-2">Ready to generate smart replies?</p>
          {onGenerateClick && (
            <Button onClick={() => onGenerateClick()} size="sm" className="gap-1.5 h-7 text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              Generate Suggestions
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-1.5 min-w-0">
      {/* Suggestion Cards - Full width, stacked */}
      <div className="flex flex-col gap-1 min-w-0">
        {suggestions.map((suggestion, index) => {
          const isSelected = index === selectedIndex
          return (
            <div
              key={index}
              onClick={() => onSuggestionSelect?.(index)}
              className={`w-full px-2 py-1.5 rounded transition-all cursor-pointer group ${
                isSelected
                  ? 'bg-blue-50 border border-blue-500'
                  : 'bg-white border border-gray-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-start gap-2">
                {/* Reply text */}
                <div className="flex-1 text-xs text-gray-900 leading-relaxed break-words overflow-hidden whitespace-pre-wrap">
                  {suggestion.reply}
                </div>

                {/* Action buttons - always visible */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopy(suggestion.reply, index)
                    }}
                    className="h-6 w-6 p-0"
                    title="Copy to clipboard"
                  >
                    {copiedIndex === index ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                  {onSendSuggestion && (
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSend(suggestion.reply, index)
                      }}
                      className="h-6 w-6 p-0"
                      title="Send this reply"
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
