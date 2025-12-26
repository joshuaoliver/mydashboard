import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePaginatedQuery, useAction, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useChatStore } from '@/stores/useChatStore'
import { ChatDetail } from './ChatDetail'
import { MessageInputPanel } from './MessageInputPanel'
import { ReplySuggestionsPanel, type ReplySuggestionsPanelRef } from './ReplySuggestionsPanel'
import { ChatDebugPanel } from './ChatDebugPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, ExternalLink, Mail, MailOpen, Archive, MessageCircle, Bug, History, Ban, MoreVertical, Link2, Search, Check } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

interface OptimisticMessage {
  id: string
  text: string
  timestamp: number
  sender: string
  senderName: string
  isFromUser: boolean
  isPending?: boolean
}

export function ConversationPanel() {
  const navigate = useNavigate()
  
  // Get selected chat from Zustand store
  const selectedChatId = useChatStore((state) => state.selectedChatId)

  // Local state
  const [isLoadingFullConversation, setIsLoadingFullConversation] = useState(false)
  const [_error, setError] = useState<string | null>(null)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  
  // State for input value (shared between input and suggestions)
  const [inputValue, setInputValue] = useState('')
  
  // State for optimistic messages
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([])
  
  // Ref for suggestions panel to trigger regeneration
  const suggestionsRef = useRef<ReplySuggestionsPanelRef>(null)

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
  const blockChat = useAction(api.chatActions.blockChat)
  const markChatAsRead = useAction(api.chatActions.markChatAsRead)
  const markChatAsUnread = useAction(api.chatActions.markChatAsUnread)
  const pageLoadSync = useAction(api.beeperSync.pageLoadSync)
  const linkChatToContact = useAction(api.chatActions.linkChatToContact)
  
  // Query all contacts for the contact linking dialog
  const contactsResult = useQuery(api.dexQueries.listContacts, { limit: 200 })
  
  // State for contact linking dialog
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [contactSearchQuery, setContactSearchQuery] = useState('')
  
  // Helper to get full name from contact
  const getContactFullName = useCallback((contact: { firstName?: string; lastName?: string }) => {
    const parts = [contact.firstName, contact.lastName].filter(Boolean)
    return parts.join(' ') || 'Unknown'
  }, [])
  
  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    const contacts = contactsResult?.contacts ?? []
    if (!contactSearchQuery.trim()) return contacts.slice(0, 50)
    const query = contactSearchQuery.toLowerCase()
    return contacts.filter(c => {
      const fullName = getContactFullName(c).toLowerCase()
      const email = c.emails?.[0]?.email?.toLowerCase() ?? ''
      const instagram = c.instagram?.toLowerCase() ?? ''
      return (
        fullName.includes(query) ||
        email.includes(query) ||
        instagram.includes(query)
      )
    }).slice(0, 50)
  }, [contactsResult, contactSearchQuery, getContactFullName])

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

    // Create optimistic message immediately
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMessage: OptimisticMessage = {
      id: optimisticId,
      text,
      timestamp: Date.now(),
      sender: 'user',
      senderName: 'You',
      isFromUser: true,
      isPending: true,
    }
    
    // Add optimistic message to state
    setOptimisticMessages(prev => [...prev, optimisticMessage])
    
    // Clear the input value
    setInputValue('')

    try {
      console.log(`📤 Sending message to ${selectedChat.name}: "${text.slice(0, 50)}..."`)
      
      const result = await sendMessageAction({ 
        chatId: selectedChatId, 
        text 
      })

      if (result.success) {
        console.log(`✅ Message sent! Pending ID: ${result.pendingMessageId}`)
        
        // Remove optimistic message (real one will come via sync)
        setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticId))
        
        // Trigger a sync to get the sent message back
        setTimeout(() => {
          pageLoadSync()
        }, 1000)
      } else {
        console.error('❌ Failed to send message:', result.error)
        setError(result.error || 'Failed to send message')
        // Remove optimistic message on failure
        setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticId))
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      // Remove optimistic message on failure
      setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticId))
    }
  }, [selectedChatId, selectedChat, sendMessageAction, pageLoadSync])

  // Handle generating AI suggestions with custom context
  const handleGenerateAI = useCallback(async (customContext?: string) => {
    // If there's text in the input, use it as context for regeneration
    if (customContext && customContext.trim()) {
      await suggestionsRef.current?.regenerateWithContext(customContext)
    }
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

  // Handle archive - navigate to next chat after archiving
  const handleArchive = useCallback(async () => {
    if (!selectedChatId) return

    // Get the next chat ID BEFORE archiving (as the list will update)
    const nextChatId = useChatStore.getState().getNextChatId()

    try {
      await archiveChat({ chatId: selectedChatId })
      
      // Navigate to the next conversation, or clear selection if none
      if (nextChatId && nextChatId !== selectedChatId) {
        navigate({ to: '/inbox', search: { chatId: nextChatId } })
      } else {
        navigate({ to: '/inbox', search: { chatId: undefined } })
      }
    } catch (err) {
      console.error('Failed to archive chat:', err)
      setError(err instanceof Error ? err.message : 'Failed to archive chat')
    }
  }, [selectedChatId, archiveChat, navigate])

  // Handle block
  const handleBlock = useCallback(async () => {
    if (!selectedChatId) return

    try {
      await blockChat({ chatId: selectedChatId })
    } catch (err) {
      console.error('Failed to block chat:', err)
      setError(err instanceof Error ? err.message : 'Failed to block chat')
    }
  }, [selectedChatId, blockChat])

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

  // Handle linking chat to a contact
  const handleLinkToContact = useCallback(async (contactId: Id<"contacts">) => {
    if (!selectedChatId) return

    try {
      await linkChatToContact({ chatId: selectedChatId, contactId })
      setShowContactDialog(false)
      setContactSearchQuery('')
    } catch (err) {
      console.error('Failed to link chat to contact:', err)
      setError(err instanceof Error ? err.message : 'Failed to link chat to contact')
    }
  }, [selectedChatId, linkChatToContact])

  // Handle suggestion selection - pass text to input
  const handleSuggestionSelect = useCallback((text: string) => {
    // Update the shared input value so it populates the text area
    setInputValue(text)
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
        <div className="flex gap-1">
          {/* Primary actions - always visible */}
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
                  onClick={handleArchive}
                  title="Archive chat"
                >
                  <Archive className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Archive (E)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" title="More actions">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                onClick={handleLoadFullConversation}
                disabled={isLoadingFullConversation}
              >
                <History className="w-4 h-4 mr-2" />
                Load full history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenInBeeper()}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Beeper
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleRead}>
                {selectedChat.unreadCount > 0 ? (
                  <>
                    <MailOpen className="w-4 h-4 mr-2" />
                    Mark as read
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Mark as unread
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowContactDialog(true)}>
                <Link2 className="w-4 h-4 mr-2" />
                Link to contact
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleBlock} className="text-red-600">
                <Ban className="w-4 h-4 mr-2" />
                Block chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className={showDebugPanel ? 'bg-yellow-50' : ''}
              >
                <Bug className="w-4 h-4 mr-2" />
                {showDebugPanel ? 'Hide debug' : 'Show debug'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            messages={[...(cachedMessages || []), ...optimisticMessages]} 
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
            externalValue={inputValue}
            onInputChange={setInputValue}
          />

          {/* AI Reply Suggestions */}
          <ReplySuggestionsPanel
            ref={suggestionsRef}
            selectedChatId={selectedChatId}
            selectedChatName={selectedChat.name}
            username={selectedChat.username}
            onSuggestionSelect={handleSuggestionSelect}
            onSendMessage={handleSendMessage}
          />
        </>
      )}

      {/* Contact Linking Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link to Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={contactSearchQuery}
                onChange={(e) => setContactSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Contact list */}
            <ScrollArea className="h-72">
              <div className="space-y-1">
                {filteredContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {contactSearchQuery ? 'No contacts found' : 'Loading contacts...'}
                  </p>
                ) : (
                  filteredContacts.map((contact) => {
                    const fullName = getContactFullName(contact)
                    const subtitle = contact.instagram || contact.emails?.[0]?.email || null
                    
                    return (
                      <button
                        key={contact._id}
                        onClick={() => handleLinkToContact(contact._id)}
                        className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left transition-colors"
                      >
                        {contact.imageUrl ? (
                          <img
                            src={contact.imageUrl}
                            alt={fullName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {(contact.firstName?.charAt(0) || contact.lastName?.charAt(0) || '?').toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {fullName}
                          </p>
                          {subtitle && (
                            <p className="text-xs text-muted-foreground truncate">
                              {subtitle}
                            </p>
                          )}
                        </div>
                        {selectedChat?.contactId === contact._id && (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

