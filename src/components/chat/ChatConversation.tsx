import { useMutation, useQuery } from "convex/react";
import { useUIMessages, useSmoothText } from "@convex-dev/agent/react";
import { api } from "~/convex/_generated/api";
import { useState, useRef, useEffect } from "react";
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
  PromptInputToolbar,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { VoiceRecorder } from "./VoiceRecorder";
import { ModelSelector } from "./ModelSelector";
import { Bot, User, Loader2, AlertCircle, Wrench } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "@/components/ui/button";
import type { Id } from "~/convex/_generated/dataModel";

interface ChatConversationProps {
  threadId: string | null;
  onThreadCreated?: (threadId: string) => void;
}

// Default model to use when none is selected
const DEFAULT_MODEL = "google/gemini-3-flash";

export function ChatConversation({ threadId, onThreadCreated }: ChatConversationProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Query the current thread to get its model
  const thread = useQuery(
    api.chat.getThread,
    threadId ? { threadId: threadId as Id<"agentThreads"> } : "skip"
  );

  // Sync selected model with thread's model when thread loads
  useEffect(() => {
    if (thread?.modelId) {
      setSelectedModel(thread.modelId);
    }
  }, [thread?.modelId]);

  // Mutations
  const sendMessage = useMutation(api.chat.sendMessage);
  const startConversation = useMutation(api.chat.startConversation);
  const createThread = useMutation(api.chat.createThread);
  const updateThreadModel = useMutation(api.chat.updateThreadModel);

  // Handle model selection change
  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    if (threadId) {
      await updateThreadModel({
        threadId: threadId as Id<"agentThreads">,
        modelId,
      });
    }
  };

  // Use the Convex Agent streaming hook for messages
  const { results: messages, status, loadMore } = useUIMessages(
    api.chat.listThreadMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 50, stream: true }
  );

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
        const result = await startConversation({ prompt: text });
        onThreadCreated?.(result.agentThreadId);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewThread = async () => {
    const result = await createThread({});
    onThreadCreated?.(result.agentThreadId);
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
              onClick={handleNewThread}
            >
              New conversation
            </Button>
          </ConversationEmptyState>
        </div>
      </div>
    );
  }

  const hasMessages = messages && messages.length > 0;
  const isStreamingAny = messages?.some((m) => m.status === "streaming");

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <Conversation className="flex-1">
        <ConversationContent className="space-y-4 p-4">
          {/* Welcome message for empty threads */}
          {!hasMessages && status !== "LoadingFirstPage" && (
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

          {/* Loading state */}
          {status === "LoadingFirstPage" && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Loading messages...
            </div>
          )}

          {/* Load more button */}
          {status === "CanLoadMore" && (
            <div className="text-center py-2">
              <Button variant="ghost" size="sm" onClick={() => loadMore(20)}>
                Load earlier messages
              </Button>
            </div>
          )}

          {/* Messages list */}
          {messages?.map((message) => (
            <StreamingMessage key={message.key} message={message} />
          ))}

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
          <PromptInputToolbar className="px-2 py-1.5 border-b">
            <ModelSelector
              value={selectedModel}
              onChange={handleModelChange}
              disabled={isLoading || isStreamingAny}
            />
            <VoiceRecorder threadId={threadId} />
          </PromptInputToolbar>
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or record a voice note..."
            className="min-h-[60px]"
          />
          <PromptInputSubmit
            status={isLoading || isStreamingAny ? "submitted" : undefined}
            disabled={!input.trim() && !isLoading}
          />
        </PromptInput>
      </div>
    </div>
  );
}

// Message type from Convex Agent
interface UIMessage {
  key: string;
  order: number;
  role: "user" | "assistant";
  text?: string;
  status?: "pending" | "streaming" | "complete" | "error";
  parts?: Array<{
    type: string;
    text?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    result?: unknown;
  }>;
}

// Component to render a single message with smooth text streaming
function StreamingMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const hasError = message.status === "error";

  // Use smooth text for streaming animation
  const [visibleText] = useSmoothText(message.text || "", {
    startStreaming: isStreaming,
  });

  // Get tool calls from message parts
  const toolCalls = message.parts?.filter((p) => p.type === "tool-call") || [];
  const toolResults = message.parts?.filter((p) => p.type === "tool-result") || [];

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        isUser ? "flex-row-reverse" : ""
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
      <div className={cn("flex-1 max-w-[85%]", isUser && "text-right")}>
        <Message from={message.role}>
          <MessageContent
            variant={isUser ? "contained" : "flat"}
            className={cn(
              "inline-block text-left",
              isUser && "bg-primary text-primary-foreground"
            )}
          >
            {/* Main text with smooth streaming */}
            {visibleText || (isStreaming && !visibleText && (
              <span className="text-muted-foreground italic">Thinking...</span>
            ))}

            {/* Streaming indicator */}
            {isStreaming && (
              <span className="inline-flex items-center gap-1 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              </span>
            )}

            {/* Error indicator */}
            {hasError && (
              <div className="flex items-center gap-1 text-destructive text-sm mt-2">
                <AlertCircle className="h-3 w-3" />
                <span>Failed to generate response</span>
              </div>
            )}
          </MessageContent>
        </Message>

        {/* Tool calls display (for assistant messages) */}
        {!isUser && toolCalls.length > 0 && (
          <div className="mt-2 space-y-2">
            {toolCalls.map((tool, i) => {
              const result = toolResults.find(
                (r) => r.toolName === tool.toolName
              );
              return (
                <ToolCallDisplay
                  key={i}
                  toolName={tool.toolName || "Unknown"}
                  args={tool.args}
                  result={result?.result}
                  isExecuting={!result && isStreaming}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Component to display tool calls
function ToolCallDisplay({
  toolName,
  args,
  result,
  isExecuting,
}: {
  toolName: string;
  args?: Record<string, unknown>;
  result?: unknown;
  isExecuting?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Format tool name for display
  const displayName = toolName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{displayName}</span>
        {isExecuting && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
        {result && !isExecuting && (
          <span className="text-xs text-green-600 dark:text-green-400">
            Completed
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {args && Object.keys(args).length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Arguments:</div>
              <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-24">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result !== undefined && result !== null && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Result:</div>
              <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-24">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
