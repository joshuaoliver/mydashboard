import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Check, Loader2 } from 'lucide-react'

interface ConversationTodosPanelProps {
  chatId: string
  chatName: string
  contactId?: Id<"contacts">
  // AI-suggested action item (may be undefined)
  actionItem?: string
}

export function ConversationTodosPanel({
  chatId,
  chatName,
  contactId,
  actionItem,
}: ConversationTodosPanelProps) {
  // Local state for the editable text
  const [text, setText] = useState(actionItem ?? '')
  const [isAdding, setIsAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  // Update text when AI suggestion changes (e.g., when switching chats)
  useEffect(() => {
    setText(actionItem ?? '')
    setJustAdded(false)
  }, [actionItem, chatId])

  const createQuickTodo = useMutation(api.todoItems.createQuickTodo)

  const handleAddTodo = async () => {
    if (!text.trim()) return

    setIsAdding(true)
    try {
      await createQuickTodo({
        text: text.trim(),
        chatId,
        contactId,
        contactName: chatName,
      })
      // Clear the field and show success
      setText('')
      setJustAdded(true)
      // Reset success state after a moment
      setTimeout(() => setJustAdded(false), 2000)
    } catch (err) {
      console.error('Failed to create todo:', err)
    } finally {
      setIsAdding(false)
    }
  }

  // Handle Enter key to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTodo()
    }
  }

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a todo from this conversation..."
          className="h-7 text-xs bg-white flex-1"
        />
        <Button
          size="sm"
          variant={justAdded ? "default" : "outline"}
          onClick={handleAddTodo}
          disabled={isAdding || !text.trim()}
          className="h-7 w-7 p-0 flex-shrink-0"
          title="Add to Quick Tasks"
        >
          {isAdding ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : justAdded ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}
