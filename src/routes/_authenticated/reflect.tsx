import { createFileRoute, Outlet, Link, useLocation } from '@tanstack/react-router'
import { BookOpen, BarChart3 } from 'lucide-react'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/reflect')({
  component: ReflectLayout,
})

function ReflectLayout() {
  const location = useLocation()
  const isStatsView = location.pathname.includes('/reflect/stats')

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <nav className="flex gap-4">
            <Link
              to="/reflect"
              className={cn(
                "flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                !isStatsView
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <BookOpen className="h-4 w-4" />
              Summaries
            </Link>
            <Link
              to="/reflect/stats"
              className={cn(
                "flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                isStatsView
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <BarChart3 className="h-4 w-4" />
              Stats
            </Link>
          </nav>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}

