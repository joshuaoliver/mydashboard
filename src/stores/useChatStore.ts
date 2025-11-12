import { create } from 'zustand'

type TabFilter = 'unreplied' | 'unread' | 'all' | 'archived'

interface ChatStore {
  // Selected chat state
  selectedChatId: string | null
  setSelectedChatId: (chatId: string | null) => void
  
  // Tab filter state
  tabFilter: TabFilter
  setTabFilter: (filter: TabFilter) => void
  
  // Mobile sheet states
  sheetOpen: boolean
  setSheetOpen: (open: boolean) => void
  
  contactPanelOpen: boolean
  setContactPanelOpen: (open: boolean) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  // Initial state
  selectedChatId: null,
  tabFilter: 'unreplied',
  sheetOpen: false,
  contactPanelOpen: false,
  
  // Actions
  setSelectedChatId: (chatId) => set({ selectedChatId: chatId }),
  setTabFilter: (filter) => set({ tabFilter: filter }),
  setSheetOpen: (open) => set({ sheetOpen: open }),
  setContactPanelOpen: (open) => set({ contactPanelOpen: open }),
}))

