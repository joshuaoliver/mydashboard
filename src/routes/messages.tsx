import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { FullWidthContent } from '@/components/layout/full-width-content'
import { Sidebar, SidebarHeader } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
// Replace plain Input with PromptInput from AI Elements
import { 
  PromptInput, 
  PromptInputBody, 
  PromptInputTextarea, 
  PromptInputToolbar, 
  PromptInputSubmit,
  PromptInputButton,
} from '@/components/ai-elements/prompt-input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ChatListItem } from '@/components/messages/ChatListItem'
import { ChatDetail } from '@/components/messages/ChatDetail'
import { ReplySuggestions } from '@/components/messages/ReplySuggestions'
import { ContactPanel } from '@/components/messages/ContactPanel'
import { useAction, useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, AlertCircle, MessageCircle, ArrowLeft, Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/lib/hooks/use-mobile'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/messages')({
  component: Messages,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      chatId: (search.chatId as string) || undefined,
    }
  },
})

interface Chat {
  id: string
  roomId: string
  name: string
  network: string
  accountID: string
  username?: string        // Instagram handle, etc.
  phoneNumber?: string     // WhatsApp number, etc.
  lastMessage: string
  lastMessageTime: number
  unreadCount: number
  lastSyncedAt?: number
  needsReply?: boolean
  lastMessageFrom?: string
  contactImageUrl?: string // From DEX integration
}

interface Attachment {
  type: string
  srcURL: string
  mimeType?: string
  fileName?: string
  fileSize?: number
  isGif?: boolean
  isSticker?: boolean
  width?: number
  height?: number
}

interface Message {
  id: string
  text: string
  timestamp: number
  sender: string
  senderName: string
  isFromUser: boolean
  attachments?: Attachment[]
}

interface ReplySuggestion {
  reply: string
  style: string  // Conversation pathway label (e.g., "Ask deeper question", "Shift to plans")
  reasoning: string
}

type TabFilter = 'unreplied' | 'unread' | 'all'

