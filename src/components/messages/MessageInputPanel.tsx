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
    <div className="flex-shrink-0 border-t-2 border-gray-300 p-4 bg-white shadow-sm">
      <PromptInput 
        onSubmit={handleSubmit} 
        className="w-full border-2 border-gray-300 rounded-lg shadow-sm hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all"
      >
        <PromptInputBody>
          <PromptInputTextarea
            placeholder="Type your reply..."
            value={messageInputValue}
            onChange={(e) => setMessageInputValue(e.target.value)}
            className="text-gray-900 placeholder:text-gray-500"
          />
        </PromptInputBody>
        <PromptInputToolbar>
          <PromptInputButton
            onClick={handleGenerateAI}
            disabled={isLoadingAI || isSending}
            className="gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            AI
          </PromptInputButton>
          <div className="flex gap-1">
            <PromptInputSubmit disabled={isSending} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onOpenInBeeper(messageInputValue)}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
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

