import { cn } from '@/lib/utils'
import { Archive, ArchiveRestore, Instagram, MessageCircle, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { memo } from 'react'

// Network icon component
function NetworkIcon({ network }: { network: string }) {
  const normalizedNetwork = network.toLowerCase()
  
  const iconClass = "w-3 h-3 text-gray-400"
  
  if (normalizedNetwork.includes('instagram')) {
    return <Instagram className={cn(iconClass, "text-pink-500")} />
  }
  if (normalizedNetwork.includes('whatsapp')) {
    return <MessageCircle className={cn(iconClass, "text-green-500")} />
  }
  if (normalizedNetwork.includes('sms') || normalizedNetwork.includes('imessage')) {
    return <Phone className={cn(iconClass, "text-blue-500")} />
  }
  if (normalizedNetwork.includes('email') || normalizedNetwork.includes('gmail')) {
    return <Mail className={cn(iconClass, "text-red-400")} />
  }
  // Fallback: show first letter
  return (
    <span className="w-3 h-3 text-[9px] font-medium text-gray-400 flex items-center justify-center">
      {network.charAt(0).toUpperCase()}
    </span>
  )
}

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
  onHover?: (chatId: string) => void  // Preload on hover
  onArchive?: (chatId: string) => void
  isArchived?: boolean
  contactImageUrl?: string // From DEX integration
}

export const ChatListItem = memo(function ChatListItem({
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
  onHover,
  onArchive,
  isArchived = false,
  contactImageUrl,
}: ChatListItemProps) {
  // Smart timestamp formatting
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    // Today: show time like "2:34 PM"
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    }
    // Yesterday
    if (diffDays === 1 || (diffDays === 0 && date.getDate() !== now.getDate())) {
      return 'Yesterday'
    }
    // Within this week: show day name
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    }
    // Older: show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const hasUnread = unreadCount > 0

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selecting the chat
    onArchive?.(id)
  }

  const handleMouseEnter = () => {
    onHover?.(id)
  }

  return (
    <div className="relative group w-full overflow-hidden" onMouseEnter={handleMouseEnter}>
      <button
        onClick={onClick}
        className={cn(
          'w-full text-left px-3 py-2.5 transition-colors block',
          'hover:bg-gray-50',
          isSelected && 'border-l-4 border-l-blue-500 bg-blue-50/50',
          hasUnread && !isSelected && 'bg-blue-50/30'
        )}
      >
        <div className="flex items-start gap-2.5 w-full">
          {/* Avatar with unread indicator - Use contact image if available */}
          <div className="flex-shrink-0 relative">
            {contactImageUrl ? (
              <img
                src={contactImageUrl}
                alt={name}
                className="w-9 h-9 rounded-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  // Fallback to initial if image fails to load
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = document.createElement('div');
                  fallback.className = 'w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm';
                  fallback.textContent = name.charAt(0).toUpperCase();
                  target.parentElement?.appendChild(fallback);
                }}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white font-semibold text-sm">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            {hasUnread && (
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white"></div>
            )}
          </div>

          {/* Chat info - use explicit width calculation */}
          <div className="flex-1 min-w-0 w-0">
            {/* Header row: Name + Timestamp + Network icon on right */}
            <div className="flex items-start justify-between gap-1 w-full">
              {/* Name */}
              <h3 
                className={cn(
                  "truncate text-sm leading-tight flex-1 min-w-0",
                  hasUnread ? "font-semibold text-gray-900" : "font-normal text-gray-700"
                )}
                title={username ? `@${username}` : phoneNumber || undefined}
              >
                {name}
              </h3>
              {/* Timestamp + Network icon on right */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={cn(
                  "text-[10px] leading-tight whitespace-nowrap",
                  hasUnread ? "font-medium text-blue-600" : "text-gray-400"
                )}>
                  {formatTime(lastMessageTime)}
                </span>
                {network && (
                  <span title={network}>
                    <NetworkIcon network={network} />
                  </span>
                )}
              </div>
            </div>

            {/* Last message preview - smaller text, never bold */}
            <div className="flex items-center gap-1.5 mt-0.5 w-full">
              <p className="text-xs truncate flex-1 min-w-0 leading-snug text-gray-500">
                {lastMessage}
              </p>
              {hasUnread && (
                <span className="px-1 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full flex-shrink-0 min-w-[16px] text-center leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
      
      {/* Archive button - shown on hover */}
      {onArchive && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleArchiveClick}
            className="h-7 w-7 p-0"
            title={isArchived ? "Unarchive chat" : "Archive chat"}
          >
            {isArchived ? (
              <ArchiveRestore className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
})

