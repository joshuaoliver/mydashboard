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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChatListItem } from '@/components/messages/ChatListItem'
import { ChatDetail } from '@/components/messages/ChatDetail'
import { ReplySuggestions } from '@/components/messages/ReplySuggestions'
import { ContactPanel } from '@/components/contacts/ContactPanel'
import { useAction, useQuery, useMutation, usePaginatedQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, AlertCircle, MessageCircle, ArrowLeft, Sparkles, Archive, Mail, MailOpen, ExternalLink, MoreVertical, User as UserIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
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

// Chat data structure is inferred from the query result
// No need for explicit interface since TypeScript infers it from the data

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
}

type TabFilter = 'unreplied' | 'unread' | 'all' | 'archived'

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
  const [isLoadingFullConversation, setIsLoadingFullConversation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Removed unused conversation context/caching state
  const [tabFilter, setTabFilter] = useState<TabFilter>('unreplied')
  const sendMessageAction = useAction(api.beeperMessages.sendMessage)
  const clearCachedSuggestions = useMutation(api.aiSuggestions.clearCachedSuggestions)
  
  // Mobile detection and sheet state
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [contactPanelOpen, setContactPanelOpen] = useState(false)
  
  // Track previous contact data to detect changes
  const prevContactDataRef = useRef<{ connection?: string[] | string; notes?: string } | null>(null)
  
  // Track current chat being generated for (prevent race conditions)
  const generatingForChatIdRef = useRef<string | null>(null)
  
  // Infinite scroll state
  const chatListRef = useRef<HTMLDivElement>(null)

  // Query cached chats from database using Convex pagination (instant, reactive, smooth loading)
  const { results: allLoadedChats, status, loadMore } = usePaginatedQuery(
    api.beeperQueries.listCachedChats,
    { filter: tabFilter },
    { initialNumItems: 100 }
  )
  const syncInfo = useQuery(api.beeperQueries.getChatInfo)
  
  // Query cached messages for selected chat with pagination (instant, reactive)
  const { 
    results: cachedMessages, 
    status: messagesStatus, 
    loadMore: loadMoreMessages 
  } = usePaginatedQuery(
    api.beeperQueries.getCachedMessages,
    selectedChatId ? { chatId: selectedChatId } : "skip",
    { initialNumItems: 50 } // Load 50 most recent messages initially
  )

  // Actions for syncing and AI generation
  const pageLoadSync = useAction(api.beeperSync.pageLoadSync)
  const manualSync = useAction(api.beeperSync.manualSync)
  const generateReplySuggestions = useAction(api.beeperActions.generateReplySuggestions)
  const archiveChat = useAction(api.chatActions.archiveChat)
  const markChatAsRead = useAction(api.chatActions.markChatAsRead)
  const markChatAsUnread = useAction(api.chatActions.markChatAsUnread)
  const loadFullConversation = useAction(api.beeperMessages.loadFullConversation)
  const focusChat = useAction(api.beeperMessages.focusChat)

  // Chats are now filtered server-side
  const chats = allLoadedChats
  
  // Infinite scroll handler - Load more when scrolling
  const handleScroll = useCallback(() => {
    if (!chatListRef.current || status !== "CanLoadMore") return
    
    const { scrollTop, scrollHeight, clientHeight } = chatListRef.current
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight
    
    // Load more when scrolled 80% down
    if (scrollPercentage > 0.8) {
      console.log('📜 Loading more chats from Convex DB...')
      loadMore(30) // Load 30 more chats
    }
  }, [status, loadMore])
  
  const selectedChat = allLoadedChats.find((chat) => chat.id === selectedChatId)
  
  // Query contact by Instagram username if available
  const contactData = useQuery(
    api.contactMutations.findContactByInstagram,
    selectedChat?.username ? { username: selectedChat.username } : "skip"
  )
  
  // Derived loading state - loading if we have a selected chat but no cached data yet
  const isLoadingMessages = selectedChatId !== null && messagesStatus === "LoadingFirstPage"

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

  // Auto-select most recent chat if no chat is selected (desktop only)
  useEffect(() => {
    if (!selectedChatId && chats.length > 0 && !isMobile) {
      const mostRecentChat = chats[0] // Chats are already sorted by most recent
      navigate({ search: { chatId: mostRecentChat.id } })
    }
  }, [chats, selectedChatId, navigate, isMobile])

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

    if (cachedMessages) {
      setChatMessages(cachedMessages || [])
      // Clear previous AI suggestions when switching chats
      setReplySuggestions([])
      // cleared along with suggestions
      setMessageInputValue('')
      setSelectedSuggestionIndex(0)
      
      // Auto-generate AI suggestions when chat is selected
      handleGenerateAISuggestions()
    }
  }, [selectedChatId, cachedMessages])

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

    const currentConnection = contactData.connections
    const currentNotes = contactData.notes

    // Check if this is the first time we're seeing this contact data
    if (prevContactDataRef.current === null) {
      prevContactDataRef.current = { connection: currentConnection, notes: currentNotes }
      return
    }

    // Check if connection or notes have changed (connections is an array now)
    const connectionChanged = JSON.stringify(prevContactDataRef.current.connection) !== JSON.stringify(currentConnection)
    const notesChanged = prevContactDataRef.current.notes !== currentNotes

    if (connectionChanged || notesChanged) {
      console.log('🔄 Contact data changed, regenerating AI suggestions...')
      if (connectionChanged) {
        console.log(`  Connection: ${JSON.stringify(prevContactDataRef.current.connection)} → ${JSON.stringify(currentConnection)}`)
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
  }, [contactData?.connections, contactData?.notes, selectedChatId])

  // Auto/Manual AI suggestion generation
  // Automatically checks cache first, only generates if conversation changed
  const handleGenerateAISuggestions = async (customContext?: string) => {
    if (!selectedChatId || !selectedChat) return

    // Track which chat we're generating for (prevent race conditions)
    const chatIdBeingGenerated = selectedChatId
    generatingForChatIdRef.current = chatIdBeingGenerated

    setIsLoadingSuggestions(true)
    setError(null)

    try {
      const suggestionsResult = await generateReplySuggestions({
        chatId: selectedChatId,
        chatName: selectedChat.name,
        instagramUsername: selectedChat.username,
        customContext: customContext || undefined, // Pass custom context if provided
      })

      // Verify we're still on the same chat before updating state
      if (generatingForChatIdRef.current !== chatIdBeingGenerated) {
        console.log(`⚠️ Chat switched during generation, discarding suggestions for ${selectedChat.name}`)
        return
      }

      const suggestions = suggestionsResult.suggestions || []
      setReplySuggestions(suggestions)
      
      // Log cache hit/miss for debugging
      if (suggestionsResult.isCached) {
        console.log(`✅ Using cached suggestions for ${selectedChat.name}`)
      } else {
        console.log(`🔄 Generated fresh suggestions for ${selectedChat.name}`)
      }
    } catch (err) {
      // Only show error if we're still on the same chat
      if (generatingForChatIdRef.current === chatIdBeingGenerated) {
        console.error('Error generating suggestions:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate suggestions'
        setError(errorMessage)
      }
    } finally {
      // Only clear loading if we're still on the same chat
      if (generatingForChatIdRef.current === chatIdBeingGenerated) {
        setIsLoadingSuggestions(false)
      }
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

  // Handle archive chat
  const handleArchiveChat = async (chatId: string) => {
    try {
      await archiveChat({ chatId })
      // If the archived chat was selected, clear selection
      if (selectedChatId === chatId) {
        navigate({ search: { chatId: undefined } })
      }
    } catch (err) {
      console.error('Failed to archive chat:', err)
      setError(err instanceof Error ? err.message : 'Failed to archive chat')
    }
  }

  // Handle mark chat as read
  const handleMarkAsRead = async (chatId: string) => {
    try {
      await markChatAsRead({ chatId })
    } catch (err) {
      console.error('Failed to mark chat as read:', err)
      setError(err instanceof Error ? err.message : 'Failed to mark chat as read')
    }
  }

  // Handle mark chat as unread
  const handleMarkAsUnread = async (chatId: string) => {
    try {
      await markChatAsUnread({ chatId })
    } catch (err) {
      console.error('Failed to mark chat as unread:', err)
      setError(err instanceof Error ? err.message : 'Failed to mark chat as unread')
    }
  }

  // Handle opening chat in Beeper Desktop
  const handleOpenInBeeper = async (chatId: string, draftText?: string) => {
    try {
      const result = await focusChat({ 
        chatId,
        draftText,
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to open chat in Beeper')
      }
    } catch (err) {
      console.error('Failed to open in Beeper:', err)
      setError(err instanceof Error ? err.message : 'Failed to open in Beeper')
    }
  }

  // Handle loading full conversation history
  const handleLoadFullConversation = async () => {
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
        {!isMobile ? (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* Left Sidebar - Chat List */}
            <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
              <div className="h-full flex flex-col bg-white border-r border-gray-200">
                {/* Sidebar Header */}
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
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
                    <button
                      onClick={() => setTabFilter('archived')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        tabFilter === 'archived'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Archived
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
                </div>

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
                {status === "LoadingFirstPage" ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                ) : chats.length === 0 ? (
                  <div className="text-center py-12 px-4 text-gray-500">
                    <p className="mb-2">🎉 All caught up!</p>
                    <p className="text-sm">No pending messages to reply to</p>
                  </div>
                ) : (
                  <ScrollArea 
                    ref={chatListRef}
                    className="flex-1"
                    onScroll={handleScroll}
                  >
                    <div className="divide-y divide-gray-100">
                      {chats.map((chat) => (
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
                          onArchive={handleArchiveChat}
                          contactImageUrl={chat.contactImageUrl}
                        />
                      ))}
                      {status === "LoadingMore" && (
                        <div className="py-4 text-center">
                          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin mx-auto" />
                          <p className="text-xs text-gray-500 mt-1">Loading more...</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </ResizablePanel>

            {/* Resizable Handle */}
            <ResizableHandle withHandle />

            {/* Main Content Area - Chat and Contact Panels */}
            {selectedChatId && selectedChat ? (
              <>
                {/* Chat Messages with Input and AI Suggestions */}
                <ResizablePanel defaultSize={60} minSize={30}>
                  <div className="h-full bg-white flex flex-col overflow-hidden">
                    {/* Chat Header with Actions */}
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
                                onClick={handleLoadFullConversation}
                                disabled={isLoadingFullConversation}
                                title="Load full conversation history"
                              >
                                <RefreshCw className={`w-4 h-4 ${isLoadingFullConversation ? 'animate-spin' : ''}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Load full conversation history (1 year)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenInBeeper(selectedChatId)}
                          title="Open in Beeper Desktop"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => selectedChat.unreadCount > 0 ? handleMarkAsRead(selectedChatId) : handleMarkAsUnread(selectedChatId)}
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
                          onClick={() => handleArchiveChat(selectedChatId)}
                          title="Archive chat"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

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
                          messagesStatus={messagesStatus}
                          onLoadMore={loadMoreMessages}
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
                            <div className="flex gap-1">
                              <PromptInputSubmit disabled={isSendingMessage} />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-9 w-9">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleOpenInBeeper(selectedChatId, messageInputValue)}
                                  >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Send with Beeper
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </PromptInputToolbar>
                        </PromptInput>
                      </div>

                      {/* AI Reply Suggestions - Below Input */}
                      <div className="flex-shrink-0 border-t-2 border-gray-300 bg-gray-50">
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
                </ResizablePanel>

                {/* Resizable Handle */}
                <ResizableHandle withHandle />

                {/* Right Sidebar - Contact Panel */}
                <ResizablePanel defaultSize={40} minSize={25} maxSize={50}>
                  <ContactPanel 
                    contact={contactData || null} 
                    isLoading={contactData === undefined && (!!selectedChat?.username || !!selectedChat?.phoneNumber)}
                    searchedUsername={selectedChat?.username}
                    searchedPhoneNumber={selectedChat?.phoneNumber}
                  />
                </ResizablePanel>
              </>
            ) : (
              <ResizablePanel>
                <div className="h-full flex items-center justify-center bg-white">
                  <div className="text-center text-gray-500">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">👈 Select a conversation</p>
                    <p className="text-sm">
                      Choose a chat from the left to view messages and get AI-powered reply suggestions
                    </p>
                  </div>
                </div>
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
        ) : (
          /* Mobile - Use Sidebar component */
          <>
            <Sidebar
              width="w-full"
              className={cn(sheetOpen && "hidden")}
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
              {/* Chat List Content */}
              {status === "LoadingFirstPage" ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : chats.length === 0 ? (
                <div className="text-center py-12 px-4 text-gray-500">
                  <p className="mb-2">🎉 All caught up!</p>
                  <p className="text-sm">No pending messages to reply to</p>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="divide-y divide-gray-100">
                    {chats.map((chat) => (
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
                        onArchive={handleArchiveChat}
                        contactImageUrl={chat.contactImageUrl}
                      />
                    ))}
                    {status === "LoadingMore" && (
                      <div className="py-4 text-center">
                        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin mx-auto" />
                        <p className="text-xs text-gray-500 mt-1">Loading more...</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </Sidebar>
          </>
        )}

        {/* Mobile Sheet - Chat detail slides over */}
        {isMobile && (
          <Sheet open={sheetOpen} onOpenChange={(open) => !open && handleCloseSheet()}>
          <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden [&>button]:hidden">
            <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCloseSheet}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <SheetTitle className="text-lg font-semibold truncate flex-1 min-w-0">
                    {selectedChat?.name || 'Conversation'}
                  </SheetTitle>
                  {/* Action Buttons - Mobile */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectedChatId && handleOpenInBeeper(selectedChatId)}
                    className="h-8 w-8 p-0 flex-shrink-0"
                    title="Open in Beeper Desktop"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContactPanelOpen(true)}
                    className="h-8 w-8 p-0 flex-shrink-0"
                    title="Contact Info"
                  >
                    <UserIcon className="h-4 w-4" />
                  </Button>
                </div>
              </SheetHeader>

              {selectedChatId && selectedChat && (
                <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                  {isLoadingMessages ? (
                    <div className="flex-1 flex items-center justify-center bg-white">
                      <div className="text-center">
                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Loading conversation...</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Messages - Takes remaining space */}
                      <div className="flex-1 overflow-hidden min-w-0">
                        <ChatDetail 
                          messages={chatMessages} 
                          isSingleChat={selectedChat?.type === 'single' || selectedChat?.type === undefined}
                          messagesStatus={messagesStatus}
                          onLoadMore={loadMoreMessages}
                        />
                      </div>
                      
                      {/* Reply Input Area */}
                      <div className="flex-shrink-0 border-t-2 border-gray-300 p-2 sm:p-4 bg-white shadow-sm">
                        <PromptInput onSubmit={handlePromptSubmit} className="w-full min-w-0 border-2 border-gray-300 rounded-lg shadow-sm hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
                          <PromptInputBody>
                            <PromptInputTextarea
                              placeholder="Type your reply..."
                              value={messageInputValue}
                              onChange={(e) => setMessageInputValue(e.target.value)}
                              className="text-gray-900 placeholder:text-gray-500 min-w-0"
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
                              <div className="flex gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleOpenInBeeper(selectedChatId, messageInputValue)}
                                    >
                                      <ExternalLink className="mr-2 h-4 w-4" />
                                      Send with Beeper
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <PromptInputSubmit disabled={isSendingMessage} />
                              </div>
                            </PromptInputToolbar>
                        </PromptInput>
                      </div>

                      {/* AI Reply Suggestions - Below Input */}
                      <div className="flex-shrink-0 border-t-2 border-gray-300 bg-gray-50 min-w-0 max-h-[35vh] overflow-auto">
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

                  {/* Contact Panel - Hidden on very small screens */}
                  <div className="hidden sm:block sm:w-[300px] bg-white border-l overflow-hidden">
                    <ContactPanel 
                      contact={contactData || null} 
                      isLoading={contactData === undefined && (!!selectedChat?.username || !!selectedChat?.phoneNumber)}
                      searchedUsername={selectedChat?.username}
                      searchedPhoneNumber={selectedChat?.phoneNumber}
                    />
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        )}

        {/* Mobile Contact Panel Sheet */}
        {isMobile && (
          <Sheet open={contactPanelOpen} onOpenChange={setContactPanelOpen}>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 [&>button]:hidden">
              <SheetHeader className="px-4 py-3 border-b">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContactPanelOpen(false)}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <SheetTitle className="text-lg font-semibold">Contact Info</SheetTitle>
                </div>
              </SheetHeader>
              {selectedChat && (
                <ContactPanel 
                  contact={contactData || null} 
                  isLoading={contactData === undefined && (!!selectedChat?.username || !!selectedChat?.phoneNumber)}
                  searchedUsername={selectedChat?.username}
                  searchedPhoneNumber={selectedChat?.phoneNumber}
                />
              )}
            </SheetContent>
          </Sheet>
        )}
      </FullWidthContent>
    </DashboardLayout>
  )
}
