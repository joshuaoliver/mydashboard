import { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useQuery, useAction } from 'convex/react'
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

export interface ReplySuggestionsPanelRef {
  regenerateWithContext: (context: string) => Promise<void>
}

export const ReplySuggestionsPanel = forwardRef<ReplySuggestionsPanelRef, ReplySuggestionsPanelProps>(function ReplySuggestionsPanel({
  selectedChatId,
  selectedChatName,
  username,
  onSuggestionSelect,
  onSendMessage,
}, ref) {
  // Local state for custom regeneration only
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | undefined>(undefined)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const [customSuggestions, setCustomSuggestions] = useState<ReplySuggestion[] | null>(null)

  // Live query to cached suggestions - no action call needed!
  const cachedSuggestions = useQuery(
    api.aiSuggestions.getSuggestionsForChat,
    selectedChatId ? { chatId: selectedChatId } : "skip"
  )

  // Action only used for manual regeneration with custom context
  const generateReplySuggestions = useAction(api.beeperActions.generateReplySuggestions)

  // Reset state when chat changes
  useEffect(() => {
    setSelectedSuggestionIndex(undefined)
    setCustomSuggestions(null)
    setRegenerateError(null)
  }, [selectedChatId])

  // Handle manual regeneration (with optional custom context)
  const handleRegenerate = useCallback(async (customContext?: string) => {
    if (!selectedChatId) return

    setIsRegenerating(true)
    setRegenerateError(null)

    try {
      const result = await generateReplySuggestions({
        chatId: selectedChatId,
        chatName: selectedChatName,
        instagramUsername: username,
        customContext: customContext || undefined,
      })

      // If custom context was provided, store in local state
      // Otherwise the live query will pick up the new cached suggestions
      if (customContext) {
        setCustomSuggestions(result.suggestions || [])
        console.log(`🔄 Generated custom suggestions for ${selectedChatName}`)
      } else {
        setCustomSuggestions(null) // Clear custom, use cached
        console.log(`🔄 Regenerated suggestions for ${selectedChatName}`)
      }
    } catch (err) {
      console.error('Error regenerating suggestions:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate suggestions'
      setRegenerateError(errorMessage)
    } finally {
      setIsRegenerating(false)
    }
  }, [selectedChatId, selectedChatName, username, generateReplySuggestions])

  // Expose regeneration method to parent via ref
  useImperativeHandle(ref, () => ({
    regenerateWithContext: async (context: string) => {
      await handleRegenerate(context)
    }
  }), [handleRegenerate])

  // Determine which suggestions to display - limit to 3 for consistent height
  const allSuggestions = customSuggestions ?? cachedSuggestions?.suggestions ?? []
  const displaySuggestions = allSuggestions.slice(0, 3)
  const isLoading = cachedSuggestions === undefined && !customSuggestions

  const handleSuggestionSelect = useCallback((index: number) => {
    setSelectedSuggestionIndex(index)
    if (displaySuggestions[index]) {
      onSuggestionSelect(displaySuggestions[index].reply)
    }
  }, [displaySuggestions, onSuggestionSelect])

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
      <ReplySuggestions
        suggestions={displaySuggestions}
        isLoading={isLoading}
        isRegenerating={isRegenerating}
        error={regenerateError || undefined}
        onGenerateClick={handleRegenerate}
        selectedIndex={selectedSuggestionIndex}
        onSuggestionSelect={handleSuggestionSelect}
        onSendSuggestion={onSendMessage}
      />
    </div>
  )
})
