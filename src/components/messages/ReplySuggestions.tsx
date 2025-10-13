import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check, Sparkles, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Loader } from '@/components/ai-elements/loader'
import { Response } from '@/components/ai-elements/response'

interface ReplySuggestion {
  reply: string
  style: string  // Conversation pathway label (e.g., "Ask deeper question", "Shift to plans")
  reasoning: string
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
  const [customContext, setCustomContext] = useState<string>('')
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false)

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
      {/* Quick Action Chips */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2 mb-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionSelect?.(index)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                index === selectedIndex
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              {suggestion.style}
            </button>
          ))}
        </div>
        
        {/* Custom Context Input */}
        <div className="flex items-center gap-2">
          {!showCustomInput ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCustomInput(true)}
              className="text-xs gap-1.5"
            >
              <Sparkles className="w-3 h-3" />
              Add Custom Context
            </Button>
          ) : (
            <>
              <Input
                type="text"
                placeholder="Add context or instructions for AI..."
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                className="flex-1 text-sm h-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customContext.trim()) {
                    onGenerateClick?.(customContext)
                    setCustomContext('')
                    setShowCustomInput(false)
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (customContext.trim()) {
                    onGenerateClick?.(customContext)
                    setCustomContext('')
                    setShowCustomInput(false)
                  }
                }}
                className="gap-1.5 h-9"
                disabled={!customContext.trim()}
              >
                <RefreshCw className="w-3 h-3" />
                Generate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCustomInput(false)
                  setCustomContext('')
                }}
                className="h-9 px-2"
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Suggestion Cards */}
      <div className="space-y-3">
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
              {/* Style badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
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
                  className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
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

              {/* Reply text with markdown support */}
              <div className="text-sm text-gray-900 mb-2 leading-relaxed">
                <Response>{suggestion.reply}</Response>
              </div>

              {/* Reasoning */}
              {suggestion.reasoning && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Why:</span>{' '}
                    {suggestion.reasoning}
                  </p>
                </div>
              )}
              
              {/* Selected indicator */}
              {isSelected && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">
                    ✓ Active in input field
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

