import { cn } from '@/lib/utils'
import { 
  Conversation, 
  ConversationContent, 
  ConversationEmptyState, 
  ConversationScrollButton 
} from '@/components/ai-elements/conversation'
import { Message as AIMessage, MessageContent } from '@/components/ai-elements/message'
import { ProxiedImage } from './ProxiedImage'
import { RefreshCw, Clock } from 'lucide-react'
import { memo } from 'react'

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
  id: string
  text: string
  timestamp: number
  sender: string
  senderName: string
  isFromUser: boolean
  attachments?: Attachment[]
  isPending?: boolean  // For optimistic messages
}

interface ChatDetailProps {
  messages: Message[]
  isSingleChat?: boolean  // Whether this is a 1:1 conversation
  messagesStatus?: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
  onLoadMore?: (numItems: number) => void
}

export const ChatDetail = memo(function ChatDetail({ messages, isSingleChat = true, messagesStatus, onLoadMore: _onLoadMore }: ChatDetailProps) {
  // Note: StickToBottom manages its own scroll container
  // Load more functionality would need to use StickToBottom's API if needed
  
  // Format timestamp for messages
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Conversation 
      className={cn(
        "flex-1 bg-gray-50",
        // Custom scrollbar styling with auto-hide (Webkit browsers - Chrome, Safari, Edge)
        "[&::-webkit-scrollbar]:w-2",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:bg-gray-300",
        "[&::-webkit-scrollbar-thumb]:rounded-full",
        "[&::-webkit-scrollbar-thumb:hover]:bg-gray-400",
        // Auto-hide: scrollbar only visible when scrolling
        "[&::-webkit-scrollbar-thumb]:transition-opacity",
        "[&:not(:hover)::-webkit-scrollbar-thumb]:opacity-0",
        // Firefox scrollbar styling
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300"
      )}
    >
      <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState 
              title="Start a conversation"
              description="Select a chat and type a message to begin"
            />
          ) : (
            <div className="px-3 py-1.5 space-y-0.5">
              {/* Loading indicator for older messages */}
              {messagesStatus === "LoadingMore" && (
                <div className="py-2 text-center">
                  <RefreshCw className="w-3 h-3 text-gray-400 animate-spin mx-auto" />
                  <p className="text-[10px] text-gray-500 mt-0.5">Loading older messages...</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div key={message.id} className={cn('flex flex-col group', message.isFromUser ? 'items-end' : 'items-start')}>
                  <AIMessage from={message.isFromUser ? 'user' : 'assistant'}>
                    <MessageContent variant="contained" className={cn("px-2.5 py-1.5", message.isPending && "opacity-70")}>
                      {/* Only show sender name in group chats */}
                      {!isSingleChat && !message.isFromUser && (
                        <div className="text-[10px] font-semibold mb-0.5 opacity-90">
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
                                  <div className="text-[10px] text-gray-500 mt-0.5">Sticker</div>
                                )}
                              </div>
                            ) : att.type === 'video' ? (
                              <div key={idx} className="p-2 bg-gray-100 rounded text-xs">
                                🎥 Video: {att.fileName || 'Video attachment'}
                              </div>
                            ) : att.type === 'audio' ? (
                              <div key={idx} className="p-2 bg-gray-100 rounded text-xs">
                                🎵 Audio: {att.fileName || 'Audio attachment'}
                              </div>
                            ) : (
                              <div key={idx} className="p-2 bg-gray-100 rounded text-xs">
                                📎 {att.fileName || 'Attachment'}
                              </div>
                            )
                          ))}
                        </div>
                      )}
                      
                      {/* Render text content */}
                      {message.text && (
                        <p className="text-xs whitespace-pre-wrap break-words">
                          {message.text}
                        </p>
                      )}
                    </MessageContent>
                  </AIMessage>
                  {/* Timestamp outside bubble - shown on hover */}
                  <div className={cn(
                    "text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity select-none mt-0.5 px-1 flex items-center gap-1",
                    message.isFromUser ? "text-right justify-end" : "text-left justify-start"
                  )}>
                    {message.isPending && (
                      <Clock className="w-2.5 h-2.5 animate-pulse" />
                    )}
                    {message.isPending ? 'Sending...' : formatMessageTime(message.timestamp)}
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

