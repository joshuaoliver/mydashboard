import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useChatStore } from '@/stores/useChatStore'
import { ContactPanel } from '../contacts/ContactPanel'
import type { Id } from '../../../convex/_generated/dataModel'

export function ContactSidePanel() {
  // Get selected chat from Zustand store
  const selectedChatId = useChatStore((state) => state.selectedChatId)

  // Query the chat directly by ID (includes contactId if linked)
  const selectedChat = useQuery(
    api.beeperQueries.getChatByIdWithContact,
    selectedChatId ? { chatId: selectedChatId } : "skip"
  )

  // Priority 1: Get contact by direct contactId link (already matched during sync)
  const contactByDirectLink = useQuery(
    api.dexQueries.getContactById,
    selectedChat?.contactId ? { contactId: selectedChat.contactId as Id<"contacts"> } : "skip"
  )

  // Priority 2: Fall back to Instagram username matching
  const contactByInstagram = useQuery(
    api.contactMutations.findContactByInstagram,
    !contactByDirectLink && selectedChat?.username ? { username: selectedChat.username } : "skip"
  )

  // Priority 3: Fall back to phone number matching (for iMessage/WhatsApp)
  const contactByPhone = useQuery(
    api.contactMutations.findContactByPhone,
    !contactByDirectLink && !contactByInstagram && selectedChat?.phoneNumber 
      ? { phoneNumber: selectedChat.phoneNumber } 
      : "skip"
  )

  // Use the first contact found (in priority order)
  const contactData = useMemo(() => {
    if (contactByDirectLink) return contactByDirectLink
    if (contactByInstagram) return contactByInstagram
    if (contactByPhone) return contactByPhone
    return null
  }, [contactByDirectLink, contactByInstagram, contactByPhone])

  // Determine if we're still loading
  const isLoading = useMemo(() => {
    // Chat not loaded yet
    if (selectedChatId && selectedChat === undefined) return true
    
    // Has a direct link and waiting for that query
    if (selectedChat?.contactId && contactByDirectLink === undefined) return true
    
    // No direct link, has username, waiting for Instagram query
    if (!selectedChat?.contactId && selectedChat?.username && contactByInstagram === undefined) return true
    
    // No direct link, no username, has phone, waiting for phone query
    if (!selectedChat?.contactId && !selectedChat?.username && selectedChat?.phoneNumber && contactByPhone === undefined) return true
    
    return false
  }, [selectedChatId, selectedChat, contactByDirectLink, contactByInstagram, contactByPhone])

  return (
    <ContactPanel 
      contact={contactData} 
      isLoading={isLoading}
      searchedUsername={selectedChat?.username}
      searchedPhoneNumber={selectedChat?.phoneNumber}
      participantName={selectedChat?.name}
      participantImageUrl={selectedChat?.contactImageUrl}
    />
  )
}

