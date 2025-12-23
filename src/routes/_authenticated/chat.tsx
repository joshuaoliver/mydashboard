import { createFileRoute } from "@tanstack/react-router";
import { FullWidthContent } from "@/components/layout/full-width-content";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { PendingActionsPanel } from "@/components/chat/PendingActionsPanel";
import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ListTodo } from "lucide-react";
import { Sidebar, SidebarHeader } from "@/components/layout/sidebar";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      threadId: (search.threadId as string) || undefined,
    };
  },
});

function ChatPage() {
  const { threadId: urlThreadId } = Route.useSearch();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    urlThreadId || null
  );
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [actionsPanelOpen, setActionsPanelOpen] = useState(false);
  const isMobile = useIsMobile();

  // Get pending actions count for the badge
  const pendingActions = useQuery(
    api.agentChat.listPendingActionsForThread,
    selectedThreadId ? { threadId: selectedThreadId } : "skip"
  );
  const pendingCount = pendingActions?.filter((a) => a.status === "pending").length || 0;

  // Get thread title for mobile header
  const threads = useQuery(api.chat.listThreads);
  const currentThread = threads?.find((t) => t.id.toString() === selectedThreadId);
  const threadTitle = currentThread?.title || "Conversation";

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    if (isMobile) {
      setMobileSheetOpen(true);
    }
  };

  const handleCloseMobileSheet = () => {
    setMobileSheetOpen(false);
  };

  return (
    <FullWidthContent>
      {!isMobile ? (
        /* Desktop Layout */
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Sidebar - Thread List */}
          <ResizablePanel defaultSize={22} minSize={15} maxSize={30}>
            <ThreadSidebar
              selectedThreadId={selectedThreadId}
              onSelectThread={handleSelectThread}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Main Content - Conversation */}
          <ResizablePanel defaultSize={pendingCount > 0 ? 50 : 78} minSize={40}>
            <ChatConversation threadId={selectedThreadId} />
          </ResizablePanel>

          {/* Right Panel - Pending Actions (only if there are any) */}
          {pendingCount > 0 && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={28} minSize={20} maxSize={40}>
                <PendingActionsPanel threadId={selectedThreadId} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      ) : (
        /* Mobile Layout */
        <>
          <Sidebar
            width="w-full"
            className={cn(mobileSheetOpen && "hidden")}
            header={
              <SidebarHeader
                title="Agent Chat"
                subtitle="Your AI assistant"
                actions={<div />}
              />
            }
          >
            <ThreadSidebar
              selectedThreadId={selectedThreadId}
              onSelectThread={handleSelectThread}
            />
          </Sidebar>

          {/* Mobile Chat Sheet */}
          <Sheet
            open={mobileSheetOpen}
            onOpenChange={(open) => !open && handleCloseMobileSheet()}
          >
            <SheetContent
              side="right"
              className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden [&>button]:hidden"
            >
              <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCloseMobileSheet}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <SheetTitle className="text-lg font-semibold truncate flex-1 min-w-0">
                    {threadTitle}
                  </SheetTitle>
                  {pendingCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActionsPanelOpen(true)}
                      className="h-8 w-8 p-0 flex-shrink-0 relative"
                      title="Pending Actions"
                    >
                      <ListTodo className="h-4 w-4" />
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                        {pendingCount}
                      </span>
                    </Button>
                  )}
                </div>
              </SheetHeader>

              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <ChatConversation threadId={selectedThreadId} />
              </div>
            </SheetContent>
          </Sheet>

          {/* Mobile Pending Actions Sheet */}
          <Sheet open={actionsPanelOpen} onOpenChange={setActionsPanelOpen}>
            <SheetContent
              side="right"
              className="w-full sm:max-w-md p-0 [&>button]:hidden"
            >
              <SheetHeader className="px-4 py-3 border-b">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActionsPanelOpen(false)}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <SheetTitle className="text-lg font-semibold">
                    Pending Actions
                  </SheetTitle>
                </div>
              </SheetHeader>
              <PendingActionsPanel threadId={selectedThreadId} />
            </SheetContent>
          </Sheet>
        </>
      )}
    </FullWidthContent>
  );
}
