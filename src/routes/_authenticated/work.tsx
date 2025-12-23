import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useAction, useQuery as useConvexQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FullWidthContent } from '@/components/layout/full-width-content'
import {
  Loader2,
  Play,
  Pause,
  SkipForward,
  CheckCircle2,
  Clock,
  Calendar,
  ExternalLink,
  ArrowLeft,
  Zap,
  Coffee,
  Target,
} from 'lucide-react'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/work')({
  component: WorkPage,
})

// ==========================================
// Helper Functions
// ==========================================

function formatTimerDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

// ==========================================
// Types
// ==========================================

interface ActiveSession {
  id: Id<"timerSessions">
  taskTitle: string
  taskType: string
  taskId: string
  mode: 'normal' | 'frog'
  targetDuration: number
  startedAt: number
  pausedAt?: number
}

// ==========================================
// Current Task Card Component
// ==========================================

interface CurrentTaskCardProps {
  task: {
    title: string
    type: string
    id: string
    url?: string
    projectName?: string
    priority?: number
    priorityLabel?: string
  }
  elapsedSeconds: number
  targetMinutes: number
  isPaused: boolean
  isFrog: boolean
  completedCount: number
  onComplete: () => void
  onSkip: () => void
  onPause: () => void
  onResume: () => void
  onOpenTask: () => void
}

