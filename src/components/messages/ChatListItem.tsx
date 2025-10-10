import { MessageCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatListItemProps {
  id: string
  name: string
  network?: string
  accountID?: string
  username?: string      // Instagram handle, etc.
  phoneNumber?: string   // WhatsApp number, etc.
  lastMessage: string
  lastMessageTime: number
  unreadCount?: number
  isSelected: boolean
  onClick: () => void
}

export function ChatListItem({
  name,
  network,
  accountID,
  username,
  phoneNumber,
  lastMessage,
  lastMessageTime,
  unreadCount = 0,
  isSelected,
  onClick,
}: ChatListItemProps) {
  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Truncate message preview
  const truncatedMessage = lastMessage.length > 60 
    ? `${lastMessage.substring(0, 60)}...` 
    : lastMessage

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 transition-colors',
        'hover:bg-gray-50',
        isSelected && 'bg-blue-50 border-l-4 border-l-blue-500'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar placeholder */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
          {name.charAt(0).toUpperCase()}
        </div>

        {/* Chat info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 truncate">
                  {name}
                </h3>
                {(username || phoneNumber) && (
                  <p className="text-xs text-gray-500 truncate">
                    {username ? `@${username}` : phoneNumber}
                  </p>
                )}
              </div>
              {network && (
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded flex-shrink-0">
                  {network}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full flex-shrink-0">
                {unreadCount}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 truncate mb-1">
            {truncatedMessage}
          </p>

          <div className="flex items-center text-xs text-gray-500">
            <Clock className="w-3 h-3 mr-1" />
            {formatTime(lastMessageTime)}
          </div>
        </div>

        {/* Indicator */}
        <div className="flex-shrink-0">
          <MessageCircle 
            className={cn(
              'w-5 h-5',
              isSelected ? 'text-blue-500' : 'text-gray-400'
            )} 
          />
        </div>
      </div>
    </button>
  )
}

