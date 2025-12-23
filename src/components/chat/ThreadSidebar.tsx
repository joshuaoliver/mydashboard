import { useQuery, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatDistanceToNow } from "~/lib/utils";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Id } from "~/convex/_generated/dataModel";

interface ThreadSidebarProps {
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
}

export function ThreadSidebar({
  selectedThreadId,
  onSelectThread,
}: ThreadSidebarProps) {
  const threads = useQuery(api.chat.listThreads);
  const createThread = useMutation(api.chat.createThread);
  const deleteThread = useMutation(api.chat.deleteThread);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

  const handleNewThread = async () => {
    const result = await createThread({});
    onSelectThread(result.agentThreadId);
  };

  const handleDeleteThread = async () => {
    if (threadToDelete) {
      await deleteThread({ threadId: threadToDelete as Id<"agentThreads"> });
      setThreadToDelete(null);
      if (selectedThreadId === threadToDelete) {
        // Select the first remaining thread or nothing
        const remainingThreads = threads?.filter((t) => t.id.toString() !== threadToDelete);
        if (remainingThreads && remainingThreads.length > 0) {
          onSelectThread(remainingThreads[0].id.toString());
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full border-r">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-lg">Conversations</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNewThread}
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads === undefined ? (
            // Loading state
            <div className="p-4 text-sm text-muted-foreground text-center">
              Loading...
            </div>
          ) : threads.length === 0 ? (
            // Empty state
            <div className="p-4 text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleNewThread}
              >
                Start a conversation
              </Button>
            </div>
          ) : (
            // Thread list
            threads.map((thread) => {
              const threadIdStr = thread.id.toString();
              return (
                <div
                  key={threadIdStr}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors group",
                    selectedThreadId === threadIdStr
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => onSelectThread(threadIdStr)}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{thread.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {thread.lastMessageAt
                        ? formatDistanceToNow(thread.lastMessageAt)
                        : "Just now"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setThreadToDelete(threadIdStr);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!threadToDelete}
        onOpenChange={(open) => !open && setThreadToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteThread}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
