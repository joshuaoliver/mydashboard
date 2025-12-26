import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Settings,
  User,
  Users,
  LogOut,
  Menu,
  FolderKanban,
  Zap,
  Bot,
  FileText,
  CalendarDays,
  BookOpen,
  Target,
  Play,
  Pause,
  Inbox,
  Sparkles,
  HeartHandshake,
  BarChart3,
  ListTodo,
  Timer,
  Mic,
  MicOff,
  Loader2,
} from "lucide-react"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useQuery as useConvexQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { cn } from "~/lib/utils"
import * as React from 'react'
import { toast } from 'sonner'

// ==========================================
// Active Session Timer Component
// ==========================================

function formatTimerDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function ActiveSessionTimer() {
  const navigate = useNavigate()
  const dbSession = useConvexQuery(api.todayPlan.getActiveSession, {})
  
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0)

  // Timer effect
  React.useEffect(() => {
    if (!dbSession || !dbSession.isActive || dbSession.pausedAt) return

    // Calculate initial elapsed
    setElapsedSeconds(Math.floor((Date.now() - dbSession.startedAt) / 1000))

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - dbSession.startedAt) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [dbSession])

  // Don't render if no active session
  if (!dbSession || !dbSession.isActive) return null

  const progress = Math.min(100, (elapsedSeconds / (dbSession.targetDuration * 60)) * 100)
  const isPaused = !!dbSession.pausedAt

  return (
    <button
      onClick={() => navigate({ to: '/focus' })}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all",
        "bg-primary/20 hover:bg-primary/30 border border-primary/30",
        dbSession.mode === 'frog' && "bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30"
      )}
    >
      {/* Status icon */}
      {isPaused ? (
        <Pause className="w-3.5 h-3.5 text-amber-400" />
      ) : (
        <Play className="w-3.5 h-3.5 text-green-400 animate-pulse" />
      )}
      
      {/* Timer display */}
      <span className={cn(
        "font-mono text-sm font-semibold tabular-nums",
        "text-white"
      )}>
        {formatTimerDisplay(elapsedSeconds)}
      </span>
      
      {/* Progress bar (tiny) */}
      <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-1000",
            dbSession.mode === 'frog' ? "bg-amber-400" : "bg-primary"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Frog indicator */}
      {dbSession.mode === 'frog' && (
        <span className="text-sm">🐸</span>
      )}
      
      {/* Task title (truncated) */}
      <span className="text-xs text-slate-300 max-w-[100px] truncate hidden xl:inline">
        {dbSession.taskTitle}
      </span>
    </button>
  )
}

// ==========================================
// Audio Record Button Component
// ==========================================

function AudioRecordButton() {
  const navigate = useNavigate()
  const [isRecording, setIsRecording] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [mediaRecorder, setMediaRecorder] = React.useState<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const streamRef = React.useRef<MediaStream | null>(null)
  const acknowledgedRef = React.useRef<Set<string>>(new Set())

  const generateUploadUrl = useMutation(api.voiceNotes.generateUploadUrl)
  const startChatFromRecording = useMutation(api.voiceNotes.startChatFromRecording)
  const acknowledgeTranscription = useMutation(api.voiceNotes.acknowledgeTranscription)
  const pendingTranscriptions = useConvexQuery(api.voiceNotes.getPendingTranscriptions)

  // Watch for completed/failed transcriptions and show toasts
  React.useEffect(() => {
    if (!pendingTranscriptions) return

    for (const t of pendingTranscriptions) {
      const id = t._id.toString()

      // Skip if we've already shown a toast for this one
      if (acknowledgedRef.current.has(id)) continue

      if (t.status === 'completed' && t.threadId) {
        acknowledgedRef.current.add(id)
        toast.success('Voice note transcribed!', {
          description: t.transcription?.slice(0, 60) + (t.transcription && t.transcription.length > 60 ? '...' : ''),
          action: {
            label: 'View Chat',
            onClick: () => {
              navigate({ to: '/chat', search: { threadId: t.threadId } })
            },
          },
          duration: 10000,
        })
        // Clean up the record
        acknowledgeTranscription({ transcriptionId: t._id })
      } else if (t.status === 'failed') {
        acknowledgedRef.current.add(id)
        toast.error('Transcription failed', {
          description: t.errorMessage || 'Unknown error occurred',
          duration: 5000,
        })
        // Clean up the record
        acknowledgeTranscription({ transcriptionId: t._id })
      }
    }
  }, [pendingTranscriptions, navigate, acknowledgeTranscription])

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async () => {
        setIsProcessing(true)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        try {
          // Upload the audio to Convex storage
          const uploadUrl = await generateUploadUrl()
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'audio/webm' },
            body: blob,
          })

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload audio')
          }

          const { storageId } = await uploadResponse.json()

          // Start the transcription and chat creation in background
          await startChatFromRecording({ storageId })

          // Show toast that transcription is in progress
          toast.info('Transcribing voice note...', {
            description: 'A new chat will be created when ready',
            duration: 3000,
          })
        } catch (err) {
          console.error('Error processing recording:', err)
          toast.error('Failed to process recording', {
            description: 'Please try again',
          })
        }

        setIsProcessing(false)
        setMediaRecorder(null)
        chunksRef.current = []
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      toast.error('Microphone access denied', {
        description: 'Please grant microphone permission to record',
      })
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }

  const handleClick = () => {
    if (isRecording) {
      handleStopRecording()
    } else {
      handleStartRecording()
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isProcessing}
      className={cn(
        "text-slate-300 hover:text-white hover:bg-slate-800/80 h-9 w-9 p-0",
        isRecording && "text-red-400 hover:text-red-300 animate-pulse"
      )}
      title={isRecording ? "Stop recording" : "Start voice note (transcribes and creates chat)"}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  )
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

