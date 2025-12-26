import { useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useChatStore } from '@/stores/useChatStore'

/**
 * Keyboard shortcuts for the messages/chat interface:
 * - E: Archive current conversation and move to next
 * - J or Down Arrow: Move to next conversation
 * - K or Up Arrow: Move to previous conversation
 */
export function useChatKeyboardShortcuts() {
  const navigate = useNavigate()
  const selectedChatId = useChatStore((state) => state.selectedChatId)
  const getNextChatId = useChatStore((state) => state.getNextChatId)
  const getPreviousChatId = useChatStore((state) => state.getPreviousChatId)
  
  const archiveChat = useAction(api.chatActions.archiveChat)

  // Archive and move to next chat
  const handleArchive = useCallback(async () => {
    if (!selectedChatId) return

    // Get next chat BEFORE archiving (because archive will remove from list)
    const nextChatId = getNextChatId()
    
    try {
      await archiveChat({ chatId: selectedChatId })
      
      // Navigate to next chat, or clear selection if no more chats
      if (nextChatId && nextChatId !== selectedChatId) {
        navigate({ to: '/inbox', search: { chatId: nextChatId } })
      } else {
        navigate({ to: '/inbox', search: { chatId: undefined } })
      }
    } catch (err) {
      console.error('Failed to archive chat:', err)
    }
  }, [selectedChatId, getNextChatId, archiveChat, navigate])

  // Move to next chat
  const handleNextChat = useCallback(() => {
    const nextChatId = getNextChatId()
    if (nextChatId) {
      navigate({ to: '/inbox', search: { chatId: nextChatId } })
    }
  }, [getNextChatId, navigate])

  // Move to previous chat
  const handlePreviousChat = useCallback(() => {
    const prevChatId = getPreviousChatId()
    if (prevChatId) {
      navigate({ to: '/inbox', search: { chatId: prevChatId } })
    }
  }, [getPreviousChatId, navigate])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // E: Archive current chat
      if (event.key === 'e' || event.key === 'E') {
        event.preventDefault()
        handleArchive()
        return
      }

      // J or Down Arrow: Next chat
      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault()
        handleNextChat()
        return
      }

      // K or Up Arrow: Previous chat
      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault()
        handlePreviousChat()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleArchive, handleNextChat, handlePreviousChat])

  return {
    handleArchive,
    handleNextChat,
    handlePreviousChat,
  }
}
