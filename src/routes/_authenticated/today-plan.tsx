import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Loader2,
  Play,
  Pause,
  Square,
  Shuffle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ListTodo,
  Zap,
  Plus,
  X,
  ChevronRight,
  Timer,
  Coffee,
  Dumbbell,
  Car,
  ShoppingBag,
  Mail,
  ExternalLink,
  RefreshCw,
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

  return (
    <Card className={cn(
      "transition-all",
      isPast && "opacity-50",
      isCurrent && "ring-2 ring-primary ring-offset-2"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isCurrent ? "bg-green-500 animate-pulse" : isPast ? "bg-gray-300" : "bg-blue-500"
            )} />
            <CardTitle className="text-sm font-medium">
              {formatTime(block.startTime)} – {formatTime(block.endTime)}
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {formatDuration(block.duration)}
            </Badge>
          </div>
          {block.label && (
            <span className="text-xs text-muted-foreground">{block.label}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingSuggestions ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tasks fit this block
          </p>
        ) : (
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion, idx) => (
              <div
                key={`${suggestion.taskId}-${idx}`}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg border",
                  "hover:bg-accent/50 transition-colors cursor-pointer",
                  idx === 0 && "bg-primary/5 border-primary/20"
                )}
                onClick={() => onStart(suggestion)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {suggestion.taskType === 'linear' ? 'Linear' :
                       suggestion.taskType === 'todo' ? 'Todo' :
                       suggestion.taskType === 'email' ? 'Email' : 'Life'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(suggestion.suggestedDuration)}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate mt-1">
                    {suggestion.taskTitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {suggestion.reason}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="flex-shrink-0">
                  <Play className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => suggestions[0] && onStart(suggestions[0])}
            disabled={suggestions.length === 0 || isPast}
          >
            <Play className="w-4 h-4 mr-1" />
            Start
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onShuffle}
            disabled={isPast}
          >
            <Shuffle className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onFrog}
            disabled={isPast}
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
          >
            🐸
          </Button>
        </div>
      </CardContent>
    </Card>
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

function WorkPoolSidebar({
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
    <div className="w-80 border-l bg-muted/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
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
      <div className="p-3 border-t bg-blue-50/50 dark:bg-blue-950/20">
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

  // Queries
  const { data: plan, isLoading: planLoading } = useQuery(
    convexQuery(api.todayPlan.getTodayPlan, {})
  )

  const { data: workPool, isLoading: workPoolLoading } = useQuery(
    convexQuery(api.todayPlan.getWorkPool, {
      planId: plan?._id,
    }),
    { enabled: !!plan }
  )

  const { data: adhocItems } = useQuery(
    convexQuery(api.todayPlan.listAdhocItems, {
      planId: plan?._id as Id<"todayPlans">,
    }),
    { enabled: !!plan }
  )

  const { data: calendarEvents } = useQuery(
    convexQuery(api.googleCalendar.getTodayEvents, {})
  )

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
  const createSampleEvents = useMutation(api.googleCalendar.createSampleEvents)

  // Actions
  const generateSuggestions = useAction(api.todayPlanAI.generateBlockSuggestions)
  const getShuffled = useAction(api.todayPlanAI.getShuffledTask)
  const getFrog = useAction(api.todayPlanAI.getFrogSuggestion)

  // Initialize plan on mount
  useEffect(() => {
    if (!plan && !planLoading) {
      getOrCreatePlan({}).then((newPlan) => {
        if (newPlan && newPlan.freeBlocks.length === 0) {
          // Create sample events and refresh blocks
          createSampleEvents({}).then(() => {
            refreshFreeBlocks({ planId: newPlan._id })
          })
        }
      })
    }
  }, [plan, planLoading, getOrCreatePlan, createSampleEvents, refreshFreeBlocks])

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

    setActiveSession({
      id: sessionId,
      taskTitle: suggestion.taskTitle,
      taskType: suggestion.taskType,
      taskId: suggestion.taskId,
      mode: 'normal',
      targetDuration: suggestion.suggestedDuration,
      startedAt: Date.now(),
    })
  }, [plan, startTimerSession])

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
  }, [plan, getFrog, startTimerSession])

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
    setActiveSession(null)
  }, [activeSession, endTimerSession])

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

  // Loading state
  if (planLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
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
          <div className="p-6">
            {/* Today's calendar events */}
            {calendarEvents && calendarEvents.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Calendar Events
                </h2>
                <div className="flex flex-wrap gap-2">
                  {calendarEvents.map((event) => (
                    <Badge
                      key={event._id}
                      variant="outline"
                      className="bg-red-50/50 text-red-700 border-red-200"
                    >
                      {formatTime(event.startTime)} - {event.summary}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Free blocks */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Free Time Blocks
              </h2>

              {!plan?.freeBlocks?.length ? (
                <div className="text-center py-12 bg-muted/30 rounded-lg">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No blocks yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Click refresh to generate free time blocks based on your calendar
                  </p>
                  <Button onClick={handleRefreshBlocks}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Generate Blocks
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
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

      {/* Work Pool Sidebar */}
      <WorkPoolSidebar
        workItems={workPool || []}
        adhocItems={adhocItems || []}
        isLoading={workPoolLoading}
        onAddAdhoc={handleAddAdhoc}
        onToggleAdhoc={handleToggleAdhoc}
        onDeleteAdhoc={handleDeleteAdhoc}
        frogTaskId={plan?.frogTaskId}
        onSetFrog={handleSetFrog}
      />

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
    </div>
  )
}
