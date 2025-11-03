import { cn } from '@/lib/utils'
import { 
  Conversation, 
  ConversationContent, 
  ConversationEmptyState, 
  ConversationScrollButton 
} from '@/components/ai-elements/conversation'
import { Message as AIMessage, MessageContent } from '@/components/ai-elements/message'
import { ProxiedImage } from './ProxiedImage'

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
}

export function ChatDetail({ messages, isSingleChat = true }: ChatDetailProps) {
  // Format timestamp for messages
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Debug: log to verify isSingleChat is being set correctly
  console.log('ChatDetail render - isSingleChat:', isSingleChat, 'messageCount:', messages.length)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState 
              title="Start a conversation"
              description="Select a chat and type a message to begin"
            />
          ) : (
            <div className="px-4 py-2 space-y-1">
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

