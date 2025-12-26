import { useState, useCallback, useEffect } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ReplySuggestions } from './ReplySuggestions'

interface ReplySuggestion {
  reply: string
}

interface ReplySuggestionsPanelProps {
  selectedChatId: string | null
  selectedChatName: string
  username?: string
  onSuggestionSelect: (text: string) => void
  onSendMessage?: (text: string) => void
}

export function ReplySuggestionsPanel({
  selectedChatId,
  selectedChatName,
  username,
  onSuggestionSelect,
  onSendMessage,
}: ReplySuggestionsPanelProps) {
  // Local state - isolated from parent
  const [replySuggestions, setReplySuggestions] = useState<ReplySuggestion[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateReplySuggestions = useAction(api.beeperActions.generateReplySuggestions)

  const handleGenerateAISuggestions = useCallback(async (customContext?: string) => {
    if (!selectedChatId) return

    setIsLoading(true)
    setError(null)

    try {
      const suggestionsResult = await generateReplySuggestions({
        chatId: selectedChatId,
        chatName: selectedChatName,
        instagramUsername: username,
        customContext: customContext || undefined,
      })

      const suggestions = suggestionsResult.suggestions || []
      setReplySuggestions(suggestions)
      
      if (suggestionsResult.isCached) {
        console.log(`✅ Using cached suggestions for ${selectedChatName}`)
      } else {
        console.log(`🔄 Generated fresh suggestions for ${selectedChatName}`)
      }
    } catch (err) {
      console.error('Error generating suggestions:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate suggestions'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [selectedChatId, selectedChatName, username, generateReplySuggestions])

  // Auto-generate suggestions when chat changes
  useEffect(() => {
    if (selectedChatId) {
      handleGenerateAISuggestions()
    } else {
      setReplySuggestions([])
      setSelectedSuggestionIndex(0)
    }
  }, [selectedChatId, handleGenerateAISuggestions])

  const handleSuggestionSelect = useCallback((index: number) => {
    setSelectedSuggestionIndex(index)
    if (replySuggestions[index]) {
      onSuggestionSelect(replySuggestions[index].reply)
    }
  }, [replySuggestions, onSuggestionSelect])

  return (
    <div className="flex-shrink-0 border-t-2 border-gray-300 bg-gray-50">
      <ReplySuggestions
        suggestions={replySuggestions}
        isLoading={isLoading}
        error={error || undefined}
        onGenerateClick={handleGenerateAISuggestions}
        selectedIndex={selectedSuggestionIndex}
        onSuggestionSelect={handleSuggestionSelect}
        onSendSuggestion={onSendMessage}
      />
    </div>
  )
}

