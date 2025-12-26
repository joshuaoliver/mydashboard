import { cn } from '@/lib/utils'
import { 
  Conversation, 
  ConversationContent, 
  ConversationEmptyState, 
  ConversationScrollButton 
} from '@/components/ai-elements/conversation'
import { ProxiedImage } from './ProxiedImage'
import { RefreshCw, Clock, AlertCircle, RotateCcw, History } from 'lucide-react'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Id } from '../../../convex/_generated/dataModel'

interface Attachment {
  type: string
  srcURL: string
  mimeType?: string
  fileName?: string
  fileSize?: number
  isGif?: boolean
  isSticker?: boolean
  width?: number
  height?: number
}

interface Message {
  _id?: Id<"beeperMessages">  // Document ID for retry functionality
  id: string
  text: string
  timestamp: number
  sender: string
  senderName: string
  isFromUser: boolean
  attachments?: Attachment[]
  isPending?: boolean  // Legacy: For old optimistic messages
  status?: "sending" | "sent" | "failed"  // New: Backend status tracking
  errorMessage?: string  // Error message if send failed
}

interface ChatDetailProps {
  messages: Message[]
  isSingleChat?: boolean  // Whether this is a 1:1 conversation
  messagesStatus?: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
  onLoadMore?: (numItems: number) => void
  onRetry?: (messageDocId: Id<"beeperMessages">) => void  // Callback to retry failed message
  onLoadFullHistory?: () => void  // Callback to load full conversation history
  isLoadingFullHistory?: boolean  // Whether full history is currently loading
}

export const ChatDetail = memo(function ChatDetail({ messages, isSingleChat = true, messagesStatus, onLoadMore: _onLoadMore, onRetry, onLoadFullHistory, isLoadingFullHistory }: ChatDetailProps) {
  // Format timestamp for messages
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Check if message is in a pending state (either old isPending or new status="sending")
  const isPending = (message: Message) => message.isPending || message.status === "sending"
  
  // Check if message failed to send
  const isFailed = (message: Message) => message.status === "failed"

  return (
    <Conversation 
      className={cn(
        "flex-1 bg-white",
        // Custom scrollbar styling with auto-hide
        "[&::-webkit-scrollbar]:w-2",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:bg-gray-200",
        "[&::-webkit-scrollbar-thumb]:rounded-full",
        "[&::-webkit-scrollbar-thumb:hover]:bg-gray-300",
        "[&::-webkit-scrollbar-thumb]:transition-opacity",
        "[&:not(:hover)::-webkit-scrollbar-thumb]:opacity-0",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200"
      )}
    >
      <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState 
              title="Start a conversation"
              description="Select a chat and type a message to begin"
            />
          ) : (
            <div className="px-2 py-1 space-y-0.5">
              {/* Load full history button - shown when at the top and all cached messages loaded */}
              {messagesStatus === "Exhausted" && onLoadFullHistory && (
                <div className="py-3 text-center border-b border-gray-100 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLoadFullHistory}
                    disabled={isLoadingFullHistory}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    {isLoadingFullHistory ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                        Loading history...
                      </>
                    ) : (
                      <>
                        <History className="w-3 h-3 mr-1.5" />
                        Load full conversation history
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Fetches all messages from the past year
                  </p>
                </div>
              )}

              {/* Loading indicator for older messages */}
              {messagesStatus === "LoadingMore" && (
                <div className="py-2 text-center">
                  <RefreshCw className="w-3 h-3 text-gray-400 animate-spin mx-auto" />
                  <p className="text-[10px] text-gray-500 mt-0.5">Loading older messages...</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={cn(
                    'flex items-end gap-1.5 group',
                    message.isFromUser ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {/* Message bubble */}
                  <div 
                    className={cn(
                      "max-w-[75%] rounded-2xl px-2.5 py-1.5",
                      message.isFromUser 
                        ? "bg-blue-500 text-white" 
                        : "bg-gray-100 text-gray-900",
                      isPending(message) && "opacity-60",
                      isFailed(message) && "border-2 border-red-400 opacity-80"
                    )}
                  >
                    {/* Only show sender name in group chats */}
                    {!isSingleChat && !message.isFromUser && (
                      <div className="text-[10px] font-semibold mb-0.5 text-gray-600">
                        {message.senderName}
                      </div>
                    )}
                    
                    {/* Render image attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-1.5 space-y-1.5">
                        {message.attachments.map((att, idx) => (
                          att.type === 'img' ? (
                            <div key={idx} className="rounded overflow-hidden">
                              <ProxiedImage
                                src={att.srcURL}
                                alt={att.fileName || 'Image attachment'}
                                className="max-w-full h-auto max-h-64 rounded"
                                mimeType={att.mimeType}
                              />
                              {att.isSticker && (
                                <div className={cn(
                                  "text-[10px] mt-0.5",
                                  message.isFromUser ? "text-blue-100" : "text-gray-500"
                                )}>Sticker</div>
                              )}
                            </div>
                          ) : att.type === 'video' ? (
                            <div key={idx} className={cn(
                              "p-2 rounded text-xs",
                              message.isFromUser ? "bg-blue-400" : "bg-gray-200"
                            )}>
                              Video: {att.fileName || 'Video attachment'}
                            </div>
                          ) : att.type === 'audio' ? (
                            <div key={idx} className={cn(
                              "p-2 rounded text-xs",
                              message.isFromUser ? "bg-blue-400" : "bg-gray-200"
                            )}>
                              Audio: {att.fileName || 'Audio attachment'}
                            </div>
                          ) : (
                            <div key={idx} className={cn(
                              "p-2 rounded text-xs",
                              message.isFromUser ? "bg-blue-400" : "bg-gray-200"
                            )}>
                              {att.fileName || 'Attachment'}
                            </div>
                          )
                        ))}
                      </div>
                    )}
                    
                    {/* Render text content */}
                    {message.text && (
                      <p className="text-xs whitespace-pre-wrap break-words leading-relaxed">
                        {message.text}
                      </p>
                    )}
                  </div>

                  {/* Status indicator and timestamp */}
                  <div className={cn(
                    "text-[9px] select-none flex items-center gap-1 flex-shrink-0 pb-1",
                    isFailed(message) 
                      ? "text-red-500 opacity-100"  // Always show failed state
                      : "text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  )}>
                    {isPending(message) && (
                      <>
                        <Clock className="w-2.5 h-2.5 animate-pulse" />
                        <span>Sending...</span>
                      </>
                    )}
                    {isFailed(message) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Failed</span>
                              {onRetry && message._id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 ml-1 hover:bg-red-100"
                                  onClick={() => onRetry(message._id!)}
                                >
                                  <RotateCcw className="w-2.5 h-2.5" />
                                </Button>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">{message.errorMessage || 'Failed to send message'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {!isPending(message) && !isFailed(message) && (
                      <span>{formatMessageTime(message.timestamp)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
  )
})

