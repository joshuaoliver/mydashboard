import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FullWidthContent } from '@/components/layout/full-width-content'
import { ChatListPanel } from '@/components/messages/ChatListPanel'
import { ConversationPanel } from '@/components/messages/ConversationPanel'
import { ContactSidePanel } from '@/components/messages/ContactSidePanel'
import { useChatStore } from '@/stores/useChatStore'
import { useEffect, useCallback } from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useIsMobile } from '@/lib/hooks/use-mobile'
import { useChatKeyboardShortcuts } from '@/lib/hooks/use-chat-keyboard-shortcuts'
import { useSwipeBack } from '@/lib/hooks/use-swipe-back'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User as UserIcon } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/inbox')({
  component: InboxPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      chatId: (search.chatId as string) || undefined,
    }
  },
})

function InboxPage() {
  const navigate = useNavigate()
  const { chatId } = Route.useSearch()
  const isMobile = useIsMobile()

  // Get state from Zustand store
  const selectedChatId = useChatStore((state) => state.selectedChatId)
  const setSelectedChatId = useChatStore((state) => state.setSelectedChatId)
  const sheetOpen = useChatStore((state) => state.sheetOpen)
  const setSheetOpen = useChatStore((state) => state.setSheetOpen)
  const contactPanelOpen = useChatStore((state) => state.contactPanelOpen)
  const setContactPanelOpen = useChatStore((state) => state.setContactPanelOpen)

  // Enable keyboard shortcuts (E to archive, J/K or arrows to navigate)
  useChatKeyboardShortcuts()

  // Sync URL param with Zustand store
  useEffect(() => {
    const targetId = chatId || null
    if (selectedChatId !== targetId) {
      setSelectedChatId(targetId)
    }
  }, [chatId, selectedChatId, setSelectedChatId])

  // Open sheet when chat selected on mobile
  useEffect(() => {
    if (isMobile && selectedChatId) {
      setSheetOpen(true)
    } else if (!isMobile) {
      setSheetOpen(false)
    }
  }, [isMobile, selectedChatId, setSheetOpen])

  // Handle closing sheet on mobile
  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false)
    navigate({ search: { chatId: undefined } })
  }, [setSheetOpen, navigate])

  // Handle closing contact panel
  const handleCloseContactPanel = useCallback(() => {
    setContactPanelOpen(false)
  }, [setContactPanelOpen])

  // Enable swipe-from-left-edge to go back on mobile
  // When contact panel is open, swipe closes contact panel
  // When only conversation is open, swipe closes conversation
  useSwipeBack({
    onSwipeBack: contactPanelOpen ? handleCloseContactPanel : handleCloseSheet,
    enabled: isMobile && (sheetOpen || contactPanelOpen),
  })

  return (
    <FullWidthContent>
      {!isMobile ? (
        /* Desktop Layout */
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Sidebar - Chat List */}
          <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
            <ChatListPanel />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Main Content - Conversation */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <ConversationPanel />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Sidebar - Contact Panel */}
          <ResizablePanel defaultSize={40} minSize={25} maxSize={50}>
            <ContactSidePanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        /* Mobile Layout */
        <>
          <Sidebar
            width="w-full"
            className={cn(sheetOpen && "hidden")}
          >
            <ChatListPanel />
          </Sidebar>

          {/* Mobile Chat Sheet */}
          <Sheet open={sheetOpen} onOpenChange={(open) => !open && handleCloseSheet()}>
            <SheetContent side="right" className="w-full sm:max-w-2xl px-0 flex flex-col overflow-hidden [&>button]:hidden gap-0">
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
                    Conversation
                  </SheetTitle>
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

              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <ConversationPanel />
              </div>
            </SheetContent>
          </Sheet>

          {/* Mobile Contact Panel Sheet */}
          <Sheet open={contactPanelOpen} onOpenChange={setContactPanelOpen}>
            <SheetContent side="right" className="w-full sm:max-w-md px-0 gap-0 [&>button]:hidden">
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
              <ContactSidePanel />
            </SheetContent>
          </Sheet>
        </>
      )}
    </FullWidthContent>
  )
}