function CurrentTaskCard({
  task,
  elapsedSeconds,
  targetMinutes,
  isPaused,
  isFrog,
  completedCount,
  onComplete,
  onSkip,
  onPause,
  onResume,
  onOpenTask,
}: CurrentTaskCardProps) {
  const progress = Math.min(100, (elapsedSeconds / (targetMinutes * 60)) * 100)
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  const isOvertime = elapsedSeconds > targetMinutes * 60

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Stats bar */}
      <div className="flex items-center justify-center gap-6 mb-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm">{completedCount} completed today</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">{formatDuration(targetMinutes)} block</span>
        </div>
      </div>

      {/* Main task card */}
      <Card className={cn(
        "border-2 shadow-xl transition-all",
        isFrog && "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
        !isFrog && "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
      )}>
        <CardContent className="p-8">
          {/* Task type badge and frog indicator */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={cn(
                  "capitalize text-sm px-3 py-1",
                  task.type === 'linear' && "bg-violet-50 text-violet-700 border-violet-200",
                  task.type === 'todo' && "bg-blue-50 text-blue-700 border-blue-200",
                  task.type === 'email' && "bg-sky-50 text-sky-700 border-sky-200"
                )}
              >
                {task.type}
              </Badge>
              {task.projectName && (
                <span className="text-sm text-muted-foreground">
                  • {task.projectName}
                </span>
              )}
            </div>
            {isFrog && (
              <div className="flex items-center gap-2 text-amber-600">
                <span className="text-2xl">🐸</span>
                <span className="text-sm font-medium">Frog Mode</span>
              </div>
            )}
          </div>

          {/* Task title - the main focus */}
          <h2 className="text-2xl font-bold mb-4 leading-tight">
            {task.title}
          </h2>

          {/* Task actions */}
          {task.url && (
            <button
              onClick={onOpenTask}
              className="flex items-center gap-2 text-sm text-primary hover:underline mb-6"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Linear
            </button>
          )}

          {/* Progress section */}
          <div className="mt-8">
            {/* Elapsed time display - prominent but not overwhelming */}
            <div className="flex items-baseline gap-3 mb-4">
              <span className={cn(
                "text-4xl font-mono font-bold tabular-nums",
                isPaused && "text-muted-foreground",
                isOvertime && "text-amber-600"
              )}>
                {formatTimerDisplay(elapsedSeconds)}
              </span>
              <span className="text-muted-foreground">
                / {formatDuration(targetMinutes)}
              </span>
              {isPaused && (
                <Badge variant="secondary" className="ml-2">
                  Paused
                </Badge>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-6">
              <div
                className={cn(
                  "h-full transition-all duration-1000 rounded-full",
                  isFrog ? "bg-amber-500" : "bg-primary",
                  isOvertime && "bg-red-500"
                )}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>

            {/* Action buttons - the key interactions */}
            <div className="flex items-center gap-3">
              <Button
                size="lg"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={onComplete}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Complete
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="flex-1"
                onClick={onSkip}
              >
                <SkipForward className="w-5 h-5 mr-2" />
                Skip
              </Button>

              {isPaused ? (
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={onResume}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Resume
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={onPause}
                >
                  <Pause className="w-5 h-5 mr-2" />
                  Pause
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Motivational hint */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        {isFrog 
          ? "You're tackling the hard stuff first. Keep going!" 
          : `${elapsedMinutes < 5 ? "Just getting started..." : elapsedMinutes < 15 ? "You're in the zone!" : "Great focus! Almost there."}`
        }
      </p>
    </div>
  )
}

// ==========================================
// No Active Session Component
// ==========================================

interface NoActiveSessionProps {
  onStartSession: () => void
  isLoading: boolean
  nextTask: { title: string; type: string } | null
}

function NoActiveSession({ onStartSession, isLoading, nextTask }: NoActiveSessionProps) {
  return (
    <div className="max-w-md mx-auto text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Target className="w-10 h-10 text-primary" />
      </div>
      
      <h1 className="text-2xl font-bold mb-2">Ready to Focus?</h1>
      <p className="text-muted-foreground mb-8">
        Start a work session and we'll pick a task for you. No decisions, just action.
      </p>

      {nextTask && (
        <Card className="mb-6 border-dashed">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Up first:</p>
            <p className="font-medium">{nextTask.title}</p>
            <Badge variant="outline" className="mt-2 capitalize text-xs">
              {nextTask.type}
            </Badge>
          </CardContent>
        </Card>
      )}

      <Button
        size="lg"
        className="w-full"
        onClick={onStartSession}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <Play className="w-5 h-5 mr-2" />
        )}
        Start Working
      </Button>

      <div className="mt-8 flex items-center justify-center gap-4">
        <Link to="/today-plan" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 inline mr-1" />
          Back to Plan
        </Link>
        <span className="text-muted-foreground">•</span>
        <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <Coffee className="w-4 h-4" />
          Take a break
        </button>
      </div>
    </div>
  )
}

// ==========================================
// Session Complete Dialog
// ==========================================

interface SessionCompleteProps {
  taskTitle: string
  onDone: () => void
  onPartial: () => void
  resultNote: string
  setResultNote: (note: string) => void
}

function SessionComplete({ taskTitle, onDone, onPartial, resultNote, setResultNote }: SessionCompleteProps) {
  return (
    <div className="max-w-md mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      
      <h2 className="text-xl font-bold mb-2">How'd it go?</h2>
      <p className="text-muted-foreground mb-6">
        "{taskTitle}"
      </p>

      <div className="space-y-3 mb-6">
        <Button
          size="lg"
          className="w-full bg-green-600 hover:bg-green-700"
          onClick={onDone}
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Done - Next Task
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={onPartial}
        >
          <Clock className="w-5 h-5 mr-2" />
          Partial - Need More Time
        </Button>
      </div>

      <Input
        placeholder="Optional note..."
        value={resultNote}
        onChange={(e) => setResultNote(e.target.value)}
        className="text-center"
      />
    </div>
  )
}

// ==========================================
// Main Work Page Component
// ==========================================

function WorkPage() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showComplete, setShowComplete] = useState(false)
  const [resultNote, setResultNote] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)

  // Queries
  const plan = useConvexQuery(api.todayPlan.getTodayPlan, {})
  const planLoading = plan === undefined

  // Get active session from DB if exists
  const dbSession = useConvexQuery(
    api.todayPlan.getActiveSession,
    plan?._id ? { planId: plan._id } : "skip"
  )

  // Mutations
  const startTimerSession = useMutation(api.todayPlan.startTimerSession)
  const pauseTimerSession = useMutation(api.todayPlan.pauseTimerSession)
  const resumeTimerSession = useMutation(api.todayPlan.resumeTimerSession)
  const endTimerSession = useMutation(api.todayPlan.endTimerSession)
  const incrementMomentum = useMutation(api.operatorAI.incrementMomentum)

  // Actions
  const getWeightedSuggestion = useAction(api.operatorAI.getWeightedSuggestion)

  // Sync active session from DB
  useEffect(() => {
    if (dbSession && dbSession.isActive) {
      setActiveSession({
        id: dbSession._id,
        taskTitle: dbSession.taskTitle,
        taskType: dbSession.taskType,
        taskId: dbSession.taskId,
        mode: dbSession.mode as 'normal' | 'frog',
        targetDuration: dbSession.targetDuration,
        startedAt: dbSession.startedAt,
        pausedAt: dbSession.pausedAt,
      })
    }
  }, [dbSession])

  // Timer effect
  useEffect(() => {
    if (!activeSession || activeSession.pausedAt) return

    const interval = setInterval(() => {
      const now = Date.now()
      setElapsedSeconds(Math.floor((now - activeSession.startedAt) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [activeSession])

  // Start a new work session
  const handleStartSession = useCallback(async () => {
    if (!plan) return

    setIsStarting(true)
    try {
      // Get a weighted task suggestion (surprise!)
      const result = await getWeightedSuggestion({
        blockDuration: 25, // Default pomodoro-style block
        excludeTaskIds: [],
      })

      if (!result.task) {
        // No tasks available
        setIsStarting(false)
        return
      }

      // Start the timer session
      const sessionId = await startTimerSession({
        planId: plan._id,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        taskTitle: result.task.taskTitle,
        mode: 'normal',
        targetDuration: result.task.duration,
      })

      await incrementMomentum({ field: 'blocksStarted' })

      setActiveSession({
        id: sessionId,
        taskTitle: result.task.taskTitle,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        mode: 'normal',
        targetDuration: result.task.duration,
        startedAt: Date.now(),
      })
      setElapsedSeconds(0)
    } finally {
      setIsStarting(false)
    }
  }, [plan, getWeightedSuggestion, startTimerSession, incrementMomentum])

  // Pause session
  const handlePause = useCallback(async () => {
    if (!activeSession) return
    await pauseTimerSession({ id: activeSession.id })
    setActiveSession((prev) => prev ? { ...prev, pausedAt: Date.now() } : null)
  }, [activeSession, pauseTimerSession])

  // Resume session
  const handleResume = useCallback(async () => {
    if (!activeSession) return
    await resumeTimerSession({ id: activeSession.id })
    setActiveSession((prev) => prev ? { ...prev, pausedAt: undefined } : null)
  }, [activeSession, resumeTimerSession])

  // Complete task and get next
  const handleComplete = useCallback(async () => {
    if (!activeSession || !plan) return

    // End the current session
    await endTimerSession({ 
      id: activeSession.id, 
      result: 'completed', 
      resultNote: resultNote || undefined 
    })
    await incrementMomentum({ field: 'blocksCompleted' })
    
    if (activeSession.mode === 'frog') {
      await incrementMomentum({ field: 'frogCompletions' })
    }

    setCompletedCount((prev) => prev + 1)

    // Get next task (surprise!)
    const result = await getWeightedSuggestion({
      blockDuration: 25,
      excludeTaskIds: [activeSession.taskId],
    })

    if (result.task) {
      // Start new session
      const sessionId = await startTimerSession({
        planId: plan._id,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        taskTitle: result.task.taskTitle,
        mode: 'normal',
        targetDuration: result.task.duration,
      })

      await incrementMomentum({ field: 'blocksStarted' })

      setActiveSession({
        id: sessionId,
        taskTitle: result.task.taskTitle,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        mode: 'normal',
        targetDuration: result.task.duration,
        startedAt: Date.now(),
      })
      setElapsedSeconds(0)
    } else {
      // No more tasks
      setActiveSession(null)
    }

    setShowComplete(false)
    setResultNote('')
  }, [activeSession, plan, resultNote, endTimerSession, incrementMomentum, getWeightedSuggestion, startTimerSession])

  // Skip task and get different one
  const handleSkip = useCallback(async () => {
    if (!activeSession || !plan) return

    // End the current session as skipped
    await endTimerSession({ id: activeSession.id, result: 'skipped' })
    await incrementMomentum({ field: 'blocksSkipped' })

    // Get different task (surprise!)
    const result = await getWeightedSuggestion({
      blockDuration: 25,
      excludeTaskIds: [activeSession.taskId],
    })

    if (result.task) {
      // Start new session with different task
      const sessionId = await startTimerSession({
        planId: plan._id,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        taskTitle: result.task.taskTitle,
        mode: 'normal',
        targetDuration: result.task.duration,
      })

      await incrementMomentum({ field: 'blocksStarted' })

      setActiveSession({
        id: sessionId,
        taskTitle: result.task.taskTitle,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        mode: 'normal',
        targetDuration: result.task.duration,
        startedAt: Date.now(),
      })
      setElapsedSeconds(0)
    } else {
      setActiveSession(null)
    }
  }, [activeSession, plan, endTimerSession, incrementMomentum, getWeightedSuggestion, startTimerSession])

  // Partial completion - mark as partial and get next
  const handlePartial = useCallback(async () => {
    if (!activeSession || !plan) return

    await endTimerSession({ 
      id: activeSession.id, 
      result: 'partial', 
      resultNote: resultNote || undefined 
    })
    await incrementMomentum({ field: 'blocksPartial' })

    // Get next task
    const result = await getWeightedSuggestion({
      blockDuration: 25,
      excludeTaskIds: [activeSession.taskId],
    })

    if (result.task) {
      const sessionId = await startTimerSession({
        planId: plan._id,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        taskTitle: result.task.taskTitle,
        mode: 'normal',
        targetDuration: result.task.duration,
      })

      await incrementMomentum({ field: 'blocksStarted' })

      setActiveSession({
        id: sessionId,
        taskTitle: result.task.taskTitle,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        mode: 'normal',
        targetDuration: result.task.duration,
        startedAt: Date.now(),
      })
      setElapsedSeconds(0)
    } else {
      setActiveSession(null)
    }

    setShowComplete(false)
    setResultNote('')
  }, [activeSession, plan, resultNote, endTimerSession, incrementMomentum, getWeightedSuggestion, startTimerSession])

  // Open task in external app
  const handleOpenTask = useCallback(() => {
    // For Linear tasks, open the URL
    // This would need the URL from the task data
    console.log('Open task:', activeSession?.taskId)
  }, [activeSession])

  // Loading state
  if (planLoading) {
    return (
      <FullWidthContent>
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </FullWidthContent>
    )
  }

  return (
    <FullWidthContent>
      <div className="h-full flex flex-col">
        {/* Minimal header */}
        <div className="px-6 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/today-plan" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <span className="font-semibold">Work Session</span>
            </div>
          </div>
          
          {activeSession && (
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm">
                <Clock className="w-3 h-3 mr-1" />
                {formatTimerDisplay(elapsedSeconds)}
              </Badge>
              <Link to="/today-plan">
                <Button variant="ghost" size="sm">
                  <Calendar className="w-4 h-4 mr-1" />
                  View Plan
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center p-8">
          {showComplete ? (
            <SessionComplete
              taskTitle={activeSession?.taskTitle || ''}
              onDone={handleComplete}
              onPartial={handlePartial}
              resultNote={resultNote}
              setResultNote={setResultNote}
            />
          ) : activeSession ? (
            <CurrentTaskCard
              task={{
                title: activeSession.taskTitle,
                type: activeSession.taskType,
                id: activeSession.taskId,
              }}
              elapsedSeconds={elapsedSeconds}
              targetMinutes={activeSession.targetDuration}
              isPaused={!!activeSession.pausedAt}
              isFrog={activeSession.mode === 'frog'}
              completedCount={completedCount}
              onComplete={() => setShowComplete(true)}
              onSkip={handleSkip}
              onPause={handlePause}
              onResume={handleResume}
              onOpenTask={handleOpenTask}
            />
          ) : (
            <NoActiveSession
              onStartSession={handleStartSession}
              isLoading={isStarting}
              nextTask={null} // We keep it a surprise!
            />
          )}
        </div>
      </div>
    </FullWidthContent>
  )
}

