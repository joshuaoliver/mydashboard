import { useMutation, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { useState, useRef } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { VoiceRecorder } from "./VoiceRecorder";
import { Bot, User, Loader2, AlertCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "@/components/ui/button";
import type { Id } from "~/convex/_generated/dataModel";

interface ChatConversationProps {
  threadId: string | null;
}

// Message from the Convex Agent
interface AgentMessage {
  key: string;
  role: "user" | "assistant";
  text?: string;
  status?: "pending" | "streaming" | "complete" | "error";
  _creationTime: number;
  parts?: Array<{
    type: string;
    text?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    result?: unknown;
  }>;
}

export function ChatConversation({ threadId }: ChatConversationProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mutations
  const sendMessage = useMutation(api.chat.sendMessage);
  const startConversation = useMutation(api.chat.startConversation);
  const createThread = useMutation(api.chat.createThread);

  // For now, we'll use a simple query to fetch thread info
  // In production, you'd use useUIMessages from @convex-dev/agent/react
  const thread = useQuery(
    api.chat.getThread,
    threadId ? { threadId: threadId as Id<"agentThreads"> } : "skip"
  );

  const handleSend = async (message: { text?: string }) => {
    const text = message.text?.trim();
    if (!text) return;

    setInput("");
    setIsLoading(true);

    try {
      if (threadId) {
        await sendMessage({ threadId, prompt: text });
      } else {
        // Create new thread with first message
        await startConversation({ prompt: text });
        // The parent component should handle selecting the new thread
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Empty state when no thread is selected
  if (!threadId) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <ConversationEmptyState
            title="Start a conversation"
            description="Select a conversation from the sidebar or start a new one"
            icon={<Bot className="h-12 w-12" />}
          >
            <Button
              variant="outline"
              className="mt-4"
              onClick={async () => {
                await createThread({});
                // Parent should handle navigation
              }}
            >
              New conversation
            </Button>
          </ConversationEmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <Conversation className="flex-1">
        <ConversationContent className="space-y-4">
          {/* Welcome message for empty threads */}
          {!thread?.messageCount && (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                How can I help you today?
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                I can help you manage tasks, send messages, set reminders, and more.
                Try saying something like "Remind me to call Sam tomorrow" or
                "Create a todo for the project meeting".
              </p>
            </div>
          )}

          {/* Messages will be rendered here using useUIMessages in production */}
          {/* For now, showing a placeholder */}
          {thread?.messageCount && thread.messageCount > 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Loading messages...
            </div>
          )}

          <div ref={messagesEndRef} />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area */}
      <div className="border-t p-4">
        <PromptInput
          onSubmit={handleSend}
          accept="audio/*"
          className="max-w-4xl mx-auto"
        >
          <VoiceRecorder threadId={threadId} />
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or record a voice note..."
            className="min-h-[60px]"
          />
          <PromptInputSubmit
            status={isLoading ? "submitted" : undefined}
            disabled={!input.trim() && !isLoading}
          />
        </PromptInput>
      </div>
    </div>
  );
}

// Helper component to render a single message (will be used once we add useUIMessages)
export function ChatMessage({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const hasError = message.status === "error";

  return (
    <Message from={message.role}>
      <div
        className={cn(
          "flex items-start gap-3 max-w-[85%]",
          isUser ? "ml-auto flex-row-reverse" : ""
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>

        {/* Message Content */}
        <MessageContent variant={isUser ? "contained" : "flat"}>
          {message.text}

          {/* Streaming indicator */}
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
            </span>
          )}

          {/* Error indicator */}
          {hasError && (
            <div className="flex items-center gap-1 text-destructive text-sm mt-1">
              <AlertCircle className="h-3 w-3" />
              <span>Failed to generate response</span>
            </div>
          )}

          {/* Tool calls */}
          {message.parts?.filter((p) => p.type === "tool-call").map((part, i) => (
            <div
              key={i}
              className="mt-2 p-2 rounded bg-muted/50 text-xs border"
            >
              <div className="font-medium text-muted-foreground">
                Tool: {part.toolName}
              </div>
              {part.result && (
                <pre className="mt-1 text-xs overflow-auto">
                  {JSON.stringify(part.result, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </MessageContent>
      </div>
    </Message>
  );
}
