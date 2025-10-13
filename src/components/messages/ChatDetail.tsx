import { cn } from '@/lib/utils'
import { 
  Conversation, 
  ConversationContent, 
  ConversationEmptyState, 
  ConversationScrollButton 
} from '@/components/ai-elements/conversation'
import { Message as AIMessage, MessageContent } from '@/components/ai-elements/message'

interface Message {
  id: string
  text: string
  timestamp: number
  sender: string
  senderName: string
  isFromUser: boolean
}

interface ChatDetailProps {
  messages: Message[]
}

export function ChatDetail({ messages }: ChatDetailProps) {
  // Format timestamp for messages
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

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
            <div className="px-6 py-4 space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={cn('flex', message.isFromUser ? 'justify-end' : 'justify-start')}>
                  <AIMessage from={message.isFromUser ? 'user' : 'assistant'}>
                    <MessageContent variant="contained">
                      {!message.isFromUser && (
                        <div className="text-xs font-semibold text-gray-700 mb-1">
                          {message.senderName}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words text-gray-900">
                        {message.text}
                      </p>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatMessageTime(message.timestamp)}
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
    </div>
  )
}

