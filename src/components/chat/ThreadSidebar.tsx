import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, Pencil, Search, Check, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatDistanceToNow } from "~/lib/utils";
import { useState, useRef, useEffect, useMemo } from "react";
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
import type { Id } from "../../../convex/_generated/dataModel";

// Type assertion for API references not yet in generated types
// Run `npx convex dev` to regenerate types after adding new files
const chatApi = (api as any).chat;

interface Thread {
  id: { toString(): string };
  title: string;
  lastMessageAt?: number;
}

interface ThreadSidebarProps {
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
}

export function ThreadSidebar({
  selectedThreadId,
  onSelectThread,
}: ThreadSidebarProps) {
  const threads = useQuery(chatApi.listThreads);
  const createThread = useMutation(chatApi.createThread);
  const deleteThread = useMutation(chatApi.deleteThread);
  const updateThreadTitle = useMutation(chatApi.updateThreadTitle);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingThreadId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingThreadId]);

  // Filter threads based on search
  const filteredThreads = useMemo(() => {
    if (!threads) return [];
    if (!searchTerm.trim()) return threads;
    const lower = searchTerm.toLowerCase();
    return threads.filter((t: Thread) =>
      t.title.toLowerCase().includes(lower)
    );
  }, [threads, searchTerm]);

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
        const remainingThreads = threads?.filter((t: Thread) => t.id.toString() !== threadToDelete);
        if (remainingThreads && remainingThreads.length > 0) {
          onSelectThread(remainingThreads[0].id.toString());
        }
      }
    }
  };

  const startEditing = (threadId: string, currentTitle: string) => {
    setEditingThreadId(threadId);
    setEditingTitle(currentTitle);
  };

  const cancelEditing = () => {
    setEditingThreadId(null);
    setEditingTitle("");
  };

  const saveTitle = async () => {
    if (editingThreadId && editingTitle.trim()) {
      await updateThreadTitle({
        threadId: editingThreadId as Id<"agentThreads">,
        title: editingTitle.trim(),
      });
    }
    cancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      {/* Header */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Conversations</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewThread}
            title="New conversation"
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads === undefined ? (
            // Loading state
            <div className="p-4 text-sm text-muted-foreground text-center">
              Loading...
            </div>
          ) : filteredThreads.length === 0 ? (
            // Empty state
            <div className="p-4 text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "No matching conversations" : "No conversations yet"}
              </p>
              {!searchTerm && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleNewThread}
                >
                  Start a conversation
                </Button>
              )}
            </div>
          ) : (
            // Thread list
            filteredThreads.map((thread: Thread) => {
              const threadIdStr = thread.id.toString();
              const isEditing = editingThreadId === threadIdStr;
              const isSelected = selectedThreadId === threadIdStr;

              return (
                <div
                  key={threadIdStr}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors group",
                    isSelected
                      ? "bg-accent border-l-2 border-l-primary"
                      : "hover:bg-accent/50 border-l-2 border-l-transparent"
                  )}
                  onClick={() => !isEditing && onSelectThread(threadIdStr)}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          ref={editInputRef}
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={saveTitle}
                          className="h-6 text-sm py-0 px-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveTitle();
                          }}
                        >
                          <Check className="h-3 w-3 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEditing();
                          }}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate">{thread.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {thread.lastMessageAt
                            ? formatDistanceToNow(thread.lastMessageAt)
                            : "Just now"}
                        </p>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(threadIdStr, thread.title);
                        }}
                        title="Rename conversation"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setThreadToDelete(threadIdStr);
                        }}
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
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
