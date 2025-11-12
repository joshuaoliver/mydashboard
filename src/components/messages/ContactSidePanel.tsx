import { useMemo } from 'react'
import { useQuery, usePaginatedQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useChatStore } from '@/stores/useChatStore'
import { ContactPanel } from '../contacts/ContactPanel'

export function ContactSidePanel() {
  // Get selected chat from Zustand store
  const selectedChatId = useChatStore((state) => state.selectedChatId)

  // Query all chats to find the selected one
  const { results: allLoadedChats } = usePaginatedQuery(
    api.beeperQueries.listCachedChats,
    { filter: 'all' },
    { initialNumItems: 100 }
  )

  // Memoize selected chat
  const selectedChat = useMemo(
    () => allLoadedChats.find((chat) => chat.id === selectedChatId),
    [allLoadedChats, selectedChatId]
  )

  // Query contact by Instagram username if available
  const contactData = useQuery(
    api.contactMutations.findContactByInstagram,
    selectedChat?.username ? { username: selectedChat.username } : "skip"
  )

  return (
    <ContactPanel 
      contact={contactData || null} 
      isLoading={contactData === undefined && (!!selectedChat?.username || !!selectedChat?.phoneNumber)}
      searchedUsername={selectedChat?.username}
      searchedPhoneNumber={selectedChat?.phoneNumber}
    />
  )
}

