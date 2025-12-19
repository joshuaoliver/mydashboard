import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  MoreHorizontal, 
  Trash2, 
  Check, 
  Loader2,
  Bold,
  Italic,
  List,
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2,
  FolderKanban,
} from 'lucide-react'
import { cn } from '~/lib/utils'

interface TodoDocument {
  _id: string
  title: string
  content: string
  projectId?: Id<"projects">
  todoCount: number
  completedCount: number
  createdAt: number
  updatedAt: number
}

interface TodoEditorProps {
  document: TodoDocument
  onSave: (content: string) => Promise<void>
  onUpdateTitle: (title: string) => Promise<void>
  onUpdateProject: (projectId: Id<"projects"> | undefined) => Promise<void>
  onDelete: () => Promise<void>
  isSaving: boolean
}

// Debounce time in milliseconds (1.5 seconds)
const SAVE_DEBOUNCE_MS = 1500

export function TodoEditor({
  document,
  onSave,
  onUpdateTitle,
  onUpdateProject,
  onDelete,
  isSaving,
}: TodoEditorProps) {
  const [title, setTitle] = useState(document.title)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string>(document.content)

  // Fetch projects for the dropdown
  const { data: projects } = useQuery(
    convexQuery(api.projectsStore.listActiveProjects, {})
  )

  // Parse initial content
  const initialContent = (() => {
    try {
      return JSON.parse(document.content)
    } catch {
      return { type: 'doc', content: [{ type: 'paragraph' }] }
    }
  })()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable the default list extensions since we're using TaskList
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex gap-2 items-start',
        },
      }),
      Placeholder.configure({
        placeholder: 'Start typing... Use the toolbar or type "[ ]" for a todo item',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-6 py-4',
      },
    },
    onUpdate: ({ editor }) => {
      // Debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      setSaveStatus('idle')

      saveTimeoutRef.current = setTimeout(async () => {
        const content = JSON.stringify(editor.getJSON())
        if (content !== lastSavedContentRef.current) {
          setSaveStatus('saving')
          await onSave(content)
          lastSavedContentRef.current = content
          setSaveStatus('saved')
          
          // Reset to idle after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000)
        }
      }, SAVE_DEBOUNCE_MS)
    },
  })

  // Update editor content when document changes (e.g., navigating to different doc)
  useEffect(() => {
    if (editor && document.content !== lastSavedContentRef.current) {
      try {
        const newContent = JSON.parse(document.content)
        editor.commands.setContent(newContent)
        lastSavedContentRef.current = document.content
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [document._id, document.content, editor])

  // Update title when document changes
  useEffect(() => {
    setTitle(document.title)
  }, [document._id, document.title])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleTitleBlur = useCallback(async () => {
    setIsEditingTitle(false)
    if (title !== document.title && title.trim()) {
      await onUpdateTitle(title.trim())
    } else if (!title.trim()) {
      setTitle(document.title)
    }
  }, [title, document.title, onUpdateTitle])

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleBlur()
    }
    if (e.key === 'Escape') {
      setTitle(document.title)
      setIsEditingTitle(false)
    }
  }

  const handleProjectChange = async (value: string) => {
    const projectId = value === 'none' ? undefined : value as Id<"projects">
    await onUpdateProject(projectId)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete()
    setIsDeleting(false)
    setDeleteDialogOpen(false)
  }

  // Find current project name
  const currentProject = projects?.find(p => p._id === document.projectId)

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Project selector */}
            <Select
              value={document.projectId ?? 'none'}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger className="w-[180px] h-8">
                <FolderKanban className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="No project">
                  {currentProject?.name ?? 'No project'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects?.map((project) => (
                  <SelectItem key={project._id} value={project._id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Title */}
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={handleTitleKeyDown}
                  autoFocus
                  className="text-xl font-semibold h-auto py-1 px-2 -mx-2"
                />
              ) : (
                <h1 
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xl font-semibold truncate cursor-pointer hover:text-muted-foreground transition-colors"
                >
                  {document.title}
                </h1>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {/* Save status */}
            <span className={cn(
              "text-sm flex items-center gap-1 transition-opacity",
              saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'
            )}>
              {saveStatus === 'saving' || isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <Check className="w-3 h-3 text-green-500" />
                  Saved
                </>
              ) : null}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => setIsEditingTitle(true)}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-6 py-2 border-b flex-shrink-0 bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(editor.isActive('bold') && 'bg-accent')}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(editor.isActive('italic') && 'bg-accent')}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(editor.isActive('heading', { level: 1 }) && 'bg-accent')}
          >
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(editor.isActive('heading', { level: 2 }) && 'bg-accent')}
          >
            <Heading2 className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(editor.isActive('bulletList') && 'bg-accent')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(editor.isActive('orderedList') && 'bg-accent')}
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={cn(editor.isActive('taskList') && 'bg-accent')}
          >
            <CheckSquare className="w-4 h-4" />
          </Button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{document.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
