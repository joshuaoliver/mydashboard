import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  chatName: string
}

export function ChatDetail({ messages, chatName }: ChatDetailProps) {
  // Format timestamp for messages
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Group messages by date
  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {}
    
    messages.forEach((msg) => {
      const date = new Date(msg.timestamp)
      const dateKey = date.toLocaleDateString()
      
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(msg)
    })
    
    return groups
  }

  const messageGroups = groupMessagesByDate(messages)

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>No messages in this conversation</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
            {chatName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{chatName}</h2>
            <p className="text-sm text-gray-500">{messages.length} messages</p>
          </div>
        </div>
      </div>

      {/* Messages area with ScrollArea */}
      <ScrollArea className="flex-1 bg-gray-50">
        <div className="px-6 py-4 space-y-6">
          {Object.entries(messageGroups).map(([date, msgs]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center justify-center mb-4">
                <div className="px-3 py-1 bg-gray-200 rounded-full text-xs text-gray-600 font-medium">
                  {date}
                </div>
              </div>

              {/* Messages for this date */}
              <div className="space-y-3">
                {msgs.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.isFromUser ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-lg px-4 py-2 shadow-sm',
                        message.isFromUser
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      )}
                    >
                      {!message.isFromUser && (
                        <div className="text-xs font-semibold mb-1 text-gray-600">
                          {message.senderName}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.text}
                      </p>
                      <div
                        className={cn(
                          'text-xs mt-1',
                          message.isFromUser ? 'text-blue-100' : 'text-gray-500'
                        )}
                      >
                        {formatMessageTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

