import { cn } from '@/lib/utils'
import { 
  Conversation, 
  ConversationContent, 
  ConversationEmptyState, 
  ConversationScrollButton 
} from '@/components/ai-elements/conversation'
import { Message as AIMessage, MessageContent } from '@/components/ai-elements/message'
import { ProxiedImage } from './ProxiedImage'
import { RefreshCw } from 'lucide-react'
import { useRef, useEffect } from 'react'

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
}

interface ChatDetailProps {
  messages: Message[]
  isSingleChat?: boolean  // Whether this is a 1:1 conversation
  messagesStatus?: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
  onLoadMore?: (numItems: number) => void
}

export function ChatDetail({ messages, isSingleChat = true, messagesStatus, onLoadMore }: ChatDetailProps) {
  const conversationRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)

  // Handle scroll to top - load more messages
  useEffect(() => {
    const container = conversationRef.current
    if (!container || !onLoadMore || messagesStatus !== "CanLoadMore") return

    const handleScroll = () => {
      const { scrollTop } = container
      
      // Load more when scrolled near the top (within 100px)
      if (scrollTop < 100) {
        console.log('📜 Loading older messages...')
        // Store current scroll height before loading
        prevScrollHeightRef.current = container.scrollHeight
        onLoadMore(50) // Load 50 more messages
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [messagesStatus, onLoadMore])

  // Maintain scroll position when new messages are prepended
  useEffect(() => {
    const container = conversationRef.current
    if (!container || messagesStatus !== "LoadingMore") return

    // After new messages load, adjust scroll to maintain visual position
    const prevScrollHeight = prevScrollHeightRef.current
    if (prevScrollHeight > 0) {
      const newScrollHeight = container.scrollHeight
      const heightDifference = newScrollHeight - prevScrollHeight
      container.scrollTop = container.scrollTop + heightDifference
      prevScrollHeightRef.current = 0
    }
  }, [messages.length, messagesStatus])
  
  // Format timestamp for messages
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <Conversation className="flex-1" ref={conversationRef}>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState 
              title="Start a conversation"
              description="Select a chat and type a message to begin"
            />
          ) : (
            <div className="px-4 py-2 space-y-1">
              {/* Loading indicator for older messages */}
              {messagesStatus === "LoadingMore" && (
                <div className="py-3 text-center">
                  <RefreshCw className="w-4 h-4 text-gray-400 animate-spin mx-auto" />
                  <p className="text-xs text-gray-500 mt-1">Loading older messages...</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div key={message.id} className={cn('flex items-end gap-1.5 group', message.isFromUser ? 'justify-end' : 'justify-start')}>
                  {/* Timestamp - shown on hover, positioned outside bubble */}
                  {!message.isFromUser && (
                    <div className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pb-1 select-none whitespace-nowrap">
                      {formatMessageTime(message.timestamp)}
                    </div>
                  )}
                  
                  <AIMessage from={message.isFromUser ? 'user' : 'assistant'}>
                    <MessageContent variant="contained">
                      {/* Only show sender name in group chats */}
                      {!isSingleChat && !message.isFromUser && (
                        <div className="text-xs font-semibold mb-1 opacity-90">
                          {message.senderName}
                        </div>
                      )}
                      
                      {/* Render image attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mb-2 space-y-2">
                          {message.attachments.map((att, idx) => (
                            att.type === 'img' ? (
                              <div key={idx} className="rounded-lg overflow-hidden">
                                <ProxiedImage
                                  src={att.srcURL}
                                  alt={att.fileName || 'Image attachment'}
                                  className="max-w-full h-auto max-h-96 rounded-lg"
                                  mimeType={att.mimeType}
                                />
                                {att.isSticker && (
                                  <div className="text-xs text-gray-500 mt-1">Sticker</div>
                                )}
                              </div>
                            ) : att.type === 'video' ? (
                              <div key={idx} className="p-3 bg-gray-100 rounded text-sm">
                                🎥 Video: {att.fileName || 'Video attachment'}
                              </div>
                            ) : att.type === 'audio' ? (
                              <div key={idx} className="p-3 bg-gray-100 rounded text-sm">
                                🎵 Audio: {att.fileName || 'Audio attachment'}
                              </div>
                            ) : (
                              <div key={idx} className="p-3 bg-gray-100 rounded text-sm">
                                📎 {att.fileName || 'Attachment'}
                              </div>
                            )
                          ))}
                        </div>
                      )}
                      
                      {/* Render text content if present */}
                      {message.text && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.text}
                        </p>
                      )}
                    </MessageContent>
                  </AIMessage>
                  
                  {/* Timestamp for user messages - shown on hover, positioned outside bubble */}
                  {message.isFromUser && (
                    <div className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pb-1 select-none whitespace-nowrap">
                      {formatMessageTime(message.timestamp)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  )
}

