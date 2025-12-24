import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery as useConvexQuery } from 'convex/react'
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
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { FullWidthContent } from '@/components/layout/full-width-content'
import {
  Loader2,
  Play,
  Clock,
  CheckCircle2,
  ListTodo,
  Plus,
  X,
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
  GripVertical,
  Calendar as CalendarIcon,
  Briefcase,
} from 'lucide-react'
import { cn } from '~/lib/utils'
import { IlamyCalendar, type CalendarEvent } from '@ilamy/calendar'
import dayjs from 'dayjs'

export const Route = createFileRoute('/_authenticated/today-plan')({
  component: TodayPlanPage,
})

// ==========================================
// Helper Functions
// ==========================================

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
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

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

// ==========================================
// Types
// ==========================================

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
  projectName?: string
}

// Extended calendar event data stored in the CalendarEvent.data field
interface EventCustomData {
  type: 'google' | 'work-block' | 'planned-task'
  taskType?: 'todo' | 'linear' | 'adhoc'
  taskId?: string
  projectName?: string
}

// ==========================================
// Work Pool Panel Component
// ==========================================

interface WorkPoolPanelProps {
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
  onDragStart: (item: WorkItem) => void
  onAddToToday: (item: WorkItem) => void
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
  onDragStart,
  onAddToToday,
}: WorkPoolPanelProps) {
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
      <div className="p-3 border-b bg-background">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-primary" />
          Work Pool
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Drag tasks to schedule • Click + for today
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
                "flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all capitalize",
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
        <div className="p-2 border-b bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 mb-2">
            <Coffee className="w-3 h-3 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Life Items
            </span>
          </div>

          {/* Add new adhoc item */}
          <div className="flex gap-1 mb-2">
            <Input
              placeholder="breakfast, gym..."
              value={newAdhocText}
              onChange={(e) => setNewAdhocText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAdhoc()}
              className="h-7 text-xs bg-background"
            />
            <Button size="icon" variant="outline" className="h-7 w-7 flex-shrink-0" onClick={handleAddAdhoc}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>

          {/* Adhoc items list */}
          <div className="space-y-0.5">
            {adhocItems.slice(0, 4).map((item) => {
              const Icon = getLifeItemIcon(item.text)
              return (
                <div
                  key={item._id}
                  className={cn(
                    "group flex items-center gap-1.5 p-1.5 rounded text-xs",
                    item.isCompleted && "opacity-50 line-through"
                  )}
                >
                  <button onClick={() => onToggleAdhoc(item._id)} className="flex-shrink-0">
                    {item.isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Icon className="w-3.5 h-3.5 text-amber-600" />
                    )}
                  </button>
                  <span className="flex-1 truncate">{item.text}</span>
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
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              No tasks available
            </p>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify(item))
                  e.dataTransfer.effectAllowed = 'copy'
                  onDragStart(item)
                }}
                className={cn(
                  "group flex items-start gap-1.5 p-2 rounded-lg border bg-background cursor-grab active:cursor-grabbing",
                  "hover:bg-accent/50 hover:shadow-sm transition-all",
                  frogTaskId === item.id && "ring-2 ring-amber-400 bg-amber-50/50"
                )}
              >
                {/* Drag handle */}
                <GripVertical className="w-3 h-3 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] capitalize h-4 px-1",
                        item.type === 'linear' && getPriorityColor(item.priority)
                      )}
                    >
                      {item.type === 'linear' ? (item.priorityLabel ?? 'Linear') :
                       item.type === 'todo' ? 'Todo' : item.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      ~{formatDuration(item.estimatedDuration)}
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-tight line-clamp-2">{item.title}</p>
                  {/* Show project name */}
                  {item.projectName && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      📁 {item.projectName}
                    </p>
                  )}
                  {item.source && 'identifier' in item.source && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {item.source.identifier as string}
                    </p>
                  )}
                </div>
                
                {/* Action buttons */}
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddToToday(item)
                    }}
                    title="Add to today's plan"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-5 w-5",
                      frogTaskId === item.id && "text-amber-600"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSetFrog(frogTaskId === item.id ? undefined : item.id)
                    }}
                    title={frogTaskId === item.id ? "Remove frog" : "Set as frog"}
                  >
                    🐸
                  </Button>
                  {item.type === 'linear' && item.source && 'url' in item.source && (
                    <a
                      href={item.source.url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-5 w-5 flex items-center justify-center hover:bg-accent rounded"
                      onClick={(e) => e.stopPropagation()}
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
      <div className="p-2 border-t bg-blue-50/50 dark:bg-blue-950/20 flex-shrink-0">
        <div className="flex items-center gap-1 mb-1.5">
          <Mail className="w-3 h-3 text-blue-600" />
          <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">
            Email Blocks
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[
            { title: 'Triage', duration: 20 },
            { title: 'Reply 5', duration: 15 },
          ].map((block) => (
            <button
              key={block.title}
              draggable
              onDragStart={(e) => {
                const emailItem: WorkItem = {
                  type: 'email',
                  id: `email-${block.title.toLowerCase().replace(' ', '-')}`,
                  title: block.title,
                  priority: 3,
                  estimatedDuration: block.duration,
                }
                e.dataTransfer.setData('application/json', JSON.stringify(emailItem))
              }}
              className="text-left p-1.5 rounded bg-background/50 hover:bg-background text-[10px] cursor-grab"
            >
              <span className="font-medium">{block.title}</span>
              <span className="text-muted-foreground ml-0.5">({block.duration}m)</span>
            </button>
          ))}
        </div>
      </div>
    </div>
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
                    placeholder="How are you feeling today? What's your energy like?"
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
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="text-xs">
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)} className="text-xs">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
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
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Add a note..."
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
    <div className="flex items-center gap-4 px-3 py-2 bg-muted/50 rounded-lg text-xs">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-3 h-3 text-primary" />
        <span className="font-medium">Momentum</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>{momentum.blocksCompleted}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>{momentum.blocksPartial}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>{momentum.blocksSkipped}</span>
        </div>
        {momentum.frogAttempts > 0 && (
          <span>🐸 {momentum.frogCompletions}/{momentum.frogAttempts}</span>
        )}
        <span className="px-2 py-0.5 bg-primary/10 rounded font-medium">{completionRate}%</span>
      </div>
    </div>
  )
}

