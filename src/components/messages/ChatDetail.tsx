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
            <div className="px-4 py-2 space-y-1">
              {/* Loading indicator for older messages */}
              {messagesStatus === "LoadingMore" && (
                <div className="py-3 text-center">
                  <RefreshCw className="w-4 h-4 text-gray-400 animate-spin mx-auto" />
                  <p className="text-xs text-gray-500 mt-1">Loading older messages...</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div key={message.id} className={cn('flex group', message.isFromUser ? 'justify-end' : 'justify-start')}>
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
                      
                      {/* Render text content with timestamp */}
                      <div className="flex items-end gap-2">
                        {message.text && (
                          <p className="text-sm whitespace-pre-wrap break-words flex-1">
                            {message.text}
                          </p>
                        )}
                        {/* Timestamp inside bubble - shown on hover */}
                        <div className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-70 transition-opacity select-none whitespace-nowrap self-end">
                          {formatMessageTime(message.timestamp)}
                        </div>
                      </div>
                    </MessageContent>
                  </AIMessage>
                </div>
              ))}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
  )
})

