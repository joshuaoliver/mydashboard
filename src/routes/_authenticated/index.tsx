import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery as useConvexQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullWidthContent } from '@/components/layout/full-width-content'
import {
  Target,
  Inbox,
  FileText,
  Users,
  Calendar,
  TrendingUp,
  Play,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})

function DashboardPage() {
  // Quick stats queries
  const activeSession = useConvexQuery(api.todayPlan.getActiveSession, {})
  const momentum = useConvexQuery(api.operatorAI.getTodayMomentum, {})

  const quickLinks = [
    {
      title: 'Focus',
      description: 'Start a focus session',
      icon: Target,
      href: '/focus',
      color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/30',
    },
    {
      title: "Today's Plan",
      description: 'Plan your day',
      icon: Calendar,
      href: '/today-plan',
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30',
    },
    {
      title: 'Inbox',
      description: 'Messages to reply',
      icon: Inbox,
      href: '/inbox',
      color: 'text-green-500 bg-green-50 dark:bg-green-950/30',
    },
    {
      title: 'Notes',
      description: 'Your notes & todos',
      icon: FileText,
      href: '/notes',
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30',
    },
    {
      title: 'People',
      description: 'Manage contacts',
      icon: Users,
      href: '/people',
      color: 'text-pink-500 bg-pink-50 dark:bg-pink-950/30',
    },
    {
      title: 'Stats',
      description: 'View analytics',
      icon: TrendingUp,
      href: '/reflect/stats',
      color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30',
    },
  ]

  return (
    <FullWidthContent>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back. Here's your command center.
          </p>
        </div>

        {/* Active Session Banner */}
        {(() => {
          // Don't show if session doesn't exist or isn't active
          if (!activeSession?.isActive) return null
          
          // Treat sessions older than 24 hours as stale (safety net)
          const isStale = (Date.now() - activeSession.startedAt) > 24 * 60 * 60 * 1000
          if (isStale) return null
          
          return (
            <Card className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Play className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Active Focus Session</p>
                      <p className="text-sm text-muted-foreground">
                        {activeSession.taskTitle}
                      </p>
                    </div>
                  </div>
                  <Link to="/focus">
                    <Button>Continue Session</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })()}

        {/* Quick Stats */}
        {momentum && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-2xl font-bold">{momentum.blocksCompleted}</span>
                </div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-blue-500" />
                  <span className="text-2xl font-bold">{momentum.blocksStarted}</span>
                </div>
                <p className="text-xs text-muted-foreground">Started</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-amber-500" />
                  <span className="text-2xl font-bold">{momentum.frogCompletions}/{momentum.frogAttempts}</span>
                </div>
                <p className="text-xs text-muted-foreground">Frogs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold mb-1">
                  {momentum.totalMinutesWorked}m
                </div>
                <p className="text-xs text-muted-foreground">Worked</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.href} to={link.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${link.color}`}>
                    <link.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg mb-1">{link.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </FullWidthContent>
  )
}
