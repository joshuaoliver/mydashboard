import { create } from 'zustand'

type TabFilter = 'unreplied' | 'unread' | 'all' | 'archived'

interface ChatListItem {
  id: string
  name: string
}

interface ChatStore {
  // Selected chat state
  selectedChatId: string | null
  setSelectedChatId: (chatId: string | null) => void
  
  // Chat list for keyboard navigation
  chatList: ChatListItem[]
  setChatList: (chats: ChatListItem[]) => void
  
  // Tab filter state
  tabFilter: TabFilter
  setTabFilter: (filter: TabFilter) => void
  
  // Mobile sheet states
  sheetOpen: boolean
  setSheetOpen: (open: boolean) => void
  
  contactPanelOpen: boolean
  setContactPanelOpen: (open: boolean) => void
  
  // Get next chat ID after current selection
  getNextChatId: () => string | null
  // Get previous chat ID before current selection
  getPreviousChatId: () => string | null
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  selectedChatId: null,
  chatList: [],
  tabFilter: 'unreplied',
  sheetOpen: false,
  contactPanelOpen: false,
  
  // Actions
  setSelectedChatId: (chatId) => set({ selectedChatId: chatId }),
  setChatList: (chats) => set({ chatList: chats }),
  setTabFilter: (filter) => set({ tabFilter: filter }),
  setSheetOpen: (open) => set({ sheetOpen: open }),
  setContactPanelOpen: (open) => set({ contactPanelOpen: open }),
  
  // Get next chat ID (for after archiving)
  getNextChatId: () => {
    const { selectedChatId, chatList } = get()
    if (!selectedChatId || chatList.length === 0) return null
    
    const currentIndex = chatList.findIndex(c => c.id === selectedChatId)
    if (currentIndex === -1) return chatList[0]?.id || null
    
    // Return next chat, or previous if at end
    if (currentIndex < chatList.length - 1) {
      return chatList[currentIndex + 1].id
    } else if (currentIndex > 0) {
      return chatList[currentIndex - 1].id
    }
    return null
  },
  
  // Get previous chat ID
  getPreviousChatId: () => {
    const { selectedChatId, chatList } = get()
    if (!selectedChatId || chatList.length === 0) return null
    
    const currentIndex = chatList.findIndex(c => c.id === selectedChatId)
    if (currentIndex > 0) {
      return chatList[currentIndex - 1].id
    }
    return null
  },
}))

