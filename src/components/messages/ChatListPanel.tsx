import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAction, useConvex } from 'convex/react'
import { useCachedQuery, useCachedPaginatedQuery } from '@/lib/convex-cache'
import { api } from '../../../convex/_generated/api'
import { useChatStore } from '@/stores/useChatStore'
import { ChatListItem } from './ChatListItem'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RefreshCw, AlertCircle, ChevronDown, Archive, Ban, Check } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ChatListPanel() {
  const navigate = useNavigate()
  const convex = useConvex()
  
  // Get state from Zustand store
  const selectedChatId = useChatStore((state) => state.selectedChatId)
  const tabFilter = useChatStore((state) => state.tabFilter)
  const setTabFilter = useChatStore((state) => state.setTabFilter)
  const setChatList = useChatStore((state) => state.setChatList)

  // Local state
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chatListRef = useRef<HTMLDivElement>(null)
  
  // Track which chats we've preloaded to avoid duplicate requests
  const preloadedChats = useRef<Set<string>>(new Set())

  // Queries (with caching to keep subscriptions alive during navigation)
  const { results: allLoadedChats, status, loadMore } = useCachedPaginatedQuery(
    api.beeperQueries.listCachedChats,
    { filter: tabFilter },
    { initialNumItems: 100 }
  )
  const syncInfo = useCachedQuery(api.beeperQueries.getChatInfo)

  // Actions
  const pageLoadSync = useAction(api.beeperSync.pageLoadSync)
  const manualSync = useAction(api.beeperSync.manualSync)
  const archiveChatAction = useAction(api.chatActions.archiveChat)
  const unarchiveChatAction = useAction(api.chatActions.unarchiveChat)

  // Sync chat list to store for keyboard navigation
  useEffect(() => {
    if (allLoadedChats) {
      setChatList(allLoadedChats.map(c => ({ id: c.id, name: c.name })))
    }
  }, [allLoadedChats, setChatList])

  // Trigger sync on mount (throttled to once every 2 minutes)
  useEffect(() => {
    const SYNC_THROTTLE_MS = 2 * 60 * 1000 // 2 minutes
    const lastSyncKey = 'beeper_last_sync_timestamp'

    const syncOnLoad = async () => {
      // Check if we've synced recently
      const lastSyncStr = sessionStorage.getItem(lastSyncKey)
      const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0
      const now = Date.now()

      if (now - lastSync < SYNC_THROTTLE_MS) {
        console.log(`⏭️ Skipping Beeper sync (last sync was ${Math.round((now - lastSync) / 1000)}s ago)`)
        return
      }

      setIsSyncing(true)
      try {
        const result = await pageLoadSync()
        if (result.success) {
          console.log(`✅ Beeper synced: ${result.syncedChats} chats, ${result.syncedMessages} messages`)
          sessionStorage.setItem(lastSyncKey, now.toString())
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

  // Auto-select first chat if none selected
  useEffect(() => {
    if (!selectedChatId && allLoadedChats && allLoadedChats.length > 0) {
      const firstChat = allLoadedChats[0]
      navigate({
        to: '/inbox',
        search: { chatId: firstChat.id },
        replace: true
      })
    }
  }, [selectedChatId, allLoadedChats, navigate])

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

  // Handle archive/unarchive toggle
  const handleArchiveChat = useCallback(async (chatId: string) => {
    try {
      // If viewing archived tab, unarchive; otherwise archive
      if (tabFilter === 'archived') {
        await unarchiveChatAction({ chatId })
      } else {
        await archiveChatAction({ chatId })
        // Navigate to next conversation when archiving the currently selected chat
        if (selectedChatId === chatId) {
          const nextChatId = useChatStore.getState().getNextChatId()
          if (nextChatId && nextChatId !== chatId) {
            navigate({ to: '/messages', search: { chatId: nextChatId } })
          } else {
            navigate({ to: '/messages', search: { chatId: undefined } })
          }
        }
      }
    } catch (err) {
      console.error('Failed to archive/unarchive chat:', err)
      setError(err instanceof Error ? err.message : 'Failed to archive/unarchive chat')
    }
  }, [archiveChatAction, unarchiveChatAction, tabFilter, selectedChatId, navigate])

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
    <div className="h-full w-full flex flex-col bg-white border-r border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-2 py-2 border-b border-gray-200">
        <div className="flex items-center gap-1">
          {/* Primary Filter Tabs */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5 flex-1 min-w-0">
            <button
              onClick={() => setTabFilter('unreplied')}
              className={`flex-1 px-1.5 py-1 text-[10px] font-medium rounded transition-colors truncate ${
                tabFilter === 'unreplied'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Unreplied"
            >
              Unreplied
            </button>
            <button
              onClick={() => setTabFilter('unread')}
              className={`flex-1 px-1.5 py-1 text-[10px] font-medium rounded transition-colors truncate ${
                tabFilter === 'unread'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Unread"
            >
              Unread
            </button>
            <button
              onClick={() => setTabFilter('all')}
              className={`flex-1 px-1.5 py-1 text-[10px] font-medium rounded transition-colors ${
                tabFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="All (including groups)"
            >
              All
            </button>
            
            {/* More Filters Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex-shrink-0 px-1.5 py-1 text-[10px] font-medium rounded transition-colors flex items-center gap-0.5 ${
                    tabFilter === 'archived' || tabFilter === 'blocked'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="More filters"
                >
                  {tabFilter === 'archived' ? (
                    <>
                      <Archive className="w-3 h-3" />
                      <span className="hidden sm:inline">Archived</span>
                    </>
                  ) : tabFilter === 'blocked' ? (
                    <>
                      <Ban className="w-3 h-3" />
                      <span className="hidden sm:inline">Blocked</span>
                    </>
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem 
                  onClick={() => setTabFilter('archived')}
                  className="flex items-center gap-2 text-xs"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archived
                  {tabFilter === 'archived' && <Check className="w-3.5 h-3.5 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setTabFilter('blocked')}
                  className="flex items-center gap-2 text-xs"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Blocked
                  {tabFilter === 'blocked' && <Check className="w-3.5 h-3.5 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  className="h-7 w-7 p-0 flex-shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
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
          className="flex-1 w-full overflow-hidden"
          onScrollChange={handleScroll}
        >
          <div className="divide-y divide-gray-100 w-full">
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
                isArchived={tabFilter === 'archived'}
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

