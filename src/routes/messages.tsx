import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatListItem } from '@/components/messages/ChatListItem'
import { ChatDetail } from '@/components/messages/ChatDetail'
import { ReplySuggestions } from '@/components/messages/ReplySuggestions'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, MessageCircle } from 'lucide-react'

export const Route = createFileRoute('/messages')({
  component: Messages,
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
  style: string
  reasoning: string
}

function Messages() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [replySuggestions, setReplySuggestions] = useState<ReplySuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationContext, setConversationContext] = useState<any>(null)

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

  const chats: Chat[] = chatsData?.chats || []
  const selectedChat = chats.find((chat: Chat) => chat.id === selectedChatId)
  
  // Derived loading state - loading if we have a selected chat but no cached data yet
  const isLoadingMessages = selectedChatId !== null && cachedMessagesData === undefined

  // Trigger sync on page load
  useEffect(() => {
    const syncOnLoad = async () => {
      setIsSyncing(true)
      try {
        const result = await pageLoadSync()
        if (result.success) {
          console.log(`✅ Beeper synced: ${result.syncedChats} chats, ${result.syncedMessages} messages`)
        } else {
          console.warn(`⚠️ Beeper sync failed: ${result.error || 'Unknown error'}`)
          // Don't show error to user - cached data will still work
        }
      } catch (err) {
        console.error('Error syncing on page load:', err)
        // Don't show error to user - cached data will still work
      } finally {
        setIsSyncing(false)
      }
    }

    syncOnLoad()
  }, [pageLoadSync])

  // Update messages when cached data changes (automatic via Convex reactivity!)
  useEffect(() => {
    if (!selectedChatId) {
      setChatMessages([])
      setReplySuggestions([])
      setConversationContext(null)
      return
    }

    if (cachedMessagesData) {
      setChatMessages(cachedMessagesData.messages || [])
      // Clear previous AI suggestions when switching chats
      setReplySuggestions([])
      setConversationContext(null)
    }
  }, [selectedChatId, cachedMessagesData])

  // Manual AI suggestion generation
  const handleGenerateAISuggestions = async () => {
    if (!selectedChatId || !selectedChat) return
    
    setIsLoadingSuggestions(true)
    setError(null)
    
    try {
      const suggestionsResult = await generateReplySuggestions({
        chatId: selectedChatId,
        chatName: selectedChat.name,
      })
      
      setReplySuggestions(suggestionsResult.suggestions || [])
      setConversationContext(suggestionsResult.conversationContext)
    } catch (err) {
      console.error('Error generating suggestions:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate suggestions'
      setError(errorMessage)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }

  // Handle chat selection
  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId)
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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-sm text-gray-600">
                AI-powered reply suggestions
              </p>
              {syncInfo?.lastSyncedAt && (
                <p className="text-xs text-gray-500">
                  Last synced: {new Date(syncInfo.lastSyncedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={isSyncing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Refresh'}
          </Button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-900">Sync Error</h3>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full-width content area - 100vh minus header */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Scrollable Chat List */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          {/* Chat list header */}
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <h2 className="font-semibold text-gray-900">Pending Replies</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {chats.length} {chats.length === 1 ? 'conversation' : 'conversations'}
            </p>
          </div>

          {/* Scrollable chat list using ScrollArea */}
          <ScrollArea className="flex-1">
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
                    accountID={chat.accountID}
                    username={chat.username}
                    phoneNumber={chat.phoneNumber}
                    lastMessage={chat.lastMessage}
                    lastMessageTime={chat.lastMessageTime}
                    unreadCount={chat.unreadCount}
                    isSelected={selectedChatId === chat.id}
                    onClick={() => handleChatSelect(chat.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Main Content Area - Chat detail and AI suggestions */}
        <div className="flex-1 flex min-h-0 bg-gray-50">
          {selectedChatId && selectedChat ? (
            <>
              {/* Chat Messages - Takes up majority of space */}
              <div className="flex-1 flex flex-col bg-white border-r border-gray-200 min-w-0">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading conversation...</p>
                    </div>
                  </div>
                ) : (
                  <ChatDetail messages={chatMessages} chatName={selectedChat.name} />
                )}
              </div>

              {/* AI Reply Suggestions - Fixed width sidebar with ScrollArea */}
              <ScrollArea className="w-[500px] flex-shrink-0 bg-white">
                <ReplySuggestions
                  suggestions={replySuggestions}
                  isLoading={isLoadingSuggestions}
                  error={error || undefined}
                  conversationContext={conversationContext}
                  onGenerateClick={handleGenerateAISuggestions}
                />
              </ScrollArea>
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
      </div>
    </div>
  )
}
