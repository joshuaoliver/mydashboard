import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useAction, useQuery as useConvexQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { FullWidthContent } from '@/components/layout/full-width-content'
import {
  Loader2,
  Play,
  Pause,
  Square,
  Shuffle,
  Clock,
  CheckCircle2,
  Calendar,
  ListTodo,
  Zap,
  Plus,
  X,
  Timer,
  Coffee,
  Dumbbell,
  Car,
  ShoppingBag,
  Mail,
  ExternalLink,
  RefreshCw,
  Brain,
  Sparkles,
  TrendingUp,
  MessageSquare,
  CalendarPlus,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/today-plan')({
  component: TodayPlanPage,
})

// ==========================================
// Helper Functions
// ==========================================

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatTimerDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function getLifeItemIcon(text: string) {
  const lower = text.toLowerCase()
  if (lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('coffee')) {
    return Coffee
  }
  if (lower.includes('gym') || lower.includes('workout') || lower.includes('exercise')) {
    return Dumbbell
  }
  if (lower.includes('drive') || lower.includes('commute') || lower.includes('pick up')) {
    return Car
  }
  if (lower.includes('groceries') || lower.includes('shopping') || lower.includes('errand')) {
    return ShoppingBag
  }
  return Clock
}

function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1: return 'text-red-500 bg-red-50 border-red-200'
    case 2: return 'text-orange-500 bg-orange-50 border-orange-200'
    case 3: return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    default: return 'text-gray-500 bg-gray-50 border-gray-200'
  }
}

// ==========================================
// Types
// ==========================================

interface FreeBlock {
  id: string
  startTime: number
  endTime: number
  duration: number
  label?: string
}

interface WorkItem {
  type: 'todo' | 'linear' | 'adhoc' | 'email'
  id: string
  title: string
  priority: number
  priorityLabel?: string
  estimatedDuration: number
  dueDate?: string
  source?: Record<string, unknown>
  status?: string
}

interface BlockSuggestion {
  taskType: string
  taskId: string
  taskTitle: string
  suggestedDuration: number
  confidence: number
  reason: string
}

// ==========================================
// Components
// ==========================================

interface FreeBlockCardProps {
  block: FreeBlock
  suggestions: BlockSuggestion[]
  isLoadingSuggestions: boolean
  onStart: (suggestion: BlockSuggestion) => void
  onShuffle: () => void
  onFrog: () => void
}

function getTimeOfDayInfo(timestamp: number) {
  const hour = new Date(timestamp).getHours()
  if (hour < 12) return { label: 'Morning', icon: Sun, color: 'from-amber-400/20 to-orange-400/10', borderColor: 'border-amber-200/50' }
  if (hour < 17) return { label: 'Afternoon', icon: Sunset, color: 'from-blue-400/20 to-indigo-400/10', borderColor: 'border-blue-200/50' }
  return { label: 'Evening', icon: Moon, color: 'from-purple-400/20 to-indigo-400/10', borderColor: 'border-purple-200/50' }
}

