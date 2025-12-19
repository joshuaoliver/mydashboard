import { useState, useCallback, useEffect, useRef } from 'react'
import { usePaginatedQuery, useAction, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useChatStore } from '@/stores/useChatStore'
import { ChatDetail } from './ChatDetail'
import { MessageInputPanel } from './MessageInputPanel'
import { ReplySuggestionsPanel } from './ReplySuggestionsPanel'
import { ChatDebugPanel } from './ChatDebugPanel'
import { Button } from '@/components/ui/button'
import { RefreshCw, ExternalLink, Mail, MailOpen, Archive, MessageCircle, Bug, History } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function ConversationPanel() {
  // Get selected chat from Zustand store
  const selectedChatId = useChatStore((state) => state.selectedChatId)

  // Local state
  const [isLoadingFullConversation, setIsLoadingFullConversation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDebugPanel, setShowDebugPanel] = useState(false)

  // Query the selected chat directly by ID (not from paginated list!)
  const selectedChat = useQuery(
    api.beeperQueries.getChatByIdWithContact,
    selectedChatId ? { chatId: selectedChatId } : "skip"
  )

  // Debug logging for chat loading
  useEffect(() => {
    if (selectedChatId) {
      if (selectedChat === undefined) {
        console.log(`[ConversationPanel] ⏳ Loading chat: ${selectedChatId.slice(0, 30)}...`)
      } else if (selectedChat === null) {
        console.log(`[ConversationPanel] ❌ Chat not found in database: ${selectedChatId}`)
      } else {
        console.log(`[ConversationPanel] ✅ Loaded chat: "${selectedChat.name}" (${selectedChat.network})`)
      }
    }
  }, [selectedChatId, selectedChat])

  // Query messages for selected chat
  const { 
    results: cachedMessages, 
    status: messagesStatus, 
    loadMore: loadMoreMessages 
  } = usePaginatedQuery(
    api.beeperQueries.getCachedMessages,
    selectedChatId ? { chatId: selectedChatId } : "skip",
    { initialNumItems: 50 }
  )

  // Debug logging for messages
  useEffect(() => {
    if (selectedChatId) {
      console.log(`[ConversationPanel] Messages query status: ${messagesStatus}`)
      console.log(`[ConversationPanel] Cached messages count: ${cachedMessages?.length ?? 0}`)
      if (messagesStatus === "LoadingFirstPage") {
        console.log(`[ConversationPanel] ⏳ Loading messages for ${selectedChatId.slice(0, 30)}...`)
      } else if (messagesStatus === "Exhausted" && (!cachedMessages || cachedMessages.length === 0)) {
        console.log(`[ConversationPanel] ⚠️ No cached messages for this chat - may need to load from Beeper`)
      }
    }
  }, [selectedChatId, messagesStatus, cachedMessages?.length])

  // Actions
  const sendMessageAction = useAction(api.beeperMessages.sendMessage)
  const loadFullConversation = useAction(api.beeperMessages.loadFullConversation)
  const loadNewerMessages = useAction(api.beeperPagination.loadNewerMessages)
  const focusChat = useAction(api.beeperMessages.focusChat)
  const archiveChat = useAction(api.chatActions.archiveChat)
  const markChatAsRead = useAction(api.chatActions.markChatAsRead)
  const markChatAsUnread = useAction(api.chatActions.markChatAsUnread)
  const pageLoadSync = useAction(api.beeperSync.pageLoadSync)

  const isLoadingMessages = selectedChatId !== null && messagesStatus === "LoadingFirstPage"
  
  // Track which chat we've loaded newer messages for to avoid duplicate calls
  const loadedNewerForChat = useRef<string | null>(null)
  const [isLoadingNewer, setIsLoadingNewer] = useState(false)

  // Load newer messages when opening a conversation
  useEffect(() => {
    if (!selectedChatId) {
      loadedNewerForChat.current = null
      return
    }
    
    // Skip if we've already loaded for this chat
    if (loadedNewerForChat.current === selectedChatId) {
      return
    }
    
    // Mark as loading for this chat
    loadedNewerForChat.current = selectedChatId
    setIsLoadingNewer(true)
    
    // Load newer messages from Beeper
    loadNewerMessages({ chatId: selectedChatId })
      .then((result) => {
        if (result.success && result.messagesLoaded > 0) {
          console.log(`✅ Loaded ${result.messagesLoaded} newer messages for chat`)
        }
      })
      .catch((err) => {
        console.warn('Failed to load newer messages:', err)
      })
      .finally(() => {
        setIsLoadingNewer(false)
      })
  }, [selectedChatId, loadNewerMessages])

  // Handle sending a message
  const handleSendMessage = useCallback(async (text: string) => {
    if (!selectedChatId || !selectedChat) return

    try {
      console.log(`📤 Sending message to ${selectedChat.name}: "${text.slice(0, 50)}..."`)
      
      const result = await sendMessageAction({ 
        chatId: selectedChatId, 
        text 
      })

      if (result.success) {
        console.log(`✅ Message sent! Pending ID: ${result.pendingMessageId}`)
        
        // Trigger a sync to get the sent message back
        setTimeout(() => {
          pageLoadSync()
        }, 1000)
      } else {
        console.error('❌ Failed to send message:', result.error)
        setError(result.error || 'Failed to send message')
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
    }
  }, [selectedChatId, selectedChat, sendMessageAction, pageLoadSync])

  // Handle generating AI suggestions
  const handleGenerateAI = useCallback(async (customContext?: string) => {
    // This is handled by ReplySuggestionsPanel
    // Just a placeholder for the interface
  }, [])

  // Handle opening in Beeper
  const handleOpenInBeeper = useCallback(async (draftText?: string) => {
    if (!selectedChatId) return

    try {
      const result = await focusChat({ 
        chatId: selectedChatId,
        draftText,
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to open chat in Beeper')
      }
    } catch (err) {
      console.error('Failed to open in Beeper:', err)
      setError(err instanceof Error ? err.message : 'Failed to open in Beeper')
    }
  }, [selectedChatId, focusChat])

  // Handle loading full conversation
  const handleLoadFullConversation = useCallback(async () => {
    if (!selectedChatId) return

    setIsLoadingFullConversation(true)
    setError(null)

    try {
      console.log('📥 Loading full conversation history...')
      const result = await loadFullConversation({ chatId: selectedChatId })

      if (result.success) {
        console.log(`✅ Loaded ${result.messagesLoaded} messages (total fetched: ${result.totalFetched})`)
      } else {
        console.error('❌ Failed to load full conversation:', result.error)
        setError(result.error || 'Failed to load full conversation')
      }
    } catch (err) {
      console.error('Error loading full conversation:', err)
      setError(err instanceof Error ? err.message : 'Failed to load full conversation')
    } finally {
      setIsLoadingFullConversation(false)
    }
  }, [selectedChatId, loadFullConversation])

  // Handle refreshing (loading newer messages)
  const handleRefreshConversation = useCallback(async () => {
    if (!selectedChatId) return

    setIsLoadingNewer(true)
    setError(null)

    try {
      console.log('🔄 Refreshing conversation (loading newer messages)...')
      const result = await loadNewerMessages({ chatId: selectedChatId })

      if (result.success) {
        if (result.messagesLoaded > 0) {
          console.log(`✅ Loaded ${result.messagesLoaded} newer messages`)
        } else {
          console.log('✅ Conversation is up to date')
        }
      } else {
        console.error('❌ Failed to refresh:', result.error)
        setError(result.error || 'Failed to refresh conversation')
      }
    } catch (err) {
      console.error('Error refreshing conversation:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh conversation')
    } finally {
      setIsLoadingNewer(false)
    }
  }, [selectedChatId, loadNewerMessages])

  // Handle archive
  const handleArchive = useCallback(async () => {
    if (!selectedChatId) return

    try {
      await archiveChat({ chatId: selectedChatId })
    } catch (err) {
      console.error('Failed to archive chat:', err)
      setError(err instanceof Error ? err.message : 'Failed to archive chat')
    }
  }, [selectedChatId, archiveChat])

  // Handle mark as read/unread
  const handleToggleRead = useCallback(async () => {
    if (!selectedChatId || !selectedChat) return

    try {
      if (selectedChat.unreadCount > 0) {
        await markChatAsRead({ chatId: selectedChatId })
      } else {
        await markChatAsUnread({ chatId: selectedChatId })
      }
    } catch (err) {
      console.error('Failed to mark chat:', err)
      setError(err instanceof Error ? err.message : 'Failed to mark chat')
    }
  }, [selectedChatId, selectedChat, markChatAsRead, markChatAsUnread])

  // Handle suggestion selection - pass text to input
  const handleSuggestionSelect = useCallback((text: string) => {
    // This would ideally update the MessageInputPanel's value
    // For now, the MessageInputPanel manages its own state
    // This is a known limitation - could be improved with a shared ref or callback
  }, [])

  // No chat selected
  if (!selectedChatId) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center text-gray-500">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">👈 Select a conversation</p>
          <p className="text-sm">
            Choose a chat from the left to view messages and get AI-powered reply suggestions
          </p>
        </div>
      </div>
    )
  }

  // Chat is loading
  if (selectedChat === undefined) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading chat...</p>
        </div>
      </div>
    )
  }

  // Chat not found in database
  if (selectedChat === null) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center text-gray-500">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">Chat not found</p>
          <p className="text-sm">
            This chat may not have been synced yet. Try refreshing the chat list.
          </p>
          <p className="text-xs text-gray-400 mt-2 font-mono">
            ID: {selectedChatId.slice(0, 40)}...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-white flex flex-col overflow-hidden">
      {/* Chat Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectedChat.contactImageUrl ? (
            <img
              src={selectedChat.contactImageUrl}
              alt={selectedChat.name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {selectedChat.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 truncate">{selectedChat.name}</h2>
            {selectedChat.username && (
              <p className="text-xs text-gray-500">@{selectedChat.username}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshConversation}
                  disabled={isLoadingNewer}
                  title="Refresh conversation (load new messages)"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingNewer ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh (load new messages)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadFullConversation}
                  disabled={isLoadingFullConversation}
                  title="Load full conversation history (1 year)"
                >
                  <History className={`w-4 h-4 ${isLoadingFullConversation ? 'animate-pulse' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Load full history (1 year)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenInBeeper()}
            title="Open in Beeper Desktop"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleRead}
            title={selectedChat.unreadCount > 0 ? "Mark as read" : "Mark as unread"}
          >
            {selectedChat.unreadCount > 0 ? (
              <MailOpen className="w-4 h-4" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleArchive}
            title="Archive chat"
          >
            <Archive className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            title="Toggle debug panel"
            className={showDebugPanel ? 'bg-yellow-100 text-yellow-700' : ''}
          >
            <Bug className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebugPanel && selectedChatId && (
        <ChatDebugPanel 
          chatId={selectedChatId} 
          onClose={() => setShowDebugPanel(false)} 
        />
      )}

      {isLoadingMessages ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading conversation...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <ChatDetail 
            messages={cachedMessages || []} 
            isSingleChat={selectedChat?.type === 'single' || selectedChat?.type === undefined}
            messagesStatus={messagesStatus}
            onLoadMore={loadMoreMessages}
          />
          
          {/* Message Input */}
          <MessageInputPanel
            selectedChat={{ id: selectedChat.id, name: selectedChat.name }}
            onSubmit={handleSendMessage}
            onGenerateAI={handleGenerateAI}
            onOpenInBeeper={handleOpenInBeeper}
            isLoadingAI={false}
          />

          {/* AI Reply Suggestions */}
          <ReplySuggestionsPanel
            selectedChatId={selectedChatId}
            selectedChatName={selectedChat.name}
            username={selectedChat.username}
            onSuggestionSelect={handleSuggestionSelect}
          />
        </>
      )}
    </div>
  )
}