// Keyboard shortcuts for navigation
// Only active when no input/textarea is focused
const KEYBOARD_SHORTCUTS: Record<string, { to: string; search?: Record<string, unknown> }> = {
  'd': { to: '/' },           // 'd' for Dashboard
  't': { to: '/today-plan' }, // 't' for Today's Plan
  'f': { to: '/today-plan' }, // 'f' for Focus (Today's Plan)
  'n': { to: '/notes' },      // 'n' for Notes
  'a': { to: '/chat' },       // 'a' for AI/Agent chat
  'i': { to: '/inbox', search: { chatId: undefined } },  // 'i' for Inbox
  'p': { to: '/people' },     // 'p' for People
  'r': { to: '/reflect' },    // 'r' for Reflect
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  // Global keyboard shortcuts for navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      ) {
        return
      }

      // Don't trigger if modifier keys are held (except shift for uppercase)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }

      const key = e.key.toLowerCase()
      const shortcut = KEYBOARD_SHORTCUTS[key]
      
      if (shortcut) {
        e.preventDefault()
        navigate({ to: shortcut.to, search: shortcut.search as never })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/sign-in' })
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700/50 flex-shrink-0">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Mobile menu button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="lg:hidden text-slate-300 hover:text-white hover:bg-slate-800/80 h-9 w-9 p-0"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-slate-900 border-slate-700 text-slate-300 w-72 overflow-y-auto">
              <nav className="flex flex-col gap-1 mt-8">
                {/* Today */}
                <Link 
                  to="/" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <CalendarDays className="h-5 w-5" />
                  Today
                </Link>

                {/* Chat (second position) */}
                <Link
                  to="/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <Sparkles className="h-5 w-5" />
                  Chat
                </Link>

                {/* Focus Section */}
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mt-2">
                  Focus
                </div>
                <Link 
                  to="/focus"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-md ml-2",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <Timer className="h-4 w-4" />
                  Focus Timer
                </Link>
                <Link 
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-md ml-2",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <ListTodo className="h-4 w-4" />
                  Today's Plan
                </Link>

                {/* Notes */}
                <Link
                  to="/notes"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md mt-2",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <FileText className="h-5 w-5" />
                  Notes
                </Link>

                {/* Inbox */}
                <Link
                  to="/inbox"
                  search={{ chatId: undefined }}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <Inbox className="h-5 w-5" />
                  Inbox
                </Link>

                {/* People Section */}
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mt-2">
                  People
                </div>
                <Link 
                  to="/people"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-md ml-2",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <Users className="h-4 w-4" />
                  Contacts
                </Link>
                <Link 
                  to="/people/dating"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-md ml-2",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <HeartHandshake className="h-4 w-4" />
                  Dating
                </Link>

                {/* Reflect Section */}
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mt-2">
                  Reflect
                </div>
                <Link
                  to="/reflect"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-md ml-2",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <BookOpen className="h-4 w-4" />
                  Summaries
                </Link>
                <Link
                  to="/reflect/stats"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-md ml-2",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <BarChart3 className="h-4 w-4" />
                  Stats
                </Link>

                {/* Settings Section */}
                <div className="border-t border-slate-700 pt-4 mt-4">
                  <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Settings
                  </div>
                  <Link 
                    to="/settings/integrations"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
                  >
                    <Zap className="h-5 w-5" />
                    Integrations
                  </Link>
                  <Link 
                    to="/settings/projects"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
                  >
                    <FolderKanban className="h-5 w-5" />
                    Projects
                  </Link>
                  <Link 
                    to="/settings/ai"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
                  >
                    <Bot className="h-5 w-5" />
                    AI Settings
                  </Link>
                  <Link 
                    to="/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
                  >
                    <Settings className="h-5 w-5" />
                    General
                  </Link>
                </div>

                {/* Sign Out */}
                <div className="border-t border-slate-700 pt-4 mt-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleSignOut()
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-base text-red-400 hover:text-red-300 hover:bg-slate-800/80 transition-all w-full text-left"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign out
                  </button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Desktop nav - hidden on mobile */}
          <div className="hidden lg:flex items-center gap-1">
            <NavigationMenu viewport={false}>
              <NavigationMenuList className="gap-1">
                {/* Home/Dashboard - direct link */}
                <NavigationMenuItem>
                  <Link
                    to="/"
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                      "text-sm font-medium transition-all",
                      "text-slate-300 hover:text-white hover:bg-slate-800/80",
                      "[&.active]:bg-slate-800 [&.active]:text-white"
                    )}
                    activeProps={{ className: "active" }}
                    activeOptions={{ exact: true }}
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">D</span>ashboard</span>
                  </Link>
                </NavigationMenuItem>

                {/* Chat - direct link (second position) */}
                <NavigationMenuItem>
                  <Link
                    to="/chat"
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                      "text-sm font-medium transition-all",
                      "text-slate-300 hover:text-white hover:bg-slate-800/80",
                      "[&.active]:bg-slate-800 [&.active]:text-white"
                    )}
                    activeProps={{ className: "active" }}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Ch<span className="underline decoration-slate-500">a</span>t</span>
                  </Link>
                </NavigationMenuItem>

                {/* Focus - dropdown with Plan access */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80 data-[state=open]:bg-slate-800 data-[state=open]:text-white",
                    "bg-transparent"
                  )}>
                    <Target className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">F</span>ocus</span>
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="z-[100]">
                    <ul className="grid w-[180px] gap-1 p-2">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/today-plan" className="w-full">
                            <ListTodo className="h-4 w-4 flex-shrink-0" />
                            <span>Today's Plan</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/focus" className="w-full">
                            <Timer className="h-4 w-4 flex-shrink-0" />
                            <span>Focus Timer</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Notes - dropdown with Notes and Todos */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80 data-[state=open]:bg-slate-800 data-[state=open]:text-white",
                    "bg-transparent"
                  )}>
                    <FileText className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">N</span>otes</span>
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="z-[100]">
                    <ul className="grid w-[180px] gap-1 p-2">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/notes" className="w-full">
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <span>Notes</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/todos" className="w-full">
                            <ListTodo className="h-4 w-4 flex-shrink-0" />
                            <span>Todos</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Inbox - direct link */}
                <NavigationMenuItem>
                  <Link
                    to="/inbox"
                    search={{ chatId: undefined }}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                      "text-sm font-medium transition-all",
                      "text-slate-300 hover:text-white hover:bg-slate-800/80",
                      "[&.active]:bg-slate-800 [&.active]:text-white"
                    )}
                    activeProps={{ className: "active" }}
                  >
                    <Inbox className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">I</span>nbox</span>
                  </Link>
                </NavigationMenuItem>

                {/* People - dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80 data-[state=open]:bg-slate-800 data-[state=open]:text-white",
                    "bg-transparent"
                  )}>
                    <Users className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">P</span>eople</span>
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="z-[100]">
                    <ul className="grid w-[180px] gap-1 p-2">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/people" className="w-full">
                            <Users className="h-4 w-4 flex-shrink-0" />
                            <span>Contacts</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/people/dating" className="w-full">
                            <HeartHandshake className="h-4 w-4 flex-shrink-0" />
                            <span>Dating</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Reflect - dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80 data-[state=open]:bg-slate-800 data-[state=open]:text-white",
                    "bg-transparent"
                  )}>
                    <BookOpen className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">R</span>eflect</span>
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="z-[100]">
                    <ul className="grid w-[180px] gap-1 p-2">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/reflect" className="w-full">
                            <BookOpen className="h-4 w-4 flex-shrink-0" />
                            <span>Summaries</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/reflect/stats" className="w-full">
                            <BarChart3 className="h-4 w-4 flex-shrink-0" />
                            <span>Stats</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80 data-[state=open]:bg-slate-800 data-[state=open]:text-white",
                    "bg-transparent"
                  )}>
                    <Settings className="h-4 w-4" />
                    Settings
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="z-[100]">
                    <ul className="grid w-[200px] gap-1 p-2">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/settings/integrations" className="w-full">
                            <Zap className="h-4 w-4 flex-shrink-0" />
                            <span>Integrations</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/settings/projects" className="w-full">
                            <FolderKanban className="h-4 w-4 flex-shrink-0" />
                            <span>Projects</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/settings/ai" className="w-full">
                            <Bot className="h-4 w-4 flex-shrink-0" />
                            <span>AI Settings</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/settings" className="w-full">
                            <Settings className="h-4 w-4 flex-shrink-0" />
                            <span>General</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Center - App title (mobile only) */}
          <div className="lg:hidden flex-1 text-center">
            <h1 className="text-lg font-semibold text-white">Dashboard</h1>
          </div>

          {/* Right side - Active session timer + Audio record + Theme toggle + User menu */}
          <div className="flex items-center gap-2">
            <ActiveSessionTimer />
            <AudioRecordButton />
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-slate-300 hover:text-white hover:bg-slate-800/80 h-9 w-9 p-0"
                >
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                <DropdownMenuLabel className="text-slate-300">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem asChild className="lg:flex hidden">
                  <Link to="/settings" className="flex items-center cursor-pointer text-slate-300 hover:text-white focus:text-white focus:bg-slate-700">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700 lg:flex hidden" />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-slate-700"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