function FreeBlockCard({
  block,
  suggestions,
  isLoadingSuggestions,
  onStart,
  onShuffle,
  onFrog,
}: FreeBlockCardProps) {
  const now = Date.now()
  const isPast = block.endTime < now
  const isCurrent = block.startTime <= now && block.endTime > now
  const isFuture = block.startTime > now
  const timeInfo = getTimeOfDayInfo(block.startTime)
  const TimeIcon = timeInfo.icon

  // Calculate visual "size" based on duration
  const blockHeight = Math.max(120, Math.min(280, block.duration * 2))

  return (
    <div
      className={cn(
        "relative group rounded-xl border-2 transition-all duration-300 overflow-hidden",
        isPast && "opacity-40 grayscale",
        isCurrent && "ring-2 ring-emerald-500 ring-offset-2 border-emerald-300 shadow-lg shadow-emerald-100",
        isFuture && timeInfo.borderColor,
        !isCurrent && !isPast && "hover:shadow-md hover:border-primary/30"
      )}
      style={{ minHeight: blockHeight }}
    >
      {/* Background gradient based on time of day */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-60",
        isPast ? "from-gray-100 to-gray-50" : timeInfo.color
      )} />

      {/* Decorative side bar indicating status */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1",
        isCurrent && "bg-emerald-500",
        isPast && "bg-gray-300",
        isFuture && "bg-gradient-to-b from-primary/60 to-primary/20"
      )} />

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              isCurrent && "bg-emerald-100 text-emerald-600",
              isPast && "bg-gray-100 text-gray-400",
              isFuture && "bg-white/80 text-primary shadow-sm"
            )}>
              {isCurrent ? (
                <Play className="w-5 h-5 animate-pulse" />
              ) : (
                <TimeIcon className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-lg font-semibold tabular-nums",
                  isCurrent && "text-emerald-700",
                  isPast && "text-gray-500"
                )}>
                  {formatTime(block.startTime)}
                </span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className={cn(
                  "text-lg font-semibold tabular-nums",
                  isCurrent && "text-emerald-700",
                  isPast && "text-gray-500"
                )}>
                  {formatTime(block.endTime)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "font-medium",
                    isCurrent && "bg-emerald-100 text-emerald-700",
                    isFuture && "bg-white/80"
                  )}
                >
                  {formatDuration(block.duration)} available
                </Badge>
                {isCurrent && (
                  <Badge className="bg-emerald-500 text-white text-xs animate-pulse">
                    Now
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {block.label && (
            <span className="text-xs text-muted-foreground bg-background/60 px-2 py-1 rounded">
              {block.label}
            </span>
          )}
        </div>

        {/* Suggestions */}
        <div className="mt-4">
          {isLoadingSuggestions ? (
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Finding best tasks...</span>
              </div>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-6 bg-white/40 rounded-lg border border-dashed border-muted-foreground/20">
              <Zap className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No tasks fit this time block
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {suggestions.slice(0, 3).map((suggestion, idx) => (
                <button
                  key={`${suggestion.taskId}-${idx}`}
                  onClick={() => onStart(suggestion)}
                  disabled={isPast}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border text-left",
                    "transition-all duration-200",
                    idx === 0 
                      ? "bg-white border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50" 
                      : "bg-white/60 border-transparent hover:bg-white hover:border-muted-foreground/20",
                    isPast && "pointer-events-none"
                  )}
                >
                  {/* Task rank indicator */}
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                    idx === 0 && "bg-primary text-primary-foreground",
                    idx === 1 && "bg-muted text-muted-foreground",
                    idx === 2 && "bg-muted/50 text-muted-foreground/80"
                  )}>
                    {idx + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs capitalize h-5",
                          suggestion.taskType === 'linear' && "bg-violet-50 text-violet-700 border-violet-200",
                          suggestion.taskType === 'todo' && "bg-blue-50 text-blue-700 border-blue-200",
                          suggestion.taskType === 'email' && "bg-sky-50 text-sky-700 border-sky-200"
                        )}
                      >
                        {suggestion.taskType}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">
                        {formatDuration(suggestion.suggestedDuration)}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{suggestion.taskTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">{suggestion.reason}</p>
                  </div>
                  
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                    idx === 0 
                      ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    <Play className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className={cn(
          "flex gap-2 mt-4 pt-4 border-t border-muted-foreground/10",
          isPast && "opacity-50"
        )}>
          <Button
            variant="default"
            size="sm"
            className="flex-1 shadow-sm"
            onClick={() => suggestions[0] && onStart(suggestions[0])}
            disabled={suggestions.length === 0 || isPast}
          >
            <Play className="w-4 h-4 mr-1.5" />
            Start Top Pick
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onShuffle}
            disabled={isPast}
            className="bg-white/80"
            title="Shuffle suggestions"
          >
            <Shuffle className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onFrog}
            disabled={isPast}
            className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            title="Eat the frog - tackle hardest task"
          >
            🐸
          </Button>
        </div>
      </div>
    </div>
  )
}

interface WorkPoolSidebarProps {
  workItems: WorkItem[]
  adhocItems: Array<{
    _id: Id<"adhocItems">
    text: string
    estimatedDuration?: number
    isCompleted: boolean
  }>
  isLoading: boolean
  onAddAdhoc: (text: string) => void
  onToggleAdhoc: (id: Id<"adhocItems">) => void
  onDeleteAdhoc: (id: Id<"adhocItems">) => void
  frogTaskId?: string
  onSetFrog: (taskId: string | undefined) => void
}

