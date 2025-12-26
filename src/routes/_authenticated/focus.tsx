import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useAction, useQuery as useConvexQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullWidthContent } from '@/components/layout/full-width-content'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Target,
  Maximize2,
  Minimize2,
  LogOut
} from 'lucide-react'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/focus')({
  component: FocusPage,
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
  projectName?: string
  taskUrl?: string
  resultNote?: string
}

// ==========================================
// Focus Hero Component
// ==========================================

interface FocusHeroProps {
  task: {
    title: string
    type: string
    id: string
    url?: string
    projectName?: string
  }
  elapsedSeconds: number
  targetMinutes: number
  isPaused: boolean
  isFrog: boolean
  onComplete: () => void
  onSkip: () => void
  onPause: () => void
  onResume: () => void
  onOpenTask: () => void
}

function FocusHero({
  task,
  elapsedSeconds,
  targetMinutes,
  isPaused,
  isFrog,
  onComplete,
  onSkip,
  onPause,
  onResume,
  onOpenTask,
}: FocusHeroProps) {
  const progress = Math.min(100, (elapsedSeconds / (targetMinutes * 60)) * 100)
  const isOvertime = elapsedSeconds > targetMinutes * 60

  return (
    <div className="relative w-full h-full flex flex-col justify-center">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-10",
          isFrog ? "bg-amber-500" : "bg-primary"
        )} />
      </div>

      <div className="space-y-10 max-w-4xl mx-auto w-full text-center">
        {/* Header Badges */}
        <div className="flex items-center justify-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "capitalize text-sm px-3 py-1 h-auto rounded-full backdrop-blur-md bg-background/50",
              task.type === 'linear' && "text-violet-500 border-violet-500/30",
              task.type === 'todo' && "text-blue-500 border-blue-500/30",
              task.type === 'email' && "text-sky-500 border-sky-500/30",
              isFrog && "text-amber-500 border-amber-500/30"
            )}
          >
            {isFrog && <span className="mr-2">🐸</span>}
            {task.type}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 h-auto rounded-full backdrop-blur-md bg-background/50 text-muted-foreground border-border">
            Target: {formatDuration(targetMinutes)}
          </Badge>
        </div>

        {/* The Task Title - Refined Size */}
        <div className="space-y-4 px-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight text-foreground drop-shadow-sm line-clamp-3">
            {task.title}
          </h1>

          {task.projectName && (
            <p className="text-lg md:text-xl text-muted-foreground font-light flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              {task.projectName}
            </p>
          )}
        </div>

        {/* Timer & Controls */}
        <div className="flex flex-col items-center gap-8">
          {/* Timer Display */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-6xl md:text-8xl font-mono font-medium tracking-tighter tabular-nums text-foreground/80 dark:text-white/90">
              {formatTimerDisplay(elapsedSeconds)}
            </div>

            {/* Duration Context */}
            <div className="text-sm text-muted-foreground font-medium tracking-wide uppercase opacity-70">
              of {formatDuration(targetMinutes)} block
            </div>

            {/* Subtle Progress Bar */}
            < div className="w-64 h-1.5 mt-4 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-1000",
                  isFrog ? "bg-amber-500" : "bg-primary",
                  isOvertime && "bg-red-500"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>

            {isPaused && (
              <div className="mt-4 px-3 py-1 bg-background/80 backdrop-blur text-xs font-medium uppercase tracking-widest text-muted-foreground rounded-full border animate-pulse">
                Paused
              </div>
            )}
          </div>

          {/* Primary Actions */}
          <div className="flex items-center gap-4 md:gap-6 mt-4">
            {isPaused ? (
              <Button
                size="icon"
                className="w-16 h-16 rounded-full shadow-lg hover:scale-105 transition-transform bg-foreground text-background hover:bg-foreground/90"
                onClick={onResume}
                title="Resume"
              >
                <Play className="w-8 h-8 ml-1" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="outline"
                className="w-16 h-16 rounded-full border-2 hover:scale-105 transition-transform bg-background/50 backdrop-blur"
                onClick={onPause}
                title="Pause"
              >
                <Pause className="w-8 h-8" />
              </Button>
            )}

            <Button
              size="lg"
              className="h-16 px-8 rounded-full text-lg font-medium shadow-lg hover:scale-105 transition-transform bg-green-600 hover:bg-green-500 text-white border-none"
              onClick={onComplete}
            >
              <CheckCircle2 className="w-6 h-6 mr-3" />
              Complete
            </Button>

            <div className="flex gap-2 ml-4">
              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full text-muted-foreground hover:text-foreground" onClick={onSkip} title="Skip Task">
                <SkipForward className="w-5 h-5" />
              </Button>
              {(task.url || task.url) && (
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full text-muted-foreground hover:text-foreground" onClick={onOpenTask} title="Open External Link">
                  <ExternalLink className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// Side Panel Components
// ==========================================

function UpNextPanel({ planId }: { planId?: Id<"todayPlans"> }) {
  const assignments = useConvexQuery(api.todayPlan.getBlockAssignments, planId ? { planId } : "skip")

  if (!assignments) return null

  // Filter for future/assigned tasks only
  const upcoming = assignments
    .filter(a => a.status === 'assigned' || a.status === 'suggested')
    .sort(() => 0) // Keep implicit order

  if (upcoming.length === 0) {
    return (
      <Card className="bg-background/40 backdrop-blur border shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Up Next</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No upcoming blocks assigned. You're free!
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-background/40 backdrop-blur border shadow-sm flex flex-col h-full max-h-[400px]">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Up Next
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {upcoming.map((block) => (
              <div key={block._id} className="p-3 rounded-lg bg-background/50 border hover:bg-background/80 transition-colors cursor-default">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm line-clamp-2 leading-snug">{block.taskTitle}</h4>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{block.taskDuration}m</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 capitalize bg-muted/50 text-muted-foreground">
                    {block.taskType}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function SessionStats({ completedCount }: { completedCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="bg-background/40 backdrop-blur border shadow-sm">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold">{completedCount}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Completed</span>
        </CardContent>
      </Card>
    </div>
  )
}

// ==========================================
// Note Taking Component (Auto-save)
// ==========================================

function SessionNotes({
  initialNote,
  sessionId,
  onUpdate
}: {
  initialNote: string,
  sessionId: Id<"timerSessions">,
  onUpdate: (id: Id<"timerSessions">, note: string) => void
}) {
  const [note, setNote] = useState(initialNote)
  // Ref to track if we've synced the initial prop
  const noteRef = useRef(initialNote)

  // Debounce save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (note !== noteRef.current) {
        onUpdate(sessionId, note)
        noteRef.current = note
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [note, sessionId, onUpdate])

  return (
    <Card className="bg-background/40 backdrop-blur border shadow-sm flex-1 flex flex-col">
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-sm font-medium text-muted-foreground">Session Notes</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <textarea
          className="w-full h-full min-h-[150px] p-4 bg-transparent resize-none focus:outline-none text-sm leading-relaxed"
          placeholder="Jot down quick thoughts here. Auto-saved."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </CardContent>
    </Card>
  )
}

// ==========================================
// No Active Session / Start Screen
// ==========================================

function NoActiveSession({ onStartSession, isLoading }: { onStartSession: () => void, isLoading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center space-y-8 animate-in fade-in duration-500">
      <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
        <Target className="w-12 h-12 text-primary" />
      </div>

      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Ready to Focus?</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Eliminate distractions. Single-tasking is the superpower. <br />
          We've queued up your next priority.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <Button
          size="lg"
          className="w-full h-14 text-lg rounded-xl shadow-lg shadow-primary/20"
          onClick={onStartSession}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Play className="w-5 h-5 mr-2" />
          )}
          Start Session
        </Button>

        <div className="pt-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link to="/today-plan" className="hover:text-foreground transition-colors flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back to Plan
          </Link>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// Complete Dialog
// ==========================================

function SessionComplete({ taskTitle, onDone, onPartial }: any) {
  return (
    <div className="max-w-md w-full mx-auto text-center animate-in zoom-in-95 duration-300">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-8">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>

      <h2 className="text-3xl font-bold mb-2">Great work!</h2>
      <p className="text-muted-foreground mb-8 text-lg">
        You crushed "{taskTitle}".
      </p>

      <div className="space-y-4 mb-8">
        <Button
          size="lg"
          className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 rounded-xl"
          onClick={onDone}
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Done & Next Task
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full h-14 text-lg rounded-xl"
          onClick={onPartial}
        >
          <Clock className="w-5 h-5 mr-2" />
          Need More Time
        </Button>
      </div>
    </div>
  )
}

// ==========================================
// Main Work Page
// ==========================================

function FocusPage() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showComplete, setShowComplete] = useState(false)
  const [resultNote, setResultNote] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Queries
  const plan = useConvexQuery(api.todayPlan.getTodayPlan, {})
  const dbSession = useConvexQuery(api.todayPlan.getActiveSession, {})

  // Mutations
  const startTimerSession = useMutation(api.todayPlan.startTimerSession)
  const pauseTimerSession = useMutation(api.todayPlan.pauseTimerSession)
  const resumeTimerSession = useMutation(api.todayPlan.resumeTimerSession)
  const endTimerSession = useMutation(api.todayPlan.endTimerSession)
  const updateSessionNote = useMutation(api.todayPlan.updateSessionNote)
  const incrementMomentum = useMutation(api.operatorAI.incrementMomentum)
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
        projectName: (dbSession as any).projectName, // Type assertion for new field
        taskUrl: (dbSession as any).taskUrl,
        resultNote: dbSession.resultNote
      })
      // If we have a note from DB, ensure our local state reflects it for the dialog
      if (dbSession.resultNote) setResultNote(dbSession.resultNote)
    } else if (dbSession === null) {
      setActiveSession(null)
    }
  }, [dbSession])

  // Timer effect
  useEffect(() => {
    if (!activeSession || activeSession.pausedAt) return

    const interval = setInterval(() => {
      const now = Date.now()
      setElapsedSeconds(Math.floor((now - activeSession.startedAt) / 1000))
    }, 1000)
    setElapsedSeconds(Math.floor((Date.now() - activeSession.startedAt) / 1000))
    return () => clearInterval(interval)
  }, [activeSession])

  // Handlers
  const handleStartSession = useCallback(async () => {
    if (!plan) return
    setIsStarting(true)
    try {
      const result = await getWeightedSuggestion({ blockDuration: 25, excludeTaskIds: [] })
      if (!result.task) { setIsStarting(false); return }

      await startTimerSession({
        planId: plan._id,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        taskTitle: result.task.taskTitle,
        mode: 'normal',
        targetDuration: result.task.duration,
      })
      await incrementMomentum({ field: 'blocksStarted' })
    } finally {
      setIsStarting(false)
    }
  }, [plan, getWeightedSuggestion, startTimerSession, incrementMomentum])

  const handlePause = useCallback(async () => {
    if (!activeSession) return
    await pauseTimerSession({ id: activeSession.id })
    setActiveSession(prev => prev ? { ...prev, pausedAt: Date.now() } : null)
  }, [activeSession, pauseTimerSession])

  const handleResume = useCallback(async () => {
    if (!activeSession) return
    await resumeTimerSession({ id: activeSession.id })
    setActiveSession(prev => prev ? { ...prev, pausedAt: undefined } : null)
  }, [activeSession, resumeTimerSession])

  const handleComplete = useCallback(async () => {
    if (!activeSession || !plan) return

    await endTimerSession({
      id: activeSession.id,
      result: 'completed',
      resultNote: resultNote || undefined
    })
    await incrementMomentum({ field: 'blocksCompleted' })
    if (activeSession.mode === 'frog') await incrementMomentum({ field: 'frogCompletions' })
    setCompletedCount(c => c + 1)

    // Fetch Next
    const result = await getWeightedSuggestion({ blockDuration: 25, excludeTaskIds: [activeSession.taskId] })

    if (result.task) {
      await startTimerSession({
        planId: plan._id,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        taskTitle: result.task.taskTitle,
        mode: 'normal',
        targetDuration: result.task.duration,
      })
      await incrementMomentum({ field: 'blocksStarted' })
    } else {
      setActiveSession(null)
    }
    setShowComplete(false)
    setResultNote('')
  }, [activeSession, plan, resultNote, endTimerSession, incrementMomentum, getWeightedSuggestion, startTimerSession])

  const handleSkip = useCallback(async () => {
    if (!activeSession || !plan) return
    await endTimerSession({ id: activeSession.id, result: 'skipped' })
    await incrementMomentum({ field: 'blocksSkipped' })

    const result = await getWeightedSuggestion({ blockDuration: 25, excludeTaskIds: [activeSession.taskId] })
    if (result.task) {
      await startTimerSession({
        planId: plan._id,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        taskTitle: result.task.taskTitle,
        mode: 'normal',
        targetDuration: result.task.duration,
      })
      await incrementMomentum({ field: 'blocksStarted' })
    } else {
      setActiveSession(null)
    }
  }, [activeSession, plan, endTimerSession, incrementMomentum, getWeightedSuggestion, startTimerSession])

  const handlePartial = useCallback(async () => {
    if (!activeSession || !plan) return
    await endTimerSession({
      id: activeSession.id,
      result: 'partial',
      resultNote: resultNote || undefined
    })
    await incrementMomentum({ field: 'blocksPartial' })

    // Check next
    const result = await getWeightedSuggestion({ blockDuration: 25, excludeTaskIds: [activeSession.taskId] })
    if (result.task) {
      await startTimerSession({
        planId: plan._id,
        taskType: result.task.taskType,
        taskId: result.task.taskId,
        taskTitle: result.task.taskTitle,
        mode: 'normal',
        targetDuration: result.task.duration,
      })
      await incrementMomentum({ field: 'blocksStarted' })
    } else {
      setActiveSession(null)
    }
    setShowComplete(false)
    setResultNote('')
  }, [activeSession, plan, resultNote, endTimerSession, incrementMomentum, getWeightedSuggestion, startTimerSession])

  const handleOpenTask = useCallback(() => {
    // Open in new tab explicitly if URL provided
    if (activeSession?.taskUrl) {
      window.open(activeSession.taskUrl, '_blank')
    } else {
      console.log('Open task:', activeSession?.taskId)
    }
  }, [activeSession])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
  }

  // Handle Note Update
  const handleNoteUpdate = useCallback(async (id: Id<"timerSessions">, note: string) => {
    await updateSessionNote({ sessionId: id, note })
    setResultNote(note) // keep local in sync for completion dialog
  }, [updateSessionNote])

  if (!plan) return <FullWidthContent><div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></FullWidthContent>

  return (
    <FullWidthContent>
      <div className="h-full flex flex-col bg-background/50">

        {/* Top Navigation Bar */}
        <header className="flex-none px-6 py-4 flex items-center justify-between border-b bg-background/40 backdrop-blur z-10">
          <div className="flex items-center gap-4">
            <Link to="/today-plan" className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-full hover:bg-muted/50 group flex items-center gap-2">
              <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Exit Focus</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Toggle Fullscreen">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-0">

            {/* Left/Top: Main Focus Area */}
            <div className="lg:col-span-8 relative flex flex-col p-6 lg:p-12 overflow-y-auto">
              <div className="flex-1 flex flex-col justify-center min-h-[400px]">
                {showComplete ? (
                  <SessionComplete
                    taskTitle={activeSession?.taskTitle}
                    onDone={handleComplete}
                    onPartial={handlePartial}
                    resultNote={resultNote}
                    setResultNote={setResultNote}
                  />
                ) : activeSession ? (
                  <FocusHero
                    task={{
                      title: activeSession.taskTitle,
                      type: activeSession.taskType,
                      id: activeSession.taskId,
                      projectName: activeSession.projectName,
                      url: activeSession.taskUrl
                    }}
                    elapsedSeconds={elapsedSeconds}
                    targetMinutes={activeSession.targetDuration}
                    isPaused={!!activeSession.pausedAt}
                    isFrog={activeSession.mode === 'frog'}
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
                  />
                )}
              </div>
            </div>

            {/* Right/Bottom: Context Sidebar */}
            <div className="lg:col-span-4 border-l bg-muted/10 p-6 flex flex-col gap-6 overflow-y-auto">
              <SessionStats completedCount={completedCount} />

              <div className="flex-1 min-h-[200px]">
                <UpNextPanel planId={plan?._id} />
              </div>

              {activeSession && (
                <div className="flex-1 min-h-[150px]">
                  <SessionNotes
                    initialNote={activeSession.resultNote || ''}
                    sessionId={activeSession.id}
                    onUpdate={handleNoteUpdate}
                  />
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </FullWidthContent>
  )
}
