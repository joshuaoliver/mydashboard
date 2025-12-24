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
  MessageSquare,
  Users,
  LogOut,
  Menu,
  FolderKanban,
  Zap,
  Bot,
  FileText,
  MapPin,
  CalendarDays,
  BookOpen,
  Target,
  Play,
  Pause,
  Inbox,
  Sparkles,
} from "lucide-react"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useQuery as useConvexQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { cn } from "~/lib/utils"
import * as React from 'react'

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

interface DashboardLayoutProps {
  children: React.ReactNode
}

// Keyboard shortcuts for navigation
// Only active when no input/textarea is focused
const KEYBOARD_SHORTCUTS: Record<string, { to: string; search?: Record<string, unknown> }> = {
  't': { to: '/' },           // 't' for Today
  'f': { to: '/focus' },      // 'f' for Focus
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
            <SheetContent side="left" className="bg-slate-900 border-slate-700 text-slate-300 w-64">
              <nav className="flex flex-col gap-1 mt-8">
                {/* Main Navigation */}
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
                <Link 
                  to="/focus"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <Target className="h-5 w-5" />
                  Focus
                </Link>
                <Link
                  to="/notes"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <FileText className="h-5 w-5" />
                  Notes
                </Link>
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
                <Link 
                  to="/people"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <Users className="h-5 w-5" />
                  People
                </Link>
                <Link
                  to="/reflect"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <BookOpen className="h-5 w-5" />
                  Reflect
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
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">T</span>oday</span>
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <Link 
                    to="/focus" 
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                      "text-sm font-medium transition-all",
                      "text-slate-300 hover:text-white hover:bg-slate-800/80",
                      "[&.active]:bg-slate-800 [&.active]:text-white"
                    )}
                    activeProps={{ className: "active" }}
                  >
                    <Target className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">F</span>ocus</span>
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <Link
                    to="/notes"
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                      "text-sm font-medium transition-all",
                      "text-slate-300 hover:text-white hover:bg-slate-800/80",
                      "[&.active]:bg-slate-800 [&.active]:text-white"
                    )}
                    activeProps={{ className: "active" }}
                  >
                    <FileText className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">N</span>otes</span>
                  </Link>
                </NavigationMenuItem>
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
                <NavigationMenuItem>
                  <Link 
                    to="/people" 
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                      "text-sm font-medium transition-all",
                      "text-slate-300 hover:text-white hover:bg-slate-800/80",
                      "[&.active]:bg-slate-800 [&.active]:text-white"
                    )}
                    activeProps={{ className: "active" }}
                  >
                    <Users className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">P</span>eople</span>
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <Link
                    to="/reflect"
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-md",
                      "text-sm font-medium transition-all",
                      "text-slate-300 hover:text-white hover:bg-slate-800/80",
                      "[&.active]:bg-slate-800 [&.active]:text-white"
                    )}
                    activeProps={{ className: "active" }}
                  >
                    <BookOpen className="h-4 w-4" />
                    <span><span className="underline decoration-slate-500">R</span>eflect</span>
                  </Link>
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

          {/* Right side - Active session timer + Theme toggle + User menu */}
          <div className="flex items-center gap-2">
            <ActiveSessionTimer />
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
