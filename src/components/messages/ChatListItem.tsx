import { cn } from '@/lib/utils'
import { Archive, ArchiveRestore } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatListItemProps {
  id: string
  name: string
  network?: string
  username?: string      // Instagram handle, etc.
  phoneNumber?: string   // WhatsApp number, etc.
  lastMessage: string
  lastMessageTime: number
  unreadCount?: number
  isSelected: boolean
  onClick: () => void
  onArchive?: (chatId: string) => void
  isArchived?: boolean
  contactImageUrl?: string // From DEX integration
}

export function ChatListItem({
  id,
  name,
  network,
  username,
  phoneNumber,
  lastMessage,
  lastMessageTime,
  unreadCount = 0,
  isSelected,
  onClick,
  onArchive,
  isArchived = false,
  contactImageUrl,
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
  const truncatedMessage = lastMessage.length > 80 
    ? `${lastMessage.substring(0, 80)}...` 
    : lastMessage

  const hasUnread = unreadCount > 0

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selecting the chat
    onArchive?.(id)
  }

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={cn(
          'w-full text-left px-4 py-3 transition-colors',
          'hover:bg-gray-50',
          isSelected && 'bg-blue-50 border-l-4 border-l-blue-500',
          hasUnread && !isSelected && 'bg-blue-50/30'
        )}
      >
      <div className="flex items-start gap-3">
        {/* Avatar with unread indicator - Use contact image if available */}
        <div className="flex-shrink-0 relative">
          {contactImageUrl ? (
            <img
              src={contactImageUrl}
              alt={name}
              className="w-10 h-10 rounded-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                // Fallback to initial if image fails to load
                const target = e.currentTarget;
                target.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold';
                fallback.textContent = name.charAt(0).toUpperCase();
                target.parentElement?.appendChild(fallback);
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          {hasUnread && (
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
          )}
        </div>

        {/* Chat info */}
        <div className="flex-1 min-w-0">
          {/* Header row: Name, network badge, time */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Name with username tooltip on hover */}
              <h3 
                className={cn(
                  "truncate text-sm",
                  hasUnread ? "font-bold text-gray-900" : "font-medium text-gray-700"
                )}
                title={username ? `@${username}` : phoneNumber || undefined}
              >
                {name}
              </h3>
              {network && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded flex-shrink-0">
                  {network}
                </span>
              )}
            </div>
            <span className={cn(
              "text-xs flex-shrink-0",
              hasUnread ? "font-semibold text-blue-600" : "text-gray-500"
            )}>
              {formatTime(lastMessageTime)}
            </span>
          </div>

          {/* Last message preview */}
          <div className="flex items-start gap-2">
            <p className={cn(
              "text-sm truncate flex-1",
              hasUnread ? "font-medium text-gray-900" : "text-gray-600"
            )}>
              {truncatedMessage}
            </p>
            {hasUnread && (
              <span className="px-1.5 py-0.5 text-xs font-bold bg-blue-500 text-white rounded-full flex-shrink-0 min-w-[20px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
      </button>
      
      {/* Archive button - shown on hover */}
      {onArchive && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleArchiveClick}
            className="h-8 w-8 p-0"
            title={isArchived ? "Unarchive chat" : "Archive chat"}
          >
            {isArchived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

