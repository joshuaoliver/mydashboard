import { useMutation, useQuery } from 'convex/react'
import { useUIMessages, useSmoothText, optimisticallySendMessage } from '@convex-dev/agent/react'
import { api } from '../../../convex/_generated/api'
import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'
import { VoiceRecorder } from './VoiceRecorder'
import { ModelSelector } from './ModelSelector'
import { AttachmentButton, type AttachmentInfo } from './AttachmentButton'
import {
  Bot,
  User,
  Loader2,
  AlertCircle,
  Wrench,
  UserSearch,
  CheckSquare,
  Calendar,
  FolderKanban,
  FileText,
  MessageSquare,
  Clock,
  ListTodo,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '~/lib/utils'
import { Button } from '@/components/ui/button'
import type { Id } from '../../../convex/_generated/dataModel'

// Type assertion for API references not yet in generated types
// Run `npx convex dev` to regenerate types after adding new files
const chatApi = (api as any).chat

interface ChatConversationProps {
  threadId: string | null
  onThreadCreated?: (threadId: string) => void
}

// Fallback model if settings haven't loaded yet
const FALLBACK_MODEL = 'google/gemini-3-flash'

export function ChatConversation({
  threadId,
  onThreadCreated,
}: ChatConversationProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachment, setAttachment] = useState<AttachmentInfo | null>(null)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Query the chat-agent setting for default model
  const chatAgentSetting = useQuery(api.aiSettings.getSetting, {
    key: 'chat-agent',
  })
  const defaultModel = chatAgentSetting?.modelId || FALLBACK_MODEL

  // State for selected model - initialized from settings
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  // Query the current thread to get its model and check if agent thread exists
  const thread = useQuery(
    chatApi.getThread,
    threadId ? { threadId: threadId as Id<'agentThreads'> } : 'skip',
  )

  // Check if the thread has an initialized agent thread
  // This is used to conditionally skip the useUIMessages call
  const hasAgentThread = thread?.hasAgentThread === true

  // Initialize selected model from thread or settings
  useEffect(() => {
    if (thread?.modelId) {
      setSelectedModel(thread.modelId)
    } else if (!selectedModel && defaultModel) {
      setSelectedModel(defaultModel)
    }
  }, [thread?.modelId, defaultModel, selectedModel])

  // Effective model to use (with fallback chain)
  const effectiveModel = selectedModel || defaultModel

  // Mutations with optimistic updates for better UX
  const sendMessage = useMutation(chatApi.sendMessage).withOptimisticUpdate(
    optimisticallySendMessage(chatApi.listThreadMessages)
  )
  const sendMessageWithAttachment = useMutation(
    chatApi.sendMessageWithAttachment,
  ).withOptimisticUpdate(
    optimisticallySendMessage(chatApi.listThreadMessages)
  )
  const startConversation = useMutation(chatApi.startConversation)
  const updateThreadModel = useMutation(chatApi.updateThreadModel)

  // Handle model selection change
  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId)
    if (threadId) {
      await updateThreadModel({
        threadId: threadId as Id<'agentThreads'>,
        modelId,
      })
    }
  }

  // Use the Convex Agent streaming hook for messages
  // Only call this if the thread has an initialized agent thread
  // Otherwise the query will throw an error
  const {
    results: messages,
    status,
    loadMore,
  } = useUIMessages(
    chatApi.listThreadMessages,
    threadId && hasAgentThread ? { threadId } : 'skip',
    { initialNumItems: 50, stream: true },
  )

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = async (message: { text?: string }) => {
    const text = message.text?.trim()
    if (!text) return

    setInput('')
    setIsLoading(true)
    const currentAttachment = attachment
    setAttachment(null) // Clear attachment after sending

    // Show pending message immediately for threads without agent thread yet
    if (threadId && !hasAgentThread) {
      setPendingMessage(text)
    }

    try {
      if (threadId) {
        if (currentAttachment) {
          // Send with attachment
          await sendMessageWithAttachment({
            threadId,
            prompt: text,
            storageId: currentAttachment.storageId as any,
            mimeType: currentAttachment.mimeType,
            fileName: currentAttachment.fileName,
          })
        } else {
          await sendMessage({ threadId, prompt: text })
        }
      } else {
        // Create new thread with first message (attachments not supported for new threads yet)
        const result = await startConversation({ prompt: text })
        // The mutation returns { threadId } which is our agentThreads table ID
        onThreadCreated?.(result.threadId)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setPendingMessage(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Clear pending message when we get real messages
  useEffect(() => {
    if (messages && messages.length > 0 && pendingMessage) {
      setPendingMessage(null)
    }
  }, [messages, pendingMessage])

  // Empty state when no thread is selected - show input to start conversation directly
  if (!threadId) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Type a message below to begin chatting with your AI assistant, or
              select an existing conversation from the sidebar.
            </p>
          </div>
        </div>

        {/* Input Area - allows starting a new conversation directly */}
        <div className="border-t p-4">
          <PromptInput
            onSubmit={handleSend}
            accept="audio/*"
            className="max-w-4xl mx-auto"
          >
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message to start a new conversation..."
              className="min-h-[60px]"
            />
            <PromptInputToolbar className="px-2 py-1.5">
              <div className="flex items-center gap-1">
                <ModelSelector
                  value={effectiveModel}
                  onChange={handleModelChange}
                  disabled={isLoading}
                />
              </div>
              <div className="flex items-center gap-1">
                <PromptInputSubmit
                  status={isLoading ? 'submitted' : undefined}
                  disabled={!input.trim() && !isLoading}
                />
              </div>
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    )
  }

  const hasMessages = messages && messages.length > 0
  const isStreamingAny = messages?.some((m) => m.status === 'streaming')

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <Conversation className="flex-1">
        <ConversationContent className="space-y-4 p-4">
          {/* Welcome message for empty threads */}
          {!hasMessages && status !== 'LoadingFirstPage' && (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                How can I help you today?
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                I can help you manage tasks, send messages, set reminders, and
                more. Try saying something like "Remind me to call Sam tomorrow"
                or "Create a todo for the project meeting".
              </p>
            </div>
          )}

          {/* Loading state - only show if we have an agent thread */}
          {hasAgentThread && status === 'LoadingFirstPage' && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Loading messages...
            </div>
          )}

          {/* Load more button */}
          {status === 'CanLoadMore' && (
            <div className="text-center py-2">
              <Button variant="ghost" size="sm" onClick={() => loadMore(20)}>
                Load earlier messages
              </Button>
            </div>
          )}

          {/* Messages list */}
          {messages?.map((message, index) => (
            <StreamingMessage
              key={(message as any).key ?? `msg-${index}`}
              message={message as any}
            />
          ))}

          {/* Pending message (shown before agent thread is created) */}
          {pendingMessage && (
            <>
              <StreamingMessage
                message={{
                  key: 'pending-user',
                  order: 0,
                  role: 'user',
                  text: pendingMessage,
                  status: 'complete',
                }}
              />
              <StreamingMessage
                message={{
                  key: 'pending-assistant',
                  order: 1,
                  role: 'assistant',
                  text: '',
                  status: 'streaming',
                }}
              />
            </>
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
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or record a voice note..."
            className="min-h-[60px]"
          />
          <PromptInputToolbar className="px-2 py-1.5">
            <div className="flex items-center gap-1">
              <ModelSelector
                value={effectiveModel}
                onChange={handleModelChange}
                disabled={isLoading || isStreamingAny}
              />
            </div>
            <div className="flex items-center gap-1">
              <AttachmentButton
                threadId={threadId}
                onAttachmentReady={setAttachment}
                onAttachmentRemove={() => setAttachment(null)}
                disabled={isLoading || isStreamingAny}
              />
              <VoiceRecorder threadId={threadId} />
              <PromptInputSubmit
                status={isLoading || isStreamingAny ? 'submitted' : undefined}
                disabled={!input.trim() && !isLoading}
              />
            </div>
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  )
}

// Message type from Convex Agent - matching AI SDK v5 UIMessage structure
interface UIMessage {
  key: string
  order: number
  role: 'user' | 'assistant'
  text?: string
  status?: 'pending' | 'streaming' | 'complete' | 'error'
  error?: string
  parts?: Array<{
    type: string
    text?: string
    toolInvocationId?: string
    toolName?: string
    args?: Record<string, unknown>
    result?: unknown
    state?: 'pending' | 'result' | 'error'
  }>
}

// Component to render a single message with smooth text streaming
function StreamingMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user'
  const isStreaming = message.status === 'streaming'
  const hasError = message.status === 'error'

  // Use smooth text for streaming animation
  const [visibleText] = useSmoothText(message.text || '', {
    startStreaming: isStreaming,
  })

  // Get tool invocations from message parts - AI SDK v5 uses 'tool-invocation' type
  const toolInvocations = message.parts?.filter((p) => 
    p.type === 'tool-invocation' || p.type === 'tool-call'
  ) || []

  return (
    <div
      className={cn('flex items-start gap-3', isUser ? 'flex-row-reverse' : '')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div className={cn('flex-1 max-w-[85%]', isUser && 'text-right')}>
        <Message from={message.role}>
          <MessageContent
            variant={isUser ? 'contained' : 'flat'}
            className={cn(
              'inline-block text-left',
              isUser && 'bg-primary text-primary-foreground',
            )}
          >
            {/* Main text with smooth streaming and markdown rendering */}
            {visibleText ? (
              isUser ? (
                // User messages: plain text
                <span className="whitespace-pre-wrap">{visibleText}</span>
              ) : (
                // Assistant messages: render markdown
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-pre:my-2 prose-code:text-sm">
                  <Markdown>{visibleText}</Markdown>
                </div>
              )
            ) : (
              isStreaming && !visibleText && (
                <span className="text-muted-foreground italic">
                  Thinking...
                </span>
              )
            )}

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
                <span>{message.error || 'Failed to generate response'}</span>
              </div>
            )}
          </MessageContent>
        </Message>

        {/* Tool invocations display (for assistant messages) */}
        {!isUser && toolInvocations.length > 0 && (
          <div className="mt-2 space-y-2">
            {toolInvocations.map((tool, i) => (
              <ToolCallDisplay
                key={tool.toolInvocationId || i}
                toolName={tool.toolName || 'Unknown'}
                args={tool.args}
                result={tool.result}
                isExecuting={tool.state === 'pending' || (!tool.result && isStreaming)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Tool icon mapping
const TOOL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  lookupContact: UserSearch,
  searchContactMessages: MessageSquare,
  createTodo: CheckSquare,
  createPendingAction: Clock,
  listPendingActions: ListTodo,
  getCurrentContext: Clock,
  getCalendarEvents: Calendar,
  getTodayPlan: Calendar,
  addAdhocTask: CheckSquare,
  listProjects: FolderKanban,
  listNotes: FileText,
}

// Get a friendly display name and summary for tool results
function getToolSummary(
  toolName: string,
  _args?: Record<string, unknown>,
  result?: unknown,
): string | null {
  if (!result) return null

  try {
    const r = result as Record<string, unknown>

    switch (toolName) {
      case 'lookupContact':
        if (r.found && Array.isArray(r.contacts)) {
          return `Found ${r.contacts.length} contact(s)`
        }
        return (r.message as string) || 'No contacts found'

      case 'createTodo':
        return (r.message as string) || 'Todo created'

      case 'createPendingAction':
        return (r.message as string) || 'Action pending approval'

      case 'searchContactMessages':
        if (r.found && Array.isArray(r.messages)) {
          return `Found ${r.messages.length} message(s)`
        }
        return (r.message as string) || 'No messages found'

      case 'getCalendarEvents':
        if (Array.isArray(result)) {
          return result.length > 0
            ? `${result.length} event(s) today`
            : 'No events today'
        }
        return null

      case 'getTodayPlan':
        if (r.hasPlan) {
          const adhocCount = Array.isArray(r.adhocItems)
            ? r.adhocItems.length
            : 0
          return `Plan active, ${adhocCount} adhoc item(s)`
        }
        return 'No plan for today'

      case 'addAdhocTask':
        return (r.message as string) || "Task added to today's plan"

      case 'listProjects':
        if (Array.isArray(result)) {
          return `${result.length} active project(s)`
        }
        return null

      case 'listNotes':
        if (Array.isArray(result)) {
          return `${result.length} note document(s)`
        }
        return null

      default:
        return null
    }
  } catch {
    return null
  }
}

// Component to display tool calls
function ToolCallDisplay({
  toolName,
  args,
  result,
  isExecuting,
}: {
  toolName: string
  args?: Record<string, unknown>
  result?: unknown
  isExecuting?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Get icon for this tool
  const IconComponent = TOOL_ICONS[toolName] || Wrench

  // Format tool name for display
  const displayName = toolName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()

  // Get a summary of the result
  const summary = getToolSummary(toolName, args, result)

  // Determine status - ensure boolean types for cn() usage
  const hasError = Boolean(
    result && typeof result === 'object' && 'error' in (result as object),
  )
  const isComplete = Boolean(result && !isExecuting)

  return (
    <div
      className={cn(
        'rounded-lg border p-2.5 text-sm transition-colors',
        isExecuting &&
          'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
        isComplete &&
          !hasError &&
          'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
        hasError &&
          'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
        !isExecuting && !isComplete && 'bg-muted/30',
      )}
    >
      <div
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <IconComponent
          className={cn(
            'h-3.5 w-3.5',
            isExecuting && 'text-blue-600 dark:text-blue-400',
            isComplete && !hasError && 'text-green-600 dark:text-green-400',
            hasError && 'text-red-600 dark:text-red-400',
            !isExecuting && !isComplete && 'text-muted-foreground',
          )}
        />
        <span className="font-medium flex-1">{displayName}</span>

        {isExecuting && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
        )}
        {isComplete && !hasError && (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        )}
        {hasError && (
          <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        )}

        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Summary line (if available) */}
      {summary && !isExpanded && (
        <div className="mt-1 text-xs text-muted-foreground pl-5.5 ml-0.5">
          {summary}
        </div>
      )}

      {isExpanded && (
        <div className="mt-2 space-y-2 pl-5.5 ml-0.5">
          {args && Object.keys(args).length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Input:
              </div>
              <pre className="text-xs bg-background/50 rounded p-2 overflow-auto max-h-24 border">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result !== undefined && result !== null && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Output:
              </div>
              <pre className="text-xs bg-background/50 rounded p-2 overflow-auto max-h-32 border">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
