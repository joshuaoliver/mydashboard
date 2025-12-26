import { createFileRoute, Outlet, Link, useLocation } from '@tanstack/react-router'
import { Users, HeartHandshake } from 'lucide-react'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/people')({
  component: PeopleLayout,
})

function PeopleLayout() {
  const location = useLocation()
  const isDateView = location.pathname.includes('/people/dating')

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <nav className="flex gap-4">
            <Link
              to="/people"
              className={cn(
                "flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                !isDateView
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Users className="h-4 w-4" />
              Contacts
            </Link>
            <Link
              to="/people/dating"
              className={cn(
                "flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                isDateView
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <HeartHandshake className="h-4 w-4" />
              Dating
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