// ==========================================
// Custom Calendar Event Renderer
// ==========================================

function CustomEventCard({ event }: { event: CalendarEvent }) {
  const customData = event.data as EventCustomData | undefined
  const eventType = customData?.type ?? 'google'
  
  const getEventStyles = () => {
    switch (eventType) {
      case 'google':
        return 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200'
      case 'work-block':
        return 'bg-indigo-100 border-indigo-300 text-indigo-800 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-200'
      case 'planned-task':
        return 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-200'
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800'
    }
  }

  const getIcon = () => {
    switch (eventType) {
      case 'google':
        return <CalendarIcon className="w-3 h-3" />
      case 'work-block':
        return <Briefcase className="w-3 h-3" />
      case 'planned-task':
        return <CheckCircle2 className="w-3 h-3" />
      default:
        return null
    }
  }

  return (
    <div className={cn(
      "h-full w-full px-2 py-1 rounded-md border text-xs overflow-hidden",
      getEventStyles()
    )}>
      <div className="flex items-center gap-1 font-medium">
        {getIcon()}
        <span className="truncate">{event.title}</span>
      </div>
      {customData?.projectName && (
        <p className="text-[10px] opacity-70 truncate mt-0.5">
          {customData.projectName}
        </p>
      )}
      {eventType === 'work-block' && (
        <p className="text-[10px] opacity-70 mt-0.5">
          Work block • Tasks hidden
        </p>
      )}
    </div>
  )
}

// ==========================================
// Main Page Component
// ==========================================

function TodayPlanPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [draggedItem, setDraggedItem] = useState<WorkItem | null>(null)

  // Queries
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
  const plannedTasks = useConvexQuery(api.plannedTasks.getPlannedTasksForDate, { date: getTodayDateString() })

  // Energy context & momentum queries
  const energyContext = useConvexQuery(api.operatorAI.getTodayContext, {})
  const momentum = useConvexQuery(api.operatorAI.getTodayMomentum, {})
  
  // Calendar settings
  const calendarSettings = useConvexQuery(api.googleCalendar.getSettings, {})
  const isCalendarConnected = calendarSettings?.isConfigured === true

  // Mutations
  const getOrCreatePlan = useMutation(api.todayPlan.getOrCreateTodayPlan)
  const refreshFreeBlocks = useMutation(api.todayPlan.refreshFreeBlocks)
  const addAdhocItem = useMutation(api.todayPlan.addAdhocItem)
  const updateAdhocItem = useMutation(api.todayPlan.updateAdhocItem)
  const deleteAdhocItem = useMutation(api.todayPlan.deleteAdhocItem)
  const setFrogTask = useMutation(api.todayPlan.setFrogTask)
  const setMorningContext = useMutation(api.operatorAI.setMorningContext)
  const addContextNote = useMutation(api.operatorAI.addContextNote)
  const createPlannedTask = useMutation(api.plannedTasks.createPlannedTask)
  const updatePlannedTask = useMutation(api.plannedTasks.updatePlannedTask)

  // Initialize plan on mount
  useEffect(() => {
    if (!plan && !planLoading) {
      getOrCreatePlan({})
    }
  }, [plan, planLoading, getOrCreatePlan])

  // Convert data to ilamy Calendar events
  const calendarDisplayEvents: CalendarEvent[] = useMemo(() => {
    const events: CalendarEvent[] = []

    // Google Calendar events (scheduled commitments)
    if (calendarEvents) {
      calendarEvents.forEach((event) => {
        events.push({
          id: `google-${event._id}`,
          title: event.summary,
          start: dayjs(event.startTime),
          end: dayjs(event.endTime),
          backgroundColor: '#fca5a5',
          color: '#991b1b',
          data: { type: 'google' } as EventCustomData,
        })
      })
    }

    // Work blocks from free time (these hide their contents)
    if (plan?.freeBlocks) {
      plan.freeBlocks.forEach((block) => {
        events.push({
          id: `work-block-${block.id}`,
          title: 'Work Block',
          start: dayjs(block.startTime),
          end: dayjs(block.endTime),
          backgroundColor: '#a5b4fc',
          color: '#3730a3',
          data: { type: 'work-block' } as EventCustomData,
        })
      })
    }

    // Planned tasks (explicit user-scheduled tasks)
    if (plannedTasks) {
      plannedTasks.forEach((task: { _id: string; taskTitle: string; startTime: number; endTime: number; taskType: 'todo' | 'linear' | 'adhoc'; taskId: string; projectName?: string }) => {
        events.push({
          id: `planned-${task._id}`,
          title: task.taskTitle,
          start: dayjs(task.startTime),
          end: dayjs(task.endTime),
          backgroundColor: '#86efac',
          color: '#166534',
          data: {
            type: 'planned-task',
            taskType: task.taskType,
            taskId: task.taskId,
            projectName: task.projectName,
          } as EventCustomData,
        })
      })
    }

    return events
  }, [calendarEvents, plan, plannedTasks])

  // Handlers
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
  }, [plan, refreshFreeBlocks])

  const handleSetMorningContext = useCallback(async (text: string) => {
    await setMorningContext({ context: text })
  }, [setMorningContext])

  const handleAddContextNote = useCallback(async (text: string) => {
    await addContextNote({ note: text })
  }, [addContextNote])

  const handleDragStart = useCallback((item: WorkItem) => {
    setDraggedItem(item)
  }, [])

  const handleAddToToday = useCallback(async (item: WorkItem) => {
    // Add task to today's plan with a default time slot
    const now = new Date()
    const startTime = now.getTime()
    const endTime = startTime + item.estimatedDuration * 60 * 1000

    // Map 'email' type to 'adhoc' since createPlannedTask only accepts 'todo' | 'linear' | 'adhoc'
    const taskType: 'todo' | 'linear' | 'adhoc' = item.type === 'email' ? 'adhoc' : item.type

    await createPlannedTask({
      date: getTodayDateString(),
      taskType,
      taskId: item.id,
      startTime,
      endTime,
      taskTitle: item.title,
      taskPriority: item.priority,
      projectName: item.projectName,
    })
  }, [createPlannedTask])

  // Handle drop on calendar
  const handleEventDrop = useCallback(async (
    eventId: string,
    newStart: Date,
    newEnd: Date
  ) => {
    // Check if it's a planned task (can be rescheduled)
    if (eventId.startsWith('planned-')) {
      const id = eventId.replace('planned-', '') as Id<"plannedTasks">
      await updatePlannedTask({
        id,
        startTime: newStart.getTime(),
        endTime: newEnd.getTime(),
      })
    }
  }, [updatePlannedTask])

  // Enrich work items with project names (must be before conditional returns)
  const enrichedWorkItems = useMemo(() => {
    if (!workPool) return []
    return workPool.map((item) => ({
      ...item,
      projectName: item.source && 'teamName' in item.source 
        ? (item.source.teamName as string)
        : undefined,
    }))
  }, [workPool])

  // Loading state
  if (planLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <FullWidthContent>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Main content - Calendar View */}
        <ResizablePanel defaultSize={70} minSize={50}>
          <div className="h-full flex flex-col overflow-hidden">
            {/* Header with context */}
            <div className="relative px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-primary" />
                      Today's Plan
                    </h1>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <EnergyContextBar
                    context={energyContext ?? null}
                    onSetMorningContext={handleSetMorningContext}
                    onAddNote={handleAddContextNote}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {plan?.frogTaskId && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                      🐸 Frog set
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" onClick={handleRefreshBlocks}>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Refresh
                  </Button>
                  <Link to="/work">
                    <Button size="sm">
                      <Play className="w-3 h-3 mr-1" />
                      Start Work
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Momentum Bar */}
            <div className="px-4 py-2 border-b">
              <MomentumBar momentum={momentum ?? null} />
            </div>

            {/* Calendar connection prompt */}
            {!isCalendarConnected ? (
              <div className="p-6">
                <Card className="border-dashed border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <CalendarPlus className="w-6 h-6 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">Connect Your Calendar</h3>
                        <p className="text-sm text-muted-foreground">
                          Link your Google Calendar to see events and plan your day.
                        </p>
                      </div>
                      <Link to="/settings/calendar">
                        <Button className="bg-amber-600 hover:bg-amber-700">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          Connect
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* ilamy Calendar - Day View */
              <div 
                className="flex-1 overflow-hidden"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }}
                onDrop={async (e) => {
                  e.preventDefault()
                  const data = e.dataTransfer.getData('application/json')
                  if (data && draggedItem) {
                    // Calculate drop time based on cursor position
                    // For now, just add to current time
                    await handleAddToToday(draggedItem)
                    setDraggedItem(null)
                  }
                }}
              >
                <IlamyCalendar
                  events={calendarDisplayEvents}
                  initialView="day"
                  initialDate={currentDate}
                  firstDayOfWeek="monday"
                  timeFormat="12-hour"
                  onDateChange={(date) => setCurrentDate(date.toDate())}
                  onEventClick={(event) => {
                    console.log('Clicked event:', event)
                  }}
                  onCellClick={(info) => {
                    console.log('Cell clicked:', info.start, info.end)
                  }}
                  onEventUpdate={(event) => {
                    // Handle event drag/resize
                    const customData = event.data as EventCustomData | undefined
                    if (customData?.type === 'planned-task') {
                      const id = String(event.id).replace('planned-', '')
                      handleEventDrop(id, event.start.toDate(), event.end.toDate())
                    }
                  }}
                  renderEvent={(event) => (
                    <CustomEventCard event={event} />
                  )}
                />
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Work Pool Panel */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <WorkPoolPanel
            workItems={enrichedWorkItems || []}
            adhocItems={adhocItems || []}
            isLoading={workPoolLoading}
            onAddAdhoc={handleAddAdhoc}
            onToggleAdhoc={handleToggleAdhoc}
            onDeleteAdhoc={handleDeleteAdhoc}
            frogTaskId={plan?.frogTaskId}
            onSetFrog={handleSetFrog}
            onDragStart={handleDragStart}
            onAddToToday={handleAddToToday}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </FullWidthContent>
  )
}
