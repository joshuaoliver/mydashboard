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
} from '@/components/ai-elements/prompt-input'
import { ChatListItem } from '@/components/messages/ChatListItem'
import { ChatDetail } from '@/components/messages/ChatDetail'
import { ReplySuggestions } from '@/components/messages/ReplySuggestions'
import { ContactPanel } from '@/components/messages/ContactPanel'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, MessageCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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

interface Message {
  id: string
  text: string
  timestamp: number
  sender: string
  senderName: string
  isFromUser: boolean
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
  const [error, setError] = useState<string | null>(null)
  const [conversationContext, setConversationContext] = useState<any>(null)
  const [isCachedSuggestions, setIsCachedSuggestions] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<number | undefined>(undefined)
  const [tabFilter, setTabFilter] = useState<TabFilter>('unreplied')
  const sendMessage = useAction(api.beeperActions.sendMessage)

  // Query cached chats from database (instant, reactive)
  const chatsData = useQuery(api.beeperQueries.listCachedChats)
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

  const allChats: Chat[] = chatsData?.chats || []
  
  // Apply tab filtering
  const chats = allChats.filter((chat) => {
    if (tabFilter === 'unreplied') {
      return chat.needsReply === true
    } else if (tabFilter === 'unread') {
      return chat.unreadCount > 0
    }
    return true // 'all' tab shows everything
  })
  
  const selectedChat = allChats.find((chat: Chat) => chat.id === selectedChatId)
  
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
      setConversationContext(null)
      setMessageInputValue('')
      setSelectedSuggestionIndex(0)
      return
    }

    if (cachedMessagesData) {
      setChatMessages(cachedMessagesData.messages || [])
      // Clear previous AI suggestions when switching chats
      setReplySuggestions([])
      setConversationContext(null)
      setMessageInputValue('')
      setSelectedSuggestionIndex(0)
      
      // Auto-generate AI suggestions when chat is selected
      handleGenerateAISuggestions()
    }
  }, [selectedChatId, cachedMessagesData])

  // eslint-disable-next-line react-hooks/exhaustive-deps

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
      setConversationContext(suggestionsResult.conversationContext)
      setIsCachedSuggestions(suggestionsResult.isCached || false)
      setGeneratedAt(suggestionsResult.generatedAt)
      
      // Auto-fill first suggestion into input field
      if (suggestions.length > 0) {
        setMessageInputValue(suggestions[0].reply)
        setSelectedSuggestionIndex(0)
      }
      
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
    if (!selectedChatId) return
    const text = (message.text || messageInputValue || '').trim()
    if (!text) return

    try {
      await sendMessage({ chatId: selectedChatId, text })
      // Clear input after sending
      setMessageInputValue('')
    } catch (err) {
      console.error('Failed to send message:', err)
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
          width="w-96"
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
            <div className="divide-y divide-gray-100">
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
            </div>
          )}
        </Sidebar>

        {/* Main Content Area - Chat detail and AI suggestions */}
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
                    <ChatDetail messages={chatMessages} />
                    
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
                          <PromptInputSubmit />
                        </PromptInputToolbar>
                      </PromptInput>
                    </div>

                    {/* AI Reply Suggestions - Below Input */}
                    <div className="flex-shrink-0 border-t-2 border-gray-300 bg-gray-50 overflow-y-auto max-h-[400px]">
                      <ReplySuggestions
                        suggestions={replySuggestions}
                        isLoading={isLoadingSuggestions}
                        error={error || undefined}
                        conversationContext={conversationContext}
                        isCached={isCachedSuggestions}
                        generatedAt={generatedAt}
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
      </FullWidthContent>
    </DashboardLayout>
  )
}
