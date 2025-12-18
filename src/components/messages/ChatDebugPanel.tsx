import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Bug, X, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface ChatDebugPanelProps {
  chatId: string
  onClose: () => void
}

export function ChatDebugPanel({ chatId, onClose }: ChatDebugPanelProps) {
  const [copied, setCopied] = useState(false)
  
  // Get raw chat data from database
  const rawChat = useQuery(api.beeperQueries.getChatById, { chatId })

  const handleCopy = () => {
    if (rawChat) {
      navigator.clipboard.writeText(JSON.stringify(rawChat, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!rawChat) {
    return (
      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg m-2 text-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-yellow-400" />
            <span className="font-semibold text-yellow-400">Debug Panel</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0 text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-gray-400">Loading chat data...</p>
      </div>
    )
  }

  // Key fields to highlight
  const keyFields = [
    { label: 'Chat ID', value: rawChat.chatId, color: 'text-blue-400' },
    { label: 'Network', value: rawChat.network, color: 'text-green-400' },
    { label: 'Type', value: rawChat.type, color: 'text-purple-400' },
    { label: 'Title', value: rawChat.title, color: 'text-white' },
  ]

  const contactFields = [
    { label: 'Username', value: rawChat.username, color: 'text-cyan-400' },
    { label: 'Phone Number', value: rawChat.phoneNumber, color: 'text-cyan-400' },
    { label: 'Email', value: rawChat.email, color: 'text-cyan-400' },
    { label: 'Participant ID', value: rawChat.participantId, color: 'text-gray-400' },
    { label: 'Participant Name', value: rawChat.participantFullName, color: 'text-yellow-400' },
    { label: 'Participant Image URL', value: rawChat.participantImgURL, color: 'text-orange-400' },
  ]

  const statusFields = [
    { label: 'Unread Count', value: rawChat.unreadCount, color: 'text-red-400' },
    { label: 'Needs Reply', value: rawChat.needsReply ? 'Yes' : 'No', color: rawChat.needsReply ? 'text-red-400' : 'text-green-400' },
    { label: 'Last Message From', value: rawChat.lastMessageFrom, color: 'text-gray-300' },
    { label: 'Is Archived', value: rawChat.isArchived ? 'Yes' : 'No', color: 'text-gray-300' },
    { label: 'Last Synced', value: rawChat.lastSyncedAt ? new Date(rawChat.lastSyncedAt).toLocaleString() : 'Never', color: 'text-gray-400' },
  ]

  return (
    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg m-2 text-xs font-mono overflow-auto max-h-80">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-yellow-400" />
          <span className="font-semibold text-yellow-400 text-sm">Debug Panel</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCopy} 
            className="h-6 px-2 text-gray-400 hover:text-white text-xs"
          >
            {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
            {copied ? 'Copied!' : 'Copy JSON'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0 text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Key Info */}
      <div className="mb-3">
        <h3 className="text-gray-500 uppercase text-[10px] tracking-wider mb-1">Chat Info</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {keyFields.map(({ label, value, color }) => (
            <div key={label} className="flex">
              <span className="text-gray-500 w-20 flex-shrink-0">{label}:</span>
              <span className={`${color} truncate`} title={String(value || '')}>
                {value || <span className="text-gray-600 italic">null</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Contact/Participant Info */}
      <div className="mb-3">
        <h3 className="text-gray-500 uppercase text-[10px] tracking-wider mb-1">Contact / Participant Data</h3>
        <div className="space-y-1">
          {contactFields.map(({ label, value, color }) => (
            <div key={label} className="flex">
              <span className="text-gray-500 w-32 flex-shrink-0">{label}:</span>
              <span className={`${color} truncate flex-1`} title={String(value || '')}>
                {value || <span className="text-gray-600 italic">null</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Status Info */}
      <div className="mb-3">
        <h3 className="text-gray-500 uppercase text-[10px] tracking-wider mb-1">Status</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {statusFields.map(({ label, value, color }) => (
            <div key={label} className="flex">
              <span className="text-gray-500 w-28 flex-shrink-0">{label}:</span>
              <span className={color}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Last Message Preview */}
      <div className="mb-3">
        <h3 className="text-gray-500 uppercase text-[10px] tracking-wider mb-1">Last Message</h3>
        <div className="bg-gray-800 p-2 rounded text-gray-300 break-words max-h-20 overflow-auto">
          {rawChat.lastMessage || <span className="text-gray-600 italic">No message</span>}
        </div>
      </div>

      {/* Image Status */}
      <div className="pt-2 border-t border-gray-700">
        <h3 className="text-gray-500 uppercase text-[10px] tracking-wider mb-1">Image Status</h3>
        {rawChat.participantImgURL ? (
          <div className="text-green-400">
            ✅ Has source image URL (file://)
            <div className="text-gray-500 text-[10px] truncate mt-1" title={rawChat.participantImgURL}>
              {rawChat.participantImgURL}
            </div>
          </div>
        ) : (
          <div className="text-orange-400">
            ⚠️ No profile image URL from Beeper API
            <div className="text-gray-500 text-[10px] mt-1">
              {rawChat.network === 'iMessage' 
                ? 'iMessage does not provide profile images via Beeper'
                : 'This chat may not have a profile picture set, or sync did not capture it'
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
