import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  PromptInput, 
  PromptInputBody, 
  PromptInputTextarea, 
  PromptInputToolbar, 
  PromptInputSubmit,
  PromptInputButton,
} from '@/components/ai-elements/prompt-input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sparkles, MoreVertical, ExternalLink } from 'lucide-react'

interface SelectedChat {
  id: string
  name: string
}

interface MessageInputPanelProps {
  selectedChat: SelectedChat | null
  onSubmit: (text: string) => Promise<void>
  onGenerateAI: (customContext?: string) => Promise<void>
  onOpenInBeeper: (draftText?: string) => Promise<void>
  isLoadingAI: boolean
}

export function MessageInputPanel({
  selectedChat: _selectedChat,
  onSubmit,
  onGenerateAI,
  onOpenInBeeper,
  isLoadingAI,
}: MessageInputPanelProps) {
  // Local state - isolated from parent, prevents parent re-renders on typing
  const [messageInputValue, setMessageInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (message: { text?: string }) => {
    const text = (message.text || messageInputValue || '').trim()
    if (!text) return

    setIsSending(true)
    try {
      await onSubmit(text)
      // Clear input after successful send
      setMessageInputValue('')
    } finally {
      setIsSending(false)
    }
  }

  const handleGenerateAI = async () => {
    if (messageInputValue.trim()) {
      await onGenerateAI(messageInputValue)
    } else {
      await onGenerateAI()
    }
  }

  return (
    <div className="flex-shrink-0 border-t border-gray-200 px-2 py-1.5 bg-white">
      <PromptInput 
        onSubmit={handleSubmit} 
        className="w-full border border-gray-300 rounded-md hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-200 transition-all"
      >
        <PromptInputBody>
          <PromptInputTextarea
            placeholder="Type your reply..."
            value={messageInputValue}
            onChange={(e) => setMessageInputValue(e.target.value)}
            className="text-sm text-gray-900 placeholder:text-gray-500 min-h-[36px] max-h-24 py-1.5"
          />
        </PromptInputBody>
        <PromptInputToolbar className="py-0.5 px-1">
          <PromptInputButton
            onClick={handleGenerateAI}
            disabled={isLoadingAI || isSending}
            className="gap-1 h-7 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI
          </PromptInputButton>
          <div className="flex gap-0.5">
            <PromptInputSubmit disabled={isSending} className="h-7 w-7" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onOpenInBeeper(messageInputValue)}
                  className="text-xs"
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Send with Beeper
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </PromptInputToolbar>
      </PromptInput>
    </div>
  )
}