function Messages() {
  const navigate = useNavigate({ from: '/messages' })
  const { chatId } = Route.useSearch()
  const selectedChatId = chatId || null
  
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [replySuggestions, setReplySuggestions] = useState<ReplySuggestion[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [messageInputValue, setMessageInputValue] = useState('')
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Removed unused conversation context/caching state
  const [tabFilter, setTabFilter] = useState<TabFilter>('unreplied')
  const sendMessageAction = useAction(api.beeperMessages.sendMessage)
  const clearCachedSuggestions = useMutation(api.aiSuggestions.clearCachedSuggestions)
  
  // Mobile detection and sheet state
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  
  // Track previous contact data to detect changes
  const prevContactDataRef = useRef<{ connection?: string; notes?: string } | null>(null)
  
  // Infinite scroll state
  const [allLoadedChats, setAllLoadedChats] = useState<Chat[]>([])
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined)
  const [hasMoreChats, setHasMoreChats] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const chatListRef = useRef<HTMLDivElement>(null)

  // Query cached chats from database (instant, reactive) with pagination
  const chatsData = useQuery(api.beeperQueries.listCachedChats, { 
    limit: 30,
    cursor: nextCursor 
  })
  const syncInfo = useQuery(api.beeperQueries.getChatInfo)
  
  // Query cached messages for selected chat (instant, reactive)
  const cachedMessagesData = useQuery(
    api.beeperQueries.getCachedMessages,
    selectedChatId ? { chatId: selectedChatId } : "skip"
  )

  // Actions for syncing and AI generation
  const pageLoadSync = useAction(api.beeperSync.pageLoadSync)
  const manualSync = useAction(api.beeperSync.manualSync)
  const generateReplySuggestions = useAction(api.beeperActions.generateReplySuggestions)

  // Merge new chats with existing ones
  useEffect(() => {
    if (chatsData?.chats) {
      setAllLoadedChats(prev => {
        // If this is the first load (no cursor was set), replace all
        if (nextCursor === undefined && prev.length === 0) {
          return chatsData.chats
        }
        // Otherwise, append new chats
        const existingIds = new Set(prev.map(c => c.id))
        const newChats = chatsData.chats.filter(c => !existingIds.has(c.id))
        return [...prev, ...newChats]
      })
      setHasMoreChats(chatsData.hasMore || false)
      setIsLoadingMore(false)
    }
  }, [chatsData, nextCursor])
  
  // Reset pagination when tab filter changes
  useEffect(() => {
    setAllLoadedChats([])
    setNextCursor(undefined)
    setHasMoreChats(true)
  }, [tabFilter])
  
  // Apply tab filtering to all loaded chats
  const chats = allLoadedChats.filter((chat) => {
    if (tabFilter === 'unreplied') {
      return chat.needsReply === true
    } else if (tabFilter === 'unread') {
      return chat.unreadCount > 0
    }
    return true // 'all' tab shows everything
  })
  
  // Load more chats when scrolling
  const loadMoreChats = useCallback(() => {
    if (hasMoreChats && chatsData?.nextCursor && !isLoadingMore) {
      console.log('📜 Loading more chats from Convex DB...')
      setIsLoadingMore(true)
      setNextCursor(chatsData.nextCursor)
    }
  }, [hasMoreChats, chatsData?.nextCursor, isLoadingMore])
  
  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!chatListRef.current || !hasMoreChats || isLoadingMore) return
    
    const { scrollTop, scrollHeight, clientHeight } = chatListRef.current
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight
    
    // Load more when scrolled 80% down
    if (scrollPercentage > 0.8) {
      loadMoreChats()
    }
  }, [hasMoreChats, isLoadingMore, loadMoreChats])
  
  const selectedChat = allLoadedChats.find((chat: Chat) => chat.id === selectedChatId)
  
  // Query contact by Instagram username if available
  const contactData = useQuery(
    api.contactMutations.findContactByInstagram,
    selectedChat?.username ? { username: selectedChat.username } : "skip"
  )
  
  // Derived loading state - loading if we have a selected chat but no cached data yet
  const isLoadingMessages = selectedChatId !== null && cachedMessagesData === undefined

  // Trigger sync on page load and auto-select most recent chat
  useEffect(() => {
    const syncOnLoad = async () => {
      setIsSyncing(true)
      try {
        const result = await pageLoadSync()
        if (result.success) {
          console.log(`✅ Beeper synced: ${result.syncedChats} chats, ${result.syncedMessages} messages`)
        } else {
          console.warn(`⚠️ Beeper sync failed: ${result.error || 'Unknown error'}`)
        }
      } catch (err) {
        console.error('Error syncing on page load:', err)
      } finally {
        setIsSyncing(false)
      }
    }

    syncOnLoad()
  }, [pageLoadSync])

  // Auto-select most recent chat if no chat is selected
  useEffect(() => {
    if (!selectedChatId && chats.length > 0) {
      const mostRecentChat = chats[0] // Chats are already sorted by most recent
      navigate({ search: { chatId: mostRecentChat.id } })
    }
  }, [chats, selectedChatId, navigate])

  // Update messages when cached data changes (automatic via Convex reactivity!)
  useEffect(() => {
    if (!selectedChatId) {
      setChatMessages([])
      setReplySuggestions([])
      // cleared along with suggestions
      setMessageInputValue('')
      setSelectedSuggestionIndex(0)
      return
    }

    if (cachedMessagesData) {
      setChatMessages(cachedMessagesData.messages || [])
      // Clear previous AI suggestions when switching chats
      setReplySuggestions([])
      // cleared along with suggestions
      setMessageInputValue('')
      setSelectedSuggestionIndex(0)
      
      // Auto-generate AI suggestions when chat is selected
      handleGenerateAISuggestions()
    }
  }, [selectedChatId, cachedMessagesData])

  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Open sheet when chat selected on mobile
  useEffect(() => {
    if (isMobile && selectedChatId) {
      setSheetOpen(true)
    } else if (!isMobile) {
      setSheetOpen(false)
    }
  }, [isMobile, selectedChatId])

  // Watch for changes in contact connection type or notes and regenerate suggestions
  useEffect(() => {
    if (!contactData || !selectedChatId) {
      prevContactDataRef.current = null
      return
    }

    const currentConnection = contactData.connection
    const currentNotes = contactData.notes

    // Check if this is the first time we're seeing this contact data
    if (prevContactDataRef.current === null) {
      prevContactDataRef.current = { connection: currentConnection, notes: currentNotes }
      return
    }

    // Check if connection or notes have changed
    const connectionChanged = prevContactDataRef.current.connection !== currentConnection
    const notesChanged = prevContactDataRef.current.notes !== currentNotes

    if (connectionChanged || notesChanged) {
      console.log('🔄 Contact data changed, regenerating AI suggestions...')
      if (connectionChanged) {
        console.log(`  Connection: ${prevContactDataRef.current.connection} → ${currentConnection}`)
      }
      if (notesChanged) {
        console.log(`  Notes changed`)
      }
      
      // Update the ref
      prevContactDataRef.current = { connection: currentConnection, notes: currentNotes }
      
      // Clear cached suggestions to force fresh generation
      const regenerate = async () => {
        await clearCachedSuggestions({ chatId: selectedChatId })
        await handleGenerateAISuggestions()
      }
      regenerate()
    }
  }, [contactData?.connection, contactData?.notes, selectedChatId])

  // Auto/Manual AI suggestion generation
  // Automatically checks cache first, only generates if conversation changed
  const handleGenerateAISuggestions = async (customContext?: string) => {
    if (!selectedChatId || !selectedChat) return

    setIsLoadingSuggestions(true)
    setError(null)

    try {
      const suggestionsResult = await generateReplySuggestions({
        chatId: selectedChatId,
        chatName: selectedChat.name,
        instagramUsername: selectedChat.username,
        customContext: customContext || undefined, // Pass custom context if provided
      })

      const suggestions = suggestionsResult.suggestions || []
      setReplySuggestions(suggestions)
      
      // Log cache hit/miss for debugging
      if (suggestionsResult.isCached) {
        console.log(`✅ Using cached suggestions for ${selectedChat.name}`)
      } else {
        console.log(`🔄 Generated fresh suggestions for ${selectedChat.name}`)
      }
    } catch (err) {
      console.error('Error generating suggestions:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate suggestions'
      setError(errorMessage)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }
  
  // Handle suggestion selection
  const handleSuggestionSelect = (index: number) => {
    setSelectedSuggestionIndex(index)
    if (replySuggestions[index]) {
      setMessageInputValue(replySuggestions[index].reply)
    }
  }

  // Handle chat selection
  const handleChatSelect = (chatId: string) => {
    navigate({ search: { chatId } })
  }

  // Handle sending a reply via PromptInput
  const handlePromptSubmit = async (
    message: { text?: string },
  ) => {
    if (!selectedChatId || !selectedChat) return
    const text = (message.text || messageInputValue || '').trim()
    if (!text) return

    setIsSendingMessage(true)
    setError(null)

    try {
      console.log(`📤 Sending message to ${selectedChat.name}: "${text.slice(0, 50)}..."`)
      
      const result = await sendMessageAction({ 
        chatId: selectedChatId, 
        text 
      })

      if (result.success) {
        console.log(`✅ Message sent! Pending ID: ${result.pendingMessageId}`)
        
        // Clear input after successful send
        setMessageInputValue('')
        
        // Clear AI suggestions after sending
        setReplySuggestions([])
        setSelectedSuggestionIndex(0)
        
        // Optionally trigger a sync to get the sent message back
        // Note: The message might take a moment to sync back from Beeper
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
    } finally {
      setIsSendingMessage(false)
    }
  }

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsSyncing(true)
    setError(null)
    
    try {
      const result = await manualSync()
      if (result.success) {
        console.log(`✅ Beeper synced: ${result.syncedChats} chats, ${result.syncedMessages} messages`)
      } else {
        console.warn(`⚠️ Beeper sync failed: ${result.error || 'Unknown error'}`)
        setError(result.error || 'Sync failed - using cached data')
      }
    } catch (err) {
      console.error('Error refreshing chats:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh chats'
      setError(errorMessage)
    } finally {
      setIsSyncing(false)
    }
  }

  // Handle closing sheet on mobile
  const handleCloseSheet = () => {
    setSheetOpen(false)
    navigate({ search: { chatId: undefined } })
  }

  // Construct subtitle with count and sync time
  const subtitle = [
    `${chats.length} ${chats.length === 1 ? 'conversation' : 'conversations'}`,
    syncInfo?.lastSyncedAt ? new Date(syncInfo.lastSyncedAt).toLocaleTimeString() : null,
  ].filter(Boolean).join(' • ')

  return (
    <DashboardLayout>
      <FullWidthContent>
        {/* Left Sidebar - Chat List */}
        <Sidebar
          width="w-full md:w-96"
          className={cn(isMobile && sheetOpen && "hidden")}
          header={
            <SidebarHeader
              title=""
              subtitle=""
              actions={
                <div className="flex items-center gap-2">
                  {/* Tab Filter */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setTabFilter('unreplied')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        tabFilter === 'unreplied'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Unreplied
                    </button>
                    <button
                      onClick={() => setTabFilter('unread')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        tabFilter === 'unread'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Unread
                    </button>
                    <button
                      onClick={() => setTabFilter('all')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        tabFilter === 'all'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      All
                    </button>
                  </div>
                  
                  {/* Refresh Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          onClick={handleRefresh} 
                          variant="ghost" 
                          size="sm"
                          disabled={isSyncing}
                          className="h-8"
                        >
                          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{subtitle}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              }
            />
          }
        >
          {/* Error Banner */}
          {error && (
            <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex-shrink-0">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-medium text-red-900">Sync Error</h3>
                  <p className="text-xs text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Chat List Content */}
          {!chatsData ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-12 px-4 text-gray-500">
              <p className="mb-2">🎉 All caught up!</p>
              <p className="text-sm">No pending messages to reply to</p>
            </div>
          ) : (
            <div 
              ref={chatListRef}
              className="divide-y divide-gray-100 overflow-y-auto"
              onScroll={handleScroll}
            >
              {chats.map((chat: Chat) => (
                <ChatListItem
                  key={chat.id}
                  id={chat.id}
                  name={chat.name}
                  network={chat.network}
                  username={chat.username}
                  phoneNumber={chat.phoneNumber}
                  lastMessage={chat.lastMessage}
                  lastMessageTime={chat.lastMessageTime}
                  unreadCount={chat.unreadCount}
                  isSelected={selectedChatId === chat.id}
                  onClick={() => handleChatSelect(chat.id)}
                  contactImageUrl={chat.contactImageUrl}
                />
              ))}
              {isLoadingMore && (
                <div className="py-4 text-center">
                  <RefreshCw className="w-5 h-5 text-gray-400 animate-spin mx-auto" />
                  <p className="text-xs text-gray-500 mt-1">Loading more from database...</p>
                </div>
              )}
            </div>
          )}
        </Sidebar>

        {/* Main Content Area - Desktop only, hidden on mobile */}
        {!isMobile && (
          <div className="flex-1 flex bg-gray-50 overflow-hidden">
            {selectedChatId && selectedChat ? (
              <>
                {/* Chat Messages with Input and AI Suggestions */}
                <div className="flex-1 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
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
                        messages={chatMessages} 
                        isSingleChat={selectedChat?.type === 'single' || selectedChat?.type === undefined}
                      />
                      
                      {/* Reply Input Area */}
                      <div className="flex-shrink-0 border-t-2 border-gray-300 p-4 bg-white shadow-sm">
                        <PromptInput onSubmit={handlePromptSubmit} className="w-full border-2 border-gray-300 rounded-lg shadow-sm hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
                          <PromptInputBody>
                            <PromptInputTextarea
                              placeholder="Type your reply..."
                              value={messageInputValue}
                              onChange={(e) => setMessageInputValue(e.target.value)}
                              className="text-gray-900 placeholder:text-gray-500"
                            />
                          </PromptInputBody>
                          <PromptInputToolbar>
                            <PromptInputButton
                              onClick={() => {
                                if (messageInputValue.trim()) {
                                  handleGenerateAISuggestions(messageInputValue)
                                } else {
                                  handleGenerateAISuggestions()
                                }
                              }}
                              disabled={isLoadingSuggestions || isSendingMessage}
                              className="gap-1.5"
                            >
                              <Sparkles className="w-4 h-4" />
                              AI
                            </PromptInputButton>
                            <PromptInputSubmit disabled={isSendingMessage} />
                          </PromptInputToolbar>
                        </PromptInput>
                      </div>

                      {/* AI Reply Suggestions - Below Input */}
                      <div className="flex-shrink-0 border-t-2 border-gray-300 bg-gray-50 overflow-y-auto max-h-[400px]">
                        <ReplySuggestions
                          suggestions={replySuggestions}
                          isLoading={isLoadingSuggestions}
                          error={error || undefined}
                          onGenerateClick={handleGenerateAISuggestions}
                          selectedIndex={selectedSuggestionIndex}
                          onSuggestionSelect={handleSuggestionSelect}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Right Sidebar - Contact Panel Only */}
                <div className="w-[400px] bg-white overflow-hidden">
                  <ContactPanel 
                    contact={contactData || null} 
                    isLoading={contactData === undefined && !!selectedChat?.username}
                    searchedUsername={selectedChat?.username}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center text-gray-500">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">👈 Select a conversation</p>
                  <p className="text-sm">
                    Choose a chat from the left to view messages and get AI-powered reply suggestions
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile Sheet - Chat detail slides over */}
        {isMobile && (
          <Sheet open={sheetOpen} onOpenChange={(open) => !open && handleCloseSheet()}>
            <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
              <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCloseSheet}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <SheetTitle className="text-lg font-semibold">
                    {selectedChat?.name || 'Conversation'}
                  </SheetTitle>
                </div>
              </SheetHeader>

              {selectedChatId && selectedChat && (
                <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
                  {/* Chat Messages with Input and AI Suggestions */}
                  <div className="flex-1 bg-white flex flex-col overflow-hidden">
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
                          messages={chatMessages} 
                          isSingleChat={selectedChat?.type === 'single' || selectedChat?.type === undefined}
                        />
                        
                        {/* Reply Input Area */}
                        <div className="flex-shrink-0 border-t-2 border-gray-300 p-4 bg-white shadow-sm">
                          <PromptInput onSubmit={handlePromptSubmit} className="w-full border-2 border-gray-300 rounded-lg shadow-sm hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
                            <PromptInputBody>
                              <PromptInputTextarea
                                placeholder="Type your reply..."
                                value={messageInputValue}
                                onChange={(e) => setMessageInputValue(e.target.value)}
                                className="text-gray-900 placeholder:text-gray-500"
                              />
                            </PromptInputBody>
                              <PromptInputToolbar>
                                <div />
                                <PromptInputSubmit disabled={isSendingMessage} />
                              </PromptInputToolbar>
                          </PromptInput>
                        </div>

                        {/* AI Reply Suggestions - Below Input */}
                        <div className="flex-shrink-0 border-t-2 border-gray-300 bg-gray-50 overflow-y-auto max-h-[200px]">
                          <ReplySuggestions
                            suggestions={replySuggestions}
                            isLoading={isLoadingSuggestions}
                            error={error || undefined}
                            onGenerateClick={handleGenerateAISuggestions}
                            selectedIndex={selectedSuggestionIndex}
                            onSuggestionSelect={handleSuggestionSelect}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Contact Panel - Hidden on very small screens */}
                  <div className="hidden sm:block sm:w-[300px] bg-white border-l overflow-hidden">
                    <ContactPanel 
                      contact={contactData || null} 
                      isLoading={contactData === undefined && !!selectedChat?.username}
                      searchedUsername={selectedChat?.username}
                    />
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        )}
      </FullWidthContent>
    </DashboardLayout>
  )
}