function WorkPoolPanel({
  workItems,
  adhocItems,
  isLoading,
  onAddAdhoc,
  onToggleAdhoc,
  onDeleteAdhoc,
  frogTaskId,
  onSetFrog,
}: WorkPoolSidebarProps) {
  const [newAdhocText, setNewAdhocText] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'todos' | 'linear' | 'life'>('all')

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return workItems
    if (activeTab === 'todos') return workItems.filter(w => w.type === 'todo')
    if (activeTab === 'linear') return workItems.filter(w => w.type === 'linear')
    return []
  }, [workItems, activeTab])

  const handleAddAdhoc = () => {
    if (newAdhocText.trim()) {
      onAddAdhoc(newAdhocText.trim())
      setNewAdhocText('')
    }
  }

  return (
    <div className="h-full flex flex-col bg-muted/20">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-primary" />
          Work Pool
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Tasks available for today
        </p>
      </div>

      {/* Filter tabs */}
      <div className="p-2 border-b">
        <div className="flex rounded-lg bg-muted/50 p-0.5">
          {(['all', 'todos', 'linear', 'life'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                activeTab === tab
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Life items section (ad-hoc) */}
      {activeTab === 'life' || activeTab === 'all' ? (
        <div className="p-3 border-b bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 mb-2">
            <Coffee className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Life Items
            </span>
          </div>

          {/* Add new adhoc item */}
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="Add: breakfast, gym, lunch..."
              value={newAdhocText}
              onChange={(e) => setNewAdhocText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAdhoc()}
              className="h-8 text-sm bg-background"
            />
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleAddAdhoc}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Adhoc items list */}
          <div className="space-y-1">
            {adhocItems.map((item) => {
              const Icon = getLifeItemIcon(item.text)
              return (
                <div
                  key={item._id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md bg-background/50 text-sm",
                    item.isCompleted && "opacity-50 line-through"
                  )}
                >
                  <button onClick={() => onToggleAdhoc(item._id)}>
                    {item.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Icon className="w-4 h-4 text-amber-600" />
                    )}
                  </button>
                  <span className="flex-1 truncate">{item.text}</span>
                  {item.estimatedDuration && (
                    <Badge variant="secondary" className="text-xs">
                      {item.estimatedDuration}m
                    </Badge>
                  )}
                  <button
                    onClick={() => onDeleteAdhoc(item._id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Work items list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tasks available
            </p>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "group flex items-start gap-2 p-2 rounded-lg border bg-background",
                  "hover:bg-accent/50 transition-colors",
                  frogTaskId === item.id && "ring-2 ring-amber-400 bg-amber-50/50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs capitalize h-5",
                        item.type === 'linear' && getPriorityColor(item.priority)
                      )}
                    >
                      {item.type === 'linear' ? item.priorityLabel ?? 'Linear' :
                       item.type === 'todo' ? 'Todo' : item.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ~{formatDuration(item.estimatedDuration)}
                    </span>
                    {item.dueDate && (
                      <Badge variant="destructive" className="text-xs h-4">
                        Due
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.source && 'identifier' in item.source && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.source.identifier as string}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-6 w-6",
                      frogTaskId === item.id && "text-amber-600"
                    )}
                    onClick={() => onSetFrog(frogTaskId === item.id ? undefined : item.id)}
                    title={frogTaskId === item.id ? "Remove frog" : "Set as frog"}
                  >
                    🐸
                  </Button>
                  {item.type === 'linear' && item.source && 'url' in item.source && (
                    <a
                      href={item.source.url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-6 w-6 flex items-center justify-center hover:bg-accent rounded"
                    >
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Email blocks section */}
      <div className="p-3 border-t bg-blue-50/50 dark:bg-blue-950/20 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            Email Blocks
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[
            { title: 'Triage inbox', duration: 20 },
            { title: 'Reply to 5', duration: 15 },
            { title: 'Clear flagged', duration: 30 },
            { title: 'Deep admin', duration: 45 },
          ].map((block) => (
            <button
              key={block.title}
              className="text-left p-2 rounded-md bg-background/50 hover:bg-background text-xs"
            >
              <span className="font-medium">{block.title}</span>
              <span className="text-muted-foreground ml-1">({block.duration}m)</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface TimerDialogProps {
  isOpen: boolean
  session: {
    taskTitle: string
    taskType: string
    mode: 'normal' | 'frog'
    targetDuration: number
    startedAt: number
    pausedAt?: number
  } | null
  onPause: () => void
  onResume: () => void
  onComplete: (result: 'completed' | 'partial' | 'skipped', note?: string) => void
  onSwap: () => void
}

function TimerDialog({ isOpen, session, onPause, onResume, onComplete, onSwap }: TimerDialogProps) {
  const [elapsed, setElapsed] = useState(0)
  const [resultNote, setResultNote] = useState('')
  const [showWrapUp, setShowWrapUp] = useState(false)

  useEffect(() => {
    if (!session || session.pausedAt) return

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsedSeconds = Math.floor((now - session.startedAt) / 1000)
      setElapsed(elapsedSeconds)

      // Check if timer completed
      if (elapsedSeconds >= session.targetDuration * 60) {
        setShowWrapUp(true)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [session])

  if (!session) return null

  const remaining = Math.max(0, session.targetDuration * 60 - elapsed)
  const progress = Math.min(100, (elapsed / (session.targetDuration * 60)) * 100)

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        {showWrapUp ? (
          <>
            <DialogHeader>
              <DialogTitle>Block Complete</DialogTitle>
              <DialogDescription>
                How did it go with "{session.taskTitle}"?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-green-200 hover:bg-green-50 text-green-700"
                  onClick={() => onComplete('completed', resultNote)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Done
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-yellow-200 hover:bg-yellow-50 text-yellow-700"
                  onClick={() => onComplete('partial', resultNote)}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Partial
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 hover:bg-red-50 text-red-700"
                  onClick={() => onComplete('skipped', resultNote)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Skipped
                </Button>
              </div>
              <Input
                placeholder="Optional note: what happened?"
                value={resultNote}
                onChange={(e) => setResultNote(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {session.mode === 'frog' && <span>🐸</span>}
                <Timer className="w-5 h-5" />
                {session.mode === 'frog' ? 'Frog Mode' : 'Focus Session'}
              </DialogTitle>
              <DialogDescription>
                {session.taskTitle}
              </DialogDescription>
            </DialogHeader>
            <div className="py-8">
              {/* Timer display */}
              <div className="text-center">
                <div className="text-6xl font-mono font-bold mb-4">
                  {formatTimerDisplay(remaining)}
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-1000",
                      session.mode === 'frog' ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {formatDuration(Math.ceil(remaining / 60))} remaining
                </p>
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={onSwap}>
                <Shuffle className="w-4 h-4 mr-2" />
                Swap Task
              </Button>
              {session.pausedAt ? (
                <Button onClick={onResume}>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              ) : (
                <Button variant="secondary" onClick={onPause}>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}
              <Button
                variant="default"
                onClick={() => setShowWrapUp(true)}
              >
                <Square className="w-4 h-4 mr-2" />
                End
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ==========================================
// Energy Context Component
// ==========================================

interface EnergyContextBarProps {
  context: {
    morningContext?: string
    contextNotes: Array<{ text: string; timestamp: number }>
    inferredEnergy?: 'low' | 'medium' | 'high'
    inferredFocus?: 'scattered' | 'moderate' | 'deep'
  } | null
  onSetMorningContext: (text: string) => void
  onAddNote: (text: string) => void
}

function EnergyContextBar({ context, onSetMorningContext, onAddNote }: EnergyContextBarProps) {
  const [morningInput, setMorningInput] = useState(context?.morningContext ?? '')
  const [noteInput, setNoteInput] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSaveMorning = () => {
    if (morningInput.trim()) {
      onSetMorningContext(morningInput.trim())
      setIsEditing(false)
      setIsExpanded(false)
    }
  }

  const handleAddNote = () => {
    if (noteInput.trim()) {
      onAddNote(noteInput.trim())
      setNoteInput('')
    }
  }

  const getEnergyBadge = () => {
    if (!context?.inferredEnergy) return null
    const colors = {
      low: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      high: 'bg-green-100 text-green-700 border-green-200',
    }
    return (
      <Badge variant="outline" className={cn("capitalize text-xs", colors[context.inferredEnergy])}>
        {context.inferredEnergy}
      </Badge>
    )
  }

  const getFocusBadge = () => {
    if (!context?.inferredFocus) return null
    const colors = {
      scattered: 'bg-red-100 text-red-700 border-red-200',
      moderate: 'bg-blue-100 text-blue-700 border-blue-200',
      deep: 'bg-purple-100 text-purple-700 border-purple-200',
    }
    return (
      <Badge variant="outline" className={cn("capitalize text-xs", colors[context.inferredFocus])}>
        {context.inferredFocus}
      </Badge>
    )
  }

  // Compact inline view for the header
  if (!isExpanded && !isEditing) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => context?.morningContext ? setIsExpanded(true) : setIsEditing(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          <Brain className="w-4 h-4 text-primary" />
          {context?.morningContext ? (
            <>
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                {context.morningContext}
              </span>
              {getEnergyBadge()}
              {getFocusBadge()}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Set context...</span>
          )}
        </button>
        {context?.morningContext && (
          <div className="flex items-center gap-1">
            <Input
              placeholder="Quick note..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              className="h-7 w-32 text-xs"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddNote}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Expanded / editing view (as a popover-style card)
  return (
    <div className="absolute top-full left-0 right-0 mt-2 z-50 px-6">
      <Card className="border shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 space-y-2">
              {isEditing || !context?.morningContext ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="How are you feeling today? What's your energy like? (e.g., 'Slept poorly, feeling scattered but have a big deadline')"
                    value={morningInput}
                    onChange={(e) => setMorningInput(e.target.value)}
                    className="min-h-[60px] text-sm resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveMorning} disabled={!morningInput.trim()}>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Set Context
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setIsExpanded(false) }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm">{context.morningContext}</p>
                      <div className="flex gap-2 mt-2">
                        {getEnergyBadge()}
                        {getFocusBadge()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="text-xs"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(false)}
                        className="text-xs"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {/* Recent notes */}
                  {context.contextNotes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {context.contextNotes.slice(-5).map((note, i) => (
                        <Badge key={i} variant="secondary" className="text-xs font-normal">
                          <MessageSquare className="w-2 h-2 mr-1" />
                          {note.text}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {/* Quick note input */}
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Add a note... (e.g., 'just had coffee', 'energy dropping')"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                      className="h-8 text-xs"
                    />
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleAddNote}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==========================================
// Momentum Bar Component
// ==========================================

interface MomentumBarProps {
  momentum: {
    blocksStarted: number
    blocksCompleted: number
    blocksPartial: number
    blocksSkipped: number
    frogAttempts: number
    frogCompletions: number
    totalMinutesWorked: number
  } | null
}

function MomentumBar({ momentum }: MomentumBarProps) {
  if (!momentum) return null

  const total = momentum.blocksCompleted + momentum.blocksPartial + momentum.blocksSkipped
  const completionRate = total > 0 ? Math.round((momentum.blocksCompleted / total) * 100) : 0

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium">Today's Momentum</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>{momentum.blocksCompleted} done</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>{momentum.blocksPartial} partial</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>{momentum.blocksSkipped} skipped</span>
        </div>
        {momentum.frogAttempts > 0 && (
          <div className="flex items-center gap-1">
            <span>🐸</span>
            <span>{momentum.frogCompletions}/{momentum.frogAttempts}</span>
          </div>
        )}
        <div className="ml-2 px-2 py-0.5 bg-primary/10 rounded">
          <span className="font-medium">{completionRate}%</span>
        </div>
        <div className="text-muted-foreground">
          {Math.round(momentum.totalMinutesWorked)}m worked
        </div>
      </div>
    </div>
  )
}

// ==========================================
// Floating Execution Header
// ==========================================

interface ExecutionHeaderProps {
  session: {
    taskTitle: string
    taskType: string
    mode: 'normal' | 'frog'
    startedAt: number
    targetDuration: number
    pausedAt?: number
  } | null
  onPause: () => void
  onResume: () => void
  onEnd: () => void
}

function ExecutionHeader({ session, onPause, onResume, onEnd }: ExecutionHeaderProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!session || session.pausedAt) return

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [session, session?.pausedAt])

  if (!session) return null

  const remaining = Math.max(0, session.targetDuration * 60 - elapsed)
  const progress = Math.min(100, (elapsed / (session.targetDuration * 60)) * 100)

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50",
      "bg-background/95 backdrop-blur border-b shadow-lg",
      session.mode === 'frog' && "bg-amber-50/95 dark:bg-amber-950/95"
    )}>
      <div className="max-w-screen-2xl mx-auto px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Timer display */}
          <div className={cn(
            "text-2xl font-mono font-bold",
            session.mode === 'frog' ? "text-amber-600" : "text-primary"
          )}>
            {formatTimerDisplay(remaining)}
          </div>

          {/* Progress bar */}
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-1000",
                session.mode === 'frog' ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Task info */}
          <div className="flex items-center gap-2">
            {session.mode === 'frog' && <span className="text-lg">🐸</span>}
            <div>
              <Badge variant="outline" className="text-xs capitalize mr-2">
                {session.taskType}
              </Badge>
              <span className="text-sm font-medium">{session.taskTitle}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {session.pausedAt ? (
              <Button size="sm" onClick={onResume}>
                <Play className="w-4 h-4 mr-1" />
                Resume
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onPause}>
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </Button>
            )}
            <Button size="sm" variant="default" onClick={onEnd}>
              <Square className="w-4 h-4 mr-1" />
              End
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// Main Page Component
// ==========================================

function TodayPlanPage() {
  // State
  const [activeSession, setActiveSession] = useState<{
    id?: Id<"timerSessions">
    taskTitle: string
    taskType: string
    taskId: string
    mode: 'normal' | 'frog'
    targetDuration: number
    startedAt: number
    pausedAt?: number
  } | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, BlockSuggestion[]>>({})
  const [loadingBlocks, setLoadingBlocks] = useState<Set<string>>(new Set())

  // Queries - using Convex's native useQuery with "skip" for conditional queries
  const plan = useConvexQuery(api.todayPlan.getTodayPlan, {})
  const planLoading = plan === undefined

  const workPool = useConvexQuery(
    api.todayPlan.getWorkPool,
    plan?._id ? { planId: plan._id } : "skip"
  )
  const workPoolLoading = workPool === undefined

  const adhocItems = useConvexQuery(
    api.todayPlan.listAdhocItems,
    plan?._id ? { planId: plan._id } : "skip"
  )

  const calendarEvents = useConvexQuery(api.googleCalendar.getTodayEvents, {})

  // Energy context & momentum queries
  const energyContext = useConvexQuery(api.operatorAI.getTodayContext, {})

  const momentum = useConvexQuery(api.operatorAI.getTodayMomentum, {})

  // Mutations
  const getOrCreatePlan = useMutation(api.todayPlan.getOrCreateTodayPlan)
  const refreshFreeBlocks = useMutation(api.todayPlan.refreshFreeBlocks)
  const addAdhocItem = useMutation(api.todayPlan.addAdhocItem)
  const updateAdhocItem = useMutation(api.todayPlan.updateAdhocItem)
  const deleteAdhocItem = useMutation(api.todayPlan.deleteAdhocItem)
  const setFrogTask = useMutation(api.todayPlan.setFrogTask)
  const startTimerSession = useMutation(api.todayPlan.startTimerSession)
  const pauseTimerSession = useMutation(api.todayPlan.pauseTimerSession)
  const resumeTimerSession = useMutation(api.todayPlan.resumeTimerSession)
  const endTimerSession = useMutation(api.todayPlan.endTimerSession)
  const setMorningContext = useMutation(api.operatorAI.setMorningContext)
  const addContextNote = useMutation(api.operatorAI.addContextNote)
  const incrementMomentum = useMutation(api.operatorAI.incrementMomentum)

  // Actions
  const generateSuggestions = useAction(api.todayPlanAI.generateBlockSuggestions)
  const getShuffled = useAction(api.todayPlanAI.getShuffledTask)
  const getFrog = useAction(api.todayPlanAI.getFrogSuggestion)
  const getWeightedSuggestion = useAction(api.operatorAI.getWeightedSuggestion)

  // Initialize plan on mount
  useEffect(() => {
    if (!plan && !planLoading) {
      getOrCreatePlan({})
    }
  }, [plan, planLoading, getOrCreatePlan])

  // Load suggestions for blocks
  useEffect(() => {
    if (!plan?._id || !plan.freeBlocks.length) return

    plan.freeBlocks.forEach((block) => {
      if (!suggestions[block.id] && !loadingBlocks.has(block.id)) {
        setLoadingBlocks((prev) => new Set(prev).add(block.id))
        generateSuggestions({ planId: plan._id, blockId: block.id })
          .then((result) => {
            setSuggestions((prev) => ({ ...prev, [block.id]: result }))
          })
          .finally(() => {
            setLoadingBlocks((prev) => {
              const next = new Set(prev)
              next.delete(block.id)
              return next
            })
          })
      }
    })
  }, [plan, suggestions, loadingBlocks, generateSuggestions])

  // Handlers
  const handleStart = useCallback(async (suggestion: BlockSuggestion, blockId: string) => {
    if (!plan) return

    const sessionId = await startTimerSession({
      planId: plan._id,
      blockId,
      taskType: suggestion.taskType,
      taskId: suggestion.taskId,
      taskTitle: suggestion.taskTitle,
      mode: 'normal',
      targetDuration: suggestion.suggestedDuration,
    })

    // Track momentum
    await incrementMomentum({ field: 'blocksStarted' })

    setActiveSession({
      id: sessionId,
      taskTitle: suggestion.taskTitle,
      taskType: suggestion.taskType,
      taskId: suggestion.taskId,
      mode: 'normal',
      targetDuration: suggestion.suggestedDuration,
      startedAt: Date.now(),
    })
  }, [plan, startTimerSession, incrementMomentum])

  const handleShuffle = useCallback(async (blockId: string) => {
    if (!plan) return

    const currentSuggestions = suggestions[blockId] || []
    const excludeIds = currentSuggestions.map((s) => s.taskId)

    const shuffled = await getShuffled({
      planId: plan._id,
      blockId,
      excludeTaskIds: excludeIds,
    })

    if (shuffled) {
      setSuggestions((prev) => ({
        ...prev,
        [blockId]: [shuffled, ...currentSuggestions.slice(0, 2)],
      }))
    }
  }, [plan, suggestions, getShuffled])

  const handleFrog = useCallback(async (blockId: string) => {
    if (!plan) return

    const block = plan.freeBlocks.find((b) => b.id === blockId)
    if (!block) return

    const frogSuggestion = await getFrog({
      planId: plan._id,
      blockDuration: block.duration,
    })

    if (frogSuggestion) {
      const sessionId = await startTimerSession({
        planId: plan._id,
        blockId,
        taskType: frogSuggestion.taskType,
        taskId: frogSuggestion.taskId,
        taskTitle: frogSuggestion.taskTitle,
        mode: 'frog',
        targetDuration: frogSuggestion.suggestedDuration,
      })

      // Track frog attempt and block start
      await incrementMomentum({ field: 'blocksStarted' })
      await incrementMomentum({ field: 'frogAttempts' })

      setActiveSession({
        id: sessionId,
        taskTitle: frogSuggestion.taskTitle,
        taskType: frogSuggestion.taskType,
        taskId: frogSuggestion.taskId,
        mode: 'frog',
        targetDuration: frogSuggestion.suggestedDuration,
        startedAt: Date.now(),
      })
    }
  }, [plan, getFrog, startTimerSession, incrementMomentum])

  const handlePause = useCallback(async () => {
    if (!activeSession?.id) return
    await pauseTimerSession({ id: activeSession.id })
    setActiveSession((prev) => prev ? { ...prev, pausedAt: Date.now() } : null)
  }, [activeSession, pauseTimerSession])

  const handleResume = useCallback(async () => {
    if (!activeSession?.id) return
    await resumeTimerSession({ id: activeSession.id })
    setActiveSession((prev) => prev ? { ...prev, pausedAt: undefined } : null)
  }, [activeSession, resumeTimerSession])

  const handleComplete = useCallback(async (
    result: 'completed' | 'partial' | 'skipped',
    note?: string
  ) => {
    if (!activeSession?.id) return
    await endTimerSession({ id: activeSession.id, result, resultNote: note })

    // Track momentum based on result
    if (result === 'completed') {
      await incrementMomentum({ field: 'blocksCompleted' })
      if (activeSession.mode === 'frog') {
        await incrementMomentum({ field: 'frogCompletions' })
      }
    } else if (result === 'partial') {
      await incrementMomentum({ field: 'blocksPartial' })
    } else if (result === 'skipped') {
      await incrementMomentum({ field: 'blocksSkipped' })
    }

    setActiveSession(null)
  }, [activeSession, endTimerSession, incrementMomentum])

  const handleAddAdhoc = useCallback(async (text: string) => {
    if (!plan) return
    await addAdhocItem({ planId: plan._id, text })
  }, [plan, addAdhocItem])

  const handleToggleAdhoc = useCallback(async (id: Id<"adhocItems">) => {
    const item = adhocItems?.find((i) => i._id === id)
    if (item) {
      await updateAdhocItem({ id, isCompleted: !item.isCompleted })
    }
  }, [adhocItems, updateAdhocItem])

  const handleDeleteAdhoc = useCallback(async (id: Id<"adhocItems">) => {
    await deleteAdhocItem({ id })
  }, [deleteAdhocItem])

  const handleSetFrog = useCallback(async (taskId: string | undefined) => {
    if (!plan) return
    await setFrogTask({ planId: plan._id, taskId })
  }, [plan, setFrogTask])

  const handleRefreshBlocks = useCallback(async () => {
    if (!plan) return
    await refreshFreeBlocks({ planId: plan._id })
    // Clear cached suggestions
    setSuggestions({})
  }, [plan, refreshFreeBlocks])

  // Energy context handlers
  const handleSetMorningContext = useCallback(async (text: string) => {
    await setMorningContext({ context: text })
  }, [setMorningContext])

  const handleAddContextNote = useCallback(async (text: string) => {
    await addContextNote({ note: text })
  }, [addContextNote])

  // Weighted suggestion shuffle (using the new AI system)
  const handleSmartShuffle = useCallback(async (blockId: string) => {
    if (!plan) return

    const block = plan.freeBlocks.find(b => b.id === blockId)
    if (!block) return

    const currentSuggestions = suggestions[blockId] || []
    const excludeIds = currentSuggestions.map(s => s.taskId)

    const result = await getWeightedSuggestion({
      blockDuration: block.duration,
      excludeTaskIds: excludeIds,
    })

    if (result.task) {
      const newSuggestion: BlockSuggestion = {
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        taskTitle: result.task.taskTitle,
        suggestedDuration: result.task.duration,
        confidence: result.task.weight / 100,
        reason: result.task.reason,
      }
      setSuggestions(prev => ({
        ...prev,
        [blockId]: [newSuggestion, ...currentSuggestions.slice(0, 2)],
      }))
    }
  }, [plan, suggestions, getWeightedSuggestion])

  // Get calendar settings to check if connected
  const calendarSettings = useConvexQuery(api.googleCalendar.getSettings, {})
  const isCalendarConnected = calendarSettings?.isConfigured === true

  // Loading state
  if (planLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <FullWidthContent className={cn(activeSession && "pt-16")}>
      {/* Floating Execution Header */}
      <ExecutionHeader
        session={activeSession}
        onPause={handlePause}
        onResume={handleResume}
        onEnd={() => {
          if (activeSession?.id) {
            endTimerSession({ id: activeSession.id, result: 'skipped' })
            setActiveSession(null)
          }
        }}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Main content - Today's Plan */}
        <ResizablePanel defaultSize={65} minSize={40}>
          <div className="h-full flex flex-col overflow-hidden">
            {/* Header with context */}
            <div className="relative px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                      <Calendar className="w-6 h-6 text-primary" />
                      Today's Plan
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  {/* Energy Context in header */}
                  <EnergyContextBar
                    context={energyContext ?? null}
                    onSetMorningContext={handleSetMorningContext}
                    onAddNote={handleAddContextNote}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {plan?.frogTaskId && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                      🐸 Frog set
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" onClick={handleRefreshBlocks}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>

            {/* Calendar events & free blocks */}
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {/* Momentum Bar */}
                <MomentumBar momentum={momentum ?? null} />

                {/* Calendar connection prompt or events */}
                {!isCalendarConnected ? (
                  <Card className="border-dashed border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                          <CalendarPlus className="w-7 h-7 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">Connect Your Calendar</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Link your Google Calendar to automatically detect free time blocks and optimize your day.
                          </p>
                        </div>
                        <Link to="/settings/calendar">
                          <Button className="bg-amber-600 hover:bg-amber-700">
                            <Calendar className="w-4 h-4 mr-2" />
                            Connect Calendar
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ) : calendarEvents && calendarEvents.length > 0 ? (
                  <div>
                    <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Today's Commitments
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {calendarEvents.map((event) => (
                        <Badge
                          key={event._id}
                          variant="outline"
                          className="bg-red-50/50 text-red-700 border-red-200 py-1.5 px-3"
                        >
                          <Clock className="w-3 h-3 mr-1.5" />
                          {formatTime(event.startTime)} – {event.summary}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Free blocks */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Free Time Blocks
                  </h2>

                  {!plan?.freeBlocks?.length ? (
                    <div className="text-center py-16 bg-gradient-to-b from-muted/30 to-transparent rounded-2xl border border-dashed border-muted-foreground/20">
                      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No blocks calculated yet</h3>
                      <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                        {isCalendarConnected 
                          ? "Click refresh to calculate your free time blocks based on today's calendar events"
                          : "Connect your calendar first, then we'll find your free time slots"
                        }
                      </p>
                      {isCalendarConnected ? (
                        <Button onClick={handleRefreshBlocks} size="lg">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Generate Free Blocks
                        </Button>
                      ) : (
                        <Link to="/settings/calendar">
                          <Button size="lg" variant="outline">
                            <Calendar className="w-4 h-4 mr-2" />
                            Connect Calendar First
                          </Button>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {plan.freeBlocks.map((block) => (
                        <FreeBlockCard
                          key={block.id}
                          block={block}
                          suggestions={suggestions[block.id] || []}
                          isLoadingSuggestions={loadingBlocks.has(block.id)}
                          onStart={(s) => handleStart(s, block.id)}
                          onShuffle={() => handleShuffle(block.id)}
                          onFrog={() => handleFrog(block.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Work Pool Panel */}
        <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
          <WorkPoolPanel
            workItems={workPool || []}
            adhocItems={adhocItems || []}
            isLoading={workPoolLoading}
            onAddAdhoc={handleAddAdhoc}
            onToggleAdhoc={handleToggleAdhoc}
            onDeleteAdhoc={handleDeleteAdhoc}
            frogTaskId={plan?.frogTaskId}
            onSetFrog={handleSetFrog}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Timer Dialog */}
      <TimerDialog
        isOpen={!!activeSession}
        session={activeSession}
        onPause={handlePause}
        onResume={handleResume}
        onComplete={handleComplete}
        onSwap={() => {
          // For now, just end and let user pick new task
          if (activeSession?.id) {
            endTimerSession({ id: activeSession.id, result: 'skipped' })
            setActiveSession(null)
          }
        }}
      />
    </FullWidthContent>
  )
}
