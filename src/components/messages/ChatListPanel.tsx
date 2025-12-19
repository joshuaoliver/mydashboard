import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePaginatedQuery, useQuery, useAction, useConvex } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useChatStore } from '@/stores/useChatStore'
import { ChatListItem } from './ChatListItem'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function ChatListPanel() {
  const navigate = useNavigate()
  const convex = useConvex()
  
  // Get state from Zustand store
  const selectedChatId = useChatStore((state) => state.selectedChatId)
  const tabFilter = useChatStore((state) => state.tabFilter)
  const setTabFilter = useChatStore((state) => state.setTabFilter)

  // Local state
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chatListRef = useRef<HTMLDivElement>(null)
  
  // Track which chats we've preloaded to avoid duplicate requests
  const preloadedChats = useRef<Set<string>>(new Set())

  // Queries
  const { results: allLoadedChats, status, loadMore } = usePaginatedQuery(
    api.beeperQueries.listCachedChats,
    { filter: tabFilter },
    { initialNumItems: 100 }
  )
  const syncInfo = useQuery(api.beeperQueries.getChatInfo)

  // Actions
  const pageLoadSync = useAction(api.beeperSync.pageLoadSync)
  const manualSync = useAction(api.beeperSync.manualSync)
  const archiveChat = useAction(api.chatActions.archiveChat)

  // Trigger sync on mount
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

  // Infinite scroll handler
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (status !== "CanLoadMore") return
    
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight
    
    if (scrollPercentage > 0.8) {
      console.log('📜 Loading more chats from Convex DB...')
      loadMore(30)
    }
  }, [status, loadMore])

  // Handle chat selection
  const handleChatSelect = useCallback((chatId: string) => {
    navigate({ to: '/messages', search: { chatId } })
  }, [navigate])

  // Handle archive
  const handleArchiveChat = useCallback(async (chatId: string) => {
    try {
      await archiveChat({ chatId })
      if (selectedChatId === chatId) {
        navigate({ to: '/messages', search: { chatId: undefined } })
      }
    } catch (err) {
      console.error('Failed to archive chat:', err)
      setError(err instanceof Error ? err.message : 'Failed to archive chat')
    }
  }, [archiveChat, selectedChatId, navigate])

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
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
  }, [manualSync])

  // Preload chat data on hover for instant loading when clicked
  const handleChatHover = useCallback((chatId: string) => {
    // Skip if already preloaded or currently selected
    if (preloadedChats.current.has(chatId) || chatId === selectedChatId) {
      return
    }
    
    // Mark as preloaded
    preloadedChats.current.add(chatId)
    
    // Preload chat details and messages in background
    // These will populate Convex's cache so they're instant on click
    console.log(`[Preload] 🔄 Preloading chat: ${chatId.slice(0, 25)}...`)
    
    // Fire and forget - preload runs in background
    Promise.all([
      convex.query(api.beeperQueries.getChatByIdWithContact, { chatId }),
      convex.query(api.beeperQueries.getCachedMessages, { 
        chatId, 
        paginationOpts: { numItems: 50, cursor: null } 
      }),
    ]).then(([chat, messages]) => {
      console.log(`[Preload] ✅ Preloaded "${chat?.name || 'unknown'}" with ${messages?.page?.length || 0} messages`)
    }).catch((err) => {
      // Silently ignore preload errors - it's just optimization
      console.debug('[Preload] Failed:', err)
    })
  }, [convex, selectedChatId])

  // Subtitle with count and sync time
  const subtitle = useMemo(() => [
    `${allLoadedChats.length} ${allLoadedChats.length === 1 ? 'conversation' : 'conversations'}`,
    syncInfo?.lastSyncedAt ? new Date(syncInfo.lastSyncedAt).toLocaleTimeString() : null,
  ].filter(Boolean).join(' • '), [allLoadedChats.length, syncInfo?.lastSyncedAt])

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
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

      {/* Chat List */}
      {status === "LoadingFirstPage" ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : allLoadedChats.length === 0 ? (
        <div className="text-center py-12 px-4 text-gray-500">
          <p className="mb-2">🎉 All caught up!</p>
          <p className="text-sm">No pending messages to reply to</p>
        </div>
      ) : (
        <ScrollArea 
          ref={chatListRef}
          className="flex-1"
          onScrollChange={handleScroll}
        >
          <div className="divide-y divide-gray-100">
            {allLoadedChats.map((chat) => (
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
                onHover={handleChatHover}
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
  )
}

